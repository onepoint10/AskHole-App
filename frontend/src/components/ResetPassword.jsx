import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { authAPI } from '../services/api';

const ResetPassword = ({ token, onSuccess, onBackToLogin }) => {
    const { t, i18n } = useTranslation();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Password strength indicators
    const [passwordStrength, setPasswordStrength] = useState({
        hasMinLength: false,
        hasUppercase: false,
        hasLowercase: false,
        hasNumber: false,
        hasSpecialChar: false
    });

    useEffect(() => {
        setPasswordStrength({
            hasMinLength: newPassword.length >= 8,
            hasUppercase: /[A-Z]/.test(newPassword),
            hasLowercase: /[a-z]/.test(newPassword),
            hasNumber: /[0-9]/.test(newPassword),
            hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword)
        });
    }, [newPassword]);

    const getPasswordStrength = () => {
        const score = Object.values(passwordStrength).filter(Boolean).length;
        if (score <= 2) return { label: t('reset_password_strength_weak'), color: 'text-red-600 dark:text-red-400' };
        if (score === 3) return { label: t('reset_password_strength_medium'), color: 'text-orange-600 dark:text-orange-400' };
        if (score === 4) return { label: t('reset_password_strength_strong'), color: 'text-yellow-600 dark:text-yellow-400' };
        return { label: t('reset_password_strength_very_strong'), color: 'text-green-600 dark:text-green-400' };
    };

    const isPasswordValid = () => {
        return passwordStrength.hasMinLength &&
            passwordStrength.hasUppercase &&
            passwordStrength.hasLowercase &&
            passwordStrength.hasNumber &&
            passwordStrength.hasSpecialChar;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Validation
        if (!isPasswordValid()) {
            setError(t('reset_password_failed'));
            setLoading(false);
            return;
        }

        if (newPassword !== confirmPassword) {
            setError(t('reset_password_passwords_do_not_match'));
            setLoading(false);
            return;
        }

        try {
            await authAPI.resetPassword(token, newPassword, i18n.language);
            setSuccess(true);

            // Redirect to login after 3 seconds
            setTimeout(() => {
                if (onSuccess) {
                    onSuccess();
                } else if (onBackToLogin) {
                    onBackToLogin();
                }
            }, 3000);

        } catch (err) {
            setError(err.message || t('reset_password_failed'));
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <Card className="w-full max-w-md">
                    <CardContent className="pt-6">
                        <div className="text-center space-y-4">
                            <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-400 mx-auto" />
                            <div>
                                <h2 className="text-2xl font-bold">{t('reset_password_title')}</h2>
                                <p className="text-muted-foreground mt-2">
                                    {t('password_reset_successfully')}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const strength = getPasswordStrength();

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-2xl">{t('reset_password_title')}</CardTitle>
                    <CardDescription>{t('reset_password_description')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="newPassword">
                                {t('reset_password_new_password')}
                            </Label>
                            <div className="relative">
                                <Input
                                    id="newPassword"
                                    type={showPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder={t('reset_password_enter_new_password')}
                                    required
                                    autoFocus
                                    disabled={loading}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? t('reset_password_hide_password') : t('reset_password_show_password')}
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>

                            {/* Password strength indicator */}
                            {newPassword && (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-sm">
                                        <span>{t('reset_password_strength')}:</span>
                                        <span className={`font-medium ${strength.color}`}>{strength.label}</span>
                                    </div>
                                </div>
                            )}

                            {/* Password requirements */}
                            <div className="space-y-1 text-sm">
                                <p className="font-medium text-muted-foreground">{t('reset_password_requirements')}</p>
                                <div className={passwordStrength.hasMinLength ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                                    {passwordStrength.hasMinLength ? '✓' : '○'} {t('reset_password_min_length')}
                                </div>
                                <div className={passwordStrength.hasUppercase ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                                    {passwordStrength.hasUppercase ? '✓' : '○'} {t('reset_password_uppercase')}
                                </div>
                                <div className={passwordStrength.hasLowercase ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                                    {passwordStrength.hasLowercase ? '✓' : '○'} {t('reset_password_lowercase')}
                                </div>
                                <div className={passwordStrength.hasNumber ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                                    {passwordStrength.hasNumber ? '✓' : '○'} {t('reset_password_number')}
                                </div>
                                <div className={passwordStrength.hasSpecialChar ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                                    {passwordStrength.hasSpecialChar ? '✓' : '○'} {t('reset_password_special_char')}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">
                                {t('reset_password_confirm_password')}
                            </Label>
                            <div className="relative">
                                <Input
                                    id="confirmPassword"
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder={t('reset_password_confirm_new_password')}
                                    required
                                    disabled={loading}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    aria-label={showConfirmPassword ? t('reset_password_hide_password') : t('reset_password_show_password')}
                                >
                                    {showConfirmPassword ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={loading || !isPasswordValid() || !confirmPassword}
                            className="w-full"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {t('reset_password_resetting')}
                                </>
                            ) : (
                                t('reset_password_submit')
                            )}
                        </Button>
                    </form>

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

export default ResetPassword;
