import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Eye,
    GitCompare,
    RotateCcw,
    Clock,
    User,
    GitBranch,
    AlertCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { promptsAPI } from '@/services/api';
import { useTranslation } from 'react-i18next';
import DiffViewerDialog from './DiffViewerDialog';
import RollbackConfirmationDialog from './RollbackConfirmationDialog';

const VersionHistoryPanel = ({
    promptId,
    currentCommit,
    onVersionUpdate
}) => {
    const { t, i18n } = useTranslation();
    const [versions, setVersions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Diff viewer state
    const [isDiffDialogOpen, setIsDiffDialogOpen] = useState(false);
    const [diffData, setDiffData] = useState(null);
    const [isLoadingDiff, setIsLoadingDiff] = useState(false);

    // Rollback state
    const [isRollbackDialogOpen, setIsRollbackDialogOpen] = useState(false);
    const [selectedVersionForRollback, setSelectedVersionForRollback] = useState(null);
    const [isRollingBack, setIsRollingBack] = useState(false);

    // Fetch version history when panel opens
    useEffect(() => {
        console.log('VersionHistoryPanel mounted/updated:', {
            promptId,
            currentCommit,
            hasOnVersionUpdate: !!onVersionUpdate
        });

        if (promptId) {
            fetchVersionHistory();
        } else {
            console.log('No promptId provided, skipping fetch');
        }
    }, [promptId]);

    const fetchVersionHistory = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await promptsAPI.getVersionHistory(promptId, i18n.language);
            console.log('Version history response:', response);
            console.log('Response.data:', response.data);
            console.log('Versions array:', response.data?.versions);
            console.log('Is array?:', Array.isArray(response.data?.versions));

            if (response.data?.versions && Array.isArray(response.data.versions)) {
                console.log('Setting versions:', response.data.versions.length, 'items');
                setVersions(response.data.versions);
            } else {
                console.log('No versions found or not an array');
                setVersions([]);
            }
        } catch (err) {
            console.error('Failed to fetch version history:', err);
            setError(err.message || 'Failed to load version history');
            toast.error('Failed to load version history');
            setVersions([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleViewVersion = async (version) => {
        try {
            const response = await promptsAPI.getVersionContent(
                promptId,
                version.commit_hash,
                i18n.language
            );

            // Show content in a dialog or modal
            toast.success(`Viewing version ${version.commit_hash.substring(0, 7)}`, {
                description: `${response.data.content.substring(0, 100)}...`,
                duration: 5000,
            });
        } catch (err) {
            console.error('Failed to view version:', err);
            toast.error('Failed to load version content');
        }
    };

    const handleCompare = async (version) => {
        // Find the version to compare with
        // Priority: 1) currentCommit prop, 2) most recent version (first in list), 3) next newer version
        let compareWithCommit = currentCommit;
        let compareWithVersion = null;

        if (!compareWithCommit && versions.length > 0) {
            // Use the most recent version (first in the list) as the comparison target
            compareWithCommit = versions[0].commit_hash;
            compareWithVersion = versions[0];
        }

        if (!compareWithCommit) {
            toast.error('No version to compare with');
            return;
        }

        // Don't compare a version with itself
        if (version.commit_hash === compareWithCommit) {
            toast.error('Cannot compare a version with itself. Please select a different version.');
            return;
        }

        setIsLoadingDiff(true);
        setIsDiffDialogOpen(true);

        try {
            const response = await promptsAPI.getDiff(
                promptId,
                version.commit_hash,  // from (older)
                compareWithCommit,     // to (newer/current)
                i18n.language
            );

            if (!compareWithVersion) {
                compareWithVersion = versions.find(v => v.commit_hash === compareWithCommit);
            }

            setDiffData({
                fromVersion: version,
                toVersion: compareWithVersion || { commit_hash: compareWithCommit },
                diffText: response.data.diff
            });
        } catch (err) {
            console.error('Failed to get diff:', err);
            toast.error('Failed to load diff');
            setIsDiffDialogOpen(false);
        } finally {
            setIsLoadingDiff(false);
        }
    };

    const handleRollbackClick = (version) => {
        setSelectedVersionForRollback(version);
        setIsRollbackDialogOpen(true);
    };

    const handleRollbackConfirm = async (commitMessage) => {
        if (!selectedVersionForRollback) return;

        setIsRollingBack(true);

        try {
            const response = await promptsAPI.rollbackPrompt(
                promptId,
                {
                    target_commit: selectedVersionForRollback.commit_hash,
                    commit_message: commitMessage
                },
                i18n.language
            );

            toast.success('Successfully rolled back to previous version', {
                description: `New commit: ${response.data.new_commit?.substring(0, 7) || 'created'}`,
            });

            // Refresh version history
            await fetchVersionHistory();

            // Notify parent to refresh prompt data
            if (onVersionUpdate) {
                onVersionUpdate(response.data.prompt);
            }

            setIsRollbackDialogOpen(false);
            setSelectedVersionForRollback(null);
        } catch (err) {
            console.error('Failed to rollback:', err);
            toast.error(err.message || 'Failed to rollback prompt');
        } finally {
            setIsRollingBack(false);
        }
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="space-y-4 p-4">
                <Skeleton className="h-4 w-48" />
                {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2">
                        <Skeleton className="h-20 w-full" />
                    </div>
                ))}
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Failed to Load Version History</h3>
                <p className="text-sm text-muted-foreground mb-4">{error}</p>
                <Button onClick={fetchVersionHistory} variant="outline" size="sm">
                    Try Again
                </Button>
            </div>
        );
    }

    // Empty state
    if (versions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center">
                <GitBranch className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Version History</h3>
                <p className="text-sm text-muted-foreground">
                    This prompt doesn't have any version history yet.
                </p>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-1">
                <div className="flex items-center justify-between mb-4 px-4 pt-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <GitBranch className="h-5 w-5" />
                        Version History
                    </h3>
                    <Badge variant="secondary">{versions.length} commits</Badge>
                </div>

                <ScrollArea className="h-[500px]">
                    <div className="space-y-3 px-4 pb-4">
                        {versions.map((version, index) => {
                            const shortHash = version.commit_hash.substring(0, 7);
                            const isCurrent = version.commit_hash === currentCommit;
                            const formattedDate = version.date
                                ? formatDistanceToNow(new Date(version.date), { addSuffix: true })
                                : 'Unknown date';

                            return (
                                <div
                                    key={version.commit_hash}
                                    className={`
                    relative border rounded-lg p-4 space-y-3 transition-colors
                    ${isCurrent ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/50'}
                  `}
                                >
                                    {/* Timeline connector */}
                                    {index < versions.length - 1 && (
                                        <div className="absolute left-6 top-[60px] w-0.5 h-[calc(100%+12px)] bg-border" />
                                    )}

                                    {/* Commit Header */}
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2 flex-1">
                                            <div className={`
                        relative z-10 w-4 h-4 rounded-full border-2
                        ${isCurrent
                                                    ? 'border-primary bg-primary'
                                                    : 'border-border bg-background'}
                      `} />

                                            <Badge
                                                variant={isCurrent ? 'default' : 'outline'}
                                                className="font-mono text-xs"
                                            >
                                                {shortHash}
                                            </Badge>

                                            {isCurrent && (
                                                <Badge variant="default" className="text-xs">
                                                    Current
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    {/* Commit Message */}
                                    <div className="ml-6">
                                        <p className="font-medium text-sm leading-relaxed">
                                            {version.message}
                                        </p>
                                    </div>

                                    {/* Commit Metadata */}
                                    <div className="ml-6 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                        <div className="flex items-center gap-1.5">
                                            <User className="h-3.5 w-3.5" />
                                            <span>{version.author}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Clock className="h-3.5 w-3.5" />
                                            <span>{formattedDate}</span>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="ml-6 flex flex-wrap gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleViewVersion(version)}
                                            className="h-8 text-xs"
                                        >
                                            <Eye className="h-3.5 w-3.5 mr-1.5" />
                                            View
                                        </Button>

                                        {!isCurrent && (
                                            <>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleCompare(version)}
                                                    className="h-8 text-xs"
                                                >
                                                    <GitCompare className="h-3.5 w-3.5 mr-1.5" />
                                                    Compare
                                                </Button>

                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleRollbackClick(version)}
                                                    className="h-8 text-xs text-yellow-700 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-300"
                                                >
                                                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                                                    Rollback
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>
            </div>

            {/* Diff Viewer Dialog */}
            {diffData && (
                <DiffViewerDialog
                    isOpen={isDiffDialogOpen}
                    onClose={() => {
                        setIsDiffDialogOpen(false);
                        setDiffData(null);
                    }}
                    fromVersion={diffData.fromVersion}
                    toVersion={diffData.toVersion}
                    diffText={diffData.diffText}
                    isLoading={isLoadingDiff}
                />
            )}

            {/* Rollback Confirmation Dialog */}
            <RollbackConfirmationDialog
                isOpen={isRollbackDialogOpen}
                onClose={() => {
                    setIsRollbackDialogOpen(false);
                    setSelectedVersionForRollback(null);
                }}
                onConfirm={handleRollbackConfirm}
                targetVersion={selectedVersionForRollback}
                isLoading={isRollingBack}
            />
        </>
    );
};

export default VersionHistoryPanel;
