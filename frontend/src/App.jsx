import React, { useState, useEffect } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import ChatTabs from './components/ChatTabs';
import MessageList from './components/MessageList';
import MessageInput from './components/MessageInput';
import Sidebar from './components/Sidebar';
import SettingsDialog from './components/SettingsDialog';
import ErrorBoundary from './components/ErrorBoundary';
import { useLocalStorage } from './hooks/useLocalStorage';
import { configAPI, sessionsAPI, promptsAPI, filesAPI } from './services/api';
import './App.css';

function App() {
  // State management
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [currentMessages, setCurrentMessages] = useState([]);
  const [prompts, setPrompts] = useState([]);
  const [availableModels, setAvailableModels] = useState({ gemini: [], openrouter: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Settings stored in localStorage
  const [settings, setSettings] = useLocalStorage('askhole-settings', {
    geminiApiKey: '',
    openrouterApiKey: '',
    defaultClient: 'gemini',
    defaultModel: 'gemini-2.5-flash',
    temperature: 1.0,
    theme: 'system',
    compactMode: false,
    showTimestamps: false,
    autoSave: true,
    streamResponses: false,
    maxTokens: 4096,
  });

  // Initialize app
  useEffect(() => {
    initializeApp();
  }, []);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else if (settings.theme === 'light') {
      root.classList.remove('dark');
    } else {
      // System theme
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      if (mediaQuery.matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [settings.theme]);

  const initializeApp = async () => {
    try {
      // **REPLACE**: Add better error handling and don't require API keys for basic initialization
      
      // Only configure API if we have keys
      if (settings.geminiApiKey || settings.openrouterApiKey) {
        try {
          await configAPI.setConfig({
            gemini_api_key: settings.geminiApiKey,
            openrouter_api_key: settings.openrouterApiKey,
          });
        } catch (error) {
          console.error('Failed to configure API keys:', error);
          // Don't throw here, continue with initialization
        }
      }

      // Try to load available models
      try {
        const modelsResponse = await configAPI.getModels();
        if (modelsResponse && modelsResponse.data) {
          setAvailableModels(modelsResponse.data);
        }
      } catch (error) {
        console.error('Failed to load models:', error);
        // Set default models if API call fails
        setAvailableModels({
          gemini: ['gemini-2.5-flash', 'gemini-1.5-pro'],
          openrouter: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4']
        });
      }

      // Load sessions and prompts with better error handling
      await Promise.all([
        loadSessions().catch(error => {
          console.error('Failed to load sessions:', error);
          // Continue without sessions - will create new one
        }),
        loadPrompts().catch(error => {
          console.error('Failed to load prompts:', error);
          // Continue without prompts
        }),
      ]);

    } catch (error) {
      console.error('App initialization error:', error);
      // Don't show error toast for initialization - let user proceed
    }
  };

  const loadSessions = async () => {
    try {
      const response = await sessionsAPI.getSessions();
      const sessionsList = response.data || [];
      setSessions(sessionsList);
      
      // Set active session to the most recent one or create a new one
      if (sessionsList.length > 0) {
        const mostRecent = sessionsList[0];
        setActiveSessionId(mostRecent.id);
        await loadSessionMessages(mostRecent.id);
      } else {
        await createNewSession();
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
      // **REPLACE**: Don't create new session if API is not working
      setSessions([]);
    }
  };

  const loadPrompts = async () => {
    try {
      const response = await promptsAPI.getPrompts();
      setPrompts(response.data || []);
    } catch (error) {
      console.error('Failed to load prompts:', error);
      setPrompts([]);
    }
  };

  const loadSessionMessages = async (sessionId) => {
    if (!sessionId) return;
    
    try {
      const response = await sessionsAPI.getSession(sessionId);
      setCurrentMessages(response.data?.messages || []);
    } catch (error) {
      console.error('Failed to load session messages:', error);
      setCurrentMessages([]);
    }
  };

  const createNewSession = async () => {
    try {
      const response = await sessionsAPI.createSession({
        title: 'New Chat',
        model: settings.defaultModel,
        client_type: settings.defaultClient,
        temperature: settings.temperature,
      });
      
      const newSession = response.data;
      setSessions(prev => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setCurrentMessages([]);
      
      return newSession;
    } catch (error) {
      console.error('Failed to create new session:', error);
      toast.error("Failed to create new chat session. Please check your backend connection.");
    }
  };

  const selectSession = async (sessionId) => {
    setActiveSessionId(sessionId);
    await loadSessionMessages(sessionId);
  };

  const closeSession = async (sessionId) => {
    try {
      await sessionsAPI.deleteSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      
      // If closing active session, switch to another or create new
      if (sessionId === activeSessionId) {
        const remainingSessions = sessions.filter(s => s.id !== sessionId);
        if (remainingSessions.length > 0) {
          await selectSession(remainingSessions[0].id);
        } else {
          await createNewSession();
        }
      }
      
      toast.success("Chat session has been deleted.");
    } catch (error) {
      console.error('Failed to delete session:', error);
      toast.error("Failed to delete chat session.");
    }
  };

  const sendMessage = async (message, files = []) => {
    if (!activeSessionId) {
      // Try to create a new session if none exists
      const newSession = await createNewSession();
      if (!newSession) {
        toast.error("Cannot send message: No active session and failed to create new one.");
        return;
      }
    }

    setIsLoading(true);
    
    try {
      // Upload files if any
      const uploadedFileIds = [];
      for (const file of files) {
        try {
          const uploadResponse = await filesAPI.uploadFile(file);
          uploadedFileIds.push(uploadResponse.data.id); // Use file ID instead of path
        } catch (error) {
          console.error('Failed to upload file:', file.name, error);
          toast.error(`Failed to upload ${file.name}`);
        }
      }

      // Send message
      const response = await sessionsAPI.sendMessage(activeSessionId, {
        message,
        files: uploadedFileIds, // Send file IDs instead of paths
      });

      // Update messages and session
      setCurrentMessages(prev => [
        ...prev,
        response.data.user_message,
        response.data.assistant_message,
      ]);

      // Update session in list
      setSessions(prev => prev.map(s => 
        s.id === activeSessionId ? response.data.session : s
      ));

    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error("Failed to send message. Please check your API keys and backend connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const createPrompt = async (promptData) => {
    try {
      const response = await promptsAPI.createPrompt(promptData);
      setPrompts(prev => [response.data, ...prev]);
      toast.success("New prompt template has been saved.");
    } catch (error) {
      console.error('Failed to create prompt:', error);
      toast.error("Failed to create prompt template.");
    }
  };

  const usePrompt = async (prompt) => {
    try {
      // Increment usage count
      await promptsAPI.usePrompt(prompt.id);
      
      // Update prompts list
      setPrompts(prev => prev.map(p => 
        p.id === prompt.id ? { ...p, usage_count: p.usage_count + 1 } : p
      ));

      // Send the prompt as a message
      await sendMessage(prompt.content);
      
      toast.success(`Applied "${prompt.title}" template.`);
    } catch (error) {
      console.error('Failed to use prompt:', error);
      toast.error("Failed to use prompt template.");
    }
  };

  const deletePrompt = async (promptId) => {
    try {
      await promptsAPI.deletePrompt(promptId);
      setPrompts(prev => prev.filter(p => p.id !== promptId));
      toast.success("Prompt template has been deleted.");
    } catch (error) {
      console.error('Failed to delete prompt:', error);
      toast.error("Failed to delete prompt template.");
    }
  };

  const renameSession = async (sessionId, newTitle) => {
    try {
      const response = await sessionsAPI.updateSession(sessionId, {
        title: newTitle.trim()
      });
      
      // Update sessions list
      setSessions(prev => prev.map(s => 
        s.id === sessionId ? { ...s, title: newTitle.trim() } : s
      ));
      
      toast.success("Chat renamed successfully.");
    } catch (error) {
      console.error('Failed to rename session:', error);
      toast.error("Failed to rename chat session.");
    }
  };

  const updateSettings = async (newSettings) => {
    setSettings(newSettings);
    
    // **REPLACE**: Improve API configuration update with better error handling
    try {
      if (newSettings.geminiApiKey || newSettings.openrouterApiKey) {
        await configAPI.setConfig({
          gemini_api_key: newSettings.geminiApiKey,
          openrouter_api_key: newSettings.openrouterApiKey,
        });
        
        // Try to reload models
        try {
          const modelsResponse = await configAPI.getModels();
          if (modelsResponse && modelsResponse.data) {
            setAvailableModels(modelsResponse.data);
          }
          toast.success("Settings updated successfully.");
        } catch (modelError) {
          console.error('Failed to reload models:', modelError);
          toast.success("Settings saved, but couldn't reload models. They will be available on next restart.");
        }
      } else {
        toast.success("Settings saved.");
      }
    } catch (error) {
      console.error('Failed to update API configuration:', error);
      toast.error("Failed to update API configuration. Please check your backend connection.");
    }
  };

  const isConfigured = Boolean(settings.geminiApiKey || settings.openrouterApiKey);

  return (
    <div className="h-screen flex bg-background text-foreground">
      <Sidebar
        sessions={sessions}
        prompts={prompts}
        onSessionSelect={selectSession}
        onNewSession={createNewSession}
        onDeleteSession={closeSession}
        onRenameSession={renameSession} 
        onNewPrompt={createPrompt}
        onUsePrompt={usePrompt}
        onDeletePrompt={deletePrompt}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      
      <div className="flex-1 flex flex-col main-content">
        <ChatTabs
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSessionSelect={selectSession}
          onNewSession={createNewSession}
          onCloseSession={closeSession}
          onRenameSession={renameSession}
        />
        
        <MessageList
          messages={currentMessages}
          isLoading={isLoading}
        />
        
        <MessageInput
          onSendMessage={sendMessage}
          isLoading={isLoading}
          disabled={!isConfigured}
        />
      </div>

      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
        availableModels={availableModels}
      />

      <Toaster />
    </div>
  );
}

export default App;