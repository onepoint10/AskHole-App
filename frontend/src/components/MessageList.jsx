import React, { useEffect, useRef, useState } from 'react';

// Import with fallbacks to prevent crashes
let ReactMarkdown;
let remarkGfm;
let SyntaxHighlighter;
let oneDark, oneLight;

try {
  ReactMarkdown = require('react-markdown').default;
} catch (error) {
  console.error('Failed to import ReactMarkdown:', error);
}

try {
  remarkGfm = require('remark-gfm').default;
} catch (error) {
  console.error('Failed to import remarkGfm:', error);
}

try {
  const Prism = require('react-syntax-highlighter').Prism;
  const styles = require('react-syntax-highlighter/dist/esm/styles/prism');
  SyntaxHighlighter = Prism;
  oneDark = styles.oneDark;
  oneLight = styles.oneLight;
} catch (error) {
  console.error('Failed to import syntax highlighter:', error);
}

import { User, Bot, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const MessageList = ({ messages = [], isLoading = false }) => {
  const scrollRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [copiedId, setCopiedId] = useState(null);
  const [isDark, setIsDark] = useState(false);
  const [hasError, setHasError] = useState(false);

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

  const CodeBlock = ({ node, inline, className, children, ...props }) => {
    try {
      const match = /language-(\w+)/.exec(className || '');
      
      if (!inline && match && SyntaxHighlighter && oneDark && oneLight) {
        return (
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
        );
      } else {
        // Fallback for inline code or when syntax highlighter is not available
        return (
          <code className="bg-muted/60 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
            {children}
          </code>
        );
      }
    } catch (error) {
      console.error('Error rendering code block:', error);
      // Fallback to simple code display
      return (
        <code className="bg-muted/60 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
          {children}
        </code>
      );
    }
  };

  // If there's an error, show a simple fallback
  if (hasError) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Something went wrong loading messages</p>
          <button 
            onClick={() => setHasError(false)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 custom-scrollbar message-scroll-area" ref={scrollRef}>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {Array.isArray(messages) && messages
          .map((message, index) => {
            try {
              // Ensure message has required properties
              if (!message || typeof message !== 'object') {
                console.warn('Invalid message at index', index, message);
                return null;
              }
              
              if (!message.id || !message.content || !message.role) {
                console.warn('Message missing required properties at index', index, message);
                return null;
              }
              
              return (
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
                    <div
                      className={`group relative ${
                        message.role === 'user'
                          ? 'message-user'
                          : 'message-assistant border border-border/50'
                      }`}
                    >
                      {(() => {
                        try {
                          if (message.role === 'user') {
                            return <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>;
                          } else {
                            return (
                              <div className="prose prose-sm dark:prose-invert max-w-none">
                                {(() => {
                                  try {
                                    // Check if ReactMarkdown is available and is a function
                                    if (!ReactMarkdown || typeof ReactMarkdown !== 'function') {
                                      throw new Error('ReactMarkdown component not available');
                                    }
                                    
                                    return (
                                      <ReactMarkdown
                                        remarkPlugins={(() => {
                                          try {
                                            // Check if remarkGfm is available and is a function
                                            if (typeof remarkGfm === 'function') {
                                              return [remarkGfm];
                                            } else {
                                              console.warn('remarkGfm plugin not available, falling back to basic markdown');
                                              return [];
                                            }
                                          } catch (error) {
                                            console.error('Error loading remarkGfm plugin:', error);
                                            return [];
                                          }
                                        })()}
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
                                          table: ({ children }) => {
                                            try {
                                              return (
                                                <div className="my-3 w-full overflow-x-auto">
                                                  <table className="w-full border-collapse text-sm">{children}</table>
                                                </div>
                                              );
                                            } catch (error) {
                                              console.error('Error rendering table:', error);
                                              return <div className="my-3 p-2 bg-muted/20 rounded border">Table content</div>;
                                            }
                                          },
                                          thead: ({ children }) => {
                                            try {
                                              return <thead className="bg-muted/50">{children}</thead>;
                                            } catch (error) {
                                              return <thead>{children}</thead>;
                                            }
                                          },
                                          tbody: ({ children }) => {
                                            try {
                                              return <tbody>{children}</tbody>;
                                            } catch (error) {
                                              return <tbody>{children}</tbody>;
                                            }
                                          },
                                          tr: ({ children }) => {
                                            try {
                                              return <tr className="even:bg-muted/20">{children}</tr>;
                                            } catch (error) {
                                              return <tr>{children}</tr>;
                                            }
                                          },
                                          th: ({ children }) => {
                                            try {
                                              return (
                                                <th className="bg-muted/80 border border-border px-2 py-1 text-left font-semibold align-middle">
                                                  {children}
                                                </th>
                                              );
                                            } catch (error) {
                                              return <th className="px-2 py-1 text-left font-semibold">{children}</th>;
                                            }
                                          },
                                          td: ({ children }) => {
                                            try {
                                              return (
                                                <td className="bg-muted/40 border border-border px-2 py-1 align-top">{children}</td>
                                              );
                                            } catch (error) {
                                              return <td className="px-2 py-1 align-top">{children}</td>;
                                            }
                                          },
                                        }}
                                      >
                                        {message.content}
                                      </ReactMarkdown>
                                    );
                                  } catch (error) {
                                    console.error('Error rendering markdown:', error);
                                    // Fallback to plain text rendering
                                    return (
                                      <div className="whitespace-pre-wrap leading-relaxed">
                                        {message.content}
                                      </div>
                                    );
                                  }
                                })()}
                              </div>
                            );
                          }
                        } catch (error) {
                          console.error('Error rendering message:', error);
                          return (
                            <div className="p-3 bg-muted/20 rounded border">
                              <p className="text-sm text-muted-foreground">Error rendering message</p>
                              <pre className="mt-2 text-xs overflow-auto">{JSON.stringify(message, null, 2)}</pre>
                            </div>
                          );
                        }
                      })()}
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
                </div>
              );
            } catch (error) {
              console.error('Error rendering message at index', index, error);
              setHasError(true);
              return (
                <div key={`error-${index}`} className="flex justify-start">
                  <div className="max-w-[85%] p-3 bg-muted/20 rounded border">
                    <p className="text-sm text-muted-foreground">Error rendering message</p>
                  </div>
                </div>
              );
            }
          })
          .filter(Boolean) // Remove null messages
        )}
        {Boolean(isLoading) && (
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