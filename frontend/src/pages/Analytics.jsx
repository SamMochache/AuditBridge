import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Users,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { paymentsService } from '../services/paymentsService';
import toast from 'react-hot-toast';
import clsx from 'clsx';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

const pct = (n) => `${n.toFixed(1)}%`;

function rateColor(rate) {
  if (rate >= 80) return 'text-success-600';
  if (rate >= 50) return 'text-warning-600';
  return 'text-error-600';
}

function rateBg(rate) {
  if (rate >= 80) return 'bg-success-500';
  if (rate >= 50) return 'bg-warning-500';
  return 'bg-error-500';
}

function rateLabel(rate) {
  if (rate >= 80) return { text: 'On Track', variant: 'matched' };
  if (rate >= 50) return { text: 'Behind', variant: 'unprocessed' };
  return { text: 'Critical', variant: 'failed' };
}

// ─── SVG Bar Chart ────────────────────────────────────────────────────────────

const BarChart = ({ terms }) => {
  const maxVal = Math.max(...terms.map((t) => t.total_expected), 1);
  const W = 100; // percentage width per group
  const BAR_W = 28;
  const GAP = 8;
  const HEIGHT = 160;
  const TOTAL_W = terms.length * (BAR_W * 2 + GAP + 20);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${TOTAL_W} ${HEIGHT + 40}`}
        className="w-full"
        style={{ minWidth: 280 }}
      >
        {/* Y-axis guidelines */}
        {[0, 25, 50, 75, 100].map((p) => {
          const y = HEIGHT - (p / 100) * HEIGHT;
          return (
            <g key={p}>
              <line
                x1={0} y1={y} x2={TOTAL_W} y2={y}
                stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4"
              />
              <text x={2} y={y - 3} fontSize="8" fill="#94a3b8">{p}%</text>
            </g>
          );
        })}

        {terms.map((term, i) => {
          const x = i * (BAR_W * 2 + GAP + 20) + 14;
          const expH = (term.total_expected / maxVal) * HEIGHT;
          const paidH = (term.total_paid / maxVal) * HEIGHT;
          const midX = x + BAR_W + GAP / 2;

          return (
            <g key={term.term}>
              {/* Expected bar */}
              <rect
                x={x} y={HEIGHT - expH}
                width={BAR_W} height={expH}
                rx={3} fill="#dbeafe"
              />
              <text
                x={x + BAR_W / 2} y={HEIGHT - expH - 4}
                textAnchor="middle" fontSize="7" fill="#64748b"
              >
                {fmt(term.total_expected).replace('KES', '')}
              </text>

              {/* Paid bar */}
              <rect
                x={x + BAR_W + GAP} y={HEIGHT - paidH}
                width={BAR_W} height={paidH}
                rx={3}
                fill={
                  term.collection_rate >= 80 ? '#22c55e'
                  : term.collection_rate >= 50 ? '#f59e0b'
                  : '#ef4444'
                }
              />
              <text
                x={x + BAR_W + GAP + BAR_W / 2} y={HEIGHT - paidH - 4}
                textAnchor="middle" fontSize="7" fill="#64748b"
              >
                {pct(term.collection_rate)}
              </text>

              {/* Term label */}
              <text
                x={midX} y={HEIGHT + 14}
                textAnchor="middle" fontSize="10" fontWeight="600" fill="#1e293b"
              >
                {term.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex gap-4 justify-center mt-1 text-xs text-navy-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-blue-100 inline-block" /> Expected
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-success-500 inline-block" /> Collected
        </span>
      </div>
    </div>
  );
};

// ─── Progress Bar ─────────────────────────────────────────────────────────────

const ProgressBar = ({ rate, className = '' }) => (
  <div className={clsx('h-2 bg-navy-100 rounded-full overflow-hidden', className)}>
    <div
      className={clsx('h-full rounded-full transition-all duration-700', rateBg(rate))}
      style={{ width: `${Math.min(rate, 100)}%` }}
    />
  </div>
);

// ─── Term Summary Card ────────────────────────────────────────────────────────

const TermCard = ({ term, active, onClick }) => {
  const status = rateLabel(term.collection_rate);
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full text-left p-5 rounded-xl border-2 transition-smooth',
        active
          ? 'border-primary-500 bg-primary-50 shadow-md'
          : 'border-navy-200 bg-white hover:border-navy-300'
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <span className={clsx('text-lg font-bold', active ? 'text-primary-700' : 'text-navy-900')}>
          {term.label}
        </span>
        <Badge variant={status.variant}>{status.text}</Badge>
      </div>

      <div className="space-y-1 mb-3">
        <div className="flex justify-between text-sm">
          <span className="text-navy-500">Collected</span>
          <span className="font-semibold text-navy-900">{fmt(term.total_paid)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-navy-500">Expected</span>
          <span className="text-navy-600">{fmt(term.total_expected)}</span>
        </div>
      </div>

      <ProgressBar rate={term.collection_rate} className="mb-2" />

      <div className="flex justify-between items-center">
        <span className={clsx('text-xl font-bold tabular-nums', rateColor(term.collection_rate))}>
          {pct(term.collection_rate)}
        </span>
        <span className="text-xs text-navy-500">
          {fmt(term.outstanding)} outstanding
        </span>
      </div>
    </button>
  );
};

// ─── Fee Item Breakdown Table ─────────────────────────────────────────────────

const FeeBreakdownTable = ({ breakdown }) => (
  <div className="overflow-x-auto rounded-lg border border-navy-200">
    <table className="min-w-full text-sm">
      <thead className="bg-navy-50">
        <tr>
          {['Fee Item', 'Expected', 'Collected', 'Outstanding', 'Rate'].map((h) => (
            <th key={h} className="px-4 py-3 text-left font-semibold text-navy-700">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {breakdown.map((item, i) => (
          <tr key={item.name} className={clsx('border-t border-navy-100', i % 2 === 0 ? 'bg-white' : 'bg-navy-50/30')}>
            <td className="px-4 py-3 font-medium text-navy-900">{item.name}</td>
            <td className="px-4 py-3 text-navy-600 tabular-nums">{fmt(item.expected)}</td>
            <td className="px-4 py-3 text-navy-900 font-semibold tabular-nums">{fmt(item.paid)}</td>
            <td className={clsx('px-4 py-3 tabular-nums', item.outstanding > 0 ? 'text-error-600' : 'text-success-600')}>
              {fmt(item.outstanding)}
            </td>
            <td className="px-4 py-3 w-40">
              <div className="flex items-center gap-2">
                <ProgressBar rate={item.rate} className="flex-1" />
                <span className={clsx('text-xs font-bold w-10 text-right', rateColor(item.rate))}>
                  {pct(item.rate)}
                </span>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ─── Student Status Breakdown ─────────────────────────────────────────────────

const StudentStatus = ({ students }) => {
  const total = students.total || 1;
  const items = [
    { label: 'Fully Paid', count: students.fully_paid, color: 'bg-success-500', textColor: 'text-success-700', icon: CheckCircle },
    { label: 'Partial', count: students.partial, color: 'bg-warning-500', textColor: 'text-warning-700', icon: Clock },
    { label: 'Unpaid', count: students.unpaid, color: 'bg-error-500', textColor: 'text-error-700', icon: AlertCircle },
  ];

  return (
    <div className="space-y-3">
      {items.map(({ label, count, color, textColor, icon: Icon }) => (
        <div key={label}>
          <div className="flex items-center justify-between mb-1">
            <span className="flex items-center gap-2 text-sm text-navy-600">
              <Icon className={clsx('w-4 h-4', textColor)} />
              {label}
            </span>
            <span className={clsx('text-sm font-bold', textColor)}>
              {count} <span className="font-normal text-navy-400">/ {students.total}</span>
            </span>
          </div>
          <div className="h-2 bg-navy-100 rounded-full overflow-hidden">
            <div
              className={clsx('h-full rounded-full transition-all duration-700', color)}
              style={{ width: `${(count / total) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const Analytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTerm, setActiveTerm] = useState(1);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await paymentsService.getTermStats();
      setData(res);
    } catch {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 skeleton rounded w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-40 rounded-xl" />)}
        </div>
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  if (!data) return null;

  const terms = data.terms;
  const selected = terms.find((t) => t.term === activeTerm);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-navy-900">Analytics</h1>
          <p className="text-navy-500 mt-1">Term-by-term fee collection breakdown</p>
        </div>
        <button
          onClick={fetchStats}
          className="p-2 rounded-lg hover:bg-navy-100 transition-smooth text-navy-500"
          title="Refresh"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Term selector cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {terms.map((term, i) => (
          <motion.div
            key={term.term}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <TermCard
              term={term}
              active={activeTerm === term.term}
              onClick={() => setActiveTerm(term.term)}
            />
          </motion.div>
        ))}
      </div>

      {/* Collection comparison chart */}
      <Card title="Expected vs Collected — All Terms" subtitle="Click a term card above to drill down">
        <BarChart terms={terms} />
      </Card>

      {/* Drill-down for selected term */}
      {selected && (
        <motion.div
          key={selected.term}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {/* Summary row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Collected', value: fmt(selected.total_paid), icon: DollarSign, color: 'from-success-500 to-success-600' },
              { label: 'Outstanding', value: fmt(selected.outstanding), icon: AlertCircle, color: 'from-error-500 to-error-600' },
              { label: 'Collection Rate', value: pct(selected.collection_rate), icon: TrendingUp, color: selected.collection_rate >= 80 ? 'from-success-500 to-success-600' : selected.collection_rate >= 50 ? 'from-warning-500 to-warning-600' : 'from-error-500 to-error-600' },
              { label: 'Total Students', value: selected.students.total, icon: Users, color: 'from-primary-500 to-primary-600' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white border border-navy-200 rounded-xl p-4">
                <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-lg flex items-center justify-center mb-3`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <p className="text-xs text-navy-500 font-medium">{label}</p>
                <p className="text-xl font-bold text-navy-900 tabular-nums mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {/* Fee item breakdown + student status side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card title={`${selected.label} — Fee Item Breakdown`}>
                {selected.fee_breakdown.length > 0
                  ? <FeeBreakdownTable breakdown={selected.fee_breakdown} />
                  : <p className="text-navy-400 text-sm text-center py-8">No fee data for this term</p>
                }
              </Card>
            </div>

            <Card title={`${selected.label} — Student Status`}>
              <StudentStatus students={selected.students} />

              <div className="mt-6 pt-4 border-t border-navy-100 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-navy-500">Fully Paid</span>
                  <span className="font-semibold text-success-700">
                    {pct(selected.students.total ? selected.students.fully_paid / selected.students.total * 100 : 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-navy-500">Partial</span>
                  <span className="font-semibold text-warning-700">
                    {pct(selected.students.total ? selected.students.partial / selected.students.total * 100 : 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-navy-500">Not Paid</span>
                  <span className="font-semibold text-error-700">
                    {pct(selected.students.total ? selected.students.unpaid / selected.students.total * 100 : 0)}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Analytics;
