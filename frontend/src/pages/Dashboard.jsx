import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  DollarSign,
  Users,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { paymentsService } from '../services/paymentsService';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const data = await paymentsService.getDashboardStats();
      setStats(data);
    } catch (error) {
      toast.error('Failed to load dashboard stats');
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

      {/* Recent Activity placeholder */}
      <Card title="Recent Activity" subtitle="Latest payment transactions">
        <div className="text-center py-12 text-navy-500">
          <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Recent activity will appear here</p>
        </div>
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