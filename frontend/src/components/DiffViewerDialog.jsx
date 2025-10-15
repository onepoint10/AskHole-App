import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Copy, Loader2, GitCompare, Check } from 'lucide-react';
import { parseDiff, Diff, Hunk } from 'react-diff-view';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const DiffViewerDialog = ({
    isOpen,
    onClose,
    fromVersion,
    toVersion,
    diffText,
    isLoading = false
}) => {
    const { t } = useTranslation();
    const [viewType, setViewType] = useState('split'); // 'split' or 'unified'
    const [copied, setCopied] = useState(false);

    // Reset state when dialog closes
    useEffect(() => {
        if (!isOpen) {
            setViewType('split');
            setCopied(false);
        }
    }, [isOpen]);

    const handleCopy = async () => {
        if (!diffText) return;

        try {
            await navigator.clipboard.writeText(diffText);
            setCopied(true);
            toast.success('Diff copied to clipboard');

            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
            toast.error('Failed to copy to clipboard');
        }
    };

    const handleClose = () => {
        if (!isLoading && onClose) {
            onClose();
        }
    };

    // Parse diff
    let parsedDiff = [];
    let addedLines = 0;
    let deletedLines = 0;
    let parseError = null;

    if (diffText && !diffText.includes('No differences')) {
        try {
            const files = parseDiff(diffText);
            parsedDiff = files;

            console.log('Parsed diff files:', files);
            console.log('Number of files:', files.length);
            if (files.length > 0) {
                console.log('First file hunks:', files[0].hunks);
                console.log('Number of hunks:', files[0].hunks?.length);
            }

            // Calculate stats
            files.forEach(file => {
                if (file.hunks && Array.isArray(file.hunks)) {
                    file.hunks.forEach(hunk => {
                        if (hunk.changes && Array.isArray(hunk.changes)) {
                            hunk.changes.forEach(change => {
                                if (change.type === 'insert') addedLines++;
                                if (change.type === 'delete') deletedLines++;
                            });
                        }
                    });
                }
            });
        } catch (error) {
            console.error('Failed to parse diff:', error);
            parseError = error.message;
        }
    }

    const fromHash = fromVersion?.commit_hash?.substring(0, 7) || '...';
    const toHash = toVersion?.commit_hash?.substring(0, 7) || '...';

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-5xl max-h-[90vh] !flex !flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <GitCompare className="h-5 w-5" />
                        Compare Versions
                    </DialogTitle>
                    <DialogDescription className="flex items-center gap-2 font-mono text-xs">
                        <span className="bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 px-2 py-0.5 rounded">
                            {fromHash}
                        </span>
                        <span>→</span>
                        <span className="bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-300 px-2 py-0.5 rounded">
                            {toHash}
                        </span>
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-muted-foreground">Loading diff...</span>
                    </div>
                ) : diffText && parsedDiff.length > 0 ? (
                    <>
                        {/* Stats and Controls */}
                        <div className="flex items-center justify-between pb-4 border-b">
                            <div className="flex items-center gap-3">
                                <Badge variant="outline" className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
                                    +{addedLines} added
                                </Badge>
                                <Badge variant="outline" className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800">
                                    -{deletedLines} deleted
                                </Badge>
                            </div>

                            <div className="flex items-center gap-2">
                                <Tabs value={viewType} onValueChange={setViewType} className="w-auto">
                                    <TabsList className="h-9">
                                        <TabsTrigger value="split" className="text-xs">Split View</TabsTrigger>
                                        <TabsTrigger value="unified" className="text-xs">Unified View</TabsTrigger>
                                    </TabsList>
                                </Tabs>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCopy}
                                    className="h-9"
                                >
                                    {copied ? (
                                        <>
                                            <Check className="h-4 w-4 mr-1 text-green-600" />
                                            Copied
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="h-4 w-4 mr-1" />
                                            Copy
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* Diff Display */}
                        <ScrollArea className="flex-1 h-0">
                            <div className="py-4" style={{ fontSize: '12px' }}>
                                {parsedDiff.map((file, idx) => (
                                    <div key={idx} className="mb-4 border rounded-lg overflow-hidden">
                                        {/* File header */}
                                        <div className="bg-muted px-3 py-2 text-xs font-mono border-b">
                                            {file.oldPath}
                                        </div>

                                        {/* Diff content - using standard react-diff-view styles */}
                                        <Diff
                                            viewType={viewType}
                                            diffType={file.type}
                                            hunks={file.hunks}
                                        >
                                            {(hunks) => hunks.map(hunk => <Hunk key={hunk.content} hunk={hunk} />)}
                                        </Diff>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </>
                ) : diffText && diffText.includes('No differences') ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Check className="h-12 w-12 mb-2" />
                        <p className="text-lg font-medium">No Differences Found</p>
                        <p className="text-sm">The selected versions have identical content</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <GitCompare className="h-12 w-12 mb-2" />
                        <p className="text-lg font-medium">No Diff Available</p>
                        <p className="text-sm">Unable to load diff for these versions</p>
                    </div>
                )}

                <div className="flex justify-end pt-4 border-t">
                    <Button variant="outline" onClick={handleClose}>
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default DiffViewerDialog;
