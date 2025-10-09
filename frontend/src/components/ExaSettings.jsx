import React, { useState, useEffect } from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { toast } from 'sonner';

const ExaSettings = ({ settings, onUpdateSettings }) => {
    const [exaApiKey, setExaApiKey] = useState(settings.exaApiKey || '');

    useEffect(() => {
        setExaApiKey(settings.exaApiKey || '');
    }, [settings.exaApiKey]);

    const handleSave = () => {
        onUpdateSettings({ ...settings, exaApiKey: exaApiKey });
        toast.success('Your EXA API key has been successfully saved.');
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-medium">EXA Search Settings</h3>
            <div className="grid gap-2">
                <Label htmlFor="exa-api-key">EXA API Key</Label>
                <Input
                    id="exa-api-key"
                    type="password"
                    value={exaApiKey}
                    onChange={(e) => setExaApiKey(e.target.value)}
                    placeholder="Enter your EXA API Key"
                />
            </div>
            <Button onClick={handleSave}>Save EXA API Key</Button>
        </div>
    );
};

export default ExaSettings;
