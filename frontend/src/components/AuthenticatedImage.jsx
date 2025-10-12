import React from 'react';
import useAuthenticatedImage from '@/hooks/useAuthenticatedImage';

const AuthenticatedImage = ({ src, alt, className, onClick, onError, ...props }) => {
    const { blobUrl, loading, error } = useAuthenticatedImage(src);

    React.useEffect(() => {
        if (error && onError) {
            onError(new Error(error));
        }
    }, [error, onError]);

    if (loading) {
        return (
            <div
                className={`${className} flex items-center justify-center bg-muted/50 animate-pulse`}
                {...props}
            >
                <svg
                    className="w-8 h-8 text-muted-foreground animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                    />
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                </svg>
            </div>
        );
    }

    if (error) {
        return (
            <div
                className={`${className} flex items-center justify-center bg-destructive/10 text-destructive text-sm`}
                {...props}
            >
                Failed to load image
            </div>
        );
    }

    return (
        <img
            src={blobUrl || src}
            alt={alt}
            className={className}
            onClick={onClick}
            onError={onError}
            {...props}
        />
    );
};

export default AuthenticatedImage;
