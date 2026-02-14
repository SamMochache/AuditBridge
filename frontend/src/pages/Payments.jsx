import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Filter,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  X,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import { paymentsService } from '../services/paymentsService';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
  });

  const [filters, setFilters] = useState({
    search: '',
    status: new URLSearchParams(window.location.search).get('status') || '',
    startDate: '',
    endDate: '',
  });

  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchPayments();
  }, [pagination.page, filters.status]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        page_size: pagination.pageSize,
        ...(filters.status && { status: filters.status }),
        ...(filters.search && { search: filters.search }),
        ...(filters.startDate && { start_date: filters.startDate }),
        ...(filters.endDate && { end_date: filters.endDate }),
      };

      const data = await paymentsService.getPayments(params);
      setPayments(data.results);
      setPagination((prev) => ({
        ...prev,
        total: data.count,
      }));
    } catch (error) {
      toast.error('Failed to load payments');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchPayments();
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleStatusFilter = (status) => {
    setFilters((prev) => ({ ...prev, status }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      status: '',
      startDate: '',
      endDate: '',
    });
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleReconcile = async () => {
    try {
      const result = await paymentsService.reconcilePayments();
      toast.success(`Reconciled ${result.summary.matched} payments successfully`);
      fetchPayments();
    } catch (error) {
      toast.error('Failed to reconcile payments');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalPages = Math.ceil(pagination.total / pagination.pageSize);

  const statusCounts = {
    all: pagination.total,
    matched: payments.filter((p) => p.status === 'MATCHED').length,
    failed: payments.filter((p) => p.status === 'FAILED').length,
    unprocessed: payments.filter((p) => p.status === 'UNPROCESSED').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-navy-900">Payments</h1>
          <p className="text-navy-500 mt-1">
            Manage and track all payment transactions
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            icon={RefreshCw}
            onClick={fetchPayments}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            icon={RefreshCw}
            onClick={handleReconcile}
          >
            Reconcile
          </Button>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <Card padding="sm">
        <div className="flex flex-wrap gap-2">
          <StatusTab
            label="All Payments"
            count={statusCounts.all}
            active={filters.status === ''}
            onClick={() => handleStatusFilter('')}
          />
          <StatusTab
            label="Matched"
            count={statusCounts.matched}
            active={filters.status === 'MATCHED'}
            onClick={() => handleStatusFilter('MATCHED')}
            color="success"
          />
          <StatusTab
            label="Failed"
            count={statusCounts.failed}
            active={filters.status === 'FAILED'}
            onClick={() => handleStatusFilter('FAILED')}
            color="error"
          />
          <StatusTab
            label="Unprocessed"
            count={statusCounts.unprocessed}
            active={filters.status === 'UNPROCESSED'}
            onClick={() => handleStatusFilter('UNPROCESSED')}
            color="warning"
          />
        </div>
      </Card>

      {/* Search and Filters */}
      <Card>
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                icon={Search}
                placeholder="Search by transaction code or student ID..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
              />
            </div>
            <Button type="submit" variant="primary">
              Search
            </Button>
            <Button
              type="button"
              variant="secondary"
              icon={Filter}
              onClick={() => setShowFilters(!showFilters)}
            >
              Filters
            </Button>
          </div>

          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-navy-200"
            >
              <Input
                label="Start Date"
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
              />
              <Input
                label="End Date"
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
              />
              <div className="md:col-span-2 flex gap-2">
                <Button type="submit" variant="primary" size="sm">
                  Apply Filters
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                >
                  Clear All
                </Button>
              </div>
            </motion.div>
          )}
        </form>
      </Card>

      {/* Payments Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary-500 mb-4" />
              <p className="text-navy-500">Loading payments...</p>
            </div>
          ) : payments.length === 0 ? (
            <div className="p-12 text-center">
              <AlertCircle className="w-12 h-12 mx-auto text-navy-300 mb-4" />
              <p className="text-navy-500">No payments found</p>
              {(filters.search || filters.status) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="mt-4"
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <table className="min-w-full divide-y divide-navy-200">
              <thead className="bg-navy-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-navy-700 uppercase tracking-wider">
                    Transaction
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-navy-700 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-navy-700 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-navy-700 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-navy-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-navy-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-navy-200">
                {payments.map((payment) => (
                  <tr
                    key={payment.id}
                    className="hover:bg-navy-50 transition-smooth"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="text-sm font-medium text-navy-900">
                          {payment.transaction_code}
                        </p>
                        <p className="text-xs text-navy-500">
                          Adm: {payment.student_admission_number}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm text-navy-900">
                        {payment.student_name || (
                          <span className="text-navy-400 italic">Unknown</span>
                        )}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm font-semibold text-navy-900 tabular-nums">
                        {formatCurrency(payment.amount)}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm text-navy-600">
                        {formatDate(payment.transaction_date)}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <PaymentStatusBadge status={payment.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Eye}
                        onClick={() => setSelectedPayment(payment)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!loading && payments.length > 0 && (
          <div className="px-6 py-4 border-t border-navy-200 flex items-center justify-between">
            <div className="text-sm text-navy-600">
              Showing {(pagination.page - 1) * pagination.pageSize + 1} to{' '}
              {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
              {pagination.total} results
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={ChevronLeft}
                onClick={() =>
                  setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                }
                disabled={pagination.page === 1}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={ChevronRight}
                iconPosition="right"
                onClick={() =>
                  setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                }
                disabled={pagination.page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Payment Detail Modal */}
      {selectedPayment && (
        <PaymentDetailModal
          payment={selectedPayment}
          onClose={() => setSelectedPayment(null)}
        />
      )}
    </div>
  );
};

// Status Tab Component
const StatusTab = ({ label, count, active, onClick, color = 'primary' }) => {
  const colorClasses = {
    primary: 'border-primary-500 text-primary-700 bg-primary-50',
    success: 'border-success-500 text-success-700 bg-success-50',
    error: 'border-error-500 text-error-700 bg-error-50',
    warning: 'border-warning-500 text-warning-700 bg-warning-50',
  };

  return (
    <button
      onClick={onClick}
      className={clsx(
        'px-4 py-2 rounded-lg border-2 transition-smooth font-medium text-sm',
        active
          ? colorClasses[color]
          : 'border-transparent text-navy-600 hover:bg-navy-50'
      )}
    >
      {label} <span className="font-bold">({count})</span>
    </button>
  );
};

// Payment Status Badge Component
const PaymentStatusBadge = ({ status }) => {
  const statusConfig = {
    MATCHED: { variant: 'matched', icon: CheckCircle, label: 'Matched' },
    FAILED: { variant: 'failed', icon: AlertCircle, label: 'Failed' },
    UNPROCESSED: { variant: 'unprocessed', icon: Clock, label: 'Unprocessed' },
  };

  const config = statusConfig[status] || statusConfig.UNPROCESSED;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} dot>
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
};

