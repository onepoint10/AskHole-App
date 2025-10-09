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
  isMobileOverlay = false, 
  disabled = false 
}) => {
  const allModels = [
    ...((availableModels.gemini || []).map(model => ({ value: model, label: `${model} (Gemini)`, type: 'gemini' }))),
    ...((availableModels.openrouter || []).map(model => ({ value: model, label: `${model} (OpenRouter)`, type: 'openrouter' }))),
    ...((availableModels.custom || []).map(model => ({ value: model, label: `${model} (Custom)`, type: 'custom' })))
  ];

  return (
    <div>
      <Select
        value={selectedModel}
        onValueChange={onModelChange}
        disabled={disabled}
      >
        <SelectTrigger className={`rounded-3xl w-64 h-8 text-xs bg-background/50 border-border/50 hover:bg-background/80 transition-colors ${isMobileOverlay ? 'w-84' : 'w-48'}`}>
          <SelectValue placeholder="Choose model..." />
        </SelectTrigger>
        <SelectContent align="start" side="top" className="max-h-48">
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