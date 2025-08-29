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
  settings
}) => {
  const [message, setMessage] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const fileInputRef = useRef(null);

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
    <div className="border-t border-border bg-background">
      <div className="max-w-4xl mx-auto p-4">
        {attachedFiles.length > 0 && (
          <div className="mb-3 space-y-2">
            {attachedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-3 bg-muted/50 rounded-lg p-3 border border-border/50"
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
          <div className="relative flex items-end gap-2">
            <div className="flex-1 relative">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={disabled ? "Please configure your API keys in settings to start chatting..." : "Message AskHole..."}
                className="chat-input min-h-[52px] max-h-32 resize-none pr-12 py-3 text-base leading-relaxed"
                disabled={disabled || isLoading}
                rows={1}
                style={{
                  height: 'auto',
                  minHeight: '52px',
                }}
                onInput={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute bottom-2 right-8 h-8 w-8 p-0 hover:bg-muted/80"
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
                accept=".txt,.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.md,.json,.csv,.py,.js,jsx,.html,.css,.xml"
              />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                disabled={(!message.trim() && attachedFiles.length === 0) || disabled || isLoading}
                className="absolute bottom-2 right-2 h-8 w-8 p-0 hover:bg-muted/80"
              >
                <Send className="h-4 w-4" />
            </Button>
            </div>
            
          </div>
          
          {/* Model selector - bottom left corner, only shown for new/empty chats */}
          {shouldShowModelSelector && !disabled && (
            <div className="py-3 absolute left-0">
              <ModelSelector
                availableModels={availableModels}
                selectedModel={selectedModel}
                onModelChange={handleModelChange}
                disabled={disabled || isLoading}
              />
            </div>
          )}
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