import api from './client';

export const billingApi = {
  get: () => api.get('/restaurant/billing').then((r) => r.data.data),
  listInvoices: () => api.get('/restaurant/billing/invoices').then((r) => r.data.data),
};
