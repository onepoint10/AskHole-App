import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const defaultPrompt = {
  title: '',
  category: 'General',
  tags: '',
  content: '',
  is_public: false,
};

const PromptDialog = ({ isOpen, onClose, initialContent = '', onCreate, editMode = false, initialPrompt = null }) => {
  const [prompt, setPrompt] = useState(defaultPrompt);

  useEffect(() => {
    if (isOpen) {
      if (editMode && initialPrompt) {
        // Edit mode - populate with existing prompt data
        setPrompt({
          title: initialPrompt.title || '',
          category: initialPrompt.category || 'General',
          tags: Array.isArray(initialPrompt.tags) 
            ? initialPrompt.tags.join(', ') 
            : (initialPrompt.tags || ''),
          content: initialPrompt.content || '',
          is_public: Boolean(initialPrompt.is_public), // Ensure boolean conversion
        });
      } else {
        // Create mode - use default with optional initial content
        setPrompt({ 
          ...defaultPrompt, 
          content: initialContent || '' 
        });
      }
    }
  }, [isOpen, initialContent, editMode, initialPrompt]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setPrompt(defaultPrompt);
    }
  }, [isOpen]);

  const handleCreate = () => {
    if (!prompt.title.trim() || !prompt.content.trim()) return;
    
    const tagsArray = prompt.tags
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean);
      
    const promptData = {
      title: prompt.title.trim(),
      content: prompt.content,
      category: prompt.category.trim() || 'General',
      tags: tagsArray,
      is_public: Boolean(prompt.is_public), // Ensure boolean
    };
    
    console.log('Creating/updating prompt with data:', promptData);
    onCreate?.(promptData);
    onClose?.(false);
  };

  const handleClose = () => {
    setPrompt(defaultPrompt); // Reset form on close
    onClose?.(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editMode ? 'Edit Prompt' : 'Create New Prompt'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="prompt-title">Title</Label>
            <Input
              id="prompt-title"
              value={prompt.title}
              onChange={(e) => setPrompt(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter prompt title"
              className="focus-ring"
            />
          </div>
          <div>
            <Label htmlFor="prompt-category">Category</Label>
            <Input
              id="prompt-category"
              value={prompt.category}
              onChange={(e) => setPrompt(prev => ({ ...prev, category: e.target.value }))}
              placeholder="e.g., Writing, Coding, Analysis"
              className="focus-ring"
            />
          </div>
          <div>
            <Label htmlFor="prompt-tags">Tags (comma-separated)</Label>
            <Input
              id="prompt-tags"
              value={prompt.tags}
              onChange={(e) => setPrompt(prev => ({ ...prev, tags: e.target.value }))}
              placeholder="e.g., creative, technical, analysis"
              className="focus-ring"
            />
          </div>
          <div>
            <Label htmlFor="prompt-content">Prompt Content</Label>
            <Textarea
              id="prompt-content"
              value={prompt.content}
              onChange={(e) => setPrompt(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Enter your prompt template..."
              className="min-h-[120px] focus-ring"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="prompt-public"
              checked={Boolean(prompt.is_public)}
              onCheckedChange={(checked) => {
                console.log('Public switch changed to:', checked);
                setPrompt(prev => ({ ...prev, is_public: checked }));
              }}
            />
            <Label htmlFor="prompt-public" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Make this prompt public
            </Label>
          </div>
          {prompt.is_public && (
            <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950 p-2 rounded-md">
              Public prompts can be discovered and used by other users in the community.
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={handleCreate} className="btn-primary flex-1">
              {editMode ? 'Save Changes' : 'Create Prompt'}
            </Button>
            <Button
              variant="outline"
              onClick={handleClose}
              className="btn-secondary"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PromptDialog;