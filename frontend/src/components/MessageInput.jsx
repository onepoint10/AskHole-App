import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, X, ImageIcon, Search, StopCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import ModelSelector from './ModelSelector';
import { useTranslation } from 'react-i18next';
import { exaAPI } from '../services/api'; // Import exaAPI

const MessageInput = ({
  onSendMessage,
  onStopSending,
  isLoading,
  isSending = false,
  disabled,
  availableModels,
  currentSession,
  onModelChange,
  onCreateNewSession,
  isMobileOverlay = false,
  settings,
  initialContent,
  onContentSet,
  onImageGeneration,
  onAddAssistantMessage, // New prop for adding assistant messages
}) => {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [selectedModel, setSelectedModel] = useState(settings?.defaultModel || 'gemini-2.5-flash');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isImageGenerationMode, setIsImageGenerationMode] = useState(false); // New state for image generation mode
  const [isExaSearchMode, setIsExaSearchMode] = useState(false); // New state for EXA search mode
  const dragCounterRef = useRef(0);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  // Update selected model when session changes
  useEffect(() => {
    if (currentSession?.model) {
      setSelectedModel(currentSession.model);
    } else if (!currentSession) {
      // When there's no session, always use the default model
      const defaultModel = settings?.defaultModel || 'gemini-2.5-flash';
      setSelectedModel(defaultModel);
    }
  }, [currentSession, settings?.defaultModel]);

  // Initialize plugins and device detection
  useEffect(() => {
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent);
    setIsMobileDevice(isMobile);
  }, []);

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
    if (message.trim() || attachedFiles.length > 0 || isImageGenerationMode || isExaSearchMode) { // Allow submission in EXA search mode even with empty message
      // If we have an empty session, update its model before sending
      if (currentSession && currentSession.message_count === 0 && selectedModel !== currentSession.model) {
        console.log(t('updating_empty_session_model', { currentModel: currentSession.model, newModel: selectedModel }));
        await onModelChange(currentSession.id, String(selectedModel));
      }

      // Note: Session creation is now handled automatically in sendMessage
      // No need to explicitly create session here - backend will auto-create if needed

      // Send message to current/updated session
      let result;
      if (isImageGenerationMode) {
        result = await onImageGeneration(message.trim());
      } else if (isExaSearchMode) {
        // In EXA search mode, send the message with the search_mode flag
        result = await onSendMessage(message.trim(), attachedFiles, true); // Pass true for search_mode
      } else {
        result = await onSendMessage(message.trim(), attachedFiles);
      }

      // Only clear input if message was sent successfully
      if (result && result.success) {
        setMessage('');
        setAttachedFiles([]);
        setIsImageGenerationMode(false); // Exit image generation mode on success
        setIsExaSearchMode(false); // Exit EXA search mode on success
        // Reset textarea height after clearing
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      } else if (result && !result.success) {
        // On error or abort, restore the original message and files
        setMessage(result.originalMessage || message);
        if (result.originalFiles) {
          setAttachedFiles(result.originalFiles);
        }
      }
    }
  };

  const handleModelChange = async (newModel) => {
    console.log(t('model_changed_to_with_type', { model: newModel, type: typeof newModel }));
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
    const textarea = e.target;
    setMessage(textarea.value);

    // Calculate line height and max height for 8 lines
    const lineHeight = 24; // matches your CSS line-height: 24px
    const maxLines = 8;
    const maxHeight = lineHeight * maxLines;
    const minHeight = 60; // Your existing minHeight

    // Reset height to calculate actual scroll height
    textarea.style.height = 'auto';

    // Get the actual content height
    const scrollHeight = textarea.scrollHeight;

    // Set height with maximum limit
    if (scrollHeight <= maxHeight) {
      // Content fits within max lines - expand textarea
      textarea.style.height = `${Math.max(scrollHeight, minHeight)}px`;
      textarea.style.overflowY = 'hidden';
    } else {
      // Content exceeds max lines - fix height and enable scrolling
      textarea.style.height = `${maxHeight}px`;
      textarea.style.overflowY = 'auto';

      // Scroll to bottom to show latest text
      textarea.scrollTop = textarea.scrollHeight;
    }
  };

  const handlePaste = async (e) => {
    const clipboardItems = e.clipboardData.items;
    const imageFiles = [];

    // Check for image files in clipboard
    for (let i = 0; i < clipboardItems.length; i++) {
      const item = clipboardItems[i];

      // Check if the item is an image
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          // Create a more descriptive filename with timestamp
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const extension = item.type.split('/')[1] || 'png';
          const renamedFile = new File([file], `pasted-image-${timestamp}.${extension}`, {
            type: item.type,
            lastModified: Date.now()
          });
          imageFiles.push(renamedFile);
        }
      }
    }

    // If we found image files, add them to attached files
    if (imageFiles.length > 0) {
      e.preventDefault(); // Prevent default paste behavior for images
      setAttachedFiles(prev => [...prev, ...imageFiles]);

      // Show feedback to user
      const fileCount = imageFiles.length;
      const message = fileCount === 1 ?
        t('image_pasted_and_attached', { fileName: imageFiles[0].name }) :
        t('images_pasted_and_attached', { count: fileCount });

      // You can add a toast notification here if you have toast functionality
      console.log(message);
    }

    // For text content, let the default paste behavior happen
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
    const sizes = [t('bytes'), t('kb'), t('mb'), t('gb')];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Determine if we should show model selector
  const shouldShowModelSelector = !currentSession || currentSession.message_count === 0;

  return (
    <div className="border-border bg-background message-input-container">
      <div className={`max-w-4xl mx-auto py-4`}>
        {attachedFiles.length > 0 && (
          <div className={`mb-3 space-y-2 ${isMobileDevice ? '' : 'mx-4'}`}>
            {attachedFiles.map((file, index) => (
              <div
                key={index}
                className={`flex items-center gap-3 bg-muted/50 rounded-3xl py-3 border border-border/50 `}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0 ml-2">
                  <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-medium truncate">{file.name}</span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {formatFileSize(file.size)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive ${isMobileDevice ? '' : 'mr-2'}`}
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
            className={`relative flex items-end gap-2 transition-all duration-200 rounded-3xl ${isDragOver
              ? ''
              : ''
              }`}
          >
            {/* Drag overlay */}
            {isDragOver && (
              <div className={`absolute inset-0 bg-primary/5 border-2 border-primary/30 border-dashed rounded-4xl z-20 flex items-center justify-center ${isMobileDevice ? '' : 'mx-4'}`}>
                <div className="text-center p-4">
                  <Paperclip className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="text-sm font-medium text-primary">{t('drop_files_here_to_attach')}</p>
                </div>
              </div>
            )}

            <div className={`flex-1 rounded-3xl relative ${isMobileDevice ? '' : 'px-4'}`}> {/* existing textarea content */}
              <Textarea
                ref={textareaRef}
                value={message}
                onChange={handleTextChange}
                onKeyPress={handleKeyPress}
                onPaste={handlePaste}
                placeholder={isImageGenerationMode ? t('describe_image_to_generate') : (isExaSearchMode ? t('exa.enter_search_query') : (disabled ? t('configure_api_keys_to_chat') : t('text_to_ask_hole')))}
                className="chat-input resize-none text-base leading-relaxed input-custom-scrollbar"
                disabled={disabled || isLoading}
                rows={2}
                style={{
                  minHeight: '60px', // 2 rows + bottom reserved row (24px * 3)
                  paddingBottom: '52px', // Extra padding for bottom row elements
                  lineHeight: '24px'
                }}
              />

              {/* Model selector - positioned in reserved bottom area */}
              {shouldShowModelSelector && !disabled && !isImageGenerationMode && !isExaSearchMode && ( // Hide model selector in EXA search mode
                <div className={`absolute bottom-2 z-10 ${isMobileDevice ? 'left-3 ' : 'left-6 '}`}>
                  <ModelSelector
                    availableModels={availableModels}
                    selectedModel={selectedModel}
                    onModelChange={handleModelChange}
                    disabled={disabled || isLoading}
                  />
                </div>
              )}

              {/* Image Generation Button - positioned next to file attachment */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={`absolute bottom-2 h-9 w-9 p-0 hover:bg-muted/80 hover:text-primary z-10 ${isMobileDevice ? 'right-16 ' : 'right-22 '} ${isImageGenerationMode ? 'text-primary' : ''}`}
                onClick={() => {
                  setIsImageGenerationMode(prev => !prev);
                  setIsExaSearchMode(false); // Disable EXA search mode when enabling image generation
                }}
                disabled={disabled || isLoading}
                title={t('toggle_image_generation_mode')}
              >
                <ImageIcon className="h-5 w-5" />
              </Button>

              {/* EXA Search Button - positioned next to image generation button */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={`absolute bottom-2 h-9 w-9 p-0 hover:bg-muted/80 hover:text-primary z-10 ${isMobileDevice ? 'right-24 ' : 'right-30 '} ${isExaSearchMode ? 'text-primary' : ''}`}
                onClick={() => {
                  setIsExaSearchMode(prev => !prev);
                  setIsImageGenerationMode(false); // Disable image generation mode when enabling EXA search
                }}
                disabled={disabled || isLoading}
                title={t('exa.toggle_search_mode')}
              >
                <Search className="h-5 w-5" />
              </Button>

              {/* File attachment button - positioned in reserved bottom area */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={`absolute bottom-2 h-9 w-9 p-0 hover:bg-muted/80 hover:text-primary z-10 ${isMobileDevice ? 'right-8 ' : 'right-14 '}`}
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isLoading || isImageGenerationMode || isExaSearchMode} // Disable when in image generation or EXA search mode
                title={t('attach_files')}
              >
                <Paperclip className="h-5 w-5" />
              </Button>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                accept={isImageGenerationMode ? "image/*" : (isExaSearchMode ? "" : ".txt,.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.md,.json,.csv,.py,.js,.jsx,.html,.css,.xml")} // Restrict to images in image generation mode, no files in EXA search mode
                disabled={isImageGenerationMode || isExaSearchMode} // Disable file input when in image generation or EXA search mode
              />

              {/* Send/Stop button - positioned in reserved bottom area */}
              {isSending ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onStopSending}
                  className={`absolute bottom-2 h-9 w-9 p-0 bg-muted/80 hover:text-destructive z-10 ${isMobileDevice ? 'right-0 ' : 'right-6 '}`}
                  title={t('stop_generation')}
                >
                  <StopCircle className="h-5 w-5 text-destructive" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  disabled={(!message.trim() && attachedFiles.length === 0 && !isImageGenerationMode && !isExaSearchMode) || ((isImageGenerationMode || isExaSearchMode) && !message.trim()) || disabled || isLoading}
                  className={`absolute bottom-2 h-9 w-9 p-0 hover:bg-muted/80 hover:text-primary z-10 ${isMobileDevice ? 'right-0 ' : 'right-6 '}`}
                >
                  <Send className="h-5 w-5" />
                </Button>
              )}
            </div>
          </div>
        </form>

        {disabled && (
          <div className="mt-3 text-center">
            <p className="text-sm text-muted-foreground">
              {t('configure_api_keys_to_start_using_askhole')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageInput;