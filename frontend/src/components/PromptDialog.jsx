import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileText, GitBranch, FlaskConical } from 'lucide-react';
import VersionHistoryPanel from './VersionHistoryPanel';

const defaultPrompt = {
  title: '',
  category: 'General',
  tags: '',
  content: '',
  is_public: false,
};

const PromptDialog = ({ isOpen, onClose, initialContent = '', onCreate, editMode = false, initialPrompt = null }) => {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [activeTab, setActiveTab] = useState('details');
  const [versionCount, setVersionCount] = useState(0);

  useEffect(() => {
    if (isOpen) {
      // Reset to details tab when opening
      setActiveTab('details');

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
      setActiveTab('details');
      setVersionCount(0);
    }
  }, [isOpen]);

  const handleVersionUpdate = (updatedPromptData) => {
    // Update the form with the rolled-back prompt data
    if (updatedPromptData) {
      setPrompt({
        title: updatedPromptData.title || '',
        category: updatedPromptData.category || 'General',
        tags: Array.isArray(updatedPromptData.tags)
          ? updatedPromptData.tags.join(', ')
          : (updatedPromptData.tags || ''),
        content: updatedPromptData.content || '',
        is_public: Boolean(updatedPromptData.is_public),
      });

      // Switch to details tab to show the updated content
      setActiveTab('details');
    }
  };

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
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {editMode ? 'Edit Prompt' : 'Create New Prompt'}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs for Edit Mode */}
        {editMode && initialPrompt?.id ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Details
              </TabsTrigger>
              <TabsTrigger value="version-history" className="flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                Version History
                {versionCount > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {versionCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="test" className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4" />
                Test
              </TabsTrigger>
            </TabsList>

            {/* Details Tab - Existing Form */}
            <TabsContent value="details" className="mt-4">
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
                    Save Changes
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
            </TabsContent>

            {/* Version History Tab */}
            <TabsContent value="version-history" className="mt-4">
              <VersionHistoryPanel
                promptId={initialPrompt.id}
                currentCommit={initialPrompt.current_commit}
                onVersionUpdate={handleVersionUpdate}
              />
            </TabsContent>

            {/* Test Tab - Placeholder */}
            <TabsContent value="test" className="mt-4">
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <FlaskConical className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Test Your Prompt</h3>
                <p className="text-sm text-muted-foreground">
                  This feature will allow you to test your prompt with sample inputs.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Coming soon in a future update.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          /* Create Mode - Simple Form without Tabs */
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
                Create Prompt
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
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PromptDialog;