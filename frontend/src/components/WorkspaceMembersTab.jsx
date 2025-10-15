import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';

/**
 * WorkspaceMembersTab - Manage workspace members
 * Simplified version - full implementation would include add/remove member functionality
 */
export default function WorkspaceMembersTab({ workspace, isOwner, onUpdate }) {
    const { t } = useTranslation();

    const members = workspace.members || [];

    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
                {t('Manage who has access to this workspace')}
            </p>

            {members.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>{t('No members yet')}</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {members.map((member) => (
                        <Card key={member.id} className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">{member.username || t('User')} #{member.user_id}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {t('Joined')} {new Date(member.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                                    {t(member.role)}
                                </Badge>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <p className="text-xs text-muted-foreground text-center mt-4">
                {t('Full member management UI will be enhanced in future updates')}
            </p>
        </div>
    );
}
