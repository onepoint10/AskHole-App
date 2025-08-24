// API configuration - Dynamic base URL that works across network
const getApiBaseUrl = () => {
  // If we're in development and accessing via network IP, use the same IP for API
  const currentHost = window.location.hostname;
  
  // Check if we're accessing via a network IP (not localhost/127.0.0.1)
  if (currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
    // Use the same host but port 5000 for API
    return `http://${currentHost}:5000/api`;
  }
  
  // Default to localhost for local development
  return 'http://127.0.0.1:5000/api';
};

const API_BASE_URL = getApiBaseUrl();

// Helper function to get cookie value
const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
};

// Helper function to set cookie
const setCookie = (name, value, days = 30) => {
  const expires = new Date();
  expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
  // FIXED: Use SameSite=Lax for better network compatibility
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
};

// Helper function for making API calls with proper error handling
const apiCall = async (url, options = {}) => {
  // FIXED: Get session ID from multiple sources with better priority
  const sessionIdFromStorage = localStorage.getItem('session_id');
  const sessionIdFromCookie = getCookie('session');
  
  // Prefer localStorage over cookie for network compatibility
  const sessionId = sessionIdFromStorage || sessionIdFromCookie;
  
  console.log(`API Call ${url}: session_id = ${sessionId}`);
  
  const defaultOptions = {
    credentials: 'include',
    mode: 'cors',
    timeout: 180000,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      // FIXED: Always send session ID in Authorization header for network requests
      ...(sessionId && { 
        'Authorization': `Bearer ${sessionId}`
      }),
      ...options.headers,
    },
  };

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), defaultOptions.timeout);

  try {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...defaultOptions,
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle different response types
    let data;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { error: text };
        }
      } else {
        data = {};
      }
    }

    if (!response.ok) {
      // Handle authentication errors specifically
      if (response.status === 401) {
        // Clear invalid session data
        localStorage.removeItem('session_id');
        document.cookie = 'session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
        throw new Error('Authentication required. Please log in again.');
      }
      throw new Error(data.error || data.message || `HTTP ${response.status}`);
    }

    // FIXED: Extract session ID from response headers for network compatibility
    const sessionFromHeader = response.headers.get('X-Session-ID');
    if (sessionFromHeader) {
      localStorage.setItem('session_id', sessionFromHeader);
      setCookie('session', sessionFromHeader);
      console.log('Session updated from header:', sessionFromHeader);
    }

    // Return data in same format as old axios API (with .data property)
    return { data, headers: response.headers };

  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    
    // Log errors for debugging
    console.error(`API ${url} Error:`, error.message);
    throw error;
  }
};

// Authentication API
export const authAPI = {
  register: async (userData) => {
    console.log('API Request: POST /auth/register');
    const response = await apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    
    // Handle session from registration response
    if (response.data.session_id) {
      localStorage.setItem('session_id', response.data.session_id);
      setCookie('session', response.data.session_id);
    }
    
    return response;
  },

  login: async (credentials) => {
    console.log('API Request: POST /auth/login');
    const response = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    
    // FIXED: Always prefer session_id from response data for network compatibility
    if (response.data.session_id) {
      localStorage.setItem('session_id', response.data.session_id);
      setCookie('session', response.data.session_id);
      console.log('Session stored from response:', response.data.session_id);
    } else {
      // Fallback to header if no session_id in response
      const sessionFromHeader = response.headers?.get('X-Session-ID');
      if (sessionFromHeader) {
        localStorage.setItem('session_id', sessionFromHeader);
        setCookie('session', sessionFromHeader);
        console.log('Session stored from header:', sessionFromHeader);
      }
    }
    
    return response;
  },

  logout: async () => {
    console.log('API Request: POST /auth/logout');
    try {
      const response = await apiCall('/auth/logout', {
        method: 'POST',
      });
      
      // Clear session data after successful logout
      localStorage.removeItem('session_id');
      document.cookie = 'session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None';
      
      return response;
    } catch (error) {
      // Even if logout fails on server, clear local data
      localStorage.removeItem('session_id');
      document.cookie = 'session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None';
      throw error;
    }
  },

  getCurrentUser: async () => {
    console.log('API Request: GET /auth/me');
    return apiCall('/auth/me');
  },

  checkAuth: async () => {
    console.log('API Request: GET /auth/check');
    try {
      return await apiCall('/auth/check');
    } catch (error) {
      // If auth check fails, clear potentially invalid session data
      if (error.message.includes('Authentication required')) {
        localStorage.removeItem('session_id');
        document.cookie = 'session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None';
      }
      throw error;
    }
  },

  getDevices: async () => {
    console.log('API Request: GET /auth/devices');
    return apiCall('/auth/devices');
  },

  revokeDevice: async (sessionId) => {
    console.log('API Request: DELETE /auth/devices/' + sessionId);
    return apiCall(`/auth/devices/${sessionId}`, {
      method: 'DELETE',
    });
  },

  revokeAllDevices: async () => {
    console.log('API Request: POST /auth/devices/revoke-all');
    return apiCall('/auth/devices/revoke-all', {
      method: 'POST',
    });
  },
};

// Configuration API
export const configAPI = {
  setConfig: async (config) => {
    console.log('API Request: POST /config');
    return apiCall('/config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  getModels: async () => {
    console.log('API Request: GET /models');
    return apiCall('/models');
  },
};

// Sessions API
export const sessionsAPI = {
  getSessions: async () => {
    console.log('API Request: GET /sessions');
    return apiCall('/sessions');
  },
  
  getSessionHistory: async () => {
    console.log('API Request: GET /sessions/history');
    return apiCall('/sessions/history');
  },

  createSession: async (sessionData) => {
    console.log('API Request: POST /sessions');
    return apiCall('/sessions', {
      method: 'POST',
      body: JSON.stringify(sessionData),
    });
  },

  getSession: async (sessionId) => {
    console.log('API Request: GET /sessions/' + sessionId);
    return apiCall(`/sessions/${sessionId}`);
  },

  updateSession: async (sessionId, updates) => {
    console.log('API Request: PUT /sessions/' + sessionId);
    return apiCall(`/sessions/${sessionId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  deleteSession: async (sessionId) => {
    console.log('API Request: DELETE /sessions/' + sessionId);
    return apiCall(`/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  },

  closeSession: async (sessionId) => {
    console.log('API Request: POST /sessions/' + sessionId + '/close');
    return apiCall(`/sessions/${sessionId}/close`, {
      method: 'POST',
    });
  },

  reopenSession: async (sessionId) => {
    console.log('API Request: POST /sessions/' + sessionId + '/reopen');
    return apiCall(`/sessions/${sessionId}/reopen`, {
      method: 'POST',
    });
  },

  sendMessage: async (sessionId, messageData) => {
    console.log('API Request: POST /sessions/' + sessionId + '/messages');
    
    // Validate message data before sending
    if (!messageData.message || !messageData.message.trim()) {
      throw new Error('Message content cannot be empty');
    }
    
    return apiCall(`/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify(messageData),
    });
  },

  deleteMessage: async (sessionId, messageId) => {
    console.log('API Request: DELETE /sessions/' + sessionId + '/messages/' + messageId);
    return apiCall(`/sessions/${sessionId}/messages/${messageId}`, {
      method: 'DELETE',
    });
  },

  clearSession: async (sessionId) => {
    console.log('API Request: POST /sessions/' + sessionId + '/clear');
    return apiCall(`/sessions/${sessionId}/clear`, {
      method: 'POST',
    });
  },
};

// Prompts API
export const promptsAPI = {
  getPrompts: async () => {
    console.log('API Request: GET /prompts');
    return apiCall('/prompts');
  },

  createPrompt: async (promptData) => {
    console.log('API Request: POST /prompts');
    return apiCall('/prompts', {
      method: 'POST',
      body: JSON.stringify(promptData),
    });
  },

  updatePrompt: async (promptId, updates) => {
    console.log('API Request: PUT /prompts/' + promptId);
    return apiCall(`/prompts/${promptId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  deletePrompt: async (promptId) => {
    console.log('API Request: DELETE /prompts/' + promptId);
    return apiCall(`/prompts/${promptId}`, {
      method: 'DELETE',
    });
  },

  usePrompt: async (promptId) => {
    console.log('API Request: POST /prompts/' + promptId + '/use');
    return apiCall(`/prompts/${promptId}/use`, {
      method: 'POST',
    });
  },
};

// Files API
export const filesAPI = {
  getFiles: async () => {
    console.log('API Request: GET /files');
    return apiCall('/files');
  },

  uploadFile: async (file) => {
    console.log('API Request: POST /files/upload');
    
    // Validate file before upload
    if (!file || file.size === 0) {
      throw new Error('Please select a valid file to upload');
    }
    
    const formData = new FormData();
    formData.append('file', file);

    // Get session for file upload (files API needs authentication)
    const sessionIdFromCookie = getCookie('session');
    const sessionIdFromStorage = localStorage.getItem('session_id');
    const sessionId = sessionIdFromCookie || sessionIdFromStorage;

    return apiCall('/files/upload', {
      method: 'POST',
      body: formData,
      headers: {
        // Remove Content-Type to let browser set it with boundary
        // Keep other headers like Authorization
        ...(sessionId && { 
          'Authorization': `Bearer ${sessionId}`
        }),
      },
    });
  },

  deleteFile: async (fileId) => {
    console.log('API Request: DELETE /files/' + fileId);
    return apiCall(`/files/${fileId}`, {
      method: 'DELETE',
    });
  },
};

// Users API
export const usersAPI = {
  getUsers: async () => {
    console.log('API Request: GET /users');
    return apiCall('/users');
  },

  getUser: async (userId) => {
    console.log('API Request: GET /users/' + userId);
    return apiCall(`/users/${userId}`);
  },

  updateUser: async (userId, updates) => {
    console.log('API Request: PUT /users/' + userId);
    return apiCall(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  deleteUser: async (userId) => {
    console.log('API Request: DELETE /users/' + userId);
    return apiCall(`/users/${userId}`, {
      method: 'DELETE',
    });
  },
};