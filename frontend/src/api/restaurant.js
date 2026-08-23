import api from './client';

export const restaurantApi = {
  // --- Categories ---
  listCategories: () => api.get('/restaurant/categories').then((r) => r.data.data),
  createCategory: (payload) => api.post('/restaurant/categories', payload).then((r) => r.data.data),
  updateCategory: (id, payload) => api.patch(`/restaurant/categories/${id}`, payload).then((r) => r.data.data),
  deleteCategory: (id) => api.delete(`/restaurant/categories/${id}`).then((r) => r.data),
  reorderCategories: (order) => api.patch('/restaurant/categories/reorder', { order }).then((r) => r.data),

  // --- Menu items ---
  listMenuItems: (params) => api.get('/restaurant/menu-items', { params }).then((r) => r.data.data),
  createMenuItem: (formData) =>
    api
      .post('/restaurant/menu-items', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data.data),
  updateMenuItem: (id, formData) =>
    api
      .patch(`/restaurant/menu-items/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data.data),
  toggleAvailability: (id, isAvailable) =>
    api.patch(`/restaurant/menu-items/${id}/availability`, { isAvailable }).then((r) => r.data.data),
  deleteMenuItem: (id) => api.delete(`/restaurant/menu-items/${id}`).then((r) => r.data),

  // --- Tables ---
  listTables: () => api.get('/restaurant/tables').then((r) => r.data.data),
  createTable: (payload) => api.post('/restaurant/tables', payload).then((r) => r.data.data),
  bulkCreateTables: (payload) => api.post('/restaurant/tables/bulk', payload).then((r) => r.data.data),
  updateTable: (id, payload) => api.patch(`/restaurant/tables/${id}`, payload).then((r) => r.data.data),
  deleteTable: (id) => api.delete(`/restaurant/tables/${id}`).then((r) => r.data),

  // --- Staff ---
  listStaff: (params) => api.get('/restaurant/staff', { params }).then((r) => r.data.data),
  createStaff: (payload) => api.post('/restaurant/staff', payload).then((r) => r.data.data),
  updateStaff: (id, payload) => api.patch(`/restaurant/staff/${id}`, payload).then((r) => r.data.data),
  resetStaffPassword: (id) => api.post(`/restaurant/staff/${id}/reset-password`).then((r) => r.data.data),
  deleteStaff: (id) => api.delete(`/restaurant/staff/${id}`).then((r) => r.data),

  // --- Feedback ---
  listFeedback: (params) => api.get('/restaurant/feedback', { params }).then((r) => r.data.data),
};
