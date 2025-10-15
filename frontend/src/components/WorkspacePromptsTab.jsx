import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
    Plus,
    GripVertical,
    Trash2,
    Play,
    Edit2,
    Check,
    X,
    FileText
} from 'lucide-react';
import { workflowSpacesAPI, promptsAPI } from '@/services/api';
import { toast } from 'sonner';
import WorkspacePromptSelector from './WorkspacePromptSelector';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sortable Prompt Item Component
function SortablePromptItem({ prompt, onRemove, onUpdateNotes }) {
    const { t } = useTranslation();
    const [editingNotes, setEditingNotes] = useState(false);
    const [notes, setNotes] = useState(prompt.notes || '');

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: prompt.prompt_id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const handleSaveNotes = () => {
        onUpdateNotes(prompt.prompt_id, notes);
        setEditingNotes(false);
    };

    const handleCancelNotes = () => {
        setNotes(prompt.notes || '');
        setEditingNotes(false);
    };

    return (
        <Card ref={setNodeRef} style={style} className="p-4">
            <div className="flex gap-3">
                {/* Drag Handle */}
                <button
                    className="cursor-grab active:cursor-grabbing touch-none"
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-medium">{prompt.prompt?.title}</h4>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => onRemove(prompt.prompt_id)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>

                    {prompt.prompt?.category && (
                        <Badge variant="secondary" className="mb-2">
                            {prompt.prompt.category}
                        </Badge>
                    )}

                    {/* Notes */}
                    <div className="mt-2">
                        {editingNotes ? (
                            <div className="space-y-2">
                                <Textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder={t('Add notes about this prompt...')}
                                    rows={2}
                                    className="text-sm"
                                />
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        onClick={handleSaveNotes}
                                    >
                                        <Check className="h-4 w-4 mr-1" />
                                        {t('Save')}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleCancelNotes}
                                    >
                                        <X className="h-4 w-4 mr-1" />
                                        {t('Cancel')}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div
                                className="text-sm text-muted-foreground cursor-pointer hover:text-foreground"
                                onClick={() => setEditingNotes(true)}
                            >
                                {notes || (
                                    <span className="italic">{t('Click to add notes...')}</span>
                                )}
                                <Edit2 className="inline h-3 w-3 ml-1" />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Card>
    );
}

/**
 * WorkspacePromptsTab - Manage prompts with drag-and-drop reordering
 */
export default function WorkspacePromptsTab({ workspace, onUpdate }) {
    const { t, i18n } = useTranslation();
    const [prompts, setPrompts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showSelector, setShowSelector] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        loadPrompts();
    }, [workspace.id]);

    const loadPrompts = async () => {
        setLoading(true);
        try {
            const response = await workflowSpacesAPI.getPrompts(workspace.id, i18n.language);
            setPrompts(response.data || []);
        } catch (error) {
            console.error('Error loading prompts:', error);
            toast.error(error.message || t('Failed to load prompts'));
        } finally {
            setLoading(false);
        }
    };

    const handleDragEnd = async (event) => {
        const { active, over } = event;

        if (active.id !== over.id) {
            const oldIndex = prompts.findIndex((p) => p.prompt_id === active.id);
            const newIndex = prompts.findIndex((p) => p.prompt_id === over.id);

            const newPrompts = arrayMove(prompts, oldIndex, newIndex);
            setPrompts(newPrompts);

            // Save new order to backend
            try {
                const promptIds = newPrompts.map((p) => p.prompt_id);
                await workflowSpacesAPI.reorderPrompts(workspace.id, promptIds, i18n.language);
                toast.success(t('Prompts reordered'));
                onUpdate();
            } catch (error) {
                console.error('Error reordering prompts:', error);
                toast.error(error.message || t('Failed to reorder prompts'));
                // Revert on error
                loadPrompts();
            }
        }
    };

    const handleRemovePrompt = async (promptId) => {
        try {
            await workflowSpacesAPI.removePrompt(workspace.id, promptId, i18n.language);
            toast.success(t('Prompt removed from workspace'));
            loadPrompts();
            onUpdate();
        } catch (error) {
            console.error('Error removing prompt:', error);
            toast.error(error.message || t('Failed to remove prompt'));
        }
    };

    const handleUpdateNotes = async (promptId, notes) => {
        try {
            await workflowSpacesAPI.updatePromptAssociation(
                workspace.id,
                promptId,
                { notes },
                i18n.language
            );
            toast.success(t('Notes updated'));
            loadPrompts();
        } catch (error) {
            console.error('Error updating notes:', error);
            toast.error(error.message || t('Failed to update notes'));
        }
    };

    const handlePromptsAdded = () => {
        loadPrompts();
        onUpdate();
        setShowSelector(false);
    };

    if (loading) {
        return <div className="text-center py-8 text-muted-foreground">{t('Loading...')}</div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    {t('Drag to reorder prompts for workflow execution')}
                </p>
                <Button onClick={() => setShowSelector(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('Add Prompts')}
                </Button>
            </div>

            {prompts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="mb-4">{t('No prompts in this workspace yet')}</p>
                    <Button onClick={() => setShowSelector(true)} variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        {t('Add Your First Prompt')}
                    </Button>
                </div>
            ) : (
                <>
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={prompts.map((p) => p.prompt_id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="space-y-2">
                                {prompts.map((prompt) => (
                                    <SortablePromptItem
                                        key={prompt.prompt_id}
                                        prompt={prompt}
                                        onRemove={handleRemovePrompt}
                                        onUpdateNotes={handleUpdateNotes}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>

                    {/* Run Workflow Button */}
                    <div className="pt-4 border-t">
                        <Button
                            className="w-full"
                            size="lg"
                            disabled={prompts.length === 0}
                        >
                            <Play className="h-5 w-5 mr-2" />
                            {t('Run Workflow')} ({prompts.length} {t('steps')})
                        </Button>
                        <p className="text-xs text-muted-foreground text-center mt-2">
                            {t('Workflow execution coming in Phase 3')}
                        </p>
                    </div>
                </>
            )}

            {/* Prompt Selector Dialog */}
            <WorkspacePromptSelector
                workspaceId={workspace.id}
                existingPromptIds={prompts.map((p) => p.prompt_id)}
                isOpen={showSelector}
                onClose={() => setShowSelector(false)}
                onPromptsAdded={handlePromptsAdded}
            />
        </div>
    );
}
