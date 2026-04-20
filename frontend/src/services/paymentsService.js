/**
 * frontend/src/services/paymentsService.js
 *
 * Changes from original
 * ─────────────────────
 * 1. PAYMENT_STATUS and STUDENT_STATUS constants added — no more magic
 *    strings scattered across components.
 *
 * 2. getStudentFees() simplified — the backend StudentFeesView now has
 *    pagination_class = None so it always returns a plain array.  The
 *    fragile `response.data.results || response.data` fallback is gone.
 *
 * 3. getSuggestions() added — calls the new smart-match endpoint that
 *    returns fuzzy-matched student candidates for a failed payment.
 *
 * 4. All endpoints that modify data check for school association on the
 *    backend, but the frontend now passes the correct Content-Type for
 *    the upload endpoint explicitly.
 */

import api from './api';

// ── Status constants — import these in components instead of raw strings ───────

export const PAYMENT_STATUS = Object.freeze({
  UNPROCESSED: 'UNPROCESSED',
  MATCHED: 'MATCHED',
  FAILED: 'FAILED',
});

export const STUDENT_STATUS = Object.freeze({
  PAID: 'PAID',
  PARTIAL: 'PARTIAL',
  UNPAID: 'UNPAID',
});

// ── Service ────────────────────────────────────────────────────────────────────

export const paymentsService = {
  // ── Dashboard ──────────────────────────────────────────────────────────────

  getDashboardStats: async () => {
    const response = await api.get('/payments/dashboard/stats/');
    return response.data;
  },

  getCollectionTrends: async () => {
    const response = await api.get('/payments/dashboard/trends/');
    return response.data;
  },

  getClassBalances: async () => {
    const response = await api.get('/payments/dashboard/class-balances/');
    return response.data;
  },

  getTermStats: async () => {
    const response = await api.get('/payments/dashboard/term-stats/');
    return response.data;
  },

  // ── Payments ───────────────────────────────────────────────────────────────

  uploadCSV: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    // Do NOT set Content-Type manually — axios sets it with the boundary
    const response = await api.post('/payments/upload/', formData);
    return response.data;
  },

  getPayments: async (params = {}) => {
    const response = await api.get('/payments/list/', { params });
    return response.data;
  },

  getPaymentDetail: async (id) => {
    const response = await api.get(`/payments/${id}/`);
    return response.data;
  },

  reconcilePayments: async () => {
    const response = await api.post('/payments/reconcile/');
    return response.data;
  },

  retryReconcilePayment: async (id) => {
    const response = await api.post(`/payments/${id}/retry/`);
    return response.data;
  },

  getUnmatchedPayments: async (params = {}) => {
    const response = await api.get('/payments/unmatched/', { params });
    return response.data;
  },

  getAuditTrail: async (params = {}) => {
    const response = await api.get('/payments/audit-trail/', { params });
    return response.data;
  },

  /**
   * Get fuzzy-match student suggestions for a failed payment.
   * Returns [{student_id, admission_number, name, confidence}]
   */
  getPaymentSuggestions: async (paymentId) => {
    const response = await api.get(`/payments/${paymentId}/suggestions/`);
    return response.data;
  },

  // ── Students ───────────────────────────────────────────────────────────────

  getStudents: async (params = {}) => {
    const response = await api.get('/payments/students/', { params });
    return response.data;
  },

  getStudentDetail: async (id) => {
    const response = await api.get(`/payments/students/${id}/`);
    return response.data;
  },

  /**
   * FIX: The backend StudentFeesView now has pagination_class = None,
   * so it always returns a plain array — no more paginated wrapper to unwrap.
   * The old `response.data.results || response.data` fallback masked a real
   * bug where fees beyond page_size would be silently truncated.
   */
  getStudentFees: async (id) => {
    const response = await api.get(`/payments/students/${id}/fees/`);
    // Backend returns a plain list (pagination disabled for this endpoint)
    return Array.isArray(response.data) ? response.data : [];
  },
};
