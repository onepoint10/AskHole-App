import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ArrowLeft, MessageCircle } from 'lucide-react';
import { authAPI } from '../services/api';

const ForgotPassword = ({ onBackToLogin }) => {
    const { t, i18n } = useTranslation();
    const [identifier, setIdentifier] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            await authAPI.forgotPassword(identifier.trim(), i18n.language);
            setSuccess(true);
            setIdentifier('');
        } catch (err) {
            // Even on error, show generic success message for security
            // (backend might return error for configuration issues)
            setSuccess(true);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onBackToLogin}
                        className="w-fit mb-4"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        {t('forgot_password_back_to_login')}
                    </Button>
                    <CardTitle className="text-2xl">{t('forgot_password_title')}</CardTitle>
                    <CardDescription>{t('forgot_password_description')}</CardDescription>
                </CardHeader>
                <CardContent>
                    {!success ? (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="identifier">
                                    {t('forgot_password_email_or_username')}
                                </Label>
                                <Input
                                    id="identifier"
                                    type="text"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    placeholder={t('forgot_password_enter_email_or_username')}
                                    required
                                    autoFocus
                                    disabled={loading}
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={loading || !identifier.trim()}
                                className="w-full"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {t('forgot_password_sending')}
                                    </>
                                ) : (
                                    t('forgot_password_send_reset_link')
                                )}
                            </Button>
                        </form>
                    ) : (
                        <div className="space-y-4">
                            <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                                <MessageCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                                <AlertDescription className="text-green-800 dark:text-green-200">
                                    {t('forgot_password_success_message')}
                                </AlertDescription>
                            </Alert>

                            <Button
                                onClick={onBackToLogin}
                                variant="outline"
                                className="w-full"
                            >
                                {t('forgot_password_back_to_login')}
                            </Button>
                        </div>
                    )}

                    {error && (
                        <Alert variant="destructive" className="mt-4">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default ForgotPassword;
