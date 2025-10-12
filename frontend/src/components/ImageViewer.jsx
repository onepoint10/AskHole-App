import React, { useState, useEffect } from 'react';
import { X, Download, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const ImageViewer = ({ isOpen, imageUrl, imageName, onClose, onDownload }) => {
    const { t } = useTranslation();
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);

    // Reset zoom and rotation when image changes
    useEffect(() => {
        if (isOpen) {
            setZoom(1);
            setRotation(0);
        }
    }, [isOpen, imageUrl]);

    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Prevent body scroll when viewer is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleZoomIn = () => {
        setZoom(prev => Math.min(prev + 0.25, 3));
    };

    const handleZoomOut = () => {
        setZoom(prev => Math.max(prev - 0.25, 0.5));
    };

    const handleRotate = () => {
        setRotation(prev => (prev + 90) % 360);
    };

    const handleDownload = () => {
        if (onDownload) {
            onDownload();
        } else {
            // Fallback download logic
            const link = document.createElement('a');
            link.href = imageUrl;
            link.download = imageName || 'image.png';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success(t('image_downloaded'));
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
        >
            {/* Control Bar */}
            <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                <Button
                    variant="secondary"
                    size="icon"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleZoomOut();
                    }}
                    title={t('zoom_out')}
                    className="bg-background/80 backdrop-blur-sm hover:bg-background/90"
                >
                    <ZoomOut className="h-4 w-4" />
                </Button>

                <Button
                    variant="secondary"
                    size="icon"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleZoomIn();
                    }}
                    title={t('zoom_in')}
                    className="bg-background/80 backdrop-blur-sm hover:bg-background/90"
                >
                    <ZoomIn className="h-4 w-4" />
                </Button>

                <Button
                    variant="secondary"
                    size="icon"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleRotate();
                    }}
                    title={t('rotate')}
                    className="bg-background/80 backdrop-blur-sm hover:bg-background/90"
                >
                    <RotateCw className="h-4 w-4" />
                </Button>

                <Button
                    variant="secondary"
                    size="icon"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleDownload();
                    }}
                    title={t('download_image')}
                    className="bg-background/80 backdrop-blur-sm hover:bg-background/90"
                >
                    <Download className="h-4 w-4" />
                </Button>

                <Button
                    variant="secondary"
                    size="icon"
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}
                    title={t('close')}
                    className="bg-background/80 backdrop-blur-sm hover:bg-background/90"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Image Name */}
            {imageName && (
                <div className="absolute top-4 left-4 bg-background/80 backdrop-blur-sm px-4 py-2 rounded-lg text-sm font-medium z-10">
                    {imageName}
                </div>
            )}

            {/* Zoom Level Indicator */}
            <div className="absolute bottom-4 left-4 bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs font-medium z-10">
                {Math.round(zoom * 100)}%
            </div>

            {/* Image Container */}
            <div
                className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <img
                    src={imageUrl}
                    alt={imageName || t('image_viewer_alt')}
                    className="max-w-full max-h-full object-contain transition-transform duration-200 select-none"
                    style={{
                        transform: `scale(${zoom}) rotate(${rotation}deg)`,
                        cursor: zoom > 1 ? 'grab' : 'default'
                    }}
                    draggable={false}
                    onError={(e) => {
                        toast.error(t('failed_to_load_image'));
                        onClose();
                    }}
                />
            </div>

            {/* Click outside hint */}
            <div className="absolute bottom-4 right-4 bg-background/60 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs text-muted-foreground z-10">
                {t('click_outside_to_close')} • ESC
            </div>
        </div>
    );
};

export default ImageViewer;
