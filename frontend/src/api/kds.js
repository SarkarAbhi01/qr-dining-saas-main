import api from './client';

export const kdsApi = {
  listActiveOrders: () => api.get('/restaurant/kds/orders').then((r) => r.data.data),

  updateOrderItemStatus: (itemId, status) =>
    api.patch(`/restaurant/kds/order-items/${itemId}/status`, { status }).then((r) => r.data.data),

  updateOrderStatus: (orderId, status) =>
    api.patch(`/restaurant/kds/orders/${orderId}/status`, { status }).then((r) => r.data.data),

  acceptOrder: (orderId) =>
    api.patch(`/restaurant/kds/orders/${orderId}/accept`).then((r) => r.data.data),

  todayStats: () => api.get('/restaurant/kds/stats').then((r) => r.data.data),

  myPerformance: () => api.get('/restaurant/kds/reports/my-performance').then((r) => r.data.data),
};
