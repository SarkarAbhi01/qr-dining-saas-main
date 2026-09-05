import api from './client';

export const waiterApi = {
  listTables: () => api.get('/restaurant/waiter/tables').then((r) => r.data.data),
  getMenu: () => api.get('/restaurant/waiter/menu').then((r) => r.data.data),
  serviceQueue: () => api.get('/restaurant/waiter/service-queue').then((r) => r.data.data),
  markServed: (orderId) =>
    api.patch(`/restaurant/waiter/orders/${orderId}/serve`).then((r) => r.data.data),
  createManualOrder: (payload) =>
    api.post('/restaurant/waiter/manual-orders', payload).then((r) => r.data.data),

  listCalls: () => api.get('/restaurant/waiter/calls').then((r) => r.data.data),
  acknowledgeCall: (id) =>
    api.patch(`/restaurant/waiter/calls/${id}/acknowledge`).then((r) => r.data.data),
  resolveCall: (id) => api.patch(`/restaurant/waiter/calls/${id}/resolve`).then((r) => r.data.data),

  listPendingPayments: () => api.get('/restaurant/waiter/payments/pending').then((r) => r.data.data),
  confirmPayment: (id) =>
    api.patch(`/restaurant/waiter/payments/${id}/confirm`).then((r) => r.data.data),
  settleTablePayment: (tableId, method) =>
    api.post(`/restaurant/waiter/tables/${tableId}/settle-payment`, { method }).then((r) => r.data),

  myPerformance: () => api.get('/restaurant/waiter/reports/my-performance').then((r) => r.data.data),
};
