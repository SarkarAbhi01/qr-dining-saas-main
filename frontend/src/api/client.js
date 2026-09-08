import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';


// For Local
/*
const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});
*/


// For Production

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});


// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let announcedOtherDeviceLogout = false;

// Auto-logout on 401 (token expired/invalid); refresh-flow lands in Phase 2
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      const message = error.response?.data?.message || '';
      // Single-active-session enforcement (see authenticate.js on the
      // backend): this device's token is still technically unexpired,
      // but a newer login elsewhere invalidated it. Worth a distinct,
      // clearer message than a silent "session expired" logout so it
      // doesn't look like a bug.
      if (message.includes('signed in on another device') && !announcedOtherDeviceLogout) {
        announcedOtherDeviceLogout = true;
        toast.error('Logged out — this account was signed in on another device.', { duration: 6000 });
        setTimeout(() => {
          announcedOtherDeviceLogout = false;
        }, 10000);
      }
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export default api;
