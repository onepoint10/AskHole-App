import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Folders, X } from 'lucide-react';
import { workflowSpacesAPI } from '@/services/api';
import { toast } from 'sonner';
import WorkspaceList from './WorkspaceList';
import WorkspaceDetail from './WorkspaceDetail';
import WorkspaceForm from './WorkspaceForm';

/**
 * WorkflowSpacesSidebar - Right sidebar for managing workflow spaces
 *
 * Provides interface for:
 * - Viewing list of workspaces
 * - Creating new workspaces
 * - Viewing workspace details
 * - Managing workspace members and prompts
 */
export default function WorkflowSpacesSidebar({ isOpen, onClose }) {
    const { t, i18n } = useTranslation();

    // View management: 'list' | 'detail' | 'create' | 'edit'
    const [activeView, setActiveView] = useState('list');
    const [selectedWorkspace, setSelectedWorkspace] = useState(null);
    const [workspaces, setWorkspaces] = useState([]);
    const [loading, setLoading] = useState(false);

    // Load workspaces when sidebar opens
    useEffect(() => {
        if (isOpen) {
            loadWorkspaces();
        }
    }, [isOpen]);

    const loadWorkspaces = async () => {
        setLoading(true);
        try {
            const response = await workflowSpacesAPI.getWorkspaces(i18n.language);
            setWorkspaces(response.data || []);
        } catch (error) {
            console.error('Error loading workspaces:', error);
            toast.error(error.message || t('Failed to load workspaces'));
        } finally {
            setLoading(false);
        }
    };

    const handleCreateWorkspace = () => {
        setSelectedWorkspace(null);
        setActiveView('create');
    };

    const handleEditWorkspace = (workspace) => {
        setSelectedWorkspace(workspace);
        setActiveView('edit');
    };

    const handleViewWorkspace = async (workspace) => {
        try {
            // Load full workspace details
            const response = await workflowSpacesAPI.getWorkspace(workspace.id, i18n.language);
            setSelectedWorkspace(response.data);
            setActiveView('detail');
        } catch (error) {
            console.error('Error loading workspace details:', error);
            toast.error(error.message || t('Failed to load workspace'));
        }
    };

    const handleWorkspaceSaved = async () => {
        await loadWorkspaces();
        setActiveView('list');
        setSelectedWorkspace(null);
    };

    const handleWorkspaceDeleted = async () => {
        await loadWorkspaces();
        setActiveView('list');
        setSelectedWorkspace(null);
    };

    const handleBack = () => {
        setActiveView('list');
        setSelectedWorkspace(null);
    };

    const handleClose = () => {
        setActiveView('list');
        setSelectedWorkspace(null);
        onClose();
    };

    return (
        <Sheet open={isOpen} onOpenChange={handleClose}>
            <SheetContent side="right" className="w-full sm:w-[500px] md:w-[600px] p-0">
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <SheetHeader className="px-6 py-4 border-b">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Folders className="h-5 w-5" />
                                <SheetTitle>
                                    {activeView === 'list' && t('Workflow Spaces')}
                                    {activeView === 'create' && t('Create Workspace')}
                                    {activeView === 'edit' && t('Edit Workspace')}
                                    {activeView === 'detail' && (selectedWorkspace?.name || t('Workspace Details'))}
                                </SheetTitle>
                            </div>
{/*                             <Button */}
{/*                                 variant="ghost" */}
{/*                                 size="icon" */}
{/*                                 onClick={handleClose} */}
{/*                                 className="h-8 w-8" */}
{/*                             > */}
{/*                                 <X className="h-4 w-4" /> */}
{/*                             </Button> */}
                        </div>
                    </SheetHeader>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto">
                        {activeView === 'list' && (
                            <WorkspaceList
                                workspaces={workspaces}
                                loading={loading}
                                onCreateNew={handleCreateWorkspace}
                                onViewWorkspace={handleViewWorkspace}
                                onRefresh={loadWorkspaces}
                            />
                        )}

                        {activeView === 'detail' && selectedWorkspace && (
                            <WorkspaceDetail
                                workspace={selectedWorkspace}
                                onBack={handleBack}
                                onEdit={handleEditWorkspace}
                                onDelete={handleWorkspaceDeleted}
                                onUpdate={loadWorkspaces}
                            />
                        )}

                        {(activeView === 'create' || activeView === 'edit') && (
                            <WorkspaceForm
                                workspace={selectedWorkspace}
                                mode={activeView}
                                onSave={handleWorkspaceSaved}
                                onCancel={handleBack}
                            />
                        )}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
