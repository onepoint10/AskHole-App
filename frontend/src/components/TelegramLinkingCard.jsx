import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Loader2, MessageCircle, Clock } from 'lucide-react';
import { authAPI } from '../services/api';

const TelegramLinkingCard = ({ currentUser, onLinked }) => {
    const { t, i18n } = useTranslation();
    const [linkingCode, setLinkingCode] = useState(null);
    const [loading, setLoading] = useState(false);
    const [unlinking, setUnlinking] = useState(false);
    const [error, setError] = useState(null);
    const [expiresAt, setExpiresAt] = useState(null);
    const [timeRemaining, setTimeRemaining] = useState(null);
    const intervalRef = useRef(null);
    const pollIntervalRef = useRef(null);

    // Check if already linked
    const isLinked = currentUser?.telegram_linked || false;

    // Debug logging
    useEffect(() => {
        console.log('TelegramLinkingCard - currentUser:', currentUser);
        console.log('TelegramLinkingCard - telegram_linked:', currentUser?.telegram_linked);
        console.log('TelegramLinkingCard - isLinked:', isLinked);
    }, [currentUser, isLinked]);

    // Cleanup intervals on unmount
    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
        };
    }, []);

    // Update countdown timer
    useEffect(() => {
        if (!expiresAt) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        const updateTimer = () => {
            const now = new Date();
            const expires = new Date(expiresAt);

            // Debug logs
            console.log('Current time:', now.toISOString());
            console.log('Expires at:', expires.toISOString());
            console.log('Time diff (seconds):', (expires - now) / 1000);

            const diff = Math.max(0, Math.floor((expires - now) / 1000));

            setTimeRemaining(diff);

            if (diff === 0) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
                setLinkingCode(null);
                setExpiresAt(null);
                setError(t('telegram_code_expired'));
            }
        };

        updateTimer();
        intervalRef.current = setInterval(updateTimer, 1000);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [expiresAt, t]);

    const formatTimeRemaining = () => {
        if (timeRemaining === null) return '';

        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;

        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const requestLinkingCode = async () => {
        setLoading(true);
        setError(null);
        setLinkingCode(null); // Clear any previous code
        setExpiresAt(null); // Clear any previous expiration
        setTimeRemaining(null); // Clear timer

        try {
            const response = await authAPI.requestTelegramLink(i18n.language);
            const data = response.data;

            console.log('Linking code response:', data); // Debug log
            console.log('Expires at:', data.expires_at); // Debug log
            console.log('Current time:', new Date().toISOString()); // Debug log

            setLinkingCode(data.code);
            setExpiresAt(data.expires_at);

            // Start polling for link completion every 3 seconds
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }

            pollIntervalRef.current = setInterval(() => {
                if (onLinked) {
                    onLinked(); // This will trigger checkAuthStatus in App.jsx
                }
            }, 3000); // Poll every 3 seconds

        } catch (err) {
            const errorMsg = err.message || t('telegram_failed_to_generate_code');
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    // Stop polling when linked or when code expires
    useEffect(() => {
        if (isLinked || !linkingCode) {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        }
    }, [isLinked, linkingCode]);

    const handleUnlink = async () => {
        if (!confirm(t('telegram_unlink_confirmation') || 'Are you sure you want to unlink your Telegram account?')) {
            return;
        }

        setUnlinking(true);
        setError(null);

        try {
            await authAPI.unlinkTelegram(i18n.language);

            // Trigger refresh to update user data
            if (onLinked) {
                onLinked();
            }
        } catch (err) {
            const errorMsg = err.message || t('telegram_failed_to_unlink') || 'Failed to unlink Telegram account';
            setError(errorMsg);
        } finally {
            setUnlinking(false);
        }
    };

    if (isLinked) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MessageCircle className="h-5 w-5" />
                        {t('telegram_linking')}
                    </CardTitle>
                    <CardDescription>{t('telegram_linking_description')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <AlertDescription className="text-green-800 dark:text-green-200">
                            {t('telegram_account_linked_successfully')}
                        </AlertDescription>
                    </Alert>
                    <p className="text-sm text-muted-foreground">
                        {t('telegram_linked_benefit')}
                    </p>
                    <Button
                        onClick={handleUnlink}
                        disabled={unlinking}
                        variant="outline"
                        className="w-full"
                    >
                        {unlinking ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {t('telegram_unlinking') || 'Unlinking...'}
                            </>
                        ) : (
                            t('telegram_unlink_account') || 'Unlink Telegram Account'
                        )}
                    </Button>
                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5" />
                    {t('telegram_linking')}
                </CardTitle>
                <CardDescription>{t('telegram_linking_description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {!linkingCode ? (
                    <>
                        <p className="text-sm text-muted-foreground">
                            {t('telegram_link_instructions')}
                        </p>
                        <Button
                            onClick={requestLinkingCode}
                            disabled={loading}
                            className="w-full"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {t('telegram_generating_code')}
                                </>
                            ) : (
                                t('telegram_generate_code')
                            )}
                        </Button>
                    </>
                ) : (
                    <>
                        <div className="bg-muted p-4 rounded-lg text-center space-y-2">
                            <p className="text-sm text-muted-foreground">
                                {t('telegram_linking_code')}
                            </p>
                            <p className="text-4xl font-mono font-bold tracking-wider">
                                {linkingCode}
                            </p>
                            {timeRemaining !== null && (
                                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                    <Clock className="h-4 w-4" />
                                    <span>
                                        {t('telegram_code_expires_in')}: {formatTimeRemaining()}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2 text-sm text-muted-foreground">
                            <p className="font-medium">{t('telegram_linking_instructions')}</p>
                            <ol className="list-decimal list-inside space-y-1 ml-2">
                                <li>{t('telegram_instruction_1')} @{t('telegram_bot_username')}</li>
                                <li>{t('telegram_instruction_2')}</li>
                                <li>{t('telegram_instruction_3')}</li>
                            </ol>
                        </div>

                        <Button
                            onClick={requestLinkingCode}
                            variant="outline"
                            size="sm"
                            className="w-full"
                        >
                            {t('telegram_generate_new_code')}
                        </Button>
                    </>
                )}

                {error && (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>
    );
};

export default TelegramLinkingCard;
