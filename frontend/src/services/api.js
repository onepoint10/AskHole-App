// API configuration
const API_BASE_URL = 'http://127.0.0.1:5000/api';

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
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=None`;
};

// Helper function for making API calls with proper error handling
const apiCall = async (url, options = {}) => {
  // Get session ID from multiple sources with priority order
  const sessionIdFromCookie = getCookie('session');
  const sessionIdFromStorage = localStorage.getItem('session_id');
  const sessionId = sessionIdFromCookie || sessionIdFromStorage; // Prefer cookie over localStorage
  
  console.log(`API Call ${url}: session_id = ${sessionId}`);
  
  const defaultOptions = {
    credentials: 'include',
    mode: 'cors',
    timeout: 120000,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      // Send Authorization header for better CORS compatibility
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
        document.cookie = 'session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None';
        throw new Error('Authentication required. Please log in again.');
      }
      throw new Error(data.error || data.message || `HTTP ${response.status}`);
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
    
    // Extract and store session ID from response
    if (response.data.session_id) {
      localStorage.setItem('session_id', response.data.session_id);
      setCookie('session', response.data.session_id);
      console.log('Session stored:', response.data.session_id);
    }
    
    // Also try to extract from Set-Cookie header as backup
    const cookieHeader = response.headers?.get('Set-Cookie');
    if (cookieHeader) {
      const sessionMatch = cookieHeader.match(/session=([^;]+)/);
      if (sessionMatch && !response.data.session_id) {
        const sessionFromCookie = sessionMatch[1];
        localStorage.setItem('session_id', sessionFromCookie);
        setCookie('session', sessionFromCookie);
        console.log('Session from cookie:', sessionFromCookie);
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