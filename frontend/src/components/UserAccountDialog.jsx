import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    User,
    Lock,
    Palette,
    AlertTriangle,
    LogOut,
    Trash2,
    Moon,
    Sun,
    Monitor,
    Globe
} from 'lucide-react';
import TelegramLinkingCard from './TelegramLinkingCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { usersAPI } from '@/services/api';

const UserAccountDialog = ({
    isOpen,
    onClose,
    currentUser,
    onUserUpdate,
    onLogout,
    onDeleteAccount,
    settings,
    onUpdateSettings,
    defaultTab = 'profile',
}) => {
    const { t, i18n } = useTranslation();
    const [activeTab, setActiveTab] = useState(defaultTab);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Profile form state
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');

    // Password form state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Initialize form with current user data
    useEffect(() => {
        if (currentUser) {
            setUsername(currentUser.username || '');
            setEmail(currentUser.email || '');
        }
    }, [currentUser]);

    // Reset to default tab when dialog opens
    useEffect(() => {
        if (isOpen) {
            setActiveTab(defaultTab);
        }
    }, [isOpen, defaultTab]);

    // Clear messages when tab changes
    useEffect(() => {
        setError('');
        setSuccess('');
    }, [activeTab]);

    const handleUpdateProfile = async () => {
        if (!currentUser) return;

        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            // Validate
            if (!username.trim() || username.length < 3) {
                setError(t('user_account_username_validation'));
                setIsLoading(false);
                return;
            }

            if (!email.trim() || !email.includes('@')) {
                setError(t('user_account_email_validation'));
                setIsLoading(false);
                return;
            }

            const updates = {};
            if (username !== currentUser.username) updates.username = username;
            if (email !== currentUser.email) updates.email = email;

            if (Object.keys(updates).length === 0) {
                setSuccess(t('user_account_no_changes'));
                setIsLoading(false);
                return;
            }

            const response = await usersAPI.updateUser(currentUser.id, updates, i18n.language);
            setSuccess(t('user_account_profile_updated'));

            if (onUserUpdate) {
                onUserUpdate(response.data);
            }
        } catch (error) {
            setError(error.message || t('user_account_update_failed'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleChangePassword = async () => {
        if (!currentUser) return;

        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            // Validate
            if (!currentPassword) {
                setError(t('user_account_current_password_required'));
                setIsLoading(false);
                return;
            }

            if (!newPassword || newPassword.length < 6) {
                setError(t('user_account_new_password_validation'));
                setIsLoading(false);
                return;
            }

            if (newPassword !== confirmPassword) {
                setError(t('user_account_passwords_dont_match'));
                setIsLoading(false);
                return;
            }

            await usersAPI.changePassword(currentUser.id, currentPassword, newPassword, i18n.language);
            setSuccess(t('user_account_password_changed'));

            // Clear password fields
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error) {
            setError(error.message || t('user_account_password_change_failed'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!currentUser) return;

        setShowDeleteConfirm(false);
        setIsLoading(true);

        try {
            await usersAPI.deleteUser(currentUser.id, i18n.language);
            if (onDeleteAccount) {
                onDeleteAccount();
            }
        } catch (error) {
            setError(error.message || t('user_account_delete_failed'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleLanguageChange = (lng) => {
        i18n.changeLanguage(lng);
        // Update settings immediately
        onUpdateSettings({ ...settings, language: lng });
        setSuccess(t('user_account_language_changed'));
    };

    const handleThemeChange = (newTheme) => {
        // Update settings immediately so App.jsx's useEffect applies the theme
        onUpdateSettings({ ...settings, theme: newTheme });
        setSuccess(t('user_account_theme_changed'));
    };

    if (!currentUser) return null;

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" />
                            {t('user_account_title')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('user_account_description')}
                        </DialogDescription>
                    </DialogHeader>

                    {error && (
                        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="bg-green-500/10 text-green-500 px-4 py-3 rounded-lg text-sm">
                            {success}
                        </div>
                    )}

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="profile">
                                <User className="h-4 w-4 mr-2" />
                                {t('user_account_tab_profile')}
                            </TabsTrigger>
                            <TabsTrigger value="security">
                                <Lock className="h-4 w-4 mr-2" />
                                {t('user_account_tab_security')}
                            </TabsTrigger>
                            <TabsTrigger value="preferences">
                                <Palette className="h-4 w-4 mr-2" />
                                {t('user_account_tab_preferences')}
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="profile" className="space-y-4 mt-4">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="username">{t('user_account_username')}</Label>
                                    <Input
                                        id="username"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder={t('user_account_username_placeholder')}
                                        disabled={isLoading}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {t('user_account_username_hint')}
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="email">{t('user_account_email')}</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder={t('user_account_email_placeholder')}
                                        disabled={isLoading}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {t('user_account_email_hint')}
                                    </p>
                                </div>

                                <Button
                                    onClick={handleUpdateProfile}
                                    disabled={isLoading}
                                    className="w-full"
                                >
                                    {isLoading ? t('user_account_saving') : t('user_account_save_profile')}
                                </Button>

                                {/* Danger Zone Section in Profile Tab */}
                                <div className="pt-6 space-y-4 border-t">
                                    <div className="border border-yellow-500/50 bg-yellow-500/10 rounded-lg p-4">
                                        <h4 className="font-medium text-yellow-500 mb-2">
                                            {t('user_account_logout_title')}
                                        </h4>
                                        <p className="text-sm text-muted-foreground mb-3">
                                            {t('user_account_logout_description')}
                                        </p>
                                        <Button
                                            onClick={onLogout}
                                            variant="outline"
                                            className="w-full"
                                        >
                                            <LogOut className="h-4 w-4 mr-2" />
                                            {t('logout')}
                                        </Button>
                                    </div>

                                    <div className="border border-destructive/50 bg-destructive/10 rounded-lg p-4">
                                        <h4 className="font-medium text-destructive mb-2">
                                            {t('user_account_delete_title')}
                                        </h4>
                                        <p className="text-sm text-muted-foreground mb-3">
                                            {t('user_account_delete_description')}
                                        </p>
                                        <Button
                                            onClick={() => setShowDeleteConfirm(true)}
                                            variant="destructive"
                                            className="w-full"
                                        >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            {t('user_account_delete_button')}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="security" className="space-y-4 mt-4">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="current-password">{t('user_account_current_password')}</Label>
                                    <Input
                                        id="current-password"
                                        type="password"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        placeholder={t('user_account_current_password_placeholder')}
                                        disabled={isLoading}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="new-password">{t('user_account_new_password')}</Label>
                                    <Input
                                        id="new-password"
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder={t('user_account_new_password_placeholder')}
                                        disabled={isLoading}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {t('user_account_password_requirements')}
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="confirm-password">{t('user_account_confirm_password')}</Label>
                                    <Input
                                        id="confirm-password"
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder={t('user_account_confirm_password_placeholder')}
                                        disabled={isLoading}
                                    />
                                </div>

                                <Button
                                    onClick={handleChangePassword}
                                    disabled={isLoading}
                                    className="w-full"
                                >
                                    {isLoading ? t('user_account_changing') : t('user_account_change_password')}
                                </Button>

                                {/* Telegram Linking Section */}
                                <div className="mt-6 pt-6 border-t">
                                    <TelegramLinkingCard
                                        currentUser={currentUser}
                                        onLinked={onUserUpdate}
                                    />
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="preferences" className="space-y-4 mt-4">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="language">
                                        <Globe className="h-4 w-4 inline mr-2" />
                                        {t('user_account_language')}
                                    </Label>
                                    <Select
                                        value={i18n.language}
                                        onValueChange={handleLanguageChange}
                                    >
                                        <SelectTrigger id="language">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="en">{t('english')}</SelectItem>
                                            <SelectItem value="fr">{t('french')}</SelectItem>
                                            <SelectItem value="ru">{t('russian')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="theme">{t('user_account_theme')}</Label>
                                    <Select
                                        value={settings?.theme || 'system'}
                                        onValueChange={handleThemeChange}
                                    >
                                        <SelectTrigger id="theme">
                                            <SelectValue placeholder={t('select_theme')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="light">
                                                <div className="flex items-center gap-2">
                                                    <Sun className="h-4 w-4" />
                                                    {t('light')}
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="dark">
                                                <div className="flex items-center gap-2">
                                                    <Moon className="h-4 w-4" />
                                                    {t('dark')}
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="system">
                                                <div className="flex items-center gap-2">
                                                    <Monitor className="h-4 w-4" />
                                                    {t('system')}
                                                </div>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>

                    <DialogFooter>
                        <Button variant="outline" onClick={onClose}>
                            {t('close')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Account Confirmation Dialog */}
            <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('user_account_delete_confirm_title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('user_account_delete_confirm_description')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteAccount}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {t('user_account_delete_confirm_button')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

export default UserAccountDialog;
