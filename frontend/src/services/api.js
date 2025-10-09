// API configuration - Dynamic base URL that works across network
const getApiBaseUrl = () => {
  // If we're in development and accessing via network IP, use the same IP for API
  const currentHost = window.location.hostname;
  const currentProtocol = window.location.protocol;
  const currentPort = window.location.port;

  // Check if we're accessing via a network IP (not localhost/127.0.0.1)
  if (currentPort === '5173' || currentPort === '3000' || currentPort === '8080') {
    return `http://${currentHost}:5000/api`;
  }

  return `${currentProtocol}//${currentHost}/api`;
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
const apiCall = async (url, options = {}, language = 'en') => {
  // FIXED: Get session ID from multiple sources with better priority
  const sessionIdFromStorage = localStorage.getItem('session_id');
  const sessionIdFromCookie = getCookie('session');

  // Prefer localStorage over cookie for network compatibility
  const sessionId = sessionIdFromStorage || sessionIdFromCookie;

  console.log(`API Call ${url}: session_id = ${sessionId}`);

  const defaultOptions = {
    credentials: 'include',  // Changed to 'include' to ensure cookies are sent
    mode: 'cors',
    timeout: 120000, // Increased to 120 seconds to match backend timeout
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Language': language, // Use the passed language parameter
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
  register: async (userData, language) => {
    console.log('API Request: POST /auth/register');
    const response = await apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    }, language);

    // Handle session from registration response
    if (response.data.session_id) {
      localStorage.setItem('session_id', response.data.session_id);
      setCookie('session', response.data.session_id);
    }

    return response;
  },

  login: async (credentials, language) => {
    console.log('API Request: POST /auth/login');
    const response = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }, language);

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

  logout: async (language) => {
    console.log('API Request: POST /auth/logout');
    try {
      const response = await apiCall('/auth/logout', {
        method: 'POST',
      }, language);

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

  getCurrentUser: async (language) => {
    console.log('API Request: GET /auth/me');
    return apiCall('/auth/me', {}, language);
  },

  checkAuth: async (language) => {
    console.log('API Request: GET /auth/check');
    try {
      return await apiCall('/auth/check', {}, language);
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
  setConfig: async (config, language) => {
    console.log('API Request: POST /config');
    return apiCall('/config', {
      method: 'POST',
      body: JSON.stringify(config),
    }, language);
  },

  getModels: async (language) => {
    console.log('API Request: GET /models');
    return apiCall('/models', {}, language);
  },
};

// Sessions API
export const sessionsAPI = {
  getSessions: async (language) => {
    console.log('API Request: GET /sessions');
    return apiCall('/sessions', {}, language);
  },

  getSessionHistory: async (language) => {
    console.log('API Request: GET /sessions/history');
    return apiCall('/sessions/history', {}, language);
  },

  createSession: async (sessionData, language) => {
    console.log('API Request: POST /sessions');
    return apiCall('/sessions', {
      method: 'POST',
      body: JSON.stringify(sessionData),
    }, language);
  },

  getSession: async (sessionId, language) => {
    console.log('API Request: GET /sessions/' + sessionId);
    return apiCall(`/sessions/${sessionId}`, {}, language);
  },

  updateSession: async (sessionId, updates, language) => {
    console.log('API Request: PUT /sessions/' + sessionId);
    return apiCall(`/sessions/${sessionId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }, language);
  },

  deleteSession: async (sessionId, language) => {
    console.log('API Request: DELETE /sessions/' + sessionId);
    return apiCall(`/sessions/${sessionId}`, {
      method: 'DELETE',
    }, language);
  },

  closeSession: async (sessionId, language) => {
    console.log('API Request: POST /sessions/' + sessionId + '/close');
    return apiCall(`/sessions/${sessionId}/close`, {
      method: 'POST',
    }, language);
  },

  reopenSession: async (sessionId, language) => {
    console.log('API Request: POST /sessions/' + sessionId + '/reopen');
    return apiCall(`/sessions/${sessionId}/reopen`, {
      method: 'POST',
    }, language);
  },

  searchContent: async (query, language) => {
    console.log('API Request: GET /search?q=' + query);
    return apiCall(`/search?q=${encodeURIComponent(query)}`, {}, language);
  },

  sendMessage: async (sessionId, messageData, language) => {
    console.log('API Request: POST /sessions/' + sessionId + '/messages');

    // Validate message data before sending, unless in search_mode with potentially empty message
    if (!messageData.search_mode && (!messageData.message || !messageData.message.trim())) {
      throw new Error('Message content cannot be empty');
    }

    return apiCall(`/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify(messageData),
    }, language);
  },

  deleteMessage: async (sessionId, messageId, language) => {
    console.log('API Request: DELETE /sessions/' + sessionId + '/messages/' + messageId);
    return apiCall(`/sessions/${sessionId}/messages/${messageId}`, {
      method: 'DELETE',
    }, language);
  },

  generateImage: async (sessionId, imageData, language) => {
    console.log('API Request: POST /sessions/' + sessionId + '/generate-image');
    return apiCall(`/sessions/${sessionId}/generate-image`, {
      method: 'POST',
      body: JSON.stringify(imageData),
    }, language);
  },

  clearSession: async (sessionId, language) => {
    console.log('API Request: POST /sessions/' + sessionId + '/clear');
    return apiCall(`/sessions/${sessionId}/clear`, {
      method: 'POST',
    }, language);
  },
};

// Prompts API
export const promptsAPI = {
  getPrompts: async (language) => {
    console.log('API Request: GET /prompts');
    return apiCall('/prompts', {}, language);
  },

  createPrompt: async (promptData, language) => {
    console.log('API Request: POST /prompts', { title: promptData.title, is_public: promptData.is_public });

    // Validate required fields on frontend
    if (!promptData.title?.trim()) {
      throw new Error('Title is required');
    }
    if (!promptData.content?.trim()) {
      throw new Error('Content is required');
    }

    // Clean data before sending
    const cleanData = {
      title: promptData.title.trim(),
      content: promptData.content.trim(),
      category: (promptData.category || 'General').trim(),
      tags: Array.isArray(promptData.tags) ? promptData.tags : [],
      is_public: Boolean(promptData.is_public)
    };

    return apiCall('/prompts', {
      method: 'POST',
      body: JSON.stringify(cleanData),
    }, language);
  },

  updatePrompt: async (promptId, updates, language) => {
    console.log('API Request: PUT /prompts/' + promptId, { is_public: updates.is_public });

    // Validate if updating title or content
    if ('title' in updates && !updates.title?.trim()) {
      throw new Error('Title cannot be empty');
    }
    if ('content' in updates && !updates.content?.trim()) {
      throw new Error('Content cannot be empty');
    }

    // Clean updates data
    const cleanUpdates = { ...updates };
    if (cleanUpdates.title) cleanUpdates.title = cleanUpdates.title.trim();
    if (cleanUpdates.content) cleanUpdates.content = cleanUpdates.content.trim();
    if (cleanUpdates.category) cleanUpdates.category = cleanUpdates.category.trim();
    if ('is_public' in cleanUpdates) cleanUpdates.is_public = Boolean(cleanUpdates.is_public);

    return apiCall(`/prompts/${promptId}`, {
      method: 'PUT',
      body: JSON.stringify(cleanUpdates),
    }, language);
  },

  deletePrompt: async (promptId, language) => {
    console.log('API Request: DELETE /prompts/' + promptId);
    return apiCall(`/prompts/${promptId}`, {
      method: 'DELETE',
    }, language);
  },

  usePrompt: async (promptId, language) => {
    console.log('API Request: POST /prompts/' + promptId + '/use');
    return apiCall(`/prompts/${promptId}/use`, {
      method: 'POST',
    }, language);
  },

  getPublicPrompts: async (params = {}, language) => {
    console.log('API Request: GET /public-prompts', params);

    // Validate parameters
    const validatedParams = {
      page: Math.max(1, parseInt(params.page) || 1),
      per_page: Math.min(100, Math.max(1, parseInt(params.per_page) || 20)),
    };

    if (params.search?.trim()) {
      validatedParams.search = params.search.trim();
    }
    if (params.category?.trim()) {
      validatedParams.category = params.category.trim();
    }
    if (params.tag?.trim()) { // Add this block to include tag parameter
      validatedParams.tag = params.tag.trim();
    }

    const queryParams = new URLSearchParams();
    Object.entries(validatedParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value.toString());
      }
    });

    const queryString = queryParams.toString();
    const url = queryString ? `/public-prompts?${queryString}` : '/public-prompts';

    return apiCall(url, {}, language);
  },

  likePrompt: async (promptId, language) => {
    console.log('API Request: POST /prompts/' + promptId + '/like');

    if (!promptId || isNaN(promptId)) {
      throw new Error('Invalid prompt ID');
    }

    return apiCall(`/prompts/${promptId}/like`, {
      method: 'POST',
    }, language);
  },

  getPromptLikeStatus: async (promptId, language) => {
    console.log('API Request: GET /prompts/' + promptId + '/like-status');

    if (!promptId || isNaN(promptId)) {
      throw new Error('Invalid prompt ID');
    }

    return apiCall(`/prompts/${promptId}/like-status`, {}, language);
  },
};

