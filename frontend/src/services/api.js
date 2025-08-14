import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: 'http://192.168.1.138:5000/api',
  timeout: 180000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log('API Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Configuration API
export const configAPI = {
  setConfig: (config) => api.post('/config', config),
  getModels: () => api.get('/models'),
};

// Sessions API
export const sessionsAPI = {
  getSessions: () => api.get('/sessions'),
  createSession: (sessionData) => api.post('/sessions', sessionData),
  getSession: (sessionId) => api.get(`/sessions/${sessionId}`),
  updateSession: (sessionId, updates) => api.put(`/sessions/${sessionId}`, updates),
  deleteSession: (sessionId) => api.delete(`/sessions/${sessionId}`),
  clearSession: (sessionId) => api.post(`/sessions/${sessionId}/clear`),
  sendMessage: (sessionId, messageData) => api.post(`/sessions/${sessionId}/messages`, messageData),
};

// Prompts API
export const promptsAPI = {
  getPrompts: () => api.get('/prompts'),
  createPrompt: (promptData) => api.post('/prompts', promptData),
  updatePrompt: (promptId, updates) => api.put(`/prompts/${promptId}`, updates),
  deletePrompt: (promptId) => api.delete(`/prompts/${promptId}`),
  usePrompt: (promptId) => api.post(`/prompts/${promptId}/use`),
};

// Files API
export const filesAPI = {
  uploadFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  getFiles: () => api.get('/files'),
  deleteFile: (fileId) => api.delete(`/files/${fileId}`),
};

export default api;

