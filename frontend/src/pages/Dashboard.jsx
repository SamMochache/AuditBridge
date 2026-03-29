import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  DollarSign,
  Users,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle,
  Clock,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { paymentsService } from '../services/paymentsService';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [recentPayments, setRecentPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const [statsData, paymentsData] = await Promise.all([
        paymentsService.getDashboardStats(),
        paymentsService.getPayments({ page_size: 8, ordering: '-created_at' }),
      ]);
      setStats(statsData);
      setRecentPayments(paymentsData.results || []);
    } catch (error) {
      toast.error('Failed to load dashboard');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-KE').format(num);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="skeleton h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Collected',
      value: formatCurrency(stats?.payments?.total_collected || 0),
      change: '+12.5%',
      trend: 'up',
      icon: DollarSign,
      color: 'success',
    },
    {
      title: 'Outstanding',
      value: formatCurrency(stats?.fees?.outstanding_balance || 0),
      subtitle: `${stats?.fees?.collection_rate || 0}% collected`,
      icon: TrendingUp,
      color: 'warning',
    },
    {
      title: 'Total Students',
      value: formatNumber(stats?.students?.total_students || 0),
      subtitle: `${stats?.students?.fully_paid || 0} fully paid`,
      icon: Users,
      color: 'primary',
    },
    {
      title: 'Matched Payments',
      value: formatNumber(stats?.payments?.matched_count || 0),
      subtitle: `${stats?.payments?.total_count || 0} total`,
      icon: ArrowUpRight,
      color: 'success',
    },
    {
      title: 'Failed Payments',
      value: formatNumber(stats?.payments?.failed_count || 0),
      subtitle: 'Needs attention',
      icon: AlertCircle,
      color: 'error',
    },
    {
      title: 'Collection Rate',
      value: `${stats?.fees?.collection_rate || 0}%`,
      subtitle: 'This term',
      icon: TrendingUp,
      color: stats?.fees?.collection_rate >= 70 ? 'success' : 'warning',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-navy-900">Dashboard</h1>
        <p className="text-navy-500 mt-1">
          Welcome back! Here's your financial overview.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <StatCard {...stat} />
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <Card title="Quick Actions" padding="default">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickActionCard
            title="Upload Payments"
            description="Import M-Pesa CSV"
            href="/upload"
          />
          <QuickActionCard
            title="View Students"
            description="Check balances"
            href="/students"
          />
          <QuickActionCard
            title="Failed Payments"
            description={`${stats?.payments?.failed_count || 0} to review`}
            href="/payments?status=FAILED"
          />
          <QuickActionCard
            title="Unprocessed"
            description={`${stats?.payments?.unprocessed_count || 0} pending`}
            href="/payments?status=UNPROCESSED"
          />
        </div>
      </Card>

      {/* Recent Activity */}
      <Card title="Recent Activity" subtitle="Latest payment transactions">
        {recentPayments.length === 0 ? (
          <div className="text-center py-12 text-navy-400">
            <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No payments yet. Upload an M-Pesa statement to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-navy-100">
            {recentPayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-3 gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    p.status === 'MATCHED' ? 'bg-success-100' :
                    p.status === 'FAILED'  ? 'bg-error-100' : 'bg-navy-100'
                  }`}>
                    {p.status === 'MATCHED' ? <CheckCircle className="w-4 h-4 text-success-600" /> :
                     p.status === 'FAILED'  ? <AlertCircle className="w-4 h-4 text-error-600" /> :
                                              <Clock className="w-4 h-4 text-navy-500" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-navy-900 truncate">
                      {p.student_name || p.student_admission_number}
                    </p>
                    <p className="text-xs text-navy-400 font-mono">{p.transaction_code}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-navy-900 tabular-nums">
                    {formatCurrency(p.amount)}
                  </p>
                  <p className="text-xs text-navy-400">
                    {new Date(p.transaction_date).toLocaleDateString('en-KE', { day:'numeric', month:'short' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
        {recentPayments.length > 0 && (
          <div className="mt-4 pt-3 border-t border-navy-100">
            <a href="/payments" className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-smooth">
              View all payments →
            </a>
          </div>
        )}
      </Card>
    </div>
  );
};

const StatCard = ({ title, value, subtitle, change, trend, icon: Icon, color }) => {
  const colorClasses = {
    success: 'from-success-500 to-success-600',
    warning: 'from-warning-500 to-warning-600',
    error: 'from-error-500 to-error-600',
    primary: 'from-primary-500 to-primary-600',
  };

  return (
    <Card hover className="relative overflow-hidden">
      {/* Gradient background decoration */}
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${colorClasses[color]} opacity-5 rounded-full -mr-16 -mt-16`} />
      
      <div className="relative">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-navy-500">{title}</p>
            <p className="text-2xl md:text-3xl font-bold text-navy-900 mt-2 tabular-nums">
              {value}
            </p>
            {subtitle && (
              <p className="text-sm text-navy-500 mt-1">{subtitle}</p>
            )}
            {change && (
              <div className={`flex items-center mt-2 text-sm ${
                trend === 'up' ? 'text-success-600' : 'text-error-600'
              }`}>
                {trend === 'up' ? (
                  <ArrowUpRight className="w-4 h-4 mr-1" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 mr-1" />
                )}
                <span className="font-medium">{change}</span>
              </div>
            )}
          </div>
          <div className={`p-3 bg-gradient-to-br ${colorClasses[color]} rounded-xl shadow-premium`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </div>
    </Card>
  );
};

const QuickActionCard = ({ title, description, href }) => {
  return (
    <a
      href={href}
      className="block p-4 rounded-lg border-2 border-navy-200 hover:border-primary-300 hover:bg-primary-50/50 transition-smooth group"
    >
      <h4 className="font-semibold text-navy-900 group-hover:text-primary-700 transition-smooth">
        {title}
      </h4>
      <p className="text-sm text-navy-500 mt-1">{description}</p>
    </a>
  );
};

export default Dashboard;