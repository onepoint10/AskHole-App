import React, { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { User, Bot, Copy, Check, Trash2, Database, Download, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ContextMenu as CM, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const Message = ({
    message,
    isMobileDevice,
    copyToClipboard,
    onAddToPrompt,
    onDeleteMessage,
    markdownComponents,
    remarkPlugins,
    getFileUrl,
    getFileDisplayName,
    isImageFile,
    copiedId,
    copiedCodeId,
    isDark,
}) => {
    const { t } = useTranslation();
    const isExaMessage = message.role === 'assistant' && message.content.includes("**Exa Search Results:**");
    const [isExaCollapsed, setIsExaCollapsed] = useState(true);
    const [copiedExaId, setCopiedExaId] = useState(false);

    let exaResultsContent = null;
    let summaryContent = message.content;

    if (isExaMessage) {
        const parts = message.content.split("**Summary from");
        if (parts.length > 1) {
            exaResultsContent = parts[0].replace("**Exa Search Results:**\n\n", '').trim();
            summaryContent = "**Summary from" + parts[1];
        } else {
            exaResultsContent = message.content.replace("**Exa Search Results:**\n\n", '').trim();
            summaryContent = null;
        }
    }

    return (
        <div
            key={message.id}
            className={`fade-in ${isMobileDevice ? 'w-full' : ''} ${message.role === 'user' ? 'flex justify-end' : 'flex justify-start'
                }`}
        >
            <div
                className={`flex gap-3 ${isMobileDevice
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
                    className={`flex-shrink-0 w-8 h-8 mt-1 rounded-full flex items-center justify-center ${message.role === 'user'
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
                            <div className={`group relative pl-4 pr-2 py-2 rounded-3xl rounded-tr-sm bg-message-primary text-primary-foreground ${{/*isMobileDevice ? 'max-w-full w-full' : 'max-w-full'*/ }
                                }`}>
                                <div className="whitespace-pre-wrap leading-relaxed break-words">
                                    {message.content}
                                </div>

                                {/* File attachments and images for user messages */}
                                {message.files && message.files.length > 0 && (
                                    <div className="mt-2 pt-2 border-primary-foreground/20">
                                        {/* Separate images and other files */}
                                        {(() => {
                                            const images = message.files.filter(file => isImageFile(file));

                                            const otherFiles = message.files.filter(file => !isImageFile(file));

                                            return (
                                                <>
                                                    {/* Display images */}
                                                    {images.length > 0 && (
                                                        <div className="space-y-2">
                                                            <div className={`grid gap-2 ${isMobileDevice ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                                                                {images.map((image, index) => {
                                                                    const imageUrl = getFileUrl(image);
                                                                    console.log(t('image_object'), image);
                                                                    console.log(t('image_url'), imageUrl);
                                                                    return (
                                                                        <div key={`image-${index}`} className="relative group">
                                                                            <img
                                                                                src={imageUrl}
                                                                                alt={typeof image === 'string' ? image : (image.original_filename || image.filename || image.name || t('image_alt', { index: index + 1 }))}
                                                                                className={`h-auto rounded border border-primary-foreground/20 object-cover cursor-pointer hover:opacity-90 transition-opacity ${isMobileDevice ? 'w-full max-h-32' : 'max-w-full max-h-48'
                                                                                    }`}
                                                                                onClick={(e) => {
                                                                                    // Open image in new tab on click
                                                                                    const imgSrc = e.target.src;
                                                                                    window.open(imgSrc, '_blank');
                                                                                }}
                                                                                onError={(e) => {
                                                                                    // Hide broken images
                                                                                    e.target.style.display = 'none';
                                                                                    console.error(t('failed_to_load_image'), imageUrl, e);
                                                                                }}
                                                                            />
                                                                            <div className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1 rounded truncate max-w-[calc(100%-8px)]">
                                                                                {typeof image === 'string' ? image.split('/').pop() : getFileDisplayName(image)}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
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
                                {t('copy')}
                            </ContextMenuItem>
                            {onAddToPrompt && (
                                <ContextMenuItem onSelect={() => onAddToPrompt(message.content)}>
                                    <Database className="h-4 w-4 mr-2" />
                                    {t('add_to_database')}
                                </ContextMenuItem>
                            )}
                            {onDeleteMessage && (
                                <ContextMenuItem
                                    onSelect={() => onDeleteMessage(message.id)}
                                    className="text-destructive focus:text-destructive"
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    {t('delete')}
                                </ContextMenuItem>
                            )}
                        </ContextMenuContent>
                    </CM>
                ) : (
                    <div className={`relative group min-h-[60px] ${isMobileDevice ? 'w-full max-w-full' : 'w-full'
                        }`}>
                        <CM>
                            <ContextMenuTrigger asChild>
                                <div className={`px-4 py-4 rounded-3xl rounded-tl-sm bg-muted/50 border border-border/50 relative ${isMobileDevice ? 'max-w-full overflow-x-hidden' : ''
                                    }`}>
                                    {isExaMessage && exaResultsContent ? (
                                        <Collapsible
                                            open={!isExaCollapsed}
                                            onOpenChange={(open) => setIsExaCollapsed(!open)}
                                            className="w-full space-y-2"
                                        >
                                            <CollapsibleTrigger
                                                className="flex items-center justify-between px-4 py-2 cursor-pointer bg-muted/70 hover:bg-muted rounded-md transition-colors duration-200 w-full"
                                            >
                                                <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                                                    <ChevronsUpDown className="h-4 w-4" />
                                                    {t('exa.search_results')}
                                                </h4>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent className="space-y-2">
                                                <div className="relative">
                                                    <div className={`prose prose-sm dark:prose-invert max-w-none ${isMobileDevice ? 'overflow-x-hidden' : ''}`}>
                                                        <ReactMarkdown
                                                            remarkPlugins={remarkPlugins}
                                                            components={markdownComponents}
                                                        >
                                                            {exaResultsContent}
                                                        </ReactMarkdown>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="absolute top-0 right-0 h-7 w-7 p-0 hover:bg-background/90 transition-all duration-200 z-20 border border-border/50 bg-background/95 backdrop-blur-sm shadow-sm hover:scale-105"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            e.preventDefault();
                                                            copyToClipboard(exaResultsContent, `exa-${message.id}`);
                                                            setCopiedExaId(true);
                                                            setTimeout(() => setCopiedExaId(false), 2000);
                                                        }}
                                                        title={t('copy_exa_results')}
                                                    >
                                                        {copiedExaId ? (
                                                            <Check className="h-3.5 w-3.5 text-green-500 animate-in fade-in-0 zoom-in-95 duration-200" />
                                                        ) : (
                                                            <Copy className="h-3.5 w-3.5 transition-transform hover:scale-110" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </CollapsibleContent>
                                        </Collapsible>
                                    ) : null}

                                    {summaryContent && (
                                        <div className={`prose prose-sm dark:prose-invert max-w-none ${isMobileDevice ? 'overflow-x-hidden' : ''
                                            } ${isExaMessage && exaResultsContent ? 'mt-4 pt-4 border-t border-border/50' : ''}`}>
                                            <ReactMarkdown
                                                remarkPlugins={remarkPlugins}
                                                components={markdownComponents}
                                            >
                                                {summaryContent}
                                            </ReactMarkdown>
                                        </div>
                                    )}

                                    {/* File attachments and images for assistant messages */}
                                    {message.files && message.files.length > 0 && (
                                        <div className="mt-2 pt-2">
                                            {(() => {
                                                const images = message.files.filter(file => isImageFile(file));

                                                const otherFiles = message.files.filter(file => !isImageFile(file));

                                                return (
                                                    <>
                                                        {/* Display images */}
                                                        {images.length > 0 && (
                                                            <div className="space-y-2">
                                                                <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                                                                    <span>🖼️</span>
                                                                    <span>{t('generated_images')}:</span>
                                                                </div>
                                                                <div className={`grid gap-2 ${isMobileDevice ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                                                                    {images.map((image, index) => {
                                                                        const imageUrl = getFileUrl(image);
                                                                        console.log(t('assistant_image_object'), image);
                                                                        console.log(t('assistant_image_url'), imageUrl);
                                                                        return (
                                                                            <div key={`image-${index}`} className="relative group">
                                                                                <img
                                                                                    src={imageUrl}
                                                                                    alt={typeof image === 'string' ? image : (image.original_filename || image.filename || image.name || t('generated_image_alt', { index: index + 1 }))}
                                                                                    className={`h-auto rounded border border-border/30 object-cover cursor-pointer hover:opacity-90 transition-opacity ${isMobileDevice ? 'w-full max-h-32' : 'max-w-full max-h-48'
                                                                                        }`}
                                                                                    onClick={(e) => {
                                                                                        const imgSrc = e.target.src;
                                                                                        window.open(imgSrc, '_blank');
                                                                                    }}
                                                                                    onError={(e) => {
                                                                                        e.target.style.display = 'none';
                                                                                        console.error(t('failed_to_load_assistant_image'), imageUrl, e);
                                                                                    }}
                                                                                />
                                                                                <Button
                                                                                    variant="secondary"
                                                                                    size="sm"
                                                                                    className="absolute top-1 right-1 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-all duration-200 z-20"
                                                                                    onClick={() => {
                                                                                        const link = document.createElement('a');
                                                                                        link.href = imageUrl;
                                                                                        link.download = image.original_filename || `generated-image-${new Date().toISOString().replace(/[:.]/g, '-')}.png`; // Use original filename for download
                                                                                        document.body.appendChild(link);
                                                                                        link.click();
                                                                                        document.body.removeChild(link);
                                                                                        toast.success(t('image_downloaded'));
                                                                                    }}
                                                                                    title={t('download_image')}
                                                                                >
                                                                                    <Download className="h-3.5 w-3.5" />
                                                                                </Button>
                                                                            </div>
                                                                        );
                                                                    })}
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
                                    {/* Copy button for assistant messages - positioned inside the message */}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className={`absolute top-2 right-2 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 hover:bg-background/90 transition-all duration-200 z-20 border border-border/50 bg-background/95 backdrop-blur-sm shadow-sm hover:scale-105`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            copyToClipboard(summaryContent || message.content, message.id);
                                        }}
                                        title={t('copy_message')}
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
                                <ContextMenuItem onSelect={() => copyToClipboard(summaryContent || message.content, message.id)}>
                                    <Copy className="h-4 w-4 mr-2" />
                                    {t('copy')}
                                </ContextMenuItem>
                                {onAddToPrompt && (
                                    <ContextMenuItem onSelect={() => onAddToPrompt(message.content)}>
                                        <Database className="h-4 w-4 mr-2" />
                                        {t('add_to_database')}
                                    </ContextMenuItem>
                                )}
                                {onDeleteMessage && (
                                    <ContextMenuItem
                                        onSelect={() => onDeleteMessage(message.id)}
                                        className="text-destructive focus:text-destructive"
                                    >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        {t('delete')}
                                    </ContextMenuItem>
                                )}
                            </ContextMenuContent>
                        </CM>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Message;