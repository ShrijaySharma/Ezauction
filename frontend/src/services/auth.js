import axios from 'axios';
import { API_URL } from '../config';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Request interceptor to automatically attach x-auction-id from URL or storage
api.interceptors.request.use((config) => {
  const match = window.location.pathname.match(/\/auction\/([^/]+)/);
  const auctionId = match ? match[1] : (window.__currentAuctionId || localStorage.getItem('currentAuctionId'));

  if (auctionId) {
    config.headers['x-auction-id'] = auctionId;
  }
  return config;
});

export const login = async (username, password, auctionId = null) => {
  try {
    const aid = auctionId || (window.location.pathname.match(/\/auction\/([^/]+)/)?.[1]);
    const url = aid ? `/auction/${aid}/auth/login` : '/auth/login';
    const response = await api.post(url, { username, password, auctionId: aid });
    if (aid) {
      localStorage.setItem('currentAuctionId', aid);
    }
    return response.data;
  } catch (error) {
    console.error('Login error:', error);
    if (error.response) {
      throw error;
    } else if (error.request) {
      throw new Error('Network error: Could not connect to server. Make sure the backend is running.');
    } else {
      throw new Error('Login failed: ' + error.message);
    }
  }
};

export const superAdminLogin = async (username, password) => {
  try {
    const response = await api.post('/super-admin/login', { username, password });
    return response.data;
  } catch (error) {
    console.error('Super admin login error:', error);
    if (error.response) {
      throw error;
    } else if (error.request) {
      throw new Error('Network error: Could not connect to server. Make sure the backend is running.');
    } else {
      throw new Error('Login failed: ' + error.message);
    }
  }
};

export const logout = async (auctionId = null) => {
  const aid = auctionId || (window.location.pathname.match(/\/auction\/([^/]+)/)?.[1]) || localStorage.getItem('currentAuctionId');
  const url = aid ? `/auction/${aid}/auth/logout` : '/auth/logout';
  await api.post(url);
  localStorage.removeItem('currentAuctionId');
};

export const getCurrentUser = async (auctionId = null) => {
  const aid = auctionId || (window.location.pathname.match(/\/auction\/([^/]+)/)?.[1]) || localStorage.getItem('currentAuctionId');
  const url = aid ? `/auction/${aid}/auth/me` : '/auth/me';
  const response = await api.get(url);
  return response.data.user;
};

export default api;
