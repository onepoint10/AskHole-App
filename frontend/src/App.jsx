import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import AuthComponent from './components/AuthComponent';
import AdminDashboard from './components/AdminDashboard';
import ChatTabs from './components/ChatTabs';
import MessageList from './components/MessageList';
import MessageInput from './components/MessageInput';
import Sidebar from './components/Sidebar';
import SettingsDialog from './components/SettingsDialog';
import ErrorBoundary from './components/ErrorBoundary';
import AppTour from './components/AppTour';
import WorkflowSpacesSidebar from './components/WorkflowSpacesSidebar';
import { useLocalStorage } from './hooks/useLocalStorage';
import { configAPI, sessionsAPI, promptsAPI, filesAPI, authAPI } from './services/api';
import './App.css';
import PromptDialog from './components/PromptDialog';
import { Menu, MessageCirclePlus, Shield, Folders } from 'lucide-react';
import { useSwipeGesture } from './hooks/useSwipeGesture';
import { useTranslation } from 'react-i18next';

function App() {
  const { t, i18n } = useTranslation();

  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Admin view state
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);

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
  const [messageInputContent, setMessageInputContent] = useState('');

  // Mobile detection and sidebar state
  const [isMobile, setIsMobile] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isWorkflowSidebarOpen, setIsWorkflowSidebarOpen] = useState(false);

  // Integrate swipe gesture hook
  const swipeHandlers = useSwipeGesture(isMobile, isSidebarOpen, setIsSidebarOpen);

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
    exaApiKey: '', // Add EXA API key to settings
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
    maxTokens: 20000,
    language: 'en', // Add default language setting
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
        if (bound === 'exa') return 'exa'; // Add EXA client determination
        // Any other key means a user-defined provider
        return 'custom';
      }
      return 'custom';
    }

    return 'openrouter';
  };

  // Computed values
  const isConfigured = useMemo(() =>
    Boolean(settings.geminiApiKey || settings.openrouterApiKey || settings.exaApiKey),
    [settings.geminiApiKey, settings.openrouterApiKey, settings.exaApiKey]
  );

  // Check if current user is admin (assuming user ID 2 is admin)
  const isAdmin = useMemo(() =>
    currentUser && currentUser.id === 2,
    [currentUser]
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

  // Apply theme and language with improved system theme detection
  useEffect(() => {
    const applyThemeAndLanguage = () => {
      const root = document.documentElement;

      // Apply theme
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

        // Apply language
        i18n.changeLanguage(settings.language || 'en');

        return () => mediaQuery.removeEventListener('change', updateTheme);
      }
      // Apply language if not system theme
      i18n.changeLanguage(settings.language || 'en');
    };

    const cleanup = applyThemeAndLanguage();
    return cleanup;
  }, [settings.theme, settings.language, i18n]);

  // Authentication functions
  const checkAuthStatus = async () => {
    try {
      const response = await authAPI.checkAuth(i18n.language);

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
      await authAPI.logout(i18n.language);

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
      setShowAdminDashboard(false);

      toast.success(t('logout_successful'));
    } catch (error) {
      console.error('Logout failed:', error);
      // Even if logout fails on server, clear client-side data
      localStorage.removeItem('session_id');
      document.cookie = 'session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None';
      setIsAuthenticated(false);
      setCurrentUser(null);
      setShowAdminDashboard(false);
      toast.error(t('logout_failed'));
    }
  }, [t]);

  // App initialization
  const initializeApp = async () => {
    try {
      // Configure API if we have keys
      if (settings.geminiApiKey || settings.openrouterApiKey || settings.exaApiKey || (settings.customProviders && settings.customProviders.length > 0)) {
        try {
          await configAPI.setConfig({
            gemini_api_key: settings.geminiApiKey,
            openrouter_api_key: settings.openrouterApiKey,
            exa_api_key: settings.exaApiKey, // Pass EXA API key to backend
            custom_providers: settings.customProviders || [],
          }, i18n.language);
        } catch (error) {
          console.error('Failed to configure API keys:', error);
          // Don't throw here, continue with initialization
        }
      }

      // Load available models
      try {
        const modelsResponse = await configAPI.getModels(i18n.language);
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
      console.log('Attempting to load sessions...');
      const response = await sessionsAPI.getSessions(i18n.language);
      console.log('Sessions API response:', response);
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
      const response = await promptsAPI.getPrompts(i18n.language);
      setPrompts(response.data || []);
    } catch (error) {
      console.error('Failed to load prompts:', error);
      setPrompts([]);
    }
  };

  const loadSessionMessages = async (sessionId) => {
    if (!sessionId) return;

    try {
      const response = await sessionsAPI.getSession(sessionId, i18n.language);
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
        title: t('new_chat'),
        model: String(model), // Ensure it's a string
        temperature: Number(settings.temperature) || 1.0, // Ensure it's a number
      };

      console.log('Sending session creation request with data:', sessionData);
      const response = await sessionsAPI.createSession(sessionData, i18n.language);
      console.log('Session creation API response:', response);

      const newSession = response.data;
      setSessions(prev => [newSession, ...prev.filter(s => s.id !== newSession.id)]);

      // Immediately set as active session and open tab
      setActiveSessionId(newSession.id);
      setOpenTabIds(prev => [newSession.id, ...prev]);
      setCurrentMessages([]); // Clear messages for new session

      // Close sidebar on mobile after creating new session
      if (isMobile && isSidebarOpen) {
        setIsSidebarOpen(false);
      }

      console.log('New session created and activated:', newSession.id);
      return newSession;
    } catch (error) {
      console.error('Failed to create new session:', error);
      toast.error(t('failed_to_create_new_chat_session'));
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

      toast.success(t('chat_deleted_from_history'));
    } catch (error) {
      console.error('Failed to delete session:', error);
      toast.error(t('failed_to_delete_chat'));
    }
  }, [activeSessionId, sessions, selectSession, t]);

  const addAssistantMessage = useCallback((content) => {
    setCurrentMessages(prev => [
      ...prev,
      {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: content,
        timestamp: new Date().toISOString(),
      },
    ]);
  }, []);

  // Clear uploaded file IDs after successful message sending
  const clearUploadedFileIds = useCallback(() => {
    setUploadedFileIds([]);
  }, []);

  // Message handling with improved error handling and UX
  const sendMessage = useCallback(async (message, files = [], searchMode = false) => {
    if (!message || !message.trim()) {
      // Allow empty message if in searchMode
      if (!searchMode) {
        toast.error(t('please_enter_a_message'));
        return { success: false };
      }
    }

    // If no active session, generate a new session ID for backend auto-creation
    let targetSessionId = activeSessionId;
    if (!activeSessionId) {
      // Generate a new UUID for the session
      targetSessionId = crypto.randomUUID();
      console.log('No active session, generated new session ID for auto-creation:', targetSessionId);

      // Set as active immediately so UI shows it
      setActiveSessionId(targetSessionId);
      setOpenTabIds(prev => [targetSessionId, ...prev]);
    }

    const sessionExists = sessions.find(s => s.id === targetSessionId);
    // No need to check if session exists - backend will auto-create if needed
    // This handles first login and session ID mismatch scenarios

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
          const uploadResponse = await filesAPI.uploadFile(file, i18n.language);
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
                const statusResponse = await filesAPI.getFileStatus(fileId, i18n.language);
                if (statusResponse.data.status === 'ready' && statusResponse.data.processing_status === 'completed') {
                  fileReady = true;
                  console.log(`File ${file.name} is ready for processing`);
                } else {
                  console.log(`File ${file.name} status: ${statusResponse.data.status}, processing: ${statusResponse.data.processing_status}`);
                  retries++;
                }
              } catch (statusError) {
                console.warn(t('failed_to_check_status_for_file', { fileName: file.name }), statusError);
                retries++;
              }
            }

            if (!fileReady) {
              console.warn(t('file_not_ready_after_timeout', { fileName: file.name, time: maxRetries * 4 }));
              // Continue anyway - the backend will handle file processing
            }
          } catch (statusError) {
            console.warn(t('status_checking_failed_for_file', { fileName: file.name }), statusError);
            // Continue anyway - the backend will handle file processing
          }

        } catch (error) {
          console.error('Failed to upload file:', file.name, error);
          let errorMsg = t('failed_to_upload_file', { fileName: file.name });

          if (error.message.includes('timeout')) {
            errorMsg = t('upload_timeout_file_processing', { fileName: file.name });
          } else if (error.message.includes('size')) {
            errorMsg = t('file_too_large', { fileName: file.name });
          } else if (error.message.includes('Authentication')) {
            errorMsg = t('authentication_failed_for_file', { fileName: file.name });
          }

          toast.error(errorMsg);

          // Try to retry the upload once
          try {
            console.log(t('retrying_upload_for_file', { fileName: file.name }));
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry

            const retryResponse = await filesAPI.uploadFile(file, i18n.language);
            const retryFileId = retryResponse.data.id;
            uploadedFileIds.push(retryFileId);
            setUploadedFileIds(prev => [...prev, retryFileId]); // Add to tracking state
            console.log(t('retry_successful_for_file', { fileName: file.name }));
            toast.success(t('retry_successful_for_file', { fileName: file.name }));
          } catch (retryError) {
            console.error(t('retry_failed_for_file', { fileName: file.name }), retryError);
            toast.error(t('retry_failed_for_file_try_again', { fileName: file.name }));
          }

          // Don't add failed files to the list if retry also failed
          continue;
        }
      }

      // Send message to the target session (could be existing or new)
      // Include model and temperature for auto-session creation on backend
      const currentSessionData = sessions.find(s => s.id === targetSessionId);
      const response = await sessionsAPI.sendMessage(targetSessionId, {
        message: message.trim(),
        files: uploadedFileIds,
        search_mode: searchMode, // Pass the searchMode flag
        model: currentSessionData?.model || settings.defaultModel, // Pass model for auto-creation
        temperature: currentSessionData?.temperature || settings.temperature, // Pass temperature for auto-creation
      }, i18n.language);

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
      // Also handle case where backend auto-created the session
      setSessions(prev => {
        const existingSession = prev.find(s => s.id === targetSessionId);
        if (existingSession) {
          // Update existing session
          return prev.map(s =>
            s.id === targetSessionId ? response.data.session : s
          );
        } else {
          // Session was auto-created by backend, add it to the list
          return [response.data.session, ...prev];
        }
      });

      // Show success message for file uploads
      if (uploadedFileIds.length > 0) {
        toast.success(t('message_sent_successfully_with_files', { count: uploadedFileIds.length }));
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
      let errorMessage = t('failed_to_send_message');
      if (error.message.includes('Authentication required')) {
        errorMessage = t('session_expired_login_again');
        setIsAuthenticated(false);
      } else if (error.message.includes('not configured')) {
        errorMessage = t('configure_api_keys_in_settings');
      } else if (error.message.includes('timeout')) {
        errorMessage = t('request_timeout_file_processing');
      } else if (error.message.includes('Load error')) {
        errorMessage = t('file_loading_error_refresh_page');
      } else if (error.message.includes('File upload timeout')) {
        errorMessage = t('file_upload_timeout_check_status');
      } else {
        errorMessage = t('failed_to_send_message_with_error', { error: error.message });
      }

      toast.error(errorMessage);

      // Return error with the original message to restore in input
      return { success: false, originalMessage: message, originalFiles: files };
    } finally {
      setIsLoading(false);
    }
  }, [activeSessionId, sessions, settings.defaultModel, settings.temperature, setIsAuthenticated, t, clearUploadedFileIds, i18n.language]);

  const generateImage = useCallback(async (prompt) => {
    if (!prompt || !prompt.trim()) {
      toast.error(t('please_enter_prompt_for_image_generation'));
      return { success: false };
    }

    if (!activeSessionId) {
      toast.error(t('no_active_session_create_new_chat'));
      return { success: false };
    }

    const sessionExists = sessions.find(s => s.id === activeSessionId);
    if (!sessionExists) {
      toast.error(t('active_session_not_found'));
      return { success: false };
    }

    const tempUserMessageId = `temp_image_prompt_${Date.now()}`;
    const userMessage = {
      id: tempUserMessageId,
      role: 'user',
      content: t('generate_image_prompt', { prompt: prompt.trim() }), // Indicate image generation
      timestamp: new Date().toISOString(),
      isTemporary: true,
      isImageGeneration: true,
    };

    setCurrentMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await sessionsAPI.generateImage(activeSessionId, { prompt: prompt.trim() }, i18n.language);

      setCurrentMessages(prev => {
        const withoutTemp = prev.filter(msg => msg.id !== tempUserMessageId);
        return [
          ...withoutTemp,
          response.data.user_message,
          response.data.assistant_message,
        ];
      });

      setSessions(prev => prev.map(s =>
        s.id === activeSessionId ? response.data.session : s
      ));

      toast.success(t('image_generated_successfully'));
      return { success: true };

    } catch (error) {
      console.error('Failed to generate image:', error);
      setCurrentMessages(prev => prev.filter(msg => msg.id !== tempUserMessageId));

      let errorMessage = t('failed_to_generate_image');
      if (error.message.includes('Authentication required')) {
        errorMessage = t('session_expired_login_again');
        setIsAuthenticated(false);
      } else if (error.message.includes('not configured')) {
        errorMessage = t('configure_api_keys_for_image_generation');
      } else {
        errorMessage = t('failed_to_generate_image_with_error', { error: error.message });
      }
      toast.error(errorMessage);
      return { success: false, originalMessage: prompt };
    } finally {
      setIsLoading(false);
    }
  }, [activeSessionId, setIsAuthenticated, t]);

  // Add periodic file status checking
  const checkFileStatuses = useCallback(async (fileIds) => {
    if (!fileIds || fileIds.length === 0) return;

    console.log(t('checking_status_for_files', { count: fileIds.length }));

    for (const fileId of fileIds) {
      try {
        const statusResponse = await filesAPI.getFileStatus(fileId, i18n.language);
        const status = statusResponse.data;

        if (status.status === 'ready' && status.processing_status === 'completed') {
          console.log(t('file_is_ready', { fileName: status.original_filename }));
        } else {
          console.log(t('file_status_processing', { fileName: status.original_filename, status: status.status, processing: status.processing_status }));
        }
      } catch (error) {
        console.warn(t('failed_to_check_status_for_file_id', { fileId: fileId }), error);
      }
    }
  }, [t]);

  // Check file statuses periodically when there are uploaded files
  useEffect(() => {
    if (uploadedFileIds.length > 0) {
      const interval = setInterval(() => {
        checkFileStatuses(uploadedFileIds);
      }, 10000); // Check every 10 seconds

      return () => clearInterval(interval);
    }
  }, [uploadedFileIds, checkFileStatuses]);

  // Delete message function
  const deleteMessage = useCallback(async (messageId) => {
    try {
      // Remove message from local state immediately for better UX
      setCurrentMessages(prev => prev.filter(msg => msg.id !== messageId));

      // Call API to delete message from server
      await sessionsAPI.deleteMessage(activeSessionId, messageId, i18n.language);

      toast.success(t('message_deleted_successfully'));
    } catch (error) {
      console.error('Failed to delete message:', error);
      toast.error(t('failed_to_delete_message'));

      // Reload messages from server to restore state
      try {
        const response = await sessionsAPI.getSession(activeSessionId, i18n.language);
        setCurrentMessages(response.data?.messages || []);
      } catch (reloadError) {
        console.error('Failed to reload messages:', reloadError);
      }
    }
  }, [activeSessionId, t]);

  // Prompt management functions
  const createPrompt = useCallback(async (promptData) => {
    try {
      const response = await promptsAPI.createPrompt(promptData, i18n.language);
      setPrompts(prev => [response.data, ...prev]);
      toast.success(t('new_prompt_template_saved'));
    } catch (error) {
      console.error('Failed to create prompt:', error);
      toast.error(t('failed_to_create_prompt_template'));
    }
  }, [t]);

  const usePrompt = useCallback(async (prompt) => {
    try {
      // Increment usage count
      await promptsAPI.usePrompt(prompt.id, i18n.language);

      // Update prompts list
      setPrompts(prev => prev.map(p =>
        p.id === prompt.id ? { ...p, usage_count: p.usage_count + 1 } : p
      ));

      if (isMobile) {
        // On mobile, create a new session and set the prompt content
        const newSession = await createNewSession();
        if (newSession) {
          await selectSession(newSession.id);
          setMessageInputContent(prompt.content);
          toast.success(t('started_new_chat_with_template', { title: prompt.title }));
          setIsSidebarOpen(false); // Close sidebar after using prompt
        } else {
          toast.error(t('failed_to_start_new_chat_with_prompt'));
        }
      } else {
        // On desktop, just set the prompt content in the message input
        setMessageInputContent(prompt.content);
        toast.success(t('applied_template_to_message_input', { title: prompt.title }));
      }
    } catch (error) {
      console.error('Failed to use prompt:', error);
      toast.error(t('failed_to_use_prompt_template'));
    }
  }, [isMobile, createNewSession, selectSession, setIsSidebarOpen, t]);

  const deletePrompt = useCallback(async (promptId) => {
    try {
      await promptsAPI.deletePrompt(promptId, i18n.language);
      setPrompts(prev => prev.filter(p => p.id !== promptId));
      toast.success(t('prompt_template_deleted'));
    } catch (error) {
      console.error('Failed to delete prompt:', error);
      toast.error(t('failed_to_delete_prompt_template'));
    }
  }, [t]);

  const updatePrompt = useCallback(async (promptId, updates) => {
    try {
      const response = await promptsAPI.updatePrompt(promptId, updates, i18n.language);
      const updated = response.data;
      setPrompts(prev => prev.map(p => p.id === promptId ? { ...p, ...updated } : p));
      toast.success(t('prompt_updated_successfully'));
    } catch (error) {
      console.error('Failed to update prompt:', error);
      toast.error(t('failed_to_update_prompt_template'));
    }
  }, [t]);

  const renameSession = useCallback(async (sessionId, newTitle) => {
    try {
      await sessionsAPI.updateSession(sessionId, {
        title: newTitle.trim()
      }, i18n.language);

      // Update sessions list
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, title: newTitle.trim() } : s
      ));

      toast.success(t('chat_renamed_successfully'));
    } catch (error) {
      console.error('Failed to rename session:', error);
      toast.error(t('failed_to_rename_chat_session'));
    }
  }, [t]);

  const changeSessionModel = useCallback(async (sessionId, newModel) => {
    try {
      await sessionsAPI.updateSession(sessionId, { model: newModel }, i18n.language);

      // Update sessions list
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, model: newModel } : s
      ));

      toast.success(t('model_changed_to', { model: newModel }));
    } catch (error) {
      console.error('Failed to change session model:', error);
      toast.error(t('failed_to_change_model'));
    }
  }, [t]);

  // Find current session object
  const currentSession = useMemo(() =>
    sessions.find(s => s.id === activeSessionId),
    [sessions, activeSessionId]
  );

  // Settings management with improved error handling
  const updateSettings = useCallback(async (newSettings) => {
    setSettings(newSettings);

    // Update i18n language immediately
    if (newSettings.language && newSettings.language !== i18n.language) {
      i18n.changeLanguage(newSettings.language);
    }

    try {
      if (newSettings.geminiApiKey || newSettings.openrouterApiKey || newSettings.exaApiKey || (newSettings.customProviders && newSettings.customProviders.length > 0)) {
        await configAPI.setConfig({
          gemini_api_key: newSettings.geminiApiKey,
          openrouter_api_key: newSettings.openrouterApiKey,
          exa_api_key: newSettings.exaApiKey, // Pass EXA API key to backend
          custom_providers: newSettings.customProviders || [],
        }, newSettings.language);

        // Try to reload models
        try {
          const modelsResponse = await configAPI.getModels(newSettings.language);
          if (modelsResponse && modelsResponse.data) {
            // Add custom models to the available models
            const modelsWithCustom = {
              ...modelsResponse.data,
              custom: newSettings.customModels || []
            };
            setAvailableModels(modelsWithCustom);
          }
          toast.success(t('settings_updated_successfully'));
        } catch (modelError) {
          console.error('Failed to reload models:', modelError);
          // Set custom models even if API call fails
          setAvailableModels(prev => ({
            ...prev,
            custom: newSettings.customModels || []
          }));
          toast.success(t('settings_saved_could_not_reload_models'));
        }
      } else {
        // Update custom models even if no API keys changed
        setAvailableModels(prev => ({
          ...prev,
          custom: newSettings.customModels || []
        }));
        toast.success(t('settings_saved'));
      }
    } catch (error) {
      console.error('Failed to update API configuration:', error);
      toast.error(t('failed_to_update_api_configuration'));
    }
  }, [setSettings, i18n, t]);

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
          <p className="text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    );
  }

  // Show authentication component if not logged in
  if (!isAuthenticated) {
    return <AuthComponent onAuthSuccess={handleAuthSuccess} />;
  }

  // Show admin dashboard if admin user and admin mode is active
  if (showAdminDashboard) {
    return (
      <div className="h-screen bg-background">
        {/* Admin Dashboard Header */}
        <div className="border-b bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-3">
              <div className="flex items-center">
                <Shield className="h-6 w-6 text-blue-600 mr-2" />
                <h1 className="text-lg font-semibold text-gray-700">{t('admin_dashboard')}</h1>
              </div>
              <button
                onClick={() => setShowAdminDashboard(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md shadow-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {t('back_to_chat')}
              </button>
            </div>
          </div>
        </div>

        <AdminDashboard />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div
        className={`h-screen flex bg-background text-foreground ${isMobile ? 'mobile-root' : ''}`}
        {...swipeHandlers} // Apply swipe handlers here
      >
        {/* App Tour Component */}
        <AppTour isMobile={isMobile} />

        {/* Mobile toggle button */}
        {isMobile && (
          <button
            aria-label={isSidebarOpen ? t('close_sidebar') : t('open_sidebar')}
            className="mobile-sidebar-toggle"
            onClick={() => setIsSidebarOpen(prev => !prev)}
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        {/* Mobile new chat button */}
        {isMobile && !isSidebarOpen && (
          <>
            <button
              variant="ghost"
              aria-label={t('new_chat')}
              className="mobile-newchat-button"
              onClick={() => createNewSession()}
            >
              <MessageCirclePlus className="h-5 w-5" />
            </button>
            <button
              variant="ghost"
              aria-label={t('Workflow Spaces')}
              className="mobile-workflows-button"
              onClick={() => setIsWorkflowSidebarOpen(true)}
            >
              <Folders className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Desktop persistent sidebar */}
        {!isMobile && (
          <Sidebar
            className="sidebar"
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
            onEditPrompt={updatePrompt}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onLogout={handleLogout}
            isAdmin={isAdmin}
            onOpenAdmin={() => setShowAdminDashboard(true)}
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
                onEditPrompt={updatePrompt}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onLogout={handleLogout}
                isMobileOverlay={true}
                onRequestClose={() => setIsSidebarOpen(false)}
                isAdmin={isAdmin}
                onOpenAdmin={() => {
                  setShowAdminDashboard(true);
                  setIsSidebarOpen(false);
                }}
              />
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col main-content">
          {!isMobile && (
            <>
              <ChatTabs
                sessions={openTabSessions}
                activeSessionId={activeSessionId}
                onSessionSelect={selectSession}
                onNewSession={createNewSession}
                onCloseTab={closeTabOnly}
                onRenameSession={renameSession}
              />
              {/* Desktop Workflow Spaces Toggle Button */}
              <button
                variant="ghost"
                aria-label={t('Workflow Spaces')}
                className="fixed top-4 right-4 z-50 p-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-colors"
                onClick={() => setIsWorkflowSidebarOpen(true)}
                title={t('Workflow Spaces')}
              >
                <Folders className="h-5 w-5" />
              </button>
            </>
          )}

          <MessageList
            messages={currentMessages}
            isLoading={isLoading}
            onAddToPrompt={openPromptDialogWithContent}
            onDeleteMessage={deleteMessage}
          />

          <MessageInput
            onSendMessage={sendMessage}
            onImageGeneration={generateImage}
            onAddAssistantMessage={addAssistantMessage} // Pass the new function
            isLoading={isLoading}
            disabled={!isConfigured}
            availableModels={availableModels}
            currentSession={currentSession}
            onModelChange={changeSessionModel}
            onCreateNewSession={createNewSession}
            settings={settings}
            initialContent={messageInputContent}
            onContentSet={() => setMessageInputContent('')}
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

        <WorkflowSpacesSidebar
          isOpen={isWorkflowSidebarOpen}
          onClose={() => setIsWorkflowSidebarOpen(false)}
          availableModels={availableModels}
        />

        <Toaster position="top-right" />
      </div>
    </ErrorBoundary>
  );
}

export default App;