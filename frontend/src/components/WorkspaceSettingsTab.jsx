import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Trash2, Globe, Lock } from 'lucide-react';

/**
 * WorkspaceSettingsTab - Workspace settings and danger zone
 */
export default function WorkspaceSettingsTab({ workspace, isOwner, onUpdate, onDelete }) {
    const { t } = useTranslation();

    return (
        <div className="space-y-6">
            {/* Basic Info */}
            <Card className="p-4">
                <h3 className="font-semibold mb-4">{t('Basic Information')}</h3>
                <div className="space-y-3">
                    <div>
                        <Label className="text-muted-foreground">{t('Name')}</Label>
                        <p className="font-medium">{workspace.name}</p>
                    </div>
                    <div>
                        <Label className="text-muted-foreground">{t('Description')}</Label>
                        <p className="text-sm">{workspace.description || t('No description')}</p>
                    </div>
                    <div>
                        <Label className="text-muted-foreground">{t('Visibility')}</Label>
                        <div className="mt-1">
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
                    </div>
                </div>
            </Card>

            {/* Stats */}
            <Card className="p-4">
                <h3 className="font-semibold mb-4">{t('Statistics')}</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Label className="text-muted-foreground">{t('Prompts')}</Label>
                        <p className="text-2xl font-bold">{workspace.prompt_count || 0}</p>
                    </div>
                    <div>
                        <Label className="text-muted-foreground">{t('Members')}</Label>
                        <p className="text-2xl font-bold">{workspace.member_count || 0}</p>
                    </div>
                    <div>
                        <Label className="text-muted-foreground">{t('Created')}</Label>
                        <p className="text-sm">{new Date(workspace.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                        <Label className="text-muted-foreground">{t('Last Updated')}</Label>
                        <p className="text-sm">{new Date(workspace.updated_at).toLocaleDateString()}</p>
                    </div>
                </div>
            </Card>

            {/* Danger Zone */}
            {isOwner && (
                <Card className="p-4 border-destructive">
                    <h3 className="font-semibold text-destructive mb-2">{t('Danger Zone')}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        {t('Once you delete a workspace, there is no going back. Please be certain.')}
                    </p>
                    <Button
                        variant="destructive"
                        onClick={onDelete}
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {t('Delete Workspace')}
                    </Button>
                </Card>
            )}
        </div>
    );
}
