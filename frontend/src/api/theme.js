import api from './client';

export const themeApi = {
  get: () => api.get('/restaurant/theme').then((r) => r.data.data),
  update: (payload) => api.patch('/restaurant/theme', payload).then((r) => r.data.data),
};
