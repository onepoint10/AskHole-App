import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import ModelSelector from './ModelSelector';

const MessageInput = ({ 
  onSendMessage, 
  isLoading, 
  disabled,
  availableModels,
  currentSession,
  onModelChange,
  onCreateNewSession,
  isMobileOverlay = false,
  settings,
  initialContent,
  onContentSet
}) => {
  const [message, setMessage] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const dragCounterRef = useRef(0);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  // Update selected model when session changes
  useEffect(() => {
    if (currentSession?.model) {
      setSelectedModel(currentSession.model);
    } else if (!currentSession && settings?.defaultModel) {
      if (!selectedModel) {
        setSelectedModel(settings.defaultModel || 'gemini-2.5-flash');
      }
    }
  }, [currentSession, settings?.defaultModel]);

  // Handle initial content changes
  useEffect(() => {
    if (initialContent && initialContent !== message) {
      setMessage(initialContent);
      // Notify parent that content has been set so it can clear the initial content
      if (onContentSet && initialContent) {
        setTimeout(() => {
          onContentSet();
        }, 100);
      }
    }
  }, [initialContent, onContentSet]);


  // Drag and drop functionality
  useEffect(() => {
    const dropZone = dropZoneRef.current;
    if (!dropZone || disabled) return;

    const handleDragEnter = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Increment counter and activate drag state only on first enter
      dragCounterRef.current++;
      if (dragCounterRef.current === 1) {
        setIsDragOver(true);
      }
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Decrement counter and deactivate only when all drags have left
      dragCounterRef.current--;
      if (dragCounterRef.current === 0) {
        setIsDragOver(false);
      }
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Set the drop effect to show the correct cursor
      e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Reset everything on drop
      dragCounterRef.current = 0;
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        setAttachedFiles(prev => [...prev, ...files]);
      }
    };

    dropZone.addEventListener('dragenter', handleDragEnter);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('drop', handleDrop);

    return () => {
      // Reset counter on cleanup
      dragCounterRef.current = 0;
      dropZone.removeEventListener('dragenter', handleDragEnter);
      dropZone.removeEventListener('dragleave', handleDragLeave);
      dropZone.removeEventListener('dragover', handleDragOver);
      dropZone.removeEventListener('drop', handleDrop);
    };
  }, [disabled]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (message.trim() || attachedFiles.length > 0) {
      // If we have an empty session, update its model before sending
      if (currentSession && currentSession.message_count === 0 && selectedModel !== currentSession.model) {
        console.log('Updating empty session model from', currentSession.model, 'to', selectedModel);
        await onModelChange(currentSession.id, String(selectedModel));
      }
      
      // If no session exists at all, create one
      if (!currentSession) {
        console.log('Creating new session with selected model:', selectedModel, 'type:', typeof selectedModel);
        const targetSession = await onCreateNewSession(selectedModel);
        if (!targetSession) {
          console.error('Failed to create new session');
          return;
        }
        // Wait a bit to ensure session is properly created and state updated
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Send message to current/updated session
      const result = await onSendMessage(message.trim(), attachedFiles);
      
      // Only clear input if message was sent successfully
      if (result && result.success) {
        setMessage('');
        setAttachedFiles([]);
        // Reset textarea height after clearing
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      } else if (result && !result.success) {
        // On error, restore the original message and files
        setMessage(result.originalMessage || message);
      }
    }
  };

  const handleModelChange = async (newModel) => {
    console.log('Model changed to:', newModel, 'type:', typeof newModel);
    setSelectedModel(String(newModel)); // Ensure it's always a string
    
    // If session exists and has messages, update the session model
    if (currentSession && currentSession.message_count > 0) {
      await onModelChange(currentSession.id, String(newModel));
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleTextChange = (e) => {
    setMessage(e.target.value);
    
    // Auto-resize textarea while keeping bottom row reserved
    const textarea = e.target;
    textarea.style.height = 'auto';
    
    // Calculate the height needed for content
    const contentHeight = textarea.scrollHeight;
    const lineHeight = 20; // Approximate line height in pixels
    const minRows = 2;
    const bottomRowHeight = lineHeight; // Reserve space for one row at bottom
    
    // Calculate minimum height (2 rows)
    const minHeight = (minRows * lineHeight) + bottomRowHeight;
    
    // Calculate maximum height (prevent excessive growth)
    const maxRows = 8; // Adjust as needed
    const maxHeight = (maxRows * lineHeight) + bottomRowHeight;
    
    // Set height ensuring minimum and maximum bounds
    const newHeight = Math.max(minHeight, Math.min(contentHeight + bottomRowHeight, maxHeight));
    textarea.style.height = newHeight + 'px';
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setAttachedFiles(prev => [...prev, ...files]);
    e.target.value = '';
  };

  const removeFile = (index) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Determine if we should show model selector
  const shouldShowModelSelector = !currentSession || currentSession.message_count === 0;

  return (
    <div className="border-border bg-background">
      <div className="max-w-4xl mx-auto p-4 px-2">
        {attachedFiles.length > 0 && (
          <div className="mb-3 space-y-2">
            {attachedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-3 bg-muted/50 rounded-3xl p-3 border border-border/50"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-medium truncate">{file.name}</span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {formatFileSize(file.size)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => removeFile(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="relative">
          <div 
            ref={dropZoneRef}
            className={`relative flex items-end gap-2 transition-all duration-200 rounded-3xl ${
              isDragOver 
                ? '' 
                : ''
            }`}
          >
            {/* Drag overlay */}
            {isDragOver && (
              <div className="absolute inset-0 bg-primary/5 border-2 border-primary/30 border-dashed rounded-4xl z-20 flex items-center justify-center">
                <div className="text-center p-4">
                  <Paperclip className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="text-sm font-medium text-primary">Drop files here to attach</p>
                </div>
              </div>
            )}
            
            <div className="flex-1 rounded-3xl relative">{/* existing textarea content */}
              <Textarea
                ref={textareaRef}
                value={message}
                onChange={handleTextChange}
                onKeyPress={handleKeyPress}
                placeholder={disabled ? "Please configure your API keys in settings to start chatting..." : "Text to Ask Hole..."}
                className="chat-input resize-none pr-12 text-base leading-relaxed input-custom-scrollbar"
                disabled={disabled || isLoading}
                rows={2}
                style={{
                  minHeight: '48px', // 2 rows + bottom reserved row (24px * 3)
                  paddingBottom: '32px', // Extra padding for bottom row elements
                  lineHeight: '24px'
                }}
              />
              
              {/* Model selector - positioned in reserved bottom area */}
              {shouldShowModelSelector && !disabled && (
                <div className="absolute bottom-2 left-2 z-10">
                  <ModelSelector
                    availableModels={availableModels}
                    selectedModel={selectedModel}
                    onModelChange={handleModelChange}
                    disabled={disabled || isLoading}
                  />
                </div>
              )}
              
              {/* File attachment button - positioned in reserved bottom area */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute bottom-2 right-9 h-8 w-8 p-0 hover:bg-muted/80 hover:text-primary z-10"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isLoading}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                accept=".txt,.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.md,.json,.csv,.py,.js,.jsx,.html,.css,.xml"
              />
              
              {/* Send button - positioned in reserved bottom area */}
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                disabled={(!message.trim() && attachedFiles.length === 0) || disabled || isLoading}
                className="absolute bottom-2 right-2 h-8 w-8 p-0 hover:bg-muted/80 hover:text-primary z-10"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </form>
        
        {disabled && (
          <div className="mt-3 text-center">
            <p className="text-sm text-muted-foreground">
              Configure your API keys in settings to start using AskHole
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageInput;