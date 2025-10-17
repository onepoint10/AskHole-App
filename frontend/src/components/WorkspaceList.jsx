import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Search, RefreshCw, Users, FileText, Globe, Lock, Folders } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * WorkspaceList - Display list of workspace cards with search
 */
export default function WorkspaceList({
    workspaces,
    loading,
    onCreateNew,
    onViewWorkspace,
    onRefresh
}) {
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');

    // Filter workspaces by search query
    const filteredWorkspaces = workspaces.filter(workspace => {
        const query = searchQuery.toLowerCase();
        return (
            workspace.name.toLowerCase().includes(query) ||
            (workspace.description || '').toLowerCase().includes(query)
        );
    });

    // Sort by updated_at descending
    const sortedWorkspaces = [...filteredWorkspaces].sort((a, b) => {
        const dateA = new Date(a.updated_at || a.created_at);
        const dateB = new Date(b.updated_at || b.created_at);
        return dateB - dateA;
    });

    if (loading) {
        return (
            <div className="p-6 space-y-4">
                {[1, 2, 3].map((i) => (
                    <Card key={i}>
                        <CardHeader>
                            <Skeleton className="h-5 w-3/4" />
                            <Skeleton className="h-4 w-full mt-2" />
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-2">
                                <Skeleton className="h-6 w-20" />
                                <Skeleton className="h-6 w-20" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Search and Actions */}
            <div className="p-4 border-b space-y-3">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder={t('Search workspaces...')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={onRefresh}
                        title={t('Refresh')}
                    >
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>

                <Button
                    onClick={onCreateNew}
                    className="w-full"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('Create New Workspace')}
                </Button>
            </div>

            {/* Workspace List */}
            <ScrollArea className="flex-1 h-0">
                <div className="p-4 space-y-3">
                    {sortedWorkspaces.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                            {searchQuery ? (
                                <>
                                    <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p>{t('No workspaces found matching your search')}</p>
                                </>
                            ) : (
                                <>
                                    <Folders className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p className="mb-4">{t('No workspaces yet')}</p>
                                    <Button onClick={onCreateNew} variant="outline">
                                        <Plus className="h-4 w-4 mr-2" />
                                        {t('Create Your First Workspace')}
                                    </Button>
                                </>
                            )}
                        </div>
                    )}

                    {sortedWorkspaces.map((workspace) => (
                        <Card
                            key={workspace.id}
                            className="cursor-pointer hover:bg-accent transition-colors"
                            onClick={() => onViewWorkspace(workspace)}
                        >
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between gap-2">
                                    <CardTitle className="text-base line-clamp-1">
                                        {workspace.name}
                                    </CardTitle>
                                    {workspace.is_public ? (
                                        <Badge variant="secondary" className="shrink-0">
                                            <Globe className="h-3 w-3 mr-1" />
                                            {t('Public')}
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="shrink-0">
                                            <Lock className="h-3 w-3 mr-1" />
                                            {t('Private')}
                                        </Badge>
                                    )}
                                </div>
                                {workspace.description && (
                                    <CardDescription className="line-clamp-2">
                                        {workspace.description}
                                    </CardDescription>
                                )}
                            </CardHeader>
                            <CardContent>
                                <div className="flex gap-4 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                        <FileText className="h-4 w-4" />
                                        <span>{workspace.prompt_count || 0} {t('prompts')}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Users className="h-4 w-4" />
                                        <span>{workspace.member_count || 0} {t('members')}</span>
                                    </div>
                                </div>
                                <div className="mt-2 text-xs text-muted-foreground">
                                    {t('Updated')} {new Date(workspace.updated_at || workspace.created_at).toLocaleDateString()}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
