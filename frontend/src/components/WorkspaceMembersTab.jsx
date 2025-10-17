import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
import InviteMemberDialog from './InviteMemberDialog';
import { Users, UserPlus, Trash2, Shield, AlertCircle } from 'lucide-react';

/**
 * WorkspaceMembersTab - Manage workspace members with full CRUD operations
 */
export default function WorkspaceMembersTab({ workspace, onUpdate }) {
    const { t, i18n } = useTranslation();
    const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
    const [memberToRemove, setMemberToRemove] = useState(null);
    const [isRemoving, setIsRemoving] = useState(false);
    const [error, setError] = useState('');

    const members = workspace.members || [];
    const isOwner = workspace.role === 'owner' || workspace.is_owner;
    const canManageMembers = isOwner;

    console.log('WorkspaceMembersTab - Permission check:', {
        workspace_id: workspace.id,
        workspace_role: workspace.role,
        workspace_is_owner: workspace.is_owner,
        workspace_owner_id: workspace.owner_id,
        isOwner,
        canManageMembers,
        members_count: members.length
    });

    const handleRoleChange = async (member, newRole) => {
        if (!canManageMembers) return;

        setError('');
        try {
            await workflowSpacesAPI.updateMemberRole(
                workspace.id,
                member.user_id,
                { role: newRole },
                i18n.language
            );
            onUpdate?.();
        } catch (err) {
            console.error('Error updating member role:', err);
            const errorData = err.response?.data;
            setError(errorData?.error || t('Failed to update member role'));
        }
    };

    const handleRemoveMember = async () => {
        if (!memberToRemove) return;

        setIsRemoving(true);
        setError('');
        try {
            await workflowSpacesAPI.removeMember(
                workspace.id,
                memberToRemove.user_id,
                i18n.language
            );
            setMemberToRemove(null);
            onUpdate?.();
        } catch (err) {
            console.error('Error removing member:', err);
            const errorData = err.response?.data;
            setError(errorData?.error || t('Failed to remove member'));
        } finally {
            setIsRemoving(false);
        }
    };

    const getRoleBadgeVariant = (role) => {
        switch (role) {
            case 'owner':
                return 'default';
            case 'editor':
                return 'secondary';
            default:
                return 'outline';
        }
    };

    return (
        <div className="space-y-4">
            {/* Header with Invite Button */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    {t('Manage team members and their access levels')}
                </p>
                {canManageMembers && (
                    <Button
                        onClick={() => setInviteDialogOpen(true)}
                        size="sm"
                    >
                        <UserPlus className="h-4 w-4 mr-2" />
                        {t('Invite Member')}
                    </Button>
                )}
            </div>

            {/* Error Message */}
            {error && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4" />
                    <span>{error}</span>
                </div>
            )}

            {/* Members List */}
            {members.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">{t('No members yet')}</p>
                    <p className="text-sm">
                        {canManageMembers
                            ? t('Click "Invite Member" to add team members')
                            : t('This workspace has no additional members')}
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {members.map((member) => {
                        const isCurrentMemberOwner = member.role === 'owner';
                        const canEditThisMember = canManageMembers && !isCurrentMemberOwner;

                        return (
                            <Card key={member.id} className="p-4">
                                <div className="flex items-center justify-between gap-4">
                                    {/* User Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium truncate">
                                                {member.username || `${t('User')} #${member.user_id}`}
                                            </p>
                                            {isCurrentMemberOwner && (
                                                <Shield className="h-4 w-4 text-primary" />
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            {t('Joined')} {new Date(member.created_at).toLocaleDateString()}
                                        </p>
                                    </div>

                                    {/* Role & Actions */}
                                    <div className="flex items-center gap-2">
                                        {canEditThisMember ? (
                                            <Select
                                                value={member.role}
                                                onValueChange={(newRole) => handleRoleChange(member, newRole)}
                                            >
                                                <SelectTrigger className="w-[120px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="viewer">{t('Viewer')}</SelectItem>
                                                    <SelectItem value="editor">{t('Editor')}</SelectItem>
                                                    <SelectItem value="owner">{t('Owner')}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <Badge variant={getRoleBadgeVariant(member.role)}>
                                                {t(member.role)}
                                            </Badge>
                                        )}

                                        {canEditThisMember && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setMemberToRemove(member)}
                                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Permissions Info */}
            <Card className="p-4 bg-muted/50">
                <h4 className="font-medium mb-2 text-sm">{t('Role Permissions')}</h4>
                <div className="space-y-1 text-xs text-muted-foreground">
                    <p>• <strong>{t('Viewer')}:</strong> {t('Can view and execute workflows')}</p>
                    <p>• <strong>{t('Editor')}:</strong> {t('Can edit prompts and manage content')}</p>
                    <p>• <strong>{t('Owner')}:</strong> {t('Full access including member management')}</p>
                </div>
            </Card>

            {/* Invite Member Dialog */}
            <InviteMemberDialog
                open={inviteDialogOpen}
                onOpenChange={setInviteDialogOpen}
                workspace={workspace}
                onMemberAdded={onUpdate}
            />

            {/* Remove Member Confirmation */}
            <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('Remove Member')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('Are you sure you want to remove')} <strong>{memberToRemove?.username || `User #${memberToRemove?.user_id}`}</strong> {t('from this workspace? They will lose access to all prompts and workflows.')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isRemoving}>
                            {t('Cancel')}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleRemoveMember}
                            disabled={isRemoving}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {t('Remove')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
