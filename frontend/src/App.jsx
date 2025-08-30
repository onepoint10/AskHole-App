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
import PromptDialog from './components/PromptDialog';
import { Menu } from 'lucide-react';

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
  const [availableModels, setAvailableModels] = useState({ 
    gemini: [], 
    openrouter: [],
    custom: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFileIds, setUploadedFileIds] = useState([]); // Track uploaded file IDs for status checking
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPromptDialogOpen, setIsPromptDialogOpen] = useState(false);
  const [promptInitialContent, setPromptInitialContent] = useState('');
  
  // Mobile detection and sidebar state
  const [isMobile, setIsMobile] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const detectMobile = () => {
      const isSmallViewport = window.innerWidth <= 768;
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || (navigator.msMaxTouchPoints || 0) > 0;
      const ua = (navigator.userAgent || navigator.vendor || (window.opera ? String(window.opera) : ''));
      const isMobileUA = /android|iphone|ipad|ipod|iemobile|blackberry|opera mini/i.test(String(ua).toLowerCase());
      setIsMobile(isSmallViewport || (isTouchDevice && isMobileUA));
    };
    detectMobile();
    window.addEventListener('resize', detectMobile);
    return () => window.removeEventListener('resize', detectMobile);
  }, []);

  // Settings stored in localStorage with improved defaults
  const [settings, setSettings] = useLocalStorage('askhole-settings', {
    geminiApiKey: '',
    openrouterApiKey: '',
    customProviders: [],
    customModels: [],
    customModelBindings: {},
    defaultModel: 'gemini-2.5-flash',
    temperature: 1.0,
    theme: 'system',
    compactMode: false,
    showTimestamps: false,
    autoSave: true,
    streamResponses: false,
    maxTokens: 4096,
  });

  const determineClientFromModel = (model) => {
    // Handle undefined or non-string models
    if (!model || typeof model !== 'string') {
      return 'gemini'; // default fallback
    }
    
    const geminiModels = [
      'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite-preview-06-17'
    ];
    
    // Check if model starts with 'gemini' or matches exactly
    if (model.startsWith('gemini') || geminiModels.includes(model)) {
      return 'gemini';
    }
    
    // Custom bindings override
    if (settings.customModels && settings.customModels.includes(model)) {
      const bound = settings.customModelBindings?.[model];
      if (bound) {
        // Map custom provider keys back to logical clients for backend routing
        if (bound === 'gemini') return 'gemini';
        if (bound === 'openrouter') return 'openrouter';
        // Any other key means a user-defined provider
        return 'custom';
      }
      return 'custom';
    }
    
    return 'openrouter';
  };

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
      if (settings.geminiApiKey || settings.openrouterApiKey || (settings.customProviders && settings.customProviders.length > 0)) {
        try {
          await configAPI.setConfig({
            gemini_api_key: settings.geminiApiKey,
            openrouter_api_key: settings.openrouterApiKey,
            custom_providers: settings.customProviders || [],
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
          // Add custom models to the available models
          const modelsWithCustom = {
            ...modelsResponse.data,
            custom: settings.customModels || []
          };
          setAvailableModels(modelsWithCustom);
        }
      } catch (error) {
        console.error('Failed to load models:', error);
        // Set default models if API call fails
        setAvailableModels({
          gemini: ['gemini-2.5-flash', 'gemini-1.5-pro'],
          openrouter: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4'],
          custom: settings.customModels || []
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
      
      // FIXED: Better session initialization logic
      if (sessionsList.length > 0) {
        // Find a session that's already open in tabs or use the most recent one
        const mostRecent = sessionsList[0];
        const sessionToActivate = openTabIds.length > 0 ? 
          sessionsList.find(s => openTabIds.includes(s.id)) || mostRecent : 
          mostRecent;
        
        setActiveSessionId(sessionToActivate.id);
        setOpenTabIds(prev => {
          if (prev.includes(sessionToActivate.id)) {
            return prev; // Keep existing tabs
          } else {
            return [sessionToActivate.id, ...prev]; // Add to tabs
          }
        });
        await loadSessionMessages(sessionToActivate.id);
      } else {
        // FIXED: Don't auto-create session on load, let user create when needed
        setActiveSessionId(null);
        setOpenTabIds([]);
        setCurrentMessages([]);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
      setSessions([]);
      setActiveSessionId(null);
      setOpenTabIds([]);
      setCurrentMessages([]);
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

  const createNewSession = async (selectedModel = null) => {
    try {
      // Ensure we extract just the string value from selectedModel
      let model;
      if (typeof selectedModel === 'string' && selectedModel) {
        model = selectedModel;
      } else if (selectedModel && selectedModel.value) {
        // If selectedModel is an object with a value property
        model = selectedModel.value;
      } else {
        model = settings.defaultModel || 'gemini-2.5-flash';
      }
      
      console.log('Creating new session with model:', model, 'type:', typeof model);
      
      // Create a clean session object without any potential circular references
      const sessionData = {
        title: 'New Chat',
        model: String(model), // Ensure it's a string
        temperature: Number(settings.temperature) || 1.0, // Ensure it's a number
      };
      
      const response = await sessionsAPI.createSession(sessionData);
      
      const newSession = response.data;
      setSessions(prev => [newSession, ...prev]);
      
      // Immediately set as active session and open tab
      setActiveSessionId(newSession.id);
      setOpenTabIds(prev => [newSession.id, ...prev]);
      setCurrentMessages([]); // Clear messages for new session

      // Update sessions list immediately to ensure the new session is available
      setSessions(prev => [newSession, ...prev.filter(s => s.id !== newSession.id)]);

      // Close sidebar on mobile after creating new session
      if (isMobile && isSidebarOpen) {
        setIsSidebarOpen(false);
      }

      console.log('New session created and activated:', newSession.id);
      return newSession;
    } catch (error) {
      console.error('Failed to create new session:', error);
      toast.error("Failed to create new chat session. Please check your backend connection.");
      return null; // Return null on failure
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
    if (isMobile) setIsSidebarOpen(false);
  }, [isMobile]);

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

    // Don't auto-create session here, let MessageInput handle it
    if (!activeSessionId) {
      toast.error("No active session. Please create a new chat first.");
      return { success: false };
    }

    const sessionExists = sessions.find(s => s.id === activeSessionId);
    if (!sessionExists) {
      toast.error("Active session not found. Please create a new chat.");
      return { success: false };
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
          console.log(`Uploading file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
          const uploadResponse = await filesAPI.uploadFile(file);
          const fileId = uploadResponse.data.id;
          uploadedFileIds.push(fileId);
          setUploadedFileIds(prev => [...prev, fileId]); // Add to tracking state
          
          // Check file status after upload to ensure it's ready
          try {
            let retries = 0;
            const maxRetries = 30; // 30 * 4 seconds = 120 seconds max wait
            let fileReady = false;
            
            while (retries < maxRetries && !fileReady) {
              await new Promise(resolve => setTimeout(resolve, 4000)); // Wait 4 seconds between checks
              
              try {
                const statusResponse = await filesAPI.getFileStatus(fileId);
                if (statusResponse.data.status === 'ready' && statusResponse.data.processing_status === 'completed') {
                  fileReady = true;
                  console.log(`File ${file.name} is ready for processing`);
                } else {
                  console.log(`File ${file.name} status: ${statusResponse.data.status}, processing: ${statusResponse.data.processing_status}`);
                  retries++;
                }
              } catch (statusError) {
                console.warn(`Failed to check status for ${file.name}:`, statusError);
                retries++;
              }
            }
            
            if (!fileReady) {
              console.warn(`File ${file.name} may not be fully ready after ${maxRetries * 4} seconds`);
              // Continue anyway - the backend will handle file processing
            }
          } catch (statusError) {
            console.warn(`Status checking failed for ${file.name}:`, statusError);
            // Continue anyway - the backend will handle file processing
          }
          
        } catch (error) {
          console.error('Failed to upload file:', file.name, error);
          let errorMsg = `Failed to upload ${file.name}`;
          
          if (error.message.includes('timeout')) {
            errorMsg = `Upload timeout for ${file.name}. The file may still be processing.`;
          } else if (error.message.includes('size')) {
            errorMsg = `File ${file.name} is too large. Maximum size is 20MB.`;
          } else if (error.message.includes('Authentication')) {
            errorMsg = `Authentication failed for ${file.name}. Please log in again.`;
          }
          
          toast.error(errorMsg);
          
          // Try to retry the upload once
          try {
            console.log(`Retrying upload for ${file.name}...`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
            
            const retryResponse = await filesAPI.uploadFile(file);
            const retryFileId = retryResponse.data.id;
            uploadedFileIds.push(retryFileId);
            setUploadedFileIds(prev => [...prev, retryFileId]); // Add to tracking state
            console.log(`Retry successful for ${file.name}`);
            toast.success(`Retry successful for ${file.name}`);
          } catch (retryError) {
            console.error(`Retry failed for ${file.name}:`, retryError);
            toast.error(`Retry failed for ${file.name}. Please try again later.`);
          }
          
          // Don't add failed files to the list if retry also failed
          continue;
        }
      }

      // Send message to the ACTIVE session (not the current session)
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

      // Show success message for file uploads
      if (uploadedFileIds.length > 0) {
        toast.success(`Message sent successfully with ${uploadedFileIds.length} file(s)`);
        // Clear uploaded file IDs after successful sending
        clearUploadedFileIds();
      }

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
      } else if (error.message.includes('timeout')) {
        errorMessage = "Request timeout. The file may still be processing. Please check the file status or try again.";
      } else if (error.message.includes('Load error')) {
        errorMessage = "File loading error. The file may still be processing. Please refresh the page to check status.";
      } else if (error.message.includes('File upload timeout')) {
        errorMessage = "File upload timeout. The file may still be processing. Please check the file status.";
      } else {
        errorMessage = `Failed to send message: ${error.message}`;
      }
      
      toast.error(errorMessage);
      
      // Return error with the original message to restore in input
      return { success: false, originalMessage: message, originalFiles: files };
    } finally {
      setIsLoading(false);
    }
  }, [activeSessionId, setIsAuthenticated]);

  // Add periodic file status checking
  const checkFileStatuses = useCallback(async (fileIds) => {
    if (!fileIds || fileIds.length === 0) return;
    
    console.log(`Checking status for ${fileIds.length} files...`);
    
    for (const fileId of fileIds) {
      try {
        const statusResponse = await filesAPI.getFileStatus(fileId);
        const status = statusResponse.data;
        
        if (status.status === 'ready' && status.processing_status === 'completed') {
          console.log(`File ${status.original_filename} is ready`);
        } else {
          console.log(`File ${status.original_filename} status: ${status.status}, processing: ${status.processing_status}`);
        }
      } catch (error) {
        console.warn(`Failed to check status for file ${fileId}:`, error);
      }
    }
  }, []);

  // Check file statuses periodically when there are uploaded files
  useEffect(() => {
    if (uploadedFileIds.length > 0) {
      const interval = setInterval(() => {
        checkFileStatuses(uploadedFileIds);
      }, 10000); // Check every 10 seconds
      
      return () => clearInterval(interval);
    }
  }, [uploadedFileIds, checkFileStatuses]);

  // Clear uploaded file IDs after successful message sending
  const clearUploadedFileIds = useCallback(() => {
    setUploadedFileIds([]);
  }, []);

  // Delete message function
  const deleteMessage = useCallback(async (messageId) => {
    try {
      // Remove message from local state immediately for better UX
      setCurrentMessages(prev => prev.filter(msg => msg.id !== messageId));
      
      // Call API to delete message from server
      await sessionsAPI.deleteMessage(activeSessionId, messageId);
      
      toast.success("Message deleted successfully.");
    } catch (error) {
      console.error('Failed to delete message:', error);
      toast.error("Failed to delete message.");
      
      // Reload messages from server to restore state
      try {
        const response = await sessionsAPI.getSession(activeSessionId);
        setCurrentMessages(response.data?.messages || []);
      } catch (reloadError) {
        console.error('Failed to reload messages:', reloadError);
      }
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

  const changeSessionModel = useCallback(async (sessionId, newModel) => {
    try {
      await sessionsAPI.updateSession(sessionId, { model: newModel });
      
      // Update sessions list
      setSessions(prev => prev.map(s => 
        s.id === sessionId ? { ...s, model: newModel } : s
      ));
      
      toast.success(`Model changed to ${newModel}`);
    } catch (error) {
      console.error('Failed to change session model:', error);
      toast.error("Failed to change model.");
    }
  }, []);

  // Find current session object
  const currentSession = useMemo(() => 
    sessions.find(s => s.id === activeSessionId), 
    [sessions, activeSessionId]
  );

  // Settings management with improved error handling
  const updateSettings = useCallback(async (newSettings) => {
    setSettings(newSettings);
    
    try {
      if (newSettings.geminiApiKey || newSettings.openrouterApiKey || (newSettings.customProviders && newSettings.customProviders.length > 0)) {
        await configAPI.setConfig({
          gemini_api_key: newSettings.geminiApiKey,
          openrouter_api_key: newSettings.openrouterApiKey,
          custom_providers: newSettings.customProviders || [],
        });
        
        // Try to reload models
        try {
          const modelsResponse = await configAPI.getModels();
          if (modelsResponse && modelsResponse.data) {
            // Add custom models to the available models
            const modelsWithCustom = {
              ...modelsResponse.data,
              custom: newSettings.customModels || []
            };
            setAvailableModels(modelsWithCustom);
          }
          toast.success("Settings updated successfully.");
        } catch (modelError) {
          console.error('Failed to reload models:', modelError);
          // Set custom models even if API call fails
          setAvailableModels(prev => ({
            ...prev,
            custom: newSettings.customModels || []
          }));
          toast.success("Settings saved, but couldn't reload models. They will be available on next restart.");
        }
      } else {
        // Update custom models even if no API keys changed
        setAvailableModels(prev => ({
          ...prev,
          custom: newSettings.customModels || []
        }));
        toast.success("Settings saved.");
      }
    } catch (error) {
      console.error('Failed to update API configuration:', error);
      toast.error("Failed to update API configuration. Please check your backend connection.");
    }
  }, [setSettings]);

  const openPromptDialogWithContent = useCallback((content) => {
    setPromptInitialContent(content || '');
    setIsPromptDialogOpen(true);
  }, []);

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
      <div className={`h-screen flex bg-background text-foreground ${isMobile ? 'mobile-root' : ''}`}>
        {/* Mobile toggle button */}
        {isMobile && (
          <button
            aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
            className="mobile-sidebar-toggle"
            onClick={() => setIsSidebarOpen(prev => !prev)}
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        {/* Mobile new chat button */}
        {isMobile && !isSidebarOpen && (
          <button
            variant="ghost"
            aria-label="New chat"
            className="mobile-newchat-button"
            onClick={() => createNewSession()}
          >
            +
          </button>
        )}

        {/* Desktop persistent sidebar */}
        {!isMobile && (
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
        )}
        
        {/* Mobile overlay sidebar */}
        {isMobile && isSidebarOpen && (
          <div className="sidebar-overlay" role="dialog" aria-modal="true">
            <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(false)} />
            <div className="sidebar-sheet">
              <Sidebar
                sessions={sessions}
                prompts={prompts}
                currentUser={currentUser}
                onSessionSelect={selectSession}
                onNewSession={createNewSession}
                onDeleteSession={deleteSession}
                onRenameSession={renameSession}
                onNewPrompt={createPrompt}
                onUsePrompt={usePrompt}
                onDeletePrompt={deletePrompt}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onLogout={handleLogout}
                isMobileOverlay={true}
                onRequestClose={() => setIsSidebarOpen(false)}
              />
            </div>
          </div>
        )}
        
        <div className="flex-1 flex flex-col main-content">
          {!isMobile && (
            <ChatTabs
              sessions={openTabSessions}  // Only show open tab sessions
              activeSessionId={activeSessionId}
              onSessionSelect={selectSession}
              onNewSession={createNewSession}
              onCloseTab={closeTabOnly}  // Use closeTabOnly for tab closure
              onRenameSession={renameSession}
            />
          )}
          
          <MessageList
            messages={currentMessages}
            isLoading={isLoading}
            onAddToPrompt={openPromptDialogWithContent}
            onDeleteMessage={deleteMessage}
          />
          
          <MessageInput
            onSendMessage={sendMessage}
            isLoading={isLoading}
            disabled={!isConfigured}
            availableModels={availableModels}
            currentSession={currentSession}
            onModelChange={changeSessionModel}
            onCreateNewSession={createNewSession}
            settings={settings}
          />
        </div>

        <SettingsDialog
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          onUpdateSettings={updateSettings}
          availableModels={availableModels}
        />

        <PromptDialog
          isOpen={isPromptDialogOpen}
          onClose={() => setIsPromptDialogOpen(false)}
          initialContent={promptInitialContent}
          onCreate={async (data) => {
            await createPrompt(data);
            setIsPromptDialogOpen(false);
          }}
        />

        <Toaster position="top-right" />
      </div>
    </ErrorBoundary>
  );
}

export default App;