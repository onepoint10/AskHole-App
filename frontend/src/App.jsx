import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import AuthComponent from './components/AuthComponent';
import ChatTabs from './components/ChatTabs';
import MessageList from './components/MessageList';
import MessageInput from './components/MessageInput';
import Sidebar from './components/Sidebar';
import SettingsDialog from './components/SettingsDialog';
import ErrorBoundary from './components/ErrorBoundary';
import { useLocalStorage } from './hooks/useLocalStorage';
import { configAPI, sessionsAPI, promptsAPI, filesAPI, authAPI } from './services/api';
import './App.css';

function App() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Core state management
  const [sessions, setSessions] = useState([]);
  const [openTabIds, setOpenTabIds] = useState([]); // Track which sessions have open tabs
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [currentMessages, setCurrentMessages] = useState([]);
  const [prompts, setPrompts] = useState([]);
  const [availableModels, setAvailableModels] = useState({ gemini: [], openrouter: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Settings stored in localStorage with improved defaults
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

  // Computed values
  const isConfigured = useMemo(() => 
    Boolean(settings.geminiApiKey || settings.openrouterApiKey), 
    [settings.geminiApiKey, settings.openrouterApiKey]
  );

  // Filter sessions for tabs (only show open tabs)
  const openTabSessions = useMemo(() => 
    sessions.filter(session => openTabIds.includes(session.id)), 
    [sessions, openTabIds]
  );

  // Check authentication on app load
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Initialize app after authentication
  useEffect(() => {
    if (isAuthenticated) {
      initializeApp();
    }
  }, [isAuthenticated]);

  // Apply theme with improved system theme detection
  useEffect(() => {
    const applyTheme = () => {
      const root = document.documentElement;
      
      if (settings.theme === 'dark') {
        root.classList.add('dark');
      } else if (settings.theme === 'light') {
        root.classList.remove('dark');
      } else {
        // System theme with proper media query listener
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const updateTheme = () => {
          if (mediaQuery.matches) {
            root.classList.add('dark');
          } else {
            root.classList.remove('dark');
          }
        };
        
        updateTheme();
        mediaQuery.addEventListener('change', updateTheme);
        
        return () => mediaQuery.removeEventListener('change', updateTheme);
      }
    };

    const cleanup = applyTheme();
    return cleanup;
  }, [settings.theme]);

  // Authentication functions
  const checkAuthStatus = async () => {
    try {
      const response = await authAPI.checkAuth();
      
      if (response.data.authenticated) {
        setIsAuthenticated(true);
        setCurrentUser(response.data.user);
        console.log('User authenticated:', response.data.user.username);
      } else {
        console.log('User not authenticated');
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
      setCurrentUser(null);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleAuthSuccess = useCallback((user) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    console.log('Authentication successful for:', user.username);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await authAPI.logout();
      
      // Clear all session data
      localStorage.removeItem('session_id');
      document.cookie = 'session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None';
      
      // Reset all state
      setIsAuthenticated(false);
      setCurrentUser(null);
      setSessions([]);
      setOpenTabIds([]);
      setActiveSessionId(null);
      setCurrentMessages([]);
      setPrompts([]);
      
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout failed:', error);
      // Even if logout fails on server, clear client-side data
      localStorage.removeItem('session_id');
      document.cookie = 'session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None';
      setIsAuthenticated(false);
      setCurrentUser(null);
      toast.error('Logout failed, but you have been logged out locally');
    }
  }, []);

  // App initialization
  const initializeApp = async () => {
    try {
      // Configure API if we have keys
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

      // Load available models
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

      // Load sessions and prompts with improved error handling
      await Promise.allSettled([
        loadSessions().catch(error => {
          console.error('Failed to load sessions:', error);
        }),
        loadPrompts().catch(error => {
          console.error('Failed to load prompts:', error);
        }),
      ]);

    } catch (error) {
      console.error('App initialization error:', error);
      // Continue gracefully without showing error toast
    }
  };

  // Session management functions
  const loadSessions = async () => {
    try {
      const response = await sessionsAPI.getSessions();
      const sessionsList = response.data || [];
      setSessions(sessionsList);
      
      // Set active session to the most recent one or create a new one
      if (sessionsList.length > 0) {
        const mostRecent = sessionsList[0];
        setActiveSessionId(mostRecent.id);
        setOpenTabIds([mostRecent.id]); // Set initial open tab
        await loadSessionMessages(mostRecent.id);
      } else {
        await createNewSession();
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
      setSessions([]);
      // Try to create a new session if none exist
      try {
        await createNewSession();
      } catch (createError) {
        console.error('Failed to create new session:', createError);
      }
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
      setOpenTabIds(prev => [newSession.id, ...prev]); // Add to open tabs
      setCurrentMessages([]);
      
      return newSession;
    } catch (error) {
      console.error('Failed to create new session:', error);
      toast.error("Failed to create new chat session. Please check your backend connection.");
    }
  };

  const selectSession = useCallback(async (sessionId) => {
    setActiveSessionId(sessionId);
    
    // Add to open tabs if not already open
    setOpenTabIds(prev => {
      if (!prev.includes(sessionId)) {
        return [sessionId, ...prev];
      }
      return prev;
    });
    
    await loadSessionMessages(sessionId);
  }, []);

  // Tab management functions
  const closeTabOnly = useCallback((sessionId) => {
    console.log('Closing tab only for session:', sessionId);
    
    // Remove from open tabs only (keep in sessions list)
    setOpenTabIds(prev => prev.filter(id => id !== sessionId));
    
    // If closing active session, switch to another open tab or create new
    if (sessionId === activeSessionId) {
      setOpenTabIds(current => {
        const remainingOpenTabs = current.filter(id => id !== sessionId);
        if (remainingOpenTabs.length > 0) {
          selectSession(remainingOpenTabs[0]);
        } else {
          createNewSession();
        }
        return remainingOpenTabs;
      });
    }
    
    // No backend call, no toast - just visual tab removal
  }, [activeSessionId, selectSession]);

  const deleteSession = useCallback(async (sessionId) => {
    console.log('Actually deleting session:', sessionId);
    
    try {
      // Close the session on backend (mark as closed/deleted)
      await sessionsAPI.closeSession(sessionId);
      
      // Remove from both sessions list and open tabs
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      setOpenTabIds(prev => prev.filter(id => id !== sessionId));
      
      // If deleting active session, switch to another or create new
      if (sessionId === activeSessionId) {
        const remainingSessions = sessions.filter(s => s.id !== sessionId);
        if (remainingSessions.length > 0) {
          await selectSession(remainingSessions[0].id);
        } else {
          await createNewSession();
        }
      }
      
      toast.success("Chat deleted from history.");
    } catch (error) {
      console.error('Failed to delete session:', error);
      toast.error("Failed to delete chat.");
    }
  }, [activeSessionId, sessions, selectSession]);

  // Message handling with improved error handling and UX
  const sendMessage = useCallback(async (message, files = []) => {
    if (!message || !message.trim()) {
      toast.error("Please enter a message");
      return { success: false };
    }

    if (!activeSessionId) {
      // Try to create a new session if none exists
      const newSession = await createNewSession();
      if (!newSession) {
        toast.error("Cannot send message: No active session and failed to create new one.");
        return { success: false };
      }
    }

    // Create temporary user message ID
    const tempUserMessageId = `temp_${Date.now()}`;
    const userMessage = {
      id: tempUserMessageId,
      role: 'user',
      content: message.trim(),
      files: files,
      timestamp: new Date().toISOString(),
      isTemporary: true
    };

    // Immediately add user message to chat
    setCurrentMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    
    try {
      // Upload files if any
      const uploadedFileIds = [];
      for (const file of files) {
        try {
          const uploadResponse = await filesAPI.uploadFile(file);
          uploadedFileIds.push(uploadResponse.data.id);
        } catch (error) {
          console.error('Failed to upload file:', file.name, error);
          toast.error(`Failed to upload ${file.name}`);
        }
      }

      // Send message
      const response = await sessionsAPI.sendMessage(activeSessionId, {
        message: message.trim(),
        files: uploadedFileIds,
      });

      // Replace temporary message with real messages from server
      setCurrentMessages(prev => {
        // Remove the temporary message
        const withoutTemp = prev.filter(msg => msg.id !== tempUserMessageId);
        // Add the real messages from server
        return [
          ...withoutTemp,
          response.data.user_message,
          response.data.assistant_message,
        ];
      });

      // Update session in list (update title, message count, etc.)
      setSessions(prev => prev.map(s => 
        s.id === activeSessionId ? response.data.session : s
      ));

      // Return success indicator
      return { success: true };

    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Remove the temporary user message on error
      setCurrentMessages(prev => prev.filter(msg => msg.id !== tempUserMessageId));
      
      // More specific error messages
      let errorMessage = "Failed to send message";
      if (error.message.includes('Authentication required')) {
        errorMessage = "Session expired. Please log in again.";
        setIsAuthenticated(false);
      } else if (error.message.includes('not configured')) {
        errorMessage = "Please configure your API keys in settings before sending messages.";
      } else {
        errorMessage = `Failed to send message: ${error.message}`;
      }
      
      toast.error(errorMessage);
      
      // Return error with the original message to restore in input
      return { success: false, originalMessage: message, originalFiles: files };
    } finally {
      setIsLoading(false);
    }
  }, [activeSessionId]);

  // Prompt management functions
  const createPrompt = useCallback(async (promptData) => {
    try {
      const response = await promptsAPI.createPrompt(promptData);
      setPrompts(prev => [response.data, ...prev]);
      toast.success("New prompt template has been saved.");
    } catch (error) {
      console.error('Failed to create prompt:', error);
      toast.error("Failed to create prompt template.");
    }
  }, []);

  const usePrompt = useCallback(async (prompt) => {
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
  }, [sendMessage]);

  const deletePrompt = useCallback(async (promptId) => {
    try {
      await promptsAPI.deletePrompt(promptId);
      setPrompts(prev => prev.filter(p => p.id !== promptId));
      toast.success("Prompt template has been deleted.");
    } catch (error) {
      console.error('Failed to delete prompt:', error);
      toast.error("Failed to delete prompt template.");
    }
  }, []);

  const renameSession = useCallback(async (sessionId, newTitle) => {
    try {
      await sessionsAPI.updateSession(sessionId, {
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
  }, []);

  // Settings management with improved error handling
  const updateSettings = useCallback(async (newSettings) => {
    setSettings(newSettings);
    
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
  }, [setSettings]);

  // Show loading spinner while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show authentication component if not logged in
  if (!isAuthenticated) {
    return <AuthComponent onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <ErrorBoundary>
      <div className="h-screen flex bg-background text-foreground">
        <Sidebar
          sessions={sessions}  // Show all sessions in sidebar
          prompts={prompts}
          currentUser={currentUser}
          onSessionSelect={selectSession}
          onNewSession={createNewSession}
          onDeleteSession={deleteSession}  // Use deleteSession for actual deletion
          onRenameSession={renameSession} 
          onNewPrompt={createPrompt}
          onUsePrompt={usePrompt}
          onDeletePrompt={deletePrompt}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onLogout={handleLogout}
        />
        
        <div className="flex-1 flex flex-col main-content">
          <ChatTabs
            sessions={openTabSessions}  // Only show open tab sessions
            activeSessionId={activeSessionId}
            onSessionSelect={selectSession}
            onNewSession={createNewSession}
            onCloseTab={closeTabOnly}  // Use closeTabOnly for tab closure
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
            placeholder={!isConfigured ? "Please configure your API keys in settings first..." : "Type your message..."}
          />
        </div>

        <SettingsDialog
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          onUpdateSettings={updateSettings}
          availableModels={availableModels}
        />

        <Toaster position="top-right" />
      </div>
    </ErrorBoundary>
  );
}

export default App;