import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Key, 
  Palette, 
  Sliders,
  Moon,
  Sun,
  Monitor
} from 'lucide-react';
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
            </div>
          </TabsContent>

          <TabsContent value="models" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Sliders className="h-4 w-4" />
                <h3 className="text-lg font-medium">Model Configuration</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="default-client">Default Client</Label>
                <Select
                  value={localSettings.defaultClient || 'gemini'}
                  onValueChange={(value) => updateSetting('defaultClient', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select default client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini">Gemini</SelectItem>
                    <SelectItem value="openrouter">OpenRouter</SelectItem>
                  </SelectContent>
                </Select>
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
    </Dialog>
  );
};

export default SettingsDialog;

