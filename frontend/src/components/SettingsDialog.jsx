import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Settings,
  Key,
  Palette,
  Sliders,
  Moon,
  Sun,
  Monitor,
  Plus,
  Trash2,
  Shield
} from 'lucide-react';
import AddProviderDialog from './AddProviderDialog';
import AddModelDialog from './AddModelDialog';
import ExaSettings from './ExaSettings';
import TelegramLinkingCard from './TelegramLinkingCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

const SettingsDialog = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  availableModels,
  currentUser,
  onUserUpdate,
  defaultTab = 'api'
}) => {
  const { t, i18n } = useTranslation();
  const [localSettings, setLocalSettings] = useState(settings);
  const [isAddProviderOpen, setIsAddProviderOpen] = useState(false);
  const [isAddModelOpen, setIsAddModelOpen] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = () => {
    onUpdateSettings(localSettings);
    onClose();
  };

  const updateSetting = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleAddProvider = (provider) => {
    const customProviders = localSettings.customProviders || [];
    const newProviders = [...customProviders, provider];
    updateSetting('customProviders', newProviders);
  };

  const handleAddModel = (modelName) => {
    // Support both legacy string and new object { name, providerKey }
    const incoming = typeof modelName === 'string' ? { name: modelName, providerKey: '' } : modelName;
    const customModels = localSettings.customModels || [];
    const newModels = [...customModels, incoming.name];
    const existingBindings = localSettings.customModelBindings || {};
    const newBindings = { ...existingBindings };
    if (incoming.providerKey) {
      newBindings[incoming.name] = incoming.providerKey;
    }
    updateSetting('customModels', newModels);
    updateSetting('customModelBindings', newBindings);
  };

  const handleRemoveProvider = (index) => {
    const customProviders = localSettings.customProviders || [];
    const newProviders = customProviders.filter((_, i) => i !== index);
    updateSetting('customProviders', newProviders);
  };

  const handleRemoveModel = (index) => {
    const customModels = localSettings.customModels || [];
    const modelToRemove = customModels[index];
    const newModels = customModels.filter((_, i) => i !== index);
    const existingBindings = { ...(localSettings.customModelBindings || {}) };
    if (modelToRemove && existingBindings[modelToRemove]) {
      delete existingBindings[modelToRemove];
    }
    updateSetting('customModels', newModels);
    updateSetting('customModelBindings', existingBindings);
  };

  const handleLanguageChange = (lng) => {
    console.log('Language change requested:', lng);
    i18n.changeLanguage(lng);
    updateSetting('language', lng);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t('settings')}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="api">{t('api_keys')}</TabsTrigger>
            <TabsTrigger value="models">{t('models')}</TabsTrigger>
            <TabsTrigger value="security">{t('security')}</TabsTrigger>
            <TabsTrigger value="appearance">{t('appearance')}</TabsTrigger>
            <TabsTrigger value="advanced">{t('advanced')}</TabsTrigger>
            <TabsTrigger value="exa">EXA Search</TabsTrigger>
          </TabsList>

          <TabsContent value="api" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Key className="h-4 w-4" />
                <h3 className="text-lg font-medium">{t('api_configuration')}</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gemini-key">{t('gemini_api_key')}</Label>
                <Input
                  id="gemini-key"
                  type="password"
                  value={localSettings.geminiApiKey || ''}
                  onChange={(e) => updateSetting('geminiApiKey', e.target.value)}
                  placeholder={t('enter_gemini_api_key')}
                />
                <p className="text-xs text-muted-foreground">
                  {t('get_api_key_gemini')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="openrouter-key">{t('openrouter_api_key')}</Label>
                <Input
                  id="openrouter-key"
                  type="password"
                  value={localSettings.openrouterApiKey || ''}
                  onChange={(e) => updateSetting('openrouterApiKey', e.target.value)}
                  placeholder={t('enter_openrouter_api_key')}
                />
                <p className="text-xs text-muted-foreground">
                  {t('get_api_key_openrouter')}
                </p>
              </div>

              {/* Custom Providers Section */}
              <div className="space-y-4 pt-6 border-t">
                <div className="flex items-center justify-between">
                  <h4 className="text-md font-medium">{t('custom_providers')}</h4>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setIsAddProviderOpen(true)}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    {t('add_provider')}
                  </Button>
                </div>

                {(localSettings.customProviders || []).length > 0 ? (
                  <div className="space-y-2">
                    {localSettings.customProviders.map((provider, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">{provider.name}</div>
                          <div className="text-sm text-muted-foreground">{provider.base_url}</div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleRemoveProvider(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t('no_custom_providers')}
                  </p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="models" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Sliders className="h-4 w-4" />
                <h3 className="text-lg font-medium">{t('model_configuration')}</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="default-model">{t('default_model')}</Label>
                <Select
                  value={localSettings.defaultModel || ''}
                  onValueChange={(value) => {
                    console.log('Default model change requested:', value);
                    updateSetting('defaultModel', value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_default_model')} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.gemini?.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model} (Gemini)
                      </SelectItem>
                    ))}
                    {availableModels.openrouter?.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model} (OpenRouter)
                      </SelectItem>
                    ))}
                    {availableModels.custom?.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model} (Custom)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="temperature">
                  {t('temperature')}: {localSettings.temperature || 1.0}
                </Label>
                <Slider
                  id="temperature"
                  min={0}
                  max={2}
                  step={0.1}
                  value={[localSettings.temperature || 1.0]}
                  onValueChange={(value) => updateSetting('temperature', value[0])}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  {t('temperature_description')}
                </p>
              </div>

              {/* Custom Models Section */}
              <div className="space-y-4 pt-6 border-t">
                <div className="flex items-center justify-between">
                  <h4 className="text-md font-medium">{t('custom_models')}</h4>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setIsAddModelOpen(true)}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    {t('add_model')}
                  </Button>
                </div>

                {(localSettings.customModels || []).length > 0 ? (
                  <div className="space-y-2">
                    {localSettings.customModels.map((model, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">{model}</div>
                          {localSettings.customModelBindings?.[model] && (
                            <div className="text-xs text-muted-foreground">
                              {t('bound_to')}: {localSettings.customModelBindings[model]}
                            </div>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleRemoveModel(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t('no_custom_models')}
                  </p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-4 w-4" />
                <h3 className="text-lg font-medium">{t('security')}</h3>
              </div>

              <TelegramLinkingCard
                currentUser={currentUser}
                onLinked={onUserUpdate}
              />
            </div>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Palette className="h-4 w-4" />
                <h3 className="text-lg font-medium">{t('appearance')}</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">{t('language')}</Label>
                <Select
                  value={localSettings.language || i18n.language}
                  onValueChange={handleLanguageChange}
                >
                  <SelectTrigger id="language">
                    <SelectValue placeholder={t('select_language')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">{t('english')}</SelectItem>
                    <SelectItem value="fr">{t('french')}</SelectItem>
                    <SelectItem value="ru">{t('russian')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="theme">{t('theme')}</Label>
                <Select
                  value={localSettings.theme || 'system'}
                  onValueChange={(value) => {
                    console.log('Theme change requested:', value);
                    updateSetting('theme', value);
                  }}
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

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="compact-mode">{t('compact_mode')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('compact_mode_description')}
                  </p>
                </div>
                <Switch
                  id="compact-mode"
                  checked={localSettings.compactMode || false}
                  onCheckedChange={(checked) => updateSetting('compactMode', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="show-timestamps">{t('show_timestamps')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('show_timestamps_description')}
                  </p>
                </div>
                <Switch
                  id="show-timestamps"
                  checked={localSettings.showTimestamps || false}
                  onCheckedChange={(checked) => updateSetting('showTimestamps', checked)}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="h-4 w-4" />
                <h3 className="text-lg font-medium">{t('advanced_settings')}</h3>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-save">{t('auto_save_chats')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('auto_save_chats_description')}
                  </p>
                </div>
                <Switch
                  id="auto-save"
                  checked={localSettings.autoSave !== false}
                  onCheckedChange={(checked) => updateSetting('autoSave', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="stream-responses">{t('stream_responses')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('stream_responses_description')}
                  </p>
                </div>
                <Switch
                  id="stream-responses"
                  checked={localSettings.streamResponses || false}
                  onCheckedChange={(checked) => updateSetting('streamResponses', checked)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-tokens">{t('max_tokens_per_response')}</Label>
                <Input
                  id="max-tokens"
                  type="number"
                  value={localSettings.maxTokens || 4096}
                  onChange={(e) => updateSetting('maxTokens', parseInt(e.target.value))}
                  placeholder="4096"
                />
                <p className="text-xs text-muted-foreground">
                  {t('max_tokens_description')}
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="exa" className="space-y-4">
            <ExaSettings settings={localSettings} onUpdateSettings={onUpdateSettings} />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSave}>
            {t('save_settings')}
          </Button>
        </div>
      </DialogContent>

      {/* Add Provider Dialog */}
      <AddProviderDialog
        isOpen={isAddProviderOpen}
        onClose={() => setIsAddProviderOpen(false)}
        onAddProvider={handleAddProvider}
      />

      {/* Add Model Dialog */}
      <AddModelDialog
        isOpen={isAddModelOpen}
        onClose={() => setIsAddModelOpen(false)}
        onAddModel={handleAddModel}
        availableProviders={[
          { key: 'gemini', label: 'Gemini' },
          { key: 'openrouter', label: 'OpenRouter' },
          ...((localSettings.customProviders || []).map((p, idx) => ({ key: `custom:${idx}`, label: `Custom: ${p.name}` })))
        ]}
      />
    </Dialog>
  );
};

export default SettingsDialog;