// Payment Detail Modal Component
const PaymentDetailModal = ({ payment, onClose }) => {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 bg-navy-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-premium-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-navy-200">
          <div>
            <h3 className="text-xl font-bold text-navy-900">
              Payment Details
            </h3>
            <p className="text-sm text-navy-500 mt-1">
              Transaction {payment.transaction_code}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-navy-100 rounded-lg transition-smooth"
          >
            <X className="w-5 h-5 text-navy-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status */}
          <div>
            <label className="text-sm font-medium text-navy-500 block mb-2">
              Status
            </label>
            <PaymentStatusBadge status={payment.status} />
          </div>

          {/* Transaction Info */}
          <div className="grid grid-cols-2 gap-4">
            <DetailItem
              label="Transaction Code"
              value={payment.transaction_code}
            />
            <DetailItem
              label="Amount"
              value={formatCurrency(payment.amount)}
            />
            <DetailItem
              label="Transaction Date"
              value={formatDate(payment.transaction_date)}
            />
            <DetailItem
              label="Admission Number"
              value={payment.student_admission_number}
            />
          </div>

          {/* Student Info */}
          {payment.student_name && (
            <div>
              <label className="text-sm font-medium text-navy-500 block mb-2">
                Student Name
              </label>
              <p className="text-base text-navy-900 font-medium">
                {payment.student_name}
              </p>
            </div>
          )}

          {/* Matched Fee Info */}
          {payment.matched_fee_details && (
            <div className="bg-success-50 border border-success-200 rounded-lg p-4">
              <h4 className="font-semibold text-success-900 mb-3">
                Matched Fee Details
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-success-700">Fee Item</p>
                  <p className="font-medium text-success-900">
                    {payment.matched_fee_details.fee_item}
                  </p>
                </div>
                <div>
                  <p className="text-success-700">Academic Year</p>
                  <p className="font-medium text-success-900">
                    {payment.matched_fee_details.academic_year}
                  </p>
                </div>
                <div>
                  <p className="text-success-700">Term</p>
                  <p className="font-medium text-success-900">
                    Term {payment.matched_fee_details.term}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {payment.error_message && (
            <div className="bg-error-50 border border-error-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-error-600 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-error-900 mb-1">
                    Error Details
                  </h4>
                  <p className="text-sm text-error-700">
                    {payment.error_message}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* System Info */}
          <div className="border-t border-navy-200 pt-4">
            <h4 className="text-sm font-semibold text-navy-700 mb-3">
              System Information
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <DetailItem
                label="Uploaded By"
                value={payment.uploaded_by_name || 'System'}
              />
              <DetailItem
                label="Created At"
                value={formatDate(payment.created_at)}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-navy-50 border-t border-navy-200 flex justify-end gap-3 rounded-b-2xl">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

// Detail Item Component
const DetailItem = ({ label, value }) => (
  <div>
    <label className="text-sm text-navy-500">{label}</label>
    <p className="text-base text-navy-900 font-medium mt-1">{value}</p>
  </div>
);

export default Payments;