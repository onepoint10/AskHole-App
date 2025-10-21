import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { workflowSpacesAPI } from '@/services/api';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

/**
 * WorkspaceForm - Create or edit workspace
 */
export default function WorkspaceForm({ workspace, mode, onSave, onCancel }) {
    const { t, i18n } = useTranslation();

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        is_public: false,
    });
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});

    // Load workspace data for edit mode
    useEffect(() => {
        if (mode === 'edit' && workspace) {
            setFormData({
                name: workspace.name || '',
                description: workspace.description || '',
                is_public: workspace.is_public || false,
            });
        }
    }, [workspace, mode]);

    const validate = () => {
        const newErrors = {};

        if (!formData.name.trim()) {
            newErrors.name = t('Name is required');
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validate()) {
            return;
        }

        setSaving(true);
        try {
            if (mode === 'create') {
                await workflowSpacesAPI.createWorkspace(formData, i18n.language);
                toast.success(t('Workspace created successfully'));
            } else {
                await workflowSpacesAPI.updateWorkspace(workspace.id, formData, i18n.language);
                toast.success(t('Workspace updated successfully'));
            }

            onSave();
        } catch (error) {
            console.error('Error saving workspace:', error);
            toast.error(error.message || t('Failed to save workspace'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Name */}
            <div className="space-y-2">
                <Label htmlFor="name">
                    {t('Name')} <span className="text-destructive">*</span>
                </Label>
                <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t('Enter workspace name')}
                    className={errors.name ? 'border-destructive' : ''}
                />
                {errors.name && (
                    <p className="text-sm text-destructive">{errors.name}</p>
                )}
            </div>

            {/* Description */}
            <div className="space-y-2">
                <Label htmlFor="description">{t('Description')}</Label>
                <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={t('Enter workspace description (optional)')}
                    rows={4}
                />
            </div>

            {/* Is Public */}
            <div className="flex items-center space-x-2">
                <Checkbox
                    id="is_public"
                    checked={formData.is_public}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_public: checked })}
                />
                <Label htmlFor="is_public" className="font-normal cursor-pointer">
                    {t('Make this workspace public')}
                </Label>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4">
                <Button
                    type="submit"
                    disabled={saving}
                    className="flex-1"
                >
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {mode === 'create' ? t('Create Workspace') : t('Save Changes')}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={saving}
                >
                    {t('Cancel')}
                </Button>
            </div>
        </form>
    );
}
