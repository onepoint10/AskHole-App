import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usersAPI, workflowSpacesAPI } from '@/services/api';
import { Search, UserPlus, Loader2, AlertCircle } from 'lucide-react';

/**
 * InviteMemberDialog - Search and invite users to workspace
 */
export default function InviteMemberDialog({ open, onOpenChange, workspace, onMemberAdded }) {
    const { t, i18n } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedRole, setSelectedRole] = useState('viewer');
    const [isInviting, setIsInviting] = useState(false);
    const [error, setError] = useState('');

    // Debounced search
    useEffect(() => {
        if (!open) {
            // Reset state when dialog closes
            setSearchQuery('');
            setSearchResults([]);
            setSelectedUser(null);
            setSelectedRole('viewer');
            setError('');
            return;
        }

        if (!searchQuery || searchQuery.length < 2) {
            setSearchResults([]);
            return;
        }

        const timeoutId = setTimeout(async () => {
            setIsSearching(true);
            setError('');
            try {
                const response = await usersAPI.searchUsers(searchQuery, i18n.language);
                const users = response.data || response;

                // Filter out users already in workspace
                const existingMemberIds = workspace.members?.map(m => m.user_id) || [];
                const filteredUsers = users.filter(user =>
                    !existingMemberIds.includes(user.id)
                );

                setSearchResults(filteredUsers);
            } catch (err) {
                console.error('Error searching users:', err);
                setError(t('Failed to search users'));
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [searchQuery, open, workspace.members, i18n.language, t]);

    const handleSelectUser = (user) => {
        setSelectedUser(user);
        setError('');
    };

    const handleInvite = async () => {
        if (!selectedUser) {
            setError(t('Please select a user'));
            return;
        }

        setIsInviting(true);
        setError('');

        try {
            await workflowSpacesAPI.addMember(
                workspace.id,
                {
                    user_id: selectedUser.id,
                    role: selectedRole
                },
                i18n.language
            );

            // Success - notify parent and close
            onMemberAdded?.();
            onOpenChange(false);

            // Reset state
            setSearchQuery('');
            setSearchResults([]);
            setSelectedUser(null);
            setSelectedRole('viewer');
        } catch (err) {
            console.error('Error inviting member:', err);
            const errorData = err.response?.data;
            setError(errorData?.error || t('Failed to invite member'));
        } finally {
            setIsInviting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5" />
                        {t('Invite Member')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('Search for users by username or email to invite them to this workspace')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Search Input */}
                    <div className="space-y-2">
                        <Label htmlFor="search">{t('Search Users')}</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="search"
                                placeholder={t('Enter username or email...')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                            {isSearching && (
                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                        </div>
                    </div>

                    {/* Search Results */}
                    {searchQuery.length >= 2 && (
                        <div className="space-y-2">
                            <Label>{t('Search Results')}</Label>
                            <div className="max-h-[200px] overflow-y-auto space-y-2 custom-scrollbar">
                                {searchResults.length === 0 && !isSearching && (
                                    <div className="text-center py-6 text-sm text-muted-foreground">
                                        {t('No users found')}
                                    </div>
                                )}
                                {searchResults.map((user) => (
                                    <Card
                                        key={user.id}
                                        className={`p-3 cursor-pointer transition-colors hover:bg-accent ${selectedUser?.id === user.id ? 'bg-accent border-primary' : ''
                                            }`}
                                        onClick={() => handleSelectUser(user)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-medium">{user.username}</p>
                                                <p className="text-sm text-muted-foreground">{user.email}</p>
                                            </div>
                                            {selectedUser?.id === user.id && (
                                                <Badge variant="default">{t('Selected')}</Badge>
                                            )}
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Selected User & Role */}
                    {selectedUser && (
                        <div className="space-y-2">
                            <Label>{t('Selected User')}</Label>
                            <Card className="p-3 bg-accent">
                                <p className="font-medium">{selectedUser.username}</p>
                                <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                            </Card>

                            <div className="space-y-2 pt-2">
                                <Label htmlFor="role">{t('Role')}</Label>
                                <Select value={selectedRole} onValueChange={setSelectedRole}>
                                    <SelectTrigger id="role">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="viewer">
                                            <div className="flex flex-col items-start">
                                                <span className="font-medium">{t('Viewer')}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {t('Can view prompts and execute workflows')}
                                                </span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="editor">
                                            <div className="flex flex-col items-start">
                                                <span className="font-medium">{t('Editor')}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {t('Can edit prompts and manage content')}
                                                </span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="owner">
                                            <div className="flex flex-col items-start">
                                                <span className="font-medium">{t('Owner')}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {t('Full access including member management')}
                                                </span>
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                            <AlertCircle className="h-4 w-4" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isInviting}
                    >
                        {t('Cancel')}
                    </Button>
                    <Button
                        onClick={handleInvite}
                        disabled={!selectedUser || isInviting}
                    >
                        {isInviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('Invite')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
