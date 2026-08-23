import api from './client';

export const superadminApi = {
  overview: () => api.get('/superadmin/reports/overview').then((r) => r.data.data),

  listRestaurants: (params) =>
    api.get('/superadmin/restaurants', { params }).then((r) => r.data),

  getRestaurant: (id) => api.get(`/superadmin/restaurants/${id}`).then((r) => r.data.data),

  createRestaurant: (payload) =>
    api.post('/superadmin/restaurants', payload).then((r) => r.data.data),

  updateRestaurant: (id, payload) =>
    api.patch(`/superadmin/restaurants/${id}`, payload).then((r) => r.data.data),

  changeStatus: (id, payload) =>
    api.patch(`/superadmin/restaurants/${id}/status`, payload).then((r) => r.data.data),

  assignPlan: (id, payload) =>
    api.patch(`/superadmin/restaurants/${id}/plan`, payload).then((r) => r.data.data),

  setRevenueModel: (id, payload) =>
    api.patch(`/superadmin/restaurants/${id}/revenue-model`, payload).then((r) => r.data.data),

  setCustomLimits: (id, payload) =>
    api.patch(`/superadmin/restaurants/${id}/custom-limits`, payload).then((r) => r.data.data),

  deleteRestaurant: (id, reason) =>
    api.delete(`/superadmin/restaurants/${id}`, { data: { reason } }).then((r) => r.data),

  createCredential: (restaurantId, payload) =>
    api.post(`/superadmin/restaurants/${restaurantId}/credentials`, payload).then((r) => r.data.data),

  resetPassword: (userId) =>
    api.post(`/superadmin/users/${userId}/reset-password`).then((r) => r.data.data),

  listPlans: () => api.get('/superadmin/plans').then((r) => r.data.data),

  createPlan: (payload) => api.post('/superadmin/plans', payload).then((r) => r.data.data),

  updatePlan: (id, payload) => api.patch(`/superadmin/plans/${id}`, payload).then((r) => r.data.data),
};