// Files API
export const filesAPI = {
  getFiles: async (language) => {
    console.log('API Request: GET /files');
    return apiCall('/files', {}, language);
  },

  uploadFile: async (file, language) => {
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
    }, language);
  },

  deleteFile: async (fileId, language) => {
    console.log('API Request: DELETE /files/' + fileId);
    return apiCall(`/files/${fileId}`, {
      method: 'DELETE',
    }, language);
  },

  getFileStatus: async (fileId, language) => {
    console.log('API Request: GET /files/' + fileId + '/status');
    return apiCall(`/files/${fileId}/status`, {}, language);
  },
};

// Users API
export const usersAPI = {
  getUsers: async (language) => {
    console.log('API Request: GET /users');
    return apiCall('/users', {}, language);
  },

  getUser: async (userId, language) => {
    console.log('API Request: GET /users/' + userId);
    return apiCall(`/users/${userId}`, {}, language);
  },

  updateUser: async (userId, updates, language) => {
    console.log('API Request: PUT /users/' + userId);
    return apiCall(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }, language);
  },

  deleteUser: async (userId, language) => {
    console.log('API Request: DELETE /users/' + userId);
    return apiCall(`/users/${userId}`, {
      method: 'DELETE',
    }, language);
  },
};

export const adminAPI = {
  getOverviewStats: async (language) => apiCall('/admin/stats/overview', {}, language),
  getUsageStats: async (days = 30, language) => apiCall(`/admin/stats/usage?days=${days}`, {}, language),
  getModelStats: async (language) => apiCall('/admin/stats/models', {}, language),
  getUsers: async (page = 1, per_page = 10, search = '', active_only = false, language) => {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: per_page.toString(),
      search: search,
      active_only: active_only.toString()
    });
    return apiCall(`/admin/users?${params.toString()}`, {}, language);
  },
  updateUserStatus: async (userId, isActive, language) => apiCall(`/admin/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify({ is_active: isActive }),
  }, language),
  getSessions: async (page = 1, per_page = 10, userId = '', model = '', language) => {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: per_page.toString()
    });
    if (userId) params.append('user_id', userId);
    if (model) params.append('model', model);
    return apiCall(`/admin/sessions?${params.toString()}`, {}, language);
  },
  getFiles: async (page = 1, per_page = 10, userId = '', language) => {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: per_page.toString()
    });
    if (userId) params.append('user_id', userId);
    return apiCall(`/admin/files?${params.toString()}`, {}, language);
  },
  getSystemInfo: async (language) => apiCall('/admin/system/info', {}, language),
};

// Exa API
export const exaAPI = {
  search: async (query, apiKey, options = {}, language) => {
    console.log('API Request: POST /exa/search');
    return apiCall('/exa/search', {
      method: 'POST',
      body: JSON.stringify({ ...options, query, api_key: apiKey }),
    }, language);
  },
  getContents: async (ids, apiKey, language) => {
    console.log('API Request: POST /exa/contents');
    return apiCall('/exa/contents', {
      method: 'POST',
      body: JSON.stringify({ ids, api_key: apiKey }),
    }, language);
  },
  searchAndContents: async (query, apiKey, options = {}, language) => {
    console.log('API Request: POST /exa/search_and_contents');
    return apiCall('/exa/search_and_contents', {
      method: 'POST',
      body: JSON.stringify({ ...options, query, api_key: apiKey }),
    }, language);
  },
};