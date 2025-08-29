import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const AddModelDialog = ({ isOpen, onClose, onAddModel }) => {
  const [modelName, setModelName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!modelName.trim()) {
      return;
    }

    onAddModel(modelName.trim());
    setModelName('');
    onClose();
  };

  const handleCancel = () => {
    setModelName('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Custom Model
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="model-name">Model Name</Label>
            <Input
              id="model-name"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="e.g., tngtech/deepseek-r1t2-chimera:free"
              required
            />
            <p className="text-xs text-muted-foreground">
              The model identifier from your provider
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit">
              Add Model
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddModelDialog;