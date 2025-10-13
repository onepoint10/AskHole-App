import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { workflowAPI } from '../services/api';
import { 
  History, 
  GitCommit,
  RotateCcw,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

const PromptVersionHistory = ({ promptId, open, onClose }) => {
  const { t, i18n } = useTranslation();
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');

  useEffect(() => {
    if (open && promptId) {
      loadVersions();
    }
  }, [open, promptId]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const response = await workflowAPI.getPromptVersions(promptId, i18n.language);
      setVersions(response.data || []);
    } catch (error) {
      console.error('Failed to load versions:', error);
      toast.error(t('failed_to_load_versions') || 'Failed to load version history');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVersion = async () => {
    if (!commitMessage.trim()) {
      toast.error(t('commit_message_required') || 'Commit message is required');
      return;
    }

    try {
      await workflowAPI.createPromptVersion(promptId, { commit_message: commitMessage }, i18n.language);
      toast.success(t('version_created') || 'Version created successfully');
      setShowCommitDialog(false);
      setCommitMessage('');
      loadVersions();
    } catch (error) {
      console.error('Failed to create version:', error);
      toast.error(t('failed_to_create_version') || 'Failed to create version');
    }
  };

  const handleRestoreVersion = async (versionId) => {
    if (!confirm(t('confirm_restore_version') || 'Are you sure you want to restore this version?')) {
      return;
    }

    try {
      await workflowAPI.restorePromptVersion(promptId, versionId, i18n.language);
      toast.success(t('version_restored') || 'Version restored successfully');
      onClose();
    } catch (error) {
      console.error('Failed to restore version:', error);
      toast.error(t('failed_to_restore_version') || 'Failed to restore version');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString(i18n.language);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              {t('version_history') || 'Version History'}
            </DialogTitle>
            <DialogDescription>
              {t('version_history_description') || 'View and restore previous versions of this prompt'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex justify-between items-center mb-4">
            <div className="text-sm text-gray-500">
              {versions.length} {t('versions') || 'versions'}
            </div>
            <Button
              onClick={() => setShowCommitDialog(true)}
              size="sm"
              className="gap-2"
            >
              <GitCommit className="h-4 w-4" />
              {t('create_version') || 'Create Version'}
            </Button>
          </div>

          <div className="overflow-y-auto max-h-96">
            {loading ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : versions.length === 0 ? (
              <div className="text-center py-8">
                <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">
                  {t('no_versions') || 'No version history yet'}
                </p>
                <Button
                  onClick={() => setShowCommitDialog(true)}
                  variant="outline"
                  className="gap-2"
                >
                  <GitCommit className="h-4 w-4" />
                  {t('create_first_version') || 'Create your first version'}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {versions.map((version) => (
                  <div
                    key={version.id}
                    className="border rounded-lg p-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <GitCommit className="h-4 w-4 text-blue-600" />
                        <span className="font-semibold text-sm">
                          v{version.version_number}
                        </span>
                        {version.version_number === 1 && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                            {t('initial') || 'Initial'}
                          </span>
                        )}
                      </div>
                      <Button
                        onClick={() => handleRestoreVersion(version.id)}
                        size="sm"
                        variant="outline"
                        className="gap-1"
                      >
                        <RotateCcw className="h-3 w-3" />
                        {t('restore') || 'Restore'}
                      </Button>
                    </div>
                    
                    <p className="text-sm mb-2">{version.commit_message}</p>
                    
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="h-3 w-3" />
                      <span>{formatDate(version.created_at)}</span>
                    </div>

                    {version.title && (
                      <div className="mt-2 pt-2 border-t">
                        <div className="text-xs text-gray-500 mb-1">
                          {t('title') || 'Title'}: {version.title}
                        </div>
                        <div className="text-xs text-gray-400 line-clamp-2">
                          {version.content}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              {t('close') || 'Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Version Dialog */}
      <Dialog open={showCommitDialog} onOpenChange={setShowCommitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('create_version') || 'Create Version'}</DialogTitle>
            <DialogDescription>
              {t('create_version_description') || 'Create a new version with a commit message'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">
              {t('commit_message') || 'Commit Message'}
            </label>
            <Input
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder={t('commit_message_placeholder') || 'Describe your changes...'}
            />
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCommitDialog(false)}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button onClick={handleCreateVersion}>
              {t('create') || 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PromptVersionHistory;
