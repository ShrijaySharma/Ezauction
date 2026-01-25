import axios from 'axios';

import { API_URL } from '../config';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

export const login = async (username, password) => {
  try {
    const response = await api.post('/auth/login', { username, password });
    return response.data;
  } catch (error) {
    console.error('Login error:', error);
    if (error.response) {
      // Server responded with error
      throw error;
    } else if (error.request) {
      // Request made but no response
      throw new Error('Network error: Could not connect to server. Make sure the backend is running.');
    } else {
      // Something else happened
      throw new Error('Login failed: ' + error.message);
    }
  }
};

export const logout = async () => {
  await api.post('/auth/logout');
};

export const getCurrentUser = async () => {
  const response = await api.get('/auth/me');
  return response.data.user;
};

export default api;

