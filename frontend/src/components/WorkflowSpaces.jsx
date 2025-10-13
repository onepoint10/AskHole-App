import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { workflowAPI } from '../services/api';
import { 
  Folder, 
  Plus, 
  Edit, 
  Trash2, 
  Users,
  GitBranch,
  Play
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const WorkflowSpaces = () => {
  const { t, i18n } = useTranslation();
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_public: false
  });

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    setLoading(true);
    try {
      const response = await workflowAPI.getWorkspaces(i18n.language);
      setWorkspaces(response.data || []);
    } catch (error) {
      console.error('Failed to load workspaces:', error);
      toast.error(t('failed_to_load_workspaces') || 'Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkspace = async () => {
    if (!formData.name.trim()) {
      toast.error(t('workspace_name_required') || 'Workspace name is required');
      return;
    }

    try {
      const response = await workflowAPI.createWorkspace(formData, i18n.language);
      setWorkspaces([...workspaces, response.data]);
      setShowCreateDialog(false);
      setFormData({ name: '', description: '', is_public: false });
      toast.success(t('workspace_created') || 'Workspace created successfully');
    } catch (error) {
      console.error('Failed to create workspace:', error);
      toast.error(t('failed_to_create_workspace') || 'Failed to create workspace');
    }
  };

  const handleDeleteWorkspace = async (workspaceId) => {
    if (!confirm(t('confirm_delete_workspace') || 'Are you sure you want to delete this workspace?')) {
      return;
    }

    try {
      await workflowAPI.deleteWorkspace(workspaceId, i18n.language);
      setWorkspaces(workspaces.filter(w => w.id !== workspaceId));
      toast.success(t('workspace_deleted') || 'Workspace deleted successfully');
    } catch (error) {
      console.error('Failed to delete workspace:', error);
      toast.error(t('failed_to_delete_workspace') || 'Failed to delete workspace');
    }
  };

  const handleWorkspaceClick = (workspace) => {
    setSelectedWorkspace(workspace);
    // TODO: Navigate to workspace detail view
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-white p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Folder className="h-5 w-5 text-blue-600" />
            <h1 className="text-lg font-semibold text-gray-700">
              {t('workflow_spaces') || 'Workflow Spaces'}
            </h1>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            size="sm"
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            {t('new_workspace') || 'New Workspace'}
          </Button>
        </div>
      </div>

      {/* Workspace List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : workspaces.length === 0 ? (
          <div className="text-center py-12">
            <Folder className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">
              {t('no_workspaces') || 'No workflow spaces yet'}
            </p>
            <Button
              onClick={() => setShowCreateDialog(true)}
              variant="outline"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              {t('create_first_workspace') || 'Create your first workspace'}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map((workspace) => (
              <div
                key={workspace.id}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleWorkspaceClick(workspace)}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <Folder className="h-5 w-5 text-blue-600" />
                    <h3 className="font-semibold">{workspace.name}</h3>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Edit workspace
                      }}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <Edit className="h-4 w-4 text-gray-500" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteWorkspace(workspace.id);
                      }}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </button>
                  </div>
                </div>
                
                {workspace.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {workspace.description}
                  </p>
                )}
                
                <div className="flex gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    <span>{workspace.member_count || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <GitBranch className="h-3 w-3" />
                    <span>{workspace.prompt_count || 0} prompts</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Play className="h-3 w-3" />
                    <span>{workspace.workflow_count || 0} workflows</span>
                  </div>
                </div>

                {workspace.is_public && (
                  <div className="mt-2">
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      {t('public') || 'Public'}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Workspace Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('create_workspace') || 'Create Workspace'}</DialogTitle>
            <DialogDescription>
              {t('create_workspace_description') || 'Create a new workspace to organize your prompts and workflows'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                {t('name') || 'Name'}
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('workspace_name_placeholder') || 'Enter workspace name'}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">
                {t('description') || 'Description'}
              </label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('workspace_description_placeholder') || 'Enter workspace description'}
                rows={3}
              />
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_public"
                checked={formData.is_public}
                onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="is_public" className="text-sm">
                {t('make_workspace_public') || 'Make workspace public'}
              </label>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button onClick={handleCreateWorkspace}>
              {t('create') || 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkflowSpaces;
