import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { toast } from 'sonner';

const ExaSettings = ({ settings, onUpdateSettings }) => {
    const { t } = useTranslation();
    const [exaApiKey, setExaApiKey] = useState(settings.exaApiKey || '');

    useEffect(() => {
        setExaApiKey(settings.exaApiKey || '');
    }, [settings.exaApiKey]);

    const handleSave = () => {
        onUpdateSettings({ ...settings, exaApiKey: exaApiKey });
        toast.success(t('exa.api_key_saved'));
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-medium">{t('exa.settings')}</h3>
            <div className="grid gap-2">
                <Label htmlFor="exa-api-key">{t('exa.api_key')}</Label>
                <Input
                    id="exa-api-key"
                    type="password"
                    value={exaApiKey}
                    onChange={(e) => setExaApiKey(e.target.value)}
                    placeholder={t('exa.enter_api_key')}
                />
            </div>
            <Button onClick={handleSave}>Save EXA API Key</Button>
        </div>
    );
};

export default ExaSettings;
