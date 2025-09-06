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

const PromptDialog = ({ isOpen, onClose, initialContent = '', onCreate }) => {
  const [prompt, setPrompt] = useState(defaultPrompt);

  useEffect(() => {
    if (isOpen) {
      setPrompt(prev => ({ ...defaultPrompt, content: initialContent || '' }));
    }
  }, [isOpen, initialContent]);

  const handleCreate = () => {
    if (!prompt.title.trim() || !prompt.content.trim()) return;
    const tagsArray = prompt.tags
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean);
    onCreate?.({
      title: prompt.title.trim(),
      content: prompt.content,
      category: prompt.category.trim() || 'General',
      tags: tagsArray,
      is_public: prompt.is_public,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Prompt</DialogTitle>
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
              checked={prompt.is_public}
              onCheckedChange={(checked) => setPrompt(prev => ({ ...prev, is_public: checked }))}
            />
            <Label htmlFor="prompt-public">Make this prompt public</Label>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreate} className="btn-primary flex-1">
              Create Prompt
            </Button>
            <Button
              variant="outline"
              onClick={() => onClose?.(false)}
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

