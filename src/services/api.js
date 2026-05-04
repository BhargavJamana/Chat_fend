import axios from 'axios';

const getApiBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl) return '/api';

  const normalized = String(apiUrl).trim().replace(/\/+$/, '');
  if (normalized.endsWith('/api')) {
    return normalized;
  }

  return `${normalized}/api`;
};

// Do not force Content-Type globally so multipart/form-data can be used per-request
const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    Accept: 'application/json',
  },
});

const getAuthToken = () => {
  const legacyToken = localStorage.getItem('chatapp-token');
  if (legacyToken) return legacyToken;

  const persistedAuth = localStorage.getItem('chatapp-auth');
  if (!persistedAuth) return null;

  try {
    const parsed = JSON.parse(persistedAuth);
    return parsed?.state?.token || null;
  } catch {
    return null;
  }
};

// Add token to requests
api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('chatapp-token');
      localStorage.removeItem('chatapp-auth');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
