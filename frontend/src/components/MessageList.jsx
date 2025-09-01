import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { User, Bot, Copy, Check, Trash2, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ContextMenu as CM, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { toast } from 'sonner';

const MessageList = ({ messages = [], isLoading, onAddToPrompt, onDeleteMessage }) => {
  const scrollRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [copiedId, setCopiedId] = useState(null);
  const [copiedCodeId, setCopiedCodeId] = useState(null);
  const [isDark, setIsDark] = useState(false);
  const [remarkPlugins, setRemarkPlugins] = useState([]);
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  // Helper function to get file URL
  const getFileUrl = useCallback((file) => {
    if (typeof file === 'string') {
      return file;
    }
    if (file.id) {
      return `/api/files/${file.id}/download`;
    }
    if (file.url || file.src) {
      return file.url || file.src;
    }
    // Fallback for File objects (during upload)
    if (file instanceof File) {
      return URL.createObjectURL(file);
    }
    return null;
  }, []);

  // Helper function to get file display name
  const getFileDisplayName = useCallback((file) => {
    if (typeof file === 'string') {
      return file;
    }
    return file.original_filename || file.filename || file.name || 'Unknown file';
  }, []);

  // Initialize plugins and device detection
  useEffect(() => {
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent);
    setIsMobileDevice(isMobile);
    
    const loadPlugins = async () => {
      try {
        if (!isMobile) {
          const remarkGfm = await import('remark-gfm');
          setRemarkPlugins([remarkGfm.default]);
        } else {
          const remarkBreaks = await import('remark-breaks');
          setRemarkPlugins([remarkBreaks.default]);
        }
      } catch (error) {
        // Silently fail - markdown will render without plugins
        console.warn('Failed to load markdown plugins:', error);
      }
    };

    loadPlugins();
  }, []);

  // Dark mode detection
  useEffect(() => {
    const updateDarkMode = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };

    updateDarkMode();
    
    const observer = new MutationObserver(updateDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  // Scroll management
  const scrollToBottom = useCallback((immediate = false) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: immediate ? 'instant' : 'smooth' 
      });
    }
  }, []);

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    const shouldScrollImmediate = lastMessage?.isTemporary || isLoading;
    scrollToBottom(shouldScrollImmediate);
  }, [messages, isLoading, scrollToBottom]);

  // Improved clipboard functionality with better debugging
  const copyToClipboard = useCallback(async (text, messageId, isCode = false) => {
    if (!text) {
      console.log('Copy failed: No text provided');
      return;
    }

    console.log('Attempting to copy text:', text.substring(0, 50) + '...');
    console.log('Is secure context:', window.isSecureContext);
    console.log('Navigator clipboard available:', !!navigator.clipboard);

    try {
      let success = false;

      // Method 1: Modern clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          console.log('Trying modern clipboard API...');
          await navigator.clipboard.writeText(text);
          console.log('Modern clipboard API succeeded');
          success = true;
        } catch (clipboardError) {
          console.log('Modern clipboard API failed:', clipboardError.name, clipboardError.message);
        }
      }

      // Method 2: execCommand fallback
      if (!success) {
        console.log('Trying execCommand fallback...');
        const textArea = document.createElement('textarea');
        textArea.value = text;
        
        // Make textarea invisible but still functional
        textArea.style.position = 'fixed';
        textArea.style.top = '0';
        textArea.style.left = '0';
        textArea.style.width = '2em';
        textArea.style.height = '2em';
        textArea.style.padding = '0';
        textArea.style.border = 'none';
        textArea.style.outline = 'none';
        textArea.style.boxShadow = 'none';
        textArea.style.background = 'transparent';
        textArea.style.opacity = '0';
        textArea.style.zIndex = '-1000';
        
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        // For mobile devices
        textArea.setSelectionRange(0, 99999);
        
        try {
          success = document.execCommand('copy');
          console.log('execCommand result:', success);
        } catch (execError) {
          console.log('execCommand failed:', execError);
        }
        
        document.body.removeChild(textArea);
      }

      // Method 3: Alternative approach for stubborn cases
      if (!success) {
        console.log('Trying alternative selection method...');
        const range = document.createRange();
        const selection = window.getSelection();
        
        const textNode = document.createTextNode(text);
        const span = document.createElement('span');
        span.appendChild(textNode);
        span.style.position = 'fixed';
        span.style.top = '0';
        span.style.left = '0';
        span.style.opacity = '0';
        span.style.pointerEvents = 'none';
        
        document.body.appendChild(span);
        range.selectNode(span);
        selection.removeAllRanges();
        selection.addRange(range);
        
        try {
          success = document.execCommand('copy');
          console.log('Alternative method result:', success);
        } catch (altError) {
          console.log('Alternative method failed:', altError);
        }
        
        selection.removeAllRanges();
        document.body.removeChild(span);
      }

      if (success) {
        console.log('Copy succeeded!');
        // Set appropriate copied state
        if (isCode) {
          setCopiedCodeId(messageId);
          setTimeout(() => setCopiedCodeId(null), 2000);
        } else {
          setCopiedId(messageId);
          setTimeout(() => setCopiedId(null), 2000);
        }
        
        toast.success('Copied to clipboard!');
      } else {
        console.log('All copy methods failed');
        toast.error('Failed to copy to clipboard. Please try copying manually.');
      }
    } catch (error) {
      console.error('Copy failed with error:', error);
      toast.error('Failed to copy to clipboard');
    }
  }, []);

  // Mobile table preprocessing
  const preprocessMarkdownForMobile = useCallback((markdown) => {
    if (!isMobileDevice || !markdown) return markdown;
    
    const lines = markdown.split('\n');
    const processedLines = [];
    let tableData = [];
    let inTable = false;
    
    const convertTableForMobile = (tableData) => {
      if (tableData.length === 0) return '';
      
      const headers = tableData[0];
      const rows = tableData.slice(1);
      
      return rows.map((row, rowIndex) => {
        const rowContent = headers.map((header, cellIndex) => {
          if (cellIndex < row.length) {
            return `**${header}:** ${row[cellIndex]}`;
          }
          return '';
        }).filter(Boolean).join('\n\n');
        
        return rowContent;
      }).join('\n\n---\n\n');
    };

    for (const line of lines) {
      const isTableRow = /^\|(.+)\|$/.test(line);
      const isTableSeparator = /^[-|\s:]+$/.test(line);
      
      if (isTableRow) {
        if (!inTable) {
          inTable = true;
          tableData = [];
        }
        const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
        tableData.push(cells);
      } else if (inTable && (line.trim() === '' || !isTableSeparator)) {
        if (tableData.length > 0) {
          processedLines.push(convertTableForMobile(tableData));
          tableData = [];
        }
        inTable = false;
        if (!isTableSeparator) {
          processedLines.push(line);
        }
      } else if (!isTableSeparator) {
        processedLines.push(line);
      }
    }
    
    // Handle table at end
    if (inTable && tableData.length > 0) {
      processedLines.push(convertTableForMobile(tableData));
    }
    
    return processedLines.join('\n');
  }, [isMobileDevice]);

  // Code block component with improved copy functionality
  const CodeBlock = useCallback(({ node, inline, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || '');
    const codeString = String(children).replace(/\n$/, '');
    // Create a more unique ID that includes content hash for better state tracking
    const codeId = `code-${Math.abs(codeString.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0))}`;
    
    if (inline || !match) {
      return (
        <code className="bg-muted/60 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
          {children}
        </code>
      );
    }

    return (
      <div className={`relative my-4 ${isMobileDevice ? 'w-full max-w-full' : ''}`}>
        <div className="flex items-center justify-between bg-muted/50 px-4 py-2 rounded-t-lg border-b border-border">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {match[1]}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-background/80 transition-all duration-200 hover:scale-105"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              copyToClipboard(codeString, codeId, true);
            }}
            title="Copy code"
          >
            {copiedCodeId === codeId ? (
              <Check className="h-3 w-3 text-green-500 animate-in fade-in-0 zoom-in-95 duration-200" />
            ) : (
              <Copy className="h-3 w-3 transition-transform hover:scale-110" />
            )}
          </Button>
        </div>
        <div className={`${isMobileDevice ? 'w-full overflow-x-auto' : ''}`}>
          <SyntaxHighlighter
            style={isDark ? oneDark : oneLight}
            language={match[1]}
            PreTag="div"
            className={`!mt-0 !rounded-t-none !border-t-0 ${
              isMobileDevice ? '!w-full !max-w-full !overflow-x-auto' : ''
            }`}
            customStyle={isMobileDevice ? {
              width: '100%',
              maxWidth: '100%',
              overflowX: 'auto',
              fontSize: '0.875rem',
              lineHeight: '1.25rem'
            } : {}}
            {...props}
          >
            {codeString}
          </SyntaxHighlighter>
        </div>
      </div>
    );
  }, [copyToClipboard, copiedCodeId, isDark, isMobileDevice]);

  // Markdown components configuration
  const markdownComponents = {
    code: CodeBlock,
    pre: ({ children }) => <div className={isMobileDevice ? 'w-full overflow-x-auto' : ''}>{children}</div>,
    p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
    h1: ({ children }) => <h1 className="text-xl font-semibold mb-3 text-foreground">{children}</h1>,
    h2: ({ children }) => <h2 className="text-lg font-semibold mb-3 text-foreground">{children}</h2>,
    h3: ({ children }) => <h3 className="text-base font-semibold mb-2 text-foreground">{children}</h3>,
    ul: ({ children }) => <ul className="mb-3 pl-4 space-y-1">{children}</ul>,
    ol: ({ children }) => <ol className="mb-3 pl-4 space-y-1">{children}</ol>,
    li: ({ children }) => <li className="text-foreground">{children}</li>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-primary pl-4 my-3 italic text-muted-foreground">
        {children}
      </blockquote>
    ),
    a: ({ href, children }) => (
      <a 
        href={href} 
        className="text-primary hover:text-primary/80 underline transition-colors" 
        target="_blank" 
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ),
    table: ({ children }) => (
      <div className={`my-3 w-full ${isMobileDevice ? 'overflow-x-auto' : 'overflow-x-auto'}`}>
        <table className={`border-collapse text-sm ${
          isMobileDevice ? 'min-w-full' : 'w-full'
        }`}>{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => <tr className="even:bg-muted/20">{children}</tr>,
    th: ({ children }) => (
      <th className={`border border-border text-left font-semibold bg-muted/30 ${
        isMobileDevice ? 'px-2 py-1 text-xs' : 'px-3 py-2'
      }`}>
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className={`border border-border ${
        isMobileDevice ? 'px-2 py-1 text-sm' : 'px-3 py-2'
      }`}>{children}</td>
    ),
  }; 

  return (
    <ScrollArea className="flex-1 custom-scrollbar message-scroll-area" ref={scrollRef}>
      <div className={`mx-auto px-4 py-6 space-y-6 ${isMobileDevice ? 'max-w-full w-full' : 'max-w-4xl'}`}>
        {messages.map((message) => (
          <div
            key={message.id}
            className={`fade-in ${isMobileDevice ? 'w-full' : ''} ${
              message.role === 'user' ? 'flex justify-end' : 'flex justify-start'
            }`}
          >
            <div
              className={`flex gap-3 ${
                isMobileDevice 
                  ? message.role === 'user' 
                    ? 'max-w-[90%] w-full flex-row-reverse' 
                    : 'max-w-[95%] w-full flex-row'
                  : message.role === 'user'
                    ? 'max-w-[85%] flex-row-reverse'
                    : 'max-w-[85%] flex-row'
              }`}
            >
              {/* Avatar */}
              <div
                className={`flex-shrink-0 w-8 h-8 mt-1 rounded-full flex items-center justify-center ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted border border-border'
                }`}
              >
                {message.role === 'user' ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4 text-muted-foreground" />
                )}
              </div>

              {/* Message Content */}
              {message.role === 'user' ? (
                <CM>
                  <ContextMenuTrigger asChild>
                    <div className={`group relative pl-4 pr-2 py-2 rounded-3xl rounded-tr-sm bg-message-primary text-primary-foreground ${
                      {/*isMobileDevice ? 'max-w-full w-full' : 'max-w-full'*/}
                    }`}>
                      <div className="whitespace-pre-wrap leading-relaxed break-words">
                        {message.content}
                      </div>
                      
                      {/* File attachments and images for user messages */}
                      {message.files && message.files.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-primary-foreground/20">
                          {/* Separate images and other files */}
                          {(() => {
                            const images = message.files.filter(file => {
                              const fileName = typeof file === 'string' ? file : file.original_filename || file.filename || file.name || '';
                              return /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(fileName) || 
                                     (file.mime_type && file.mime_type.startsWith('image/'));
                            });
                            
                            const otherFiles = message.files.filter(file => {
                              const fileName = typeof file === 'string' ? file : file.original_filename || file.filename || file.name || '';
                              return !/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(fileName) && 
                                     !(file.mime_type && file.mime_type.startsWith('image/'));
                            });

                            return (
                              <>
                                {/* Display images */}
                                {images.length > 0 && (
                                  <div className="space-y-2">
                                    <div className={`grid gap-2 ${isMobileDevice ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                                      {images.map((image, index) => (
                                        <div key={`image-${index}`} className="relative group">
                                          <img
                                            src={getFileUrl(image)}
                                            alt={typeof image === 'string' ? image : (image.original_filename || image.filename || image.name || `Image ${index + 1}`)}
                                            className={`h-auto rounded border border-primary-foreground/20 object-cover cursor-pointer hover:opacity-90 transition-opacity ${
                                              isMobileDevice ? 'w-full max-h-32' : 'max-w-full max-h-48'
                                            }`}
                                            onClick={(e) => {
                                              // Open image in new tab on click
                                              const imgSrc = e.target.src;
                                              window.open(imgSrc, '_blank');
                                            }}
                                            onError={(e) => {
                                              // Hide broken images
                                              e.target.style.display = 'none';
                                            }}
                                          />
                                          <div className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1 rounded truncate max-w-[calc(100%-8px)]">
                                            {typeof image === 'string' ? image.split('/').pop() : getFileDisplayName(image)}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Display other files */}
                                {otherFiles.length > 0 && (
                                  <div className={`space-y-1 ${images.length > 0 ? 'mt-3 pt-3 border-t border-primary-foreground/10' : ''}`}>
                                    <div className="flex flex-wrap gap-1">
                                      {otherFiles.map((file, index) => (
                                        <span 
                                          key={`file-${index}`}
                                          className="inline-flex items-center gap-1 px-2 py-1 bg-primary-foreground/10 rounded text-xs text-primary-foreground/90 border border-primary-foreground/20"
                                          title={getFileDisplayName(file)}
                                        >
                                          <span>📄</span>
                                          <span className={`truncate ${isMobileDevice ? 'max-w-[120px]' : 'max-w-[200px]'}`}>
                                            {getFileDisplayName(file)}
                                          </span>
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onSelect={() => copyToClipboard(message.content, message.id)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </ContextMenuItem>
                    {onAddToPrompt && (
                      <ContextMenuItem onSelect={() => onAddToPrompt(message.content)}>
                        <Database className="h-4 w-4 mr-2" />
                        Add to database
                      </ContextMenuItem>
                    )}
                    {onDeleteMessage && (
                      <ContextMenuItem 
                        onSelect={() => onDeleteMessage(message.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </ContextMenuItem>
                    )}
                  </ContextMenuContent>
                </CM>
              ) : (
                <div className={`relative group min-h-[60px] ${
                  isMobileDevice ? 'w-full max-w-full' : 'w-full'
                }`}>
                  <CM>
                    <ContextMenuTrigger asChild>
                      <div className={`px-4 py-4 rounded-3xl rounded-tl-sm bg-muted/50 border border-border/50 relative ${
                        isMobileDevice ? 'max-w-full overflow-x-hidden' : ''
                      }`}>
                        <div className={`prose prose-sm dark:prose-invert max-w-none ${
                          isMobileDevice ? 'overflow-x-hidden' : ''
                        }`}>
                          <ReactMarkdown
                            remarkPlugins={remarkPlugins}
                            components={markdownComponents}
                          >
                            {preprocessMarkdownForMobile(message.content)}
                          </ReactMarkdown>
                        </div>
                        
                        {/* File attachments and images for assistant messages */}
                        {message.files && message.files.length > 0 && (
                          <div className="mt-2 pt-2">
                            {(() => {
                              const images = message.files.filter(file => {
                                const fileName = typeof file === 'string' ? file : file.original_filename || file.filename || file.name || '';
                                return /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(fileName) || 
                                       (file.mime_type && file.mime_type.startsWith('image/'));
                              });
                              
                              const otherFiles = message.files.filter(file => {
                                const fileName = typeof file === 'string' ? file : file.original_filename || file.filename || file.name || '';
                                return !/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(fileName) && 
                                       !(file.mime_type && file.mime_type.startsWith('image/'));
                              });

                              return (
                                <>
                                  {/* Display images */}
                                  {images.length > 0 && (
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                                        <span>🖼️</span>
                                        <span>Referenced images:</span>
                                      </div>
                                      <div className={`grid gap-2 ${isMobileDevice ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                                        {images.map((image, index) => (
                                          <div key={`image-${index}`} className="relative group">
                                            <img
                                              src={getFileUrl(image)}
                                              alt={typeof image === 'string' ? image : (image.original_filename || image.filename || image.name || `Image ${index + 1}`)}
                                              className={`h-auto rounded border border-border/30 object-cover cursor-pointer hover:opacity-90 transition-opacity ${
                                                isMobileDevice ? 'w-full max-h-32' : 'max-w-full max-h-48'
                                              }`}
                                              onClick={(e) => {
                                                const imgSrc = e.target.src;
                                                window.open(imgSrc, '_blank');
                                              }}
                                              onError={(e) => {
                                                e.target.style.display = 'none';
                                              }}
                                            />
                                            <div className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1 rounded truncate max-w-[calc(100%-8px)]">
                                              {typeof image === 'string' ? image.split('/').pop() : getFileDisplayName(image)}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Display other files */}
                                  {otherFiles.length > 0 && (
                                    <div className={`space-y-1 ${images.length > 0 ? 'mt-3 pt-3 border-primary-foreground/10' : ''}`}>
                                      <div className="flex flex-wrap gap-1">
                                        {otherFiles.map((file, index) => (
                                          <span 
                                            key={`file-${index}`}
                                            className="inline-flex items-center gap-1 px-2 py-1 bg-primary-foreground/10 rounded text-xs text-primary-foreground/90 border border-primary-foreground/20"
                                            title={getFileDisplayName(file)}
                                          >
                                            <span>📄</span>
                                            <span className={`truncate ${isMobileDevice ? 'max-w-[120px]' : 'max-w-[200px]'}`}>
                                              {getFileDisplayName(file)}
                                            </span>
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        )}
                        {/* Copy button for assistant messages - positioned inside the message */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 hover:bg-background/90 transition-all duration-200 z-20 border border-border/50 bg-background/95 backdrop-blur-sm shadow-sm hover:scale-105"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            copyToClipboard(message.content, message.id);
                          }}
                          title="Copy message"
                        >
                          {copiedId === message.id ? (
                            <Check className="h-3.5 w-3.5 text-green-500 animate-in fade-in-0 zoom-in-95 duration-200" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 transition-transform hover:scale-110" />
                          )}
                        </Button>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem onSelect={() => copyToClipboard(message.content, message.id)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </ContextMenuItem>
                      {onAddToPrompt && (
                        <ContextMenuItem onSelect={() => onAddToPrompt(message.content)}>
                          <Database className="h-4 w-4 mr-2" />
                          Add to database
                        </ContextMenuItem>
                      )}
                      {onDeleteMessage && (
                        <ContextMenuItem 
                          onSelect={() => onDeleteMessage(message.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </ContextMenuItem>
                      )}
                    </ContextMenuContent>
                  </CM>
                </div>
              )}
            </div>
          </div>
        ))}
        {/* Loading indicator */}
        {isLoading && (
          <div className="fade-in flex justify-start">
            <div className={`flex gap-3 ${isMobileDevice ? 'max-w-[95%]' : 'max-w-[85%]'}`}>
              <div className="flex-shrink-0 w-8 h-8 rounded-3xl flex items-center justify-center bg-muted border border-border">
                <Bot className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="px-4 py-3 rounded-3xl bg-muted/50 border border-border/50">
                <div className="typing-indicator flex space-x-1">
                  <div className="typing-dot w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                  <div className="typing-dot w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                  <div className="typing-dot w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                </div>
              </div>
            </div>
          </div>
        )}
        {!isLoading && messages.length === 0 && (
          <div className="flex justify-center items-center py-50">
            <p className="text-muted-foreground">No messages yet. Start a conversation!</p>
          </div>
        )}
        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
};

export default MessageList;