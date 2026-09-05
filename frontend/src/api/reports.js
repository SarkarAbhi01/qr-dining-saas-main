import api from './client';

export const reportsApi = {
  overview: () => api.get('/restaurant/reports/overview').then((r) => r.data.data),
  revenueSeries: (range) =>
    api.get('/restaurant/reports/revenue-series', { params: { range } }).then((r) => r.data.data),
  topItems: (params) =>
    api.get('/restaurant/reports/top-items', { params }).then((r) => r.data.data),
  peakHours: () => api.get('/restaurant/reports/peak-hours').then((r) => r.data.data),
  staffPerformance: () => api.get('/restaurant/reports/staff-performance').then((r) => r.data.data),
  chefPerformance: (range) =>
    api.get('/restaurant/reports/chef-performance', { params: { range } }).then((r) => r.data.data),
  paymentsCollected: (range) =>
    api.get('/restaurant/reports/payments-collected', { params: { range } }).then((r) => r.data.data),
  revenueByMethod: (range) =>
    api.get('/restaurant/reports/revenue-by-method', { params: { range } }).then((r) => r.data.data),
};
