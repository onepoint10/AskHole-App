import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    ArrowLeft,
    Edit,
    Trash2,
    Globe,
    Lock,
    Users as UsersIcon,
    FileText,
    Settings as SettingsIcon,
    Play
} from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { workflowSpacesAPI } from '@/services/api';
import { toast } from 'sonner';
import WorkspacePromptsTab from './WorkspacePromptsTab';
import WorkspaceMembersTab from './WorkspaceMembersTab';
import WorkspaceSettingsTab from './WorkspaceSettingsTab';

/**
 * WorkspaceDetail - Full workspace view with tabs
 */
export default function WorkspaceDetail({
    workspace,
    onBack,
    onEdit,
    onDelete,
    onUpdate
}) {
    const { t, i18n } = useTranslation();
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await workflowSpacesAPI.deleteWorkspace(workspace.id, i18n.language);
            toast.success(t('Workspace deleted successfully'));
            onDelete();
        } catch (error) {
            console.error('Error deleting workspace:', error);
            toast.error(error.message || t('Failed to delete workspace'));
        } finally {
            setDeleting(false);
            setShowDeleteDialog(false);
        }
    };

    // Check if current user is owner (for permission-based UI)
    // This would need to be enhanced with actual user ID comparison
    const isOwner = true; // Placeholder - implement proper ownership check

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-6 border-b space-y-4">
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onBack}
                        className="h-8 w-8"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-lg font-semibold truncate">{workspace.name}</h2>
                            {workspace.is_public ? (
                                <Badge variant="secondary">
                                    <Globe className="h-3 w-3 mr-1" />
                                    {t('Public')}
                                </Badge>
                            ) : (
                                <Badge variant="outline">
                                    <Lock className="h-3 w-3 mr-1" />
                                    {t('Private')}
                                </Badge>
                            )}
                        </div>
                        {workspace.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                                {workspace.description}
                            </p>
                        )}
                    </div>
                </div>

                {/* Stats */}
                <div className="flex gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                        <FileText className="h-4 w-4" />
                        <span>{workspace.prompt_count || 0} {t('prompts')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <UsersIcon className="h-4 w-4" />
                        <span>{workspace.member_count || 0} {t('members')}</span>
                    </div>
                </div>

                {/* Actions */}
                {isOwner && (
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onEdit(workspace)}
                            className="flex-1"
                        >
                            <Edit className="h-4 w-4 mr-2" />
                            {t('Edit')}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowDeleteDialog(true)}
                            className="text-destructive hover:text-destructive"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('Delete')}
                        </Button>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <Tabs defaultValue="prompts" className="flex-1 flex flex-col">
                <TabsList className="w-full justify-start rounded-none border-b px-6">
                    <TabsTrigger value="prompts" className="gap-2">
                        <FileText className="h-4 w-4" />
                        {t('Prompts')}
                    </TabsTrigger>
                    <TabsTrigger value="members" className="gap-2">
                        <UsersIcon className="h-4 w-4" />
                        {t('Members')}
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="gap-2">
                        <SettingsIcon className="h-4 w-4" />
                        {t('Settings')}
                    </TabsTrigger>
                </TabsList>

                <ScrollArea className="flex-1 h-0">
                    <TabsContent value="prompts" className="m-0 p-6">
                        <WorkspacePromptsTab
                            workspace={workspace}
                            onUpdate={onUpdate}
                        />
                    </TabsContent>

                    <TabsContent value="members" className="m-0 p-6">
                        <WorkspaceMembersTab
                            workspace={workspace}
                            isOwner={isOwner}
                            onUpdate={onUpdate}
                        />
                    </TabsContent>

                    <TabsContent value="settings" className="m-0 p-6">
                        <WorkspaceSettingsTab
                            workspace={workspace}
                            isOwner={isOwner}
                            onUpdate={onUpdate}
                            onDelete={() => setShowDeleteDialog(true)}
                        />
                    </TabsContent>
                </ScrollArea>
            </Tabs>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('Delete Workspace?')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('This will permanently delete')} "{workspace.name}" {t('and all its associations. This action cannot be undone.')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>{t('Cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleting ? t('Deleting...') : t('Delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
