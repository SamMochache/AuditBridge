import api from './api';

export const paymentsService = {
  // Dashboard stats
  getDashboardStats: async () => {
    const response = await api.get('/payments/dashboard/stats/');
    return response.data;
  },

  // Upload CSV
  uploadCSV: async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/payments/upload/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Get payments list
  getPayments: async (params = {}) => {
    const response = await api.get('/payments/list/', { params });
    return response.data;
  },

  // Get payment detail
  getPaymentDetail: async (id) => {
    const response = await api.get(`/payments/${id}/`);
    return response.data;
  },

  // Reconcile payments
  reconcilePayments: async () => {
    const response = await api.post('/payments/reconcile/');
    return response.data;
  },

  // Get unmatched payments
  getUnmatchedPayments: async () => {
    const response = await api.get('/payments/unmatched/');
    return response.data;
  },

  // Get students
  getStudents: async (params = {}) => {
    const response = await api.get('/payments/students/', { params });
    return response.data;
  },

  // Get student detail
  getStudentDetail: async (id) => {
    const response = await api.get(`/payments/students/${id}/`);
    return response.data;
  },

  // Get student fees
  getStudentFees: async (id) => {
    const response = await api.get(`/payments/students/${id}/fees/`);
    return response.data;
  },

  // Get collection trends
  getCollectionTrends: async () => {
    const response = await api.get('/payments/dashboard/trends/');
    return response.data;
  },

  // Get class balances
  getClassBalances: async () => {
    const response = await api.get('/payments/dashboard/class-balances/');
    return response.data;
  },

  // Get audit trail
  getAuditTrail: async (params = {}) => {
    const response = await api.get('/payments/audit-trail/', { params });
    return response.data;
  },
};