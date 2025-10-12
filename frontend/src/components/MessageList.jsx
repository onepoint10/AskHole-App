import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { User, Bot, Copy, Check, Trash2, Database, Download } from 'lucide-react'; // Add Download icon
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ContextMenu as CM, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import Message from './Message'; // Import the new Message component

const MessageList = ({ messages = [], isLoading, onAddToPrompt, onDeleteMessage }) => {
  const { t } = useTranslation();
  const scrollRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [copiedId, setCopiedId] = useState(null);
  const [copiedCodeId, setCopiedCodeId] = useState(null);
  const [isDark, setIsDark] = useState(false);
  const [remarkPlugins, setRemarkPlugins] = useState([]);
  const [rehypePlugins, setRehypePlugins] = useState([]);
  const [ReactMarkdownComponent, setReactMarkdownComponent] = useState(null);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isSafari, setIsSafari] = useState(false);

  // Helper function to detect Safari browser
  const detectSafari = useCallback(() => {
    if (typeof navigator === 'undefined') return false;

    const userAgent = navigator.userAgent.toLowerCase();
    // Detect Safari but exclude Chrome/Chromium-based browsers
    const isSafariBrowser = /safari/.test(userAgent) &&
      !/chrome|chromium|crios|edg|brave|opera|opr/.test(userAgent);
    return isSafariBrowser;
  }, []);

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
    return file.original_filename || file.filename || file.name || t('unknown_file');
  }, [t]);

  // Helper function to determine if a file is an image
  const isImageFile = useCallback((file) => {
    const fileName = typeof file === 'string' ? file : file.original_filename || file.filename || file.name || '';
    return /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(fileName) ||
      (file.mime_type && file.mime_type.startsWith('image/'));
  }, []);

  // Initialize plugins and device detection
  useEffect(() => {
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent);
    const safariDetected = detectSafari();

    setIsMobileDevice(isMobile);
    setIsSafari(safariDetected);

    const loadPlugins = async () => {
      try {
        // Use older versions for Safari (react-markdown 8.0.7 + remark-gfm 3.0.1)
        // Use newer versions for other browsers (react-markdown 10.1.0 + remark-gfm 4.0.0)
        if (safariDetected) {
          console.log('Safari detected - loading compatible versions: react-markdown 8.0.7 + remark-gfm 3.0.1');
          const [remarkGfmModule, rehypeRawModule, reactMarkdownModule] = await Promise.all([
            import('remark-gfm-safari'),
            import('rehype-raw'),
            import('react-markdown-safari')
          ]);
          setRemarkPlugins([remarkGfmModule.default]);
          setRehypePlugins([rehypeRawModule.default]);
          setReactMarkdownComponent(() => reactMarkdownModule.default);
        } else {
          console.log('Non-Safari browser detected - loading latest versions: react-markdown 10.1.0 + remark-gfm 4.0.0');
          const [remarkGfmModule, rehypeRawModule, reactMarkdownModule] = await Promise.all([
            import('remark-gfm'),
            import('rehype-raw'),
            import('react-markdown')
          ]);
          setRemarkPlugins([remarkGfmModule.default]);
          setRehypePlugins([rehypeRawModule.default]);
          setReactMarkdownComponent(() => reactMarkdownModule.default);
        }
      } catch (error) {
        // Silently fail - markdown will render without plugins
        console.warn(t('failed_to_load_markdown_plugins'), error);
      }
    };

    loadPlugins();
  }, [t, detectSafari]);

  // Add scroll detection for tables to show/hide scroll indicators
  useEffect(() => {
    const handleTableScroll = () => {
      const tableContainers = document.querySelectorAll('.markdown-table-container');
      tableContainers.forEach((container) => {
        const { scrollLeft, scrollWidth, clientWidth } = container;
        const isScrollable = scrollWidth > clientWidth;

        if (isScrollable) {
          // Can scroll left (not at the start)
          if (scrollLeft > 0) {
            container.classList.add('scrollable-left');
          } else {
            container.classList.remove('scrollable-left');
          }

          // Can scroll right (not at the end)
          if (scrollLeft < scrollWidth - clientWidth - 1) {
            container.classList.add('scrollable-right');
          } else {
            container.classList.remove('scrollable-right');
          }
        }
      });
    };

    // Run on mount and when messages change
    setTimeout(handleTableScroll, 100);

    // Add scroll listeners to all table containers
    const tableContainers = document.querySelectorAll('.markdown-table-container');
    tableContainers.forEach((container) => {
      container.addEventListener('scroll', handleTableScroll);
    });

    // Cleanup
    return () => {
      tableContainers.forEach((container) => {
        container.removeEventListener('scroll', handleTableScroll);
      });
    };
  }, [messages]);

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
      console.log(t('copy_failed_no_text'));
      return;
    }

    console.log(t('attempting_to_copy_text', { text: text.substring(0, 50) + '...' }));
    console.log(t('is_secure_context'), window.isSecureContext);
    console.log(t('navigator_clipboard_available'), !!navigator.clipboard);

    try {
      let success = false;

      // Method 1: Modern clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          console.log(t('trying_modern_clipboard_api'));
          await navigator.clipboard.writeText(text);
          console.log(t('modern_clipboard_api_succeeded'));
          success = true;
        } catch (clipboardError) {
          console.log(t('modern_clipboard_api_failed'), clipboardError.name, clipboardError.message);
        }
      }

      // Method 2: execCommand fallback
      if (!success) {
        console.log(t('trying_execcommand_fallback'));
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
          console.log(t('execcommand_result'), success);
        } catch (execError) {
          console.log(t('execcommand_failed'), execError);
        }

        document.body.removeChild(textArea);
      }

      // Method 3: Alternative approach for stubborn cases
      if (!success) {
        console.log(t('trying_alternative_selection_method'));
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
          console.log(t('alternative_method_result'), success);
        } catch (altError) {
          console.log(t('alternative_method_failed'), altError);
        }

        selection.removeAllRanges();
        document.body.removeChild(span);
      }

      if (success) {
        console.log(t('copy_succeeded'));
        // Set appropriate copied state
        if (isCode) {
          setCopiedCodeId(messageId);
          setTimeout(() => setCopiedCodeId(null), 2000);
        } else {
          setCopiedId(messageId);
          setTimeout(() => setCopiedId(null), 2000);
        }

        toast.success(t('copied_to_clipboard'));
      } else {
        console.log(t('all_copy_methods_failed'));
        toast.error(t('failed_to_copy_clipboard_manual'));
      }
    } catch (error) {
      console.error(t('copy_failed_with_error'), error);
      toast.error(t('failed_to_copy_clipboard'));
    }
  }, [t]);

  // Mobile table preprocessing - disabled, now using proper table rendering
  const preprocessMarkdownForMobile = useCallback((markdown) => {
    // Return markdown as-is for proper table rendering
    return markdown;
  }, []);

  // Code block component with improved copy functionality
  const CodeBlock = useCallback(({ inline, className, children, ...props }) => {
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
            title={t('copy_code')}
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
            className={`!mt-0 !rounded-t-none !border-t-0 ${isMobileDevice ? '!w-full !max-w-full !overflow-x-auto' : ''
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
  }, [copyToClipboard, copiedCodeId, isDark, isMobileDevice, t]);

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
      <div className="markdown-table-container my-3">
        <table className="markdown-table">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => <thead>{children}</thead>,
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children, node, isHeader, ...props }) => {
      // Remove alternating background on Safari mobile for better alignment
      const trClassName = (isSafari && isMobileDevice) ? '' : 'even:bg-muted/20';
      return <tr className={trClassName} {...props}>{children}</tr>;
    },
    th: ({ children, node, isHeader, ...props }) => (
      <th {...props}>
        {children}
      </th>
    ),
    td: ({ children, node, isHeader, ...props }) => (
      <td {...props}>{children}</td>
    ),
  };

  return (
    <ScrollArea className="flex-1 custom-scrollbar message-scroll-area" ref={scrollRef}>
      <div className={`mx-auto px-4 py-6 space-y-6 ${isMobileDevice ? 'max-w-full w-full' : 'max-w-4xl'}`}>
        {ReactMarkdownComponent && messages.map((message) => (
          <Message
            key={message.id}
            message={message}
            isMobileDevice={isMobileDevice}
            copyToClipboard={copyToClipboard}
            onAddToPrompt={onAddToPrompt}
            onDeleteMessage={onDeleteMessage}
            markdownComponents={markdownComponents}
            remarkPlugins={remarkPlugins}
            rehypePlugins={rehypePlugins}
            ReactMarkdownComponent={ReactMarkdownComponent}
            preprocessMarkdownForMobile={preprocessMarkdownForMobile}
            getFileUrl={getFileUrl}
            getFileDisplayName={getFileDisplayName}
            isImageFile={isImageFile}
            copiedId={copiedId}
            copiedCodeId={copiedCodeId}
            isDark={isDark}
          />
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
                  <div className="typing-dot w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="typing-dot w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="typing-dot w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}
        {!isLoading && messages.length === 0 && (
          <div className="flex justify-center items-center py-50">
            <p className="text-muted-foreground">{t('no_messages_yet_start_conversation')}</p>
          </div>
        )}
        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
};

export default MessageList;