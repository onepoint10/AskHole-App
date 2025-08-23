import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { User, Bot, Copy, Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useState } from 'react';
import { ContextMenu as CM, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';

const MessageList = ({ messages, isLoading, onAddToPrompt, onDeleteMessage }) => {
  const scrollRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [copiedId, setCopiedId] = useState(null);
  const [isDark, setIsDark] = useState(false);
  const [remarkPlugins, setRemarkPlugins] = useState([]);
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    // Load different plugins based on device type
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent);
    setIsMobileDevice(isMobile);
    
    if (!isMobile) {
      // Desktop: Load remark-gfm for full GFM support
      import('remark-gfm')
        .then((mod) => {
          setRemarkPlugins([mod.default]);
        })
        .catch(() => {
          // Ignore failures silently; markdown will render without GFM
        });
    } else {
      // Mobile: Load remark-breaks for line break handling
      import('remark-breaks')
        .then((mod) => {
          setRemarkPlugins([mod.default]);
        })
        .catch(() => {
          // Ignore failures silently; markdown will render without breaks plugin
        });
    }
  }, []);

  // Function to scroll to bottom
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Force immediate scroll to bottom
  const scrollToBottomImmediate = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'instant' });
    }
  };

  useEffect(() => {
    // Check if dark mode is active
    setIsDark(document.documentElement.classList.contains('dark'));
    
    // Listen for theme changes
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  // Scroll to bottom when messages change or loading starts
  useEffect(() => {
    // Use immediate scroll for user messages (when they just sent something)
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.isTemporary || isLoading) {
      scrollToBottomImmediate();
    } else {
      scrollToBottom();
    }
  }, [messages, isLoading]);

  const copyToClipboard = async (text, messageId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  // Preprocess markdown for mobile to handle tables manually
  const preprocessMarkdownForMobile = (markdown) => {
    if (!isMobileDevice) return markdown;
    
    // Simple table detection and conversion for mobile
    const tableRegex = /^\|(.+)\|$/gm;
    const lines = markdown.split('\n');
    let processedLines = [];
    let inTable = false;
    let tableData = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (tableRegex.test(line)) {
        if (!inTable) {
          inTable = true;
          tableData = [];
        }
        // Extract table row data
        const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
        tableData.push(cells);
      } else if (inTable && line.trim() === '') {
        // End of table, convert to mobile-friendly format
        if (tableData.length > 0) {
          const mobileTable = convertTableForMobile(tableData);
          processedLines.push(mobileTable);
          tableData = [];
        }
        inTable = false;
        processedLines.push(line);
      } else if (inTable && /^[-|\s:]+$/.test(line)) {
        // Skip table separator line
        continue;
      } else {
        if (inTable && tableData.length > 0) {
          // End of table without empty line
          const mobileTable = convertTableForMobile(tableData);
          processedLines.push(mobileTable);
          tableData = [];
          inTable = false;
        }
        processedLines.push(line);
      }
    }
    
    // Handle table at end of content
    if (inTable && tableData.length > 0) {
      const mobileTable = convertTableForMobile(tableData);
      processedLines.push(mobileTable);
    }
    
    return processedLines.join('\n');
  };

  const convertTableForMobile = (tableData) => {
    if (tableData.length === 0) return '';
    
    const headers = tableData[0];
    const rows = tableData.slice(1);
    
    let mobileFormat = '';
    
    rows.forEach((row, rowIndex) => {
      if (rowIndex > 0) mobileFormat += '\n---\n\n';
      
      headers.forEach((header, cellIndex) => {
        if (cellIndex < row.length) {
          mobileFormat += `**${header}:** ${row[cellIndex]}\n\n`;
        }
      });
    });
    
    return mobileFormat;
  };

  const CodeBlock = ({ node, inline, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || '');
    return !inline && match ? (
      <div className="relative my-4">
        <div className="flex items-center justify-between bg-muted/50 px-4 py-2 rounded-t-lg border-b border-border">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {match[1]}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-background/80"
            onClick={() => copyToClipboard(String(children), `code-${Math.random()}`)}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
        <SyntaxHighlighter
          style={isDark ? oneDark : oneLight}
          language={match[1]}
          PreTag="div"
          className="!mt-0 !rounded-t-none !border-t-0"
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      </div>
    ) : (
      <code className="bg-muted/60 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
        {children}
      </code>
    );
  };

  return (
    <ScrollArea className="flex-1 custom-scrollbar message-scroll-area" ref={scrollRef}>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {messages.map((message, index) => (
          <div
            key={message.id}
            className={`fade-in ${
              message.role === 'user' ? 'flex justify-end' : 'flex justify-start'
            }`}
          >
            <div
              className={`flex gap-3 max-w-[85%] ${
                message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
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
              {message.role === 'user' ? (
                <CM>
                  <ContextMenuTrigger asChild>
                    <div
                      className={`group relative message-user`}
                    >
                      <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onSelect={() => copyToClipboard(message.content, message.id)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => onAddToPrompt && onAddToPrompt(message.content)}>
                      Add to prompt database
                    </ContextMenuItem>
                    <ContextMenuItem 
                      onSelect={() => onDeleteMessage && onDeleteMessage(message.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                </CM>
              ) : (
                <CM>
                  <ContextMenuTrigger asChild>
                    <div
                      className={`group relative message-assistant border border-border/50`}
                    >
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown
                          remarkPlugins={remarkPlugins}
                          components={{
                            code: CodeBlock,
                            pre: ({ children }) => <div>{children}</div>,
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
                              <a href={href} className="text-primary hover:text-primary/80 underline" target="_blank" rel="noopener noreferrer">
                                {children}
                              </a>
                            ),
                            table: ({ children }) => (
                              <div className="my-3 w-full overflow-x-auto">
                                <table className="w-full border-collapse text-sm">{children}</table>
                              </div>
                            ),
                            thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
                            tbody: ({ children }) => <tbody>{children}</tbody>,
                            tr: ({ children }) => <tr className="even:bg-muted/20">{children}</tr>,
                            th: ({ children }) => (
                              <th className="bg-gray-800 border border-gray-200 px-2 py-1 text-left font-semibold align-middle">
                                {children}
                              </th>
                            ),
                            td: ({ children }) => (
                              <td className="bg-gray-600 border border-gray-200 px-2 py-1 align-top">{children}</td>
                            ),
                          }}
                        >
                          {preprocessMarkdownForMobile(message.content)}
                        </ReactMarkdown>
                      </div>
                      {message.role === 'assistant' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => copyToClipboard(message.content, message.id)}
                        >
                          {copiedId === message.id ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                      {message.files && message.files.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/30">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <span>📎</span>
                            <span>{message.files.length} file(s) attached</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onSelect={() => copyToClipboard(message.content, message.id)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </ContextMenuItem>
                    <ContextMenuItem 
                      onSelect={() => onDeleteMessage && onDeleteMessage(message.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                </CM>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="fade-in flex justify-start">
            <div className="flex gap-3 max-w-[85%]">
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-muted border border-border">
                <Bot className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="message-assistant border border-border/50">
                <div className="typing-indicator">
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Invisible element for scrolling to bottom */}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
};

export default MessageList;