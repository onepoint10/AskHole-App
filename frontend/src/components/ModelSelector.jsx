import React from 'react';
import { ChevronUp } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ModelSelector = ({ 
  availableModels, 
  selectedModel, 
  onModelChange, 
  disabled = false 
}) => {
  const allModels = [
    ...((availableModels.gemini || []).map(model => ({ value: model, label: `${model} (Gemini)`, type: 'gemini' }))),
    ...((availableModels.openrouter || []).map(model => ({ value: model, label: `${model} (OpenRouter)`, type: 'openrouter' })))
  ];

  return (
    <div className="model-selector">
      <Select
        value={selectedModel}
        onValueChange={onModelChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-64 h-8 text-xs bg-background/50 border-border/50 hover:bg-background/80 transition-colors">
          <SelectValue placeholder="Choose model..." />
          <ChevronUp className="h-3 w-3 opacity-50" />
        </SelectTrigger>
        <SelectContent align="start" side="top" className="w-64 max-h-48">
          {allModels.map((model) => (
            <SelectItem 
              key={model.value} 
              value={model.value}
              className="text-xs"
            >
              <div className="flex items-center justify-between w-full">
                <span className="truncate">{model.label}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default ModelSelector;