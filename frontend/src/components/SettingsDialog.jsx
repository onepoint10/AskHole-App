import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Key, 
  Palette, 
  Sliders,
  Moon,
  Sun,
  Monitor,
  Plus,
  Trash2
} from 'lucide-react';
import AddProviderDialog from './AddProviderDialog';
import AddModelDialog from './AddModelDialog';
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
  availableModels 
}) => {
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="api" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="api">API Keys</TabsTrigger>
            <TabsTrigger value="models">Models</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="api" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Key className="h-4 w-4" />
                <h3 className="text-lg font-medium">API Configuration</h3>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="gemini-key">Gemini API Key</Label>
                <Input
                  id="gemini-key"
                  type="password"
                  value={localSettings.geminiApiKey || ''}
                  onChange={(e) => updateSetting('geminiApiKey', e.target.value)}
                  placeholder="Enter your Gemini API key"
                />
                <p className="text-xs text-muted-foreground">
                  Get your API key from Google AI Studio
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="openrouter-key">OpenRouter API Key</Label>
                <Input
                  id="openrouter-key"
                  type="password"
                  value={localSettings.openrouterApiKey || ''}
                  onChange={(e) => updateSetting('openrouterApiKey', e.target.value)}
                  placeholder="Enter your OpenRouter API key"
                />
                <p className="text-xs text-muted-foreground">
                  Get your API key from OpenRouter.ai
                </p>
              </div>

              {/* Custom Providers Section */}
              <div className="space-y-4 pt-6 border-t">
                <div className="flex items-center justify-between">
                  <h4 className="text-md font-medium">Custom Providers</h4>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setIsAddProviderOpen(true)}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Provider
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
                    No custom providers added yet. Click "Add Provider" to add your own API provider.
                  </p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="models" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Sliders className="h-4 w-4" />
                <h3 className="text-lg font-medium">Model Configuration</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="default-model">Default Model</Label>
                <Select
                  value={localSettings.defaultModel || ''}
                  onValueChange={(value) => updateSetting('defaultModel', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select default model" />
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
                  Temperature: {localSettings.temperature || 1.0}
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
                  Controls randomness in responses. Lower values are more focused, higher values are more creative.
                </p>
              </div>

              {/* Custom Models Section */}
              <div className="space-y-4 pt-6 border-t">
                <div className="flex items-center justify-between">
                  <h4 className="text-md font-medium">Custom Models</h4>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setIsAddModelOpen(true)}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Model
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
                              Bound to: {localSettings.customModelBindings[model]}
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
                    No custom models added yet. Click "Add Model" to add your own model.
                  </p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Palette className="h-4 w-4" />
                <h3 className="text-lg font-medium">Appearance</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <Select
                  value={localSettings.theme || 'system'}
                  onValueChange={(value) => updateSetting('theme', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">
                      <div className="flex items-center gap-2">
                        <Sun className="h-4 w-4" />
                        Light
                      </div>
                    </SelectItem>
                    <SelectItem value="dark">
                      <div className="flex items-center gap-2">
                        <Moon className="h-4 w-4" />
                        Dark
                      </div>
                    </SelectItem>
                    <SelectItem value="system">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4" />
                        System
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="compact-mode">Compact Mode</Label>
                  <p className="text-xs text-muted-foreground">
                    Reduce spacing and padding for more content
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
                  <Label htmlFor="show-timestamps">Show Timestamps</Label>
                  <p className="text-xs text-muted-foreground">
                    Display message timestamps in chat
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
                <h3 className="text-lg font-medium">Advanced Settings</h3>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-save">Auto-save Chats</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically save chat sessions
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
                  <Label htmlFor="stream-responses">Stream Responses</Label>
                  <p className="text-xs text-muted-foreground">
                    Show responses as they are generated
                  </p>
                </div>
                <Switch
                  id="stream-responses"
                  checked={localSettings.streamResponses || false}
                  onCheckedChange={(checked) => updateSetting('streamResponses', checked)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-tokens">Max Tokens per Response</Label>
                <Input
                  id="max-tokens"
                  type="number"
                  value={localSettings.maxTokens || 4096}
                  onChange={(e) => updateSetting('maxTokens', parseInt(e.target.value))}
                  placeholder="4096"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum number of tokens in AI responses
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Settings
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

