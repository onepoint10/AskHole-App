import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { MessageCircle, X, AlertTriangle } from 'lucide-react';

const TelegramLinkingPrompt = ({ currentUser, onLinkNow, onDismiss }) => {
    const { t } = useTranslation();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (!currentUser) {
            setIsVisible(false);
            return;
        }

        // Check if already linked
        if (currentUser.telegram_linked) {
            setIsVisible(false);
            return;
        }

        // Always show for unlinked users (no localStorage check)
        setIsVisible(true);
    }, [currentUser]);

    const handleDismiss = () => {
        // Only hide for current session, don't persist to localStorage
        setIsVisible(false);
        if (onDismiss) {
            onDismiss();
        }
    };

    const handleLinkNow = () => {
        setIsVisible(false);
        if (onLinkNow) {
            onLinkNow();
        }
    };

    if (!isVisible) {
        return null;
    }

    return (
        <div className="px-4 pt-4">
            <Alert className="mb-4 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
                <MessageCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                <button
                    onClick={handleDismiss}
                    className="absolute right-2 top-2 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
                >
                    <X className="h-4 w-4" />
                    <span className="sr-only">{t('close')}</span>
                </button>
                <AlertTitle className="text-orange-900 dark:text-orange-100 pr-6">
                    {t('telegram_prompt_title') || 'Link Your Telegram for Account Security'}
                </AlertTitle>
                <AlertDescription className="space-y-3">
                    <p className="text-orange-800 dark:text-orange-200">
                        {t('telegram_prompt_description') ||
                            'We recommend linking your Telegram account to enable password recovery. Without it, you may lose access to your account and all your chat history.'}
                    </p>
                    <div className="flex items-start gap-2 text-xs text-orange-700 dark:text-orange-300">
                        <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <p>
                            {t('telegram_prompt_warning') ||
                                'Warning: If you forget your password and haven\'t linked Telegram, you will permanently lose access to your entire chat history and personal prompts database.'}
                        </p>
                    </div>
                    <div className="flex gap-2 pt-1">
                        <Button
                            onClick={handleLinkNow}
                            size="sm"
                            className="bg-orange-600 hover:bg-orange-700 text-white"
                        >
                            {t('telegram_prompt_link_now') || 'Link Now'}
                        </Button>
                        <Button
                            onClick={handleDismiss}
                            size="sm"
                            variant="outline"
                            className="border-orange-300 text-orange-900 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-100 dark:hover:bg-orange-900"
                        >
                            {t('telegram_prompt_skip') || 'Skip for Now'}
                        </Button>
                    </div>
                </AlertDescription>
            </Alert>
        </div>
    );
};

export default TelegramLinkingPrompt;
