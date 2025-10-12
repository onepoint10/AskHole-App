import { useState, useEffect } from 'react';
import { getBaseApiUrl } from '@/services/api';

/**
 * Custom hook to fetch images with authentication credentials
 * Returns a blob URL that can be used in img src attributes
 */
const useAuthenticatedImage = (imageUrl) => {
    const [blobUrl, setBlobUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!imageUrl) {
            setLoading(false);
            return;
        }

        // If it's already a blob URL or data URL, use it directly
        if (imageUrl.startsWith('blob:') || imageUrl.startsWith('data:')) {
            setBlobUrl(imageUrl);
            setLoading(false);
            return;
        }

        let isMounted = true;
        const abortController = new AbortController();

        const fetchImage = async () => {
            try {
                setLoading(true);
                setError(null);

                // Get session ID from localStorage
                const sessionId = localStorage.getItem('session_id');

                // Fetch image with credentials
                const response = await fetch(imageUrl, {
                    credentials: 'include',
                    mode: 'cors',
                    headers: {
                        'Authorization': `Bearer ${sessionId}`,
                    },
                    signal: abortController.signal,
                });

                if (!response.ok) {
                    throw new Error(`Failed to load image: ${response.status} ${response.statusText}`);
                }

                const blob = await response.blob();

                if (isMounted) {
                    const url = URL.createObjectURL(blob);
                    setBlobUrl(url);
                    setLoading(false);
                }
            } catch (err) {
                if (err.name !== 'AbortError' && isMounted) {
                    console.error('Error fetching authenticated image:', err);
                    setError(err.message);
                    setLoading(false);
                }
            }
        };

        fetchImage();

        // Cleanup function
        return () => {
            isMounted = false;
            abortController.abort();

            // Revoke the blob URL to free memory
            if (blobUrl && blobUrl.startsWith('blob:')) {
                URL.revokeObjectURL(blobUrl);
            }
        };
    }, [imageUrl]);

    return { blobUrl, loading, error };
};

export default useAuthenticatedImage;
