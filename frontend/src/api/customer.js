import api from './client';

export const customerApi = {
  resolveTable: (restaurantSlug, tableId) =>
    api.get(`/customer/tables/${restaurantSlug}/${tableId}`).then((r) => r.data.data),

  getMenu: (slug) => api.get(`/customer/menu/${slug}`).then((r) => r.data.data),


getPaymentConfig: () => api.get('/customer/payment-config').then((r) => r.data.data),

  checkoutOnline: (sessionId) =>
    api.post(`/customer/sessions/${sessionId}/checkout/online`).then((r) => r.data.data),

  confirmOnlinePayment: (stripeSessionId) =>
    api.get(`/customer/checkout/online/confirm/${stripeSessionId}`).then((r) => r.data.data),







  getSession: (sessionId) => api.get(`/customer/sessions/${sessionId}`).then((r) => r.data.data),

  placeOrder: (sessionId, items) =>
    api.post(`/customer/sessions/${sessionId}/orders`, { items }).then((r) => r.data.data),

  callWaiter: (sessionId) => api.post(`/customer/sessions/${sessionId}/call-waiter`).then((r) => r.data),

  requestBill: (sessionId) => api.post(`/customer/sessions/${sessionId}/request-bill`).then((r) => r.data),

  splitBill: (sessionId, payload) =>
    api.post(`/customer/sessions/${sessionId}/split`, payload).then((r) => r.data.data),

  checkoutCash: (sessionId) =>
    api.post(`/customer/sessions/${sessionId}/checkout/cash`).then((r) => r.data),

  listStaffForComplaint: (slug) => api.get(`/customer/staff/${slug}`).then((r) => r.data.data),

  submitFeedback: (sessionId, payload) =>
    api.post(`/customer/sessions/${sessionId}/feedback`, payload).then((r) => r.data),
};
