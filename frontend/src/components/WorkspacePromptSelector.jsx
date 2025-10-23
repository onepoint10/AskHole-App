import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { promptsAPI, workflowSpacesAPI } from '@/services/api';

/**
 * WorkspacePromptSelector - Select prompts to add to workspace
 */
export default function WorkspacePromptSelector({
    workspaceId,
    existingPromptIds = [],
    isOpen,
    onClose,
    onPromptsAdded
}) {
    const { t, i18n } = useTranslation();
    const [prompts, setPrompts] = useState([]);
    const [selectedPromptIds, setSelectedPromptIds] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadPrompts();
            setSelectedPromptIds([]);
        }
    }, [isOpen]);

    const loadPrompts = async () => {
        setLoading(true);
        try {
            const response = await promptsAPI.getPrompts(i18n.language);
            // Filter out prompts already in workspace
            const available = (response.data || []).filter(
                (p) => !existingPromptIds.includes(p.id)
            );
            setPrompts(available);
        } catch (error) {
            console.error('Error loading prompts:', error);
            toast.error(error.message || t('Failed to load prompts'));
        } finally {
            setLoading(false);
        }
    };

    const filteredPrompts = prompts.filter((prompt) => {
        const query = searchQuery.toLowerCase();
        return (
            prompt.title.toLowerCase().includes(query) ||
            (prompt.content || '').toLowerCase().includes(query) ||
            (prompt.category || '').toLowerCase().includes(query)
        );
    });

    const togglePrompt = (promptId) => {
        setSelectedPromptIds((prev) =>
            prev.includes(promptId)
                ? prev.filter((id) => id !== promptId)
                : [...prev, promptId]
        );
    };

    const handleAddPrompts = async () => {
        if (selectedPromptIds.length === 0) {
            toast.error(t('Please select at least one prompt to add'));
            return;
        }

        setAdding(true);
        try {
            // Add each selected prompt
            for (const promptId of selectedPromptIds) {
                await workflowSpacesAPI.addPrompt(
                    workspaceId,
                    { prompt_id: promptId },
                    i18n.language
                );
            }

            toast.success(t('{{count}} prompt(s) added to workspace', { count: selectedPromptIds.length }));

            onPromptsAdded();
        } catch (error) {
            console.error('Error adding prompts:', error);
            toast.error(error.message || t('Failed to add prompts'));
        } finally {
            setAdding(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
                <DialogHeader>
                    <DialogTitle>{t('Add Prompts to Workspace')}</DialogTitle>
                    <DialogDescription>
                        {t('Select prompts to add to your workflow space')}
                    </DialogDescription>
                </DialogHeader>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder={t('Search prompts...')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>

                {/* Prompt List */}
                <ScrollArea className="h-[400px] -mx-6 px-6">
                    {loading ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
                            {t('Loading prompts...')}
                        </div>
                    ) : filteredPrompts.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            {searchQuery ? (
                                <p>{t('No prompts found matching your search')}</p>
                            ) : (
                                <p>{t('No prompts available to add')}</p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2 pr-4">
                            {filteredPrompts.map((prompt) => (
                                <div
                                    key={prompt.id}
                                    className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent cursor-pointer"
                                    onClick={() => togglePrompt(prompt.id)}
                                >
                                    <Checkbox
                                        checked={selectedPromptIds.includes(prompt.id)}
                                        onCheckedChange={() => togglePrompt(prompt.id)}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-medium mb-1">{prompt.title}</h4>
                                        {prompt.category && (
                                            <Badge variant="secondary" className="mb-1">
                                                {prompt.category}
                                            </Badge>
                                        )}
                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                            {prompt.content}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>

                <DialogFooter className="flex-shrink-0">
                    <div className="flex items-center justify-between w-full">
                        <span className="text-sm text-muted-foreground">
                            {selectedPromptIds.length} {t('selected')}
                        </span>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={onClose} disabled={adding}>
                                {t('Cancel')}
                            </Button>
                            <Button
                                onClick={handleAddPrompts}
                                disabled={adding || selectedPromptIds.length === 0}
                            >
                                {adding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                {t('Add Selected')}
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
