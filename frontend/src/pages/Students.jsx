import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Filter,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Users,
  Eye,
  X,
  CheckCircle,
  AlertCircle,
  Clock,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import { paymentsService } from '../services/paymentsService';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const Students = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
  });

  const [filters, setFilters] = useState({
    search: '',
    paymentStatus: '',
    classId: '',
  });

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentFees, setStudentFees] = useState([]);
  const [loadingFees, setLoadingFees] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, [pagination.page, filters.paymentStatus, filters.classId]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        page_size: pagination.pageSize,
        ...(filters.search && { search: filters.search }),
        ...(filters.paymentStatus && { payment_status: filters.paymentStatus }),
        ...(filters.classId && { class_id: filters.classId }),
      };

      const data = await paymentsService.getStudents(params);
      setStudents(data.results);
      setPagination((prev) => ({
        ...prev,
        total: data.count,
      }));
    } catch (error) {
      toast.error('Failed to load students');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentFees = async (studentId) => {
    setLoadingFees(true);
    try {
      const fees = await paymentsService.getStudentFees(studentId);
      setStudentFees(fees);
    } catch (error) {
      toast.error('Failed to load student fees');
      console.error(error);
    } finally {
      setLoadingFees(false);
    }
  };

  const handleViewStudent = async (student) => {
    setSelectedStudent(student);
    await fetchStudentFees(student.id);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchStudents();
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleStatusFilter = (status) => {
    setFilters((prev) => ({ ...prev, paymentStatus: status }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      paymentStatus: '',
      classId: '',
    });
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const totalPages = Math.ceil(pagination.total / pagination.pageSize);

  // Calculate status counts
  const statusCounts = {
    all: pagination.total,
    paid: students.filter((s) => s.payment_status === 'PAID').length,
    partial: students.filter((s) => s.payment_status === 'PARTIAL').length,
    unpaid: students.filter((s) => s.payment_status === 'UNPAID').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-navy-900">Students</h1>
          <p className="text-navy-500 mt-1">
            Manage students and track fee balances
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            icon={RefreshCw}
            onClick={fetchStudents}
          >
            Refresh
          </Button>
          <Button
            variant="ghost"
            icon={Download}
          >
            Export
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <QuickStatCard
          label="Total Students"
          value={statusCounts.all}
          icon={Users}
          color="primary"
        />
        <QuickStatCard
          label="Fully Paid"
          value={statusCounts.paid}
          icon={CheckCircle}
          color="success"
        />
        <QuickStatCard
          label="Partial Payment"
          value={statusCounts.partial}
          icon={Clock}
          color="warning"
        />
        <QuickStatCard
          label="Unpaid"
          value={statusCounts.unpaid}
          icon={AlertCircle}
          color="error"
        />
      </div>

      {/* Payment Status Filter Tabs */}
      <Card padding="sm">
        <div className="flex flex-wrap gap-2">
          <StatusTab
            label="All Students"
            count={statusCounts.all}
            active={filters.paymentStatus === ''}
            onClick={() => handleStatusFilter('')}
          />
          <StatusTab
            label="Fully Paid"
            count={statusCounts.paid}
            active={filters.paymentStatus === 'PAID'}
            onClick={() => handleStatusFilter('PAID')}
            color="success"
          />
          <StatusTab
            label="Partial"
            count={statusCounts.partial}
            active={filters.paymentStatus === 'PARTIAL'}
            onClick={() => handleStatusFilter('PARTIAL')}
            color="warning"
          />
          <StatusTab
            label="Unpaid"
            count={statusCounts.unpaid}
            active={filters.paymentStatus === 'UNPAID'}
            onClick={() => handleStatusFilter('UNPAID')}
            color="error"
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
                placeholder="Search by name or student ID..."
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
              className="pt-4 border-t border-navy-200"
            >
              <div className="flex gap-2">
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

      {/* Students Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary-500 mb-4" />
              <p className="text-navy-500">Loading students...</p>
            </div>
          ) : students.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 mx-auto text-navy-300 mb-4" />
              <p className="text-navy-500">No students found</p>
              {(filters.search || filters.paymentStatus) && (
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
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-navy-700 uppercase tracking-wider">
                    Student ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-navy-700 uppercase tracking-wider">
                    Class
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-navy-700 uppercase tracking-wider">
                    Outstanding Balance
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
                {students.map((student) => (
                  <tr
                    key={student.id}
                    className="hover:bg-navy-50 transition-smooth"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-semibold mr-3">
                          {student.first_name[0]}{student.last_name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-navy-900">
                            {student.first_name} {student.last_name}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm text-navy-600 font-mono">
                        {student.student_id}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm text-navy-900">
                        {student.class_name || (
                          <span className="text-navy-400 italic">No class</span>
                        )}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className={clsx(
                        'text-sm font-semibold tabular-nums',
                        student.outstanding_balance > 0
                          ? 'text-error-600'
                          : 'text-success-600'
                      )}>
                        {formatCurrency(student.outstanding_balance)}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <PaymentStatusBadge status={student.payment_status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Eye}
                        onClick={() => handleViewStudent(student)}
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
        {!loading && students.length > 0 && (
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

      {/* Student Detail Modal */}
      {selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          fees={studentFees}
          loading={loadingFees}
          onClose={() => {
            setSelectedStudent(null);
            setStudentFees([]);
          }}
        />
      )}
    </div>
  );
};

// Quick Stat Card Component
const QuickStatCard = ({ label, value, icon: Icon, color }) => {
  const colorClasses = {
    primary: 'from-primary-500 to-primary-600',
    success: 'from-success-500 to-success-600',
    warning: 'from-warning-500 to-warning-600',
    error: 'from-error-500 to-error-600',
  };

  return (
    <Card hover>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-navy-500">{label}</p>
          <p className="text-2xl font-bold text-navy-900 mt-1 tabular-nums">
            {value}
          </p>
        </div>
        <div className={`p-3 bg-gradient-to-br ${colorClasses[color]} rounded-lg shadow-premium`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </Card>
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
    PAID: { variant: 'paid', icon: CheckCircle, label: 'Fully Paid' },
    PARTIAL: { variant: 'partial', icon: Clock, label: 'Partial' },
    UNPAID: { variant: 'unpaid', icon: AlertCircle, label: 'Unpaid' },
  };

  const config = statusConfig[status] || statusConfig.UNPAID;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} dot>
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
};

// Student Detail Modal Component
const StudentDetailModal = ({ student, fees, loading, onClose }) => {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Group fees by academic year and term
  // Add safety check to ensure fees is an array
  const groupedFees = Array.isArray(fees) ? fees.reduce((acc, fee) => {
    const key = `${fee.academic_year_name} - Term ${fee.term}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(fee);
    return acc;
  }, {}) : {};

  return (
    <div className="fixed inset-0 bg-navy-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-premium-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-navy-200">
          <div className="flex items-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold text-2xl mr-4">
              {student.first_name[0]}{student.last_name[0]}
            </div>
            <div>
              <h3 className="text-xl font-bold text-navy-900">
                {student.first_name} {student.last_name}
              </h3>
              <p className="text-sm text-navy-500 mt-1">
                {student.student_id} • {student.class_name}
              </p>
            </div>
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
          {/* Balance Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-error-50 border border-error-200 rounded-lg p-4">
              <p className="text-sm font-medium text-error-700">
                Outstanding Balance
              </p>
              <p className="text-3xl font-bold text-error-900 mt-2 tabular-nums">
                {formatCurrency(student.outstanding_balance)}
              </p>
            </div>
            <div className="bg-navy-50 border border-navy-200 rounded-lg p-4">
              <p className="text-sm font-medium text-navy-700">
                Payment Status
              </p>
              <div className="mt-2">
                <PaymentStatusBadge status={student.payment_status} />
              </div>
            </div>
          </div>

          {/* Fee Breakdown */}
          <div>
            <h4 className="text-lg font-semibold text-navy-900 mb-4">
              Fee Breakdown
            </h4>
            
            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary-500 mb-2" />
                <p className="text-sm text-navy-500">Loading fees...</p>
              </div>
            ) : Object.keys(groupedFees).length === 0 ? (
              <div className="text-center py-8 text-navy-500">
                No fee records found
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedFees).map(([period, periodFees]) => (
                  <div
                    key={period}
                    className="border border-navy-200 rounded-lg overflow-hidden"
                  >
                    <div className="bg-navy-50 px-4 py-2 border-b border-navy-200">
                      <h5 className="font-semibold text-navy-900">{period}</h5>
                    </div>
                    <div className="p-4 space-y-3">
                      {periodFees.map((fee) => (
                        <FeeItem key={fee.id} fee={fee} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
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

// Fee Item Component
const FeeItem = ({ fee }) => {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const balance = fee.balance;
  const percentPaid = (fee.amount_paid / fee.fee_item_amount) * 100;

  return (
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <p className="font-medium text-navy-900">{fee.fee_item_name}</p>
          <div className="text-right">
            <p className="text-sm font-semibold text-navy-900 tabular-nums">
              {formatCurrency(fee.amount_paid)} / {formatCurrency(fee.fee_item_amount)}
            </p>
          </div>
        </div>
        <div className="w-full bg-navy-100 rounded-full h-2">
          <div
            className={clsx(
              'h-2 rounded-full transition-all',
              fee.is_paid
                ? 'bg-success-500'
                : percentPaid > 50
                ? 'bg-warning-500'
                : 'bg-error-500'
            )}
            style={{ width: `${Math.min(percentPaid, 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-navy-500">
            {fee.is_paid ? (
              <span className="text-success-600 font-medium">Paid</span>
            ) : (
              <span className="text-error-600 font-medium">
                Balance: {formatCurrency(balance)}
              </span>
            )}
          </p>
          <p className="text-xs text-navy-500">
            {percentPaid.toFixed(0)}% paid
          </p>
        </div>
      </div>
    </div>
  );
};

export default Students;