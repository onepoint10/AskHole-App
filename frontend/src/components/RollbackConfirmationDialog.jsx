import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Clock, User, GitBranch } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useTranslation } from 'react-i18next';

const RollbackConfirmationDialog = ({
    isOpen,
    onClose,
    onConfirm,
    targetVersion,
    isLoading = false
}) => {
    const { t } = useTranslation();
    const [commitMessage, setCommitMessage] = useState('');

    // Set default commit message when dialog opens
    useEffect(() => {
        if (isOpen && targetVersion) {
            const shortHash = targetVersion.commit_hash?.substring(0, 7) || 'unknown';
            setCommitMessage(`Rolled back to version ${shortHash}`);
        }
    }, [isOpen, targetVersion]);

    // Reset state when dialog closes
    useEffect(() => {
        if (!isOpen) {
            setCommitMessage('');
        }
    }, [isOpen]);

    const handleConfirm = () => {
        if (commitMessage.trim() && onConfirm) {
            onConfirm(commitMessage.trim());
        }
    };

    const handleClose = () => {
        if (!isLoading && onClose) {
            onClose();
        }
    };

    if (!targetVersion) return null;

    const shortHash = targetVersion.commit_hash?.substring(0, 7) || 'unknown';
    const formattedDate = targetVersion.date
        ? formatDistanceToNow(new Date(targetVersion.date), { addSuffix: true })
        : 'Unknown date';

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
                        Confirm Rollback
                    </DialogTitle>
                    <DialogDescription>
                        You are about to rollback this prompt to a previous version.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Target Version Info */}
                    <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                        <h4 className="text-sm font-semibold mb-2">Target Version</h4>

                        <div className="flex items-center gap-2 text-sm">
                            <GitBranch className="h-4 w-4 text-muted-foreground" />
                            <span className="font-mono text-xs bg-background px-2 py-0.5 rounded">
                                {shortHash}
                            </span>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-4 w-4" />
                            <span>{targetVersion.author || 'Unknown'}</span>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>{formattedDate}</span>
                        </div>

                        {targetVersion.message && (
                            <div className="pt-2 border-t">
                                <p className="text-sm italic text-muted-foreground">
                                    "{targetVersion.message}"
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Warning Alert */}
                    <Alert>
                        <AlertDescription className="text-sm">
                            <strong>Important:</strong> This action will create a new commit with the content
                            from the selected version. The version history will be preserved - no commits will
                            be deleted.
                        </AlertDescription>
                    </Alert>

                    {/* Commit Message Input */}
                    <div className="space-y-2">
                        <Label htmlFor="commit-message">
                            Commit Message
                            <span className="text-red-500 ml-1">*</span>
                        </Label>
                        <Input
                            id="commit-message"
                            value={commitMessage}
                            onChange={(e) => setCommitMessage(e.target.value)}
                            placeholder="Enter a commit message..."
                            disabled={isLoading}
                            className="font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                            Describe why you're rolling back to this version
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!commitMessage.trim() || isLoading}
                        className="bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-600 dark:hover:bg-yellow-700"
                    >
                        {isLoading ? (
                            <>
                                <span className="animate-spin mr-2">⏳</span>
                                Rolling Back...
                            </>
                        ) : (
                            'Confirm Rollback'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default RollbackConfirmationDialog;
