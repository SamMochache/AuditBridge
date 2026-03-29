import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  User, Lock, Building2, Save, AlertCircle, CheckCircle,
  Phone, Mail, AtSign, Shield, Calendar, Hash,
  TrendingUp, Users, DollarSign, CreditCard,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { paymentsService } from '../services/paymentsService';
import toast from 'react-hot-toast';
import clsx from 'clsx';

// ─── Tab Button ───────────────────────────────────────────────────────────────

const TabButton = ({ active, onClick, icon: Icon, children }) => (
  <button
    onClick={onClick}
    className={clsx(
      'flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-smooth',
      active
        ? 'border-primary-500 text-primary-700'
        : 'border-transparent text-navy-500 hover:text-navy-900 hover:border-navy-300'
    )}
  >
    <Icon className="w-4 h-4" />
    {children}
  </button>
);

// ─── Profile Tab ──────────────────────────────────────────────────────────────

const ProfileTab = ({ user, updateUser }) => {
  const [formData, setFormData] = useState({
    first_name:   user?.first_name   || '',
    last_name:    user?.last_name    || '',
    email:        user?.email        || '',
    phone_number: user?.phone_number || '',
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) =>
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await authService.updateProfile(formData);
      updateUser(updated);
      toast.success('Profile updated!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const initials = `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Avatar card */}
      <Card className="lg:col-span-1">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold text-3xl mb-4 shadow-premium-lg">
            {initials}
          </div>
          <h3 className="text-xl font-bold text-navy-900">
            {user?.first_name} {user?.last_name}
          </h3>
          <p className="text-sm text-navy-500 mt-0.5">{user?.email}</p>

          <div className="mt-4 space-y-2">
            <Badge variant="primary" size="md">{user?.role}</Badge>
          </div>

          <div className="mt-6 pt-5 border-t border-navy-100 space-y-3 text-left">
            {[
              { icon: AtSign,    label: 'Username',  value: user?.username },
              { icon: Phone,     label: 'Phone',     value: user?.phone_number || '—' },
              { icon: Calendar,  label: 'Joined',    value: user?.date_joined
                  ? new Date(user.date_joined).toLocaleDateString('en-KE', { month: 'short', year: 'numeric' })
                  : '—' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-2 text-sm">
                <Icon className="w-4 h-4 text-navy-400 flex-shrink-0" />
                <span className="text-navy-500 w-16">{label}</span>
                <span className="text-navy-800 font-medium truncate">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Edit form */}
      <Card className="lg:col-span-2" title="Personal Information" subtitle="Update your name, email and contact details">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="First Name"  name="first_name"  value={formData.first_name}  onChange={handleChange} required />
            <Input label="Last Name"   name="last_name"   value={formData.last_name}   onChange={handleChange} required />
          </div>
          <Input label="Email Address" name="email" type="email" value={formData.email} onChange={handleChange} icon={Mail} required />
          <Input label="Phone Number"  name="phone_number" type="tel" value={formData.phone_number} onChange={handleChange} icon={Phone} hint="Optional — used for M-Pesa notifications" />

          <div className="flex justify-end gap-3 pt-4 border-t border-navy-200">
            <Button type="button" variant="secondary" onClick={() => setFormData({
              first_name: user?.first_name || '', last_name: user?.last_name || '',
              email: user?.email || '', phone_number: user?.phone_number || '',
            })}>
              Discard
            </Button>
            <Button type="submit" variant="primary" icon={Save} loading={saving}>
              Save Changes
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

// ─── Security Tab ─────────────────────────────────────────────────────────────

const REQUIREMENTS = [
  { id: 'length',    label: 'At least 8 characters',        test: (p) => p.length >= 8 },
  { id: 'upper',     label: 'Uppercase letter (A–Z)',        test: (p) => /[A-Z]/.test(p) },
  { id: 'lower',     label: 'Lowercase letter (a–z)',        test: (p) => /[a-z]/.test(p) },
  { id: 'number',    label: 'At least one number',           test: (p) => /\d/.test(p) },
  { id: 'special',   label: 'Special character (!@#$…)',     test: (p) => /[^a-zA-Z\d]/.test(p) },
];

function passwordStrength(password) {
  if (!password) return { score: 0, label: '', color: '' };
  const met = REQUIREMENTS.filter((r) => r.test(password)).length;
  if (met <= 1) return { score: 1, label: 'Weak',   color: 'bg-error-500'   };
  if (met === 2) return { score: 2, label: 'Fair',   color: 'bg-warning-500' };
  if (met === 3) return { score: 3, label: 'Good',   color: 'bg-success-400' };
  if (met === 4) return { score: 4, label: 'Strong', color: 'bg-success-500' };
  return             { score: 5, label: 'Very Strong', color: 'bg-success-600' };
}

const SecurityTab = () => {
  const [form, setForm] = useState({ old_password: '', new_password: '', new_password_confirm: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (errors[e.target.name]) setErrors((prev) => ({ ...prev, [e.target.name]: '' }));
  };

  const validate = () => {
    const errs = {};
    if (form.new_password.length < 8)                      errs.new_password = 'Must be at least 8 characters';
    if (form.new_password !== form.new_password_confirm)   errs.new_password_confirm = 'Passwords do not match';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await authService.changePassword(form.old_password, form.new_password, form.new_password_confirm);
      toast.success('Password changed successfully!');
      setForm({ old_password: '', new_password: '', new_password_confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.old_password?.[0] || err.response?.data?.detail || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const strength = passwordStrength(form.new_password);
  const metCount = REQUIREMENTS.filter((r) => r.test(form.new_password)).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card title="Change Password" subtitle="Keep your account secure with a strong password">
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input label="Current Password" name="old_password" type="password"
            value={form.old_password} onChange={handleChange} icon={Lock} required />

          <div className="space-y-2">
            <Input label="New Password" name="new_password" type="password"
              value={form.new_password} onChange={handleChange}
              icon={Lock} error={errors.new_password} required />

            {form.new_password && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex gap-0.5 h-1.5">
                    {[1,2,3,4,5].map((s) => (
                      <div key={s} className={clsx('flex-1 rounded-full transition-all duration-300',
                        s <= strength.score ? strength.color : 'bg-navy-100'
                      )} />
                    ))}
                  </div>
                  <span className={clsx('text-xs font-semibold w-20 text-right',
                    strength.score <= 1 ? 'text-error-600' :
                    strength.score <= 2 ? 'text-warning-600' : 'text-success-600'
                  )}>
                    {strength.label}
                  </span>
                </div>
              </div>
            )}
          </div>

          <Input label="Confirm New Password" name="new_password_confirm" type="password"
            value={form.new_password_confirm} onChange={handleChange}
            icon={Lock} error={errors.new_password_confirm} required />

          <div className="flex justify-end gap-3 pt-4 border-t border-navy-200">
            <Button type="button" variant="secondary"
              onClick={() => { setForm({ old_password: '', new_password: '', new_password_confirm: '' }); setErrors({}); }}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" icon={Shield} loading={saving}>
              Update Password
            </Button>
          </div>
        </form>
      </Card>

      {/* Live requirements checklist */}
      <Card title="Password Requirements" subtitle="All must be met for a strong password">
        <ul className="space-y-3">
          {REQUIREMENTS.map((req) => {
            const met = form.new_password ? req.test(form.new_password) : null;
            return (
              <li key={req.id} className={clsx(
                'flex items-center gap-3 p-3 rounded-lg transition-smooth',
                met === true  ? 'bg-success-50  border border-success-200' :
                met === false ? 'bg-error-50    border border-error-100'   :
                                'bg-navy-50     border border-navy-100'
              )}>
                <div className={clsx('w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0',
                  met === true  ? 'bg-success-500' :
                  met === false ? 'bg-error-400'   : 'bg-navy-200'
                )}>
                  {met === true  && <CheckCircle className="w-3 h-3 text-white" />}
                  {met === false && <AlertCircle className="w-3 h-3 text-white" />}
                </div>
                <span className={clsx('text-sm font-medium',
                  met === true  ? 'text-success-700' :
                  met === false ? 'text-error-600'   : 'text-navy-500'
                )}>
                  {req.label}
                </span>
              </li>
            );
          })}
        </ul>

        {form.new_password && (
          <p className="mt-4 text-xs text-navy-400 text-center">
            {metCount} / {REQUIREMENTS.length} requirements met
          </p>
        )}
      </Card>
    </div>
  );
};

// ─── School Info Tab ──────────────────────────────────────────────────────────

const SchoolInfoTab = ({ user }) => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    paymentsService.getDashboardStats()
      .then(setStats)
      .catch(() => {});
  }, []);

  const fmt = (n) => new Intl.NumberFormat('en-KE', {
    style: 'currency', currency: 'KES', minimumFractionDigits: 0,
  }).format(n || 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* School details */}
      <Card title="School Details">
        <div className="space-y-4">
          {[
            { icon: Building2, label: 'School Name',    value: user?.school_name || '—' },
            { icon: Hash,      label: 'Paybill Number', value: user?.paybill_number
                ? <span className="font-mono text-lg font-bold text-primary-700">{user.paybill_number}</span>
                : <span className="text-navy-400 italic text-sm">Not set</span>
            },
            { icon: User,      label: 'Your Role',     value: <Badge variant="primary">{user?.role}</Badge> },
            { icon: Calendar,  label: 'Member Since',  value: user?.date_joined
                ? new Date(user.date_joined).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })
                : '—'
            },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-3 py-3 border-b border-navy-100 last:border-0">
              <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-primary-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-navy-500 uppercase tracking-wide">{label}</p>
                <div className="mt-0.5 text-navy-900">
                  {typeof value === 'string' ? <p className="font-medium">{value}</p> : value}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-primary-50 border border-primary-200 rounded-lg">
          <p className="text-xs text-primary-800">
            <span className="font-semibold">Remind parents:</span> When paying via M-Pesa Paybill, the account reference must be the student's admission number exactly (e.g. <code className="bg-primary-100 px-1 rounded">NA20260001</code>).
          </p>
        </div>
      </Card>

      {/* Account info */}
      <Card title="Account Information">
        <div className="space-y-4">
          {[
            { icon: AtSign,   label: 'Username',       value: user?.username },
            { icon: Mail,     label: 'Email',          value: user?.email },
            { icon: Phone,    label: 'Phone',          value: user?.phone_number || '—' },
            { icon: Shield,   label: 'Account Status', value: user?.is_active
                ? <Badge variant="matched" dot>Active</Badge>
                : <Badge variant="failed"  dot>Inactive</Badge>
            },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-3 py-3 border-b border-navy-100 last:border-0">
              <div className="w-8 h-8 rounded-lg bg-navy-100 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-navy-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-navy-500 uppercase tracking-wide">{label}</p>
                <div className="mt-0.5">
                  {typeof value === 'string' ? <p className="font-medium text-navy-900">{value}</p> : value}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Live school stats */}
      <Card title="School at a Glance" subtitle="Live summary from your database" className="lg:col-span-2">
        {stats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Users,      label: 'Total Students',     value: stats.students?.total_students ?? '—',              color: 'from-primary-500 to-primary-600' },
              { icon: DollarSign, label: 'Total Collected',    value: fmt(stats.payments?.total_collected),               color: 'from-success-500 to-success-600' },
              { icon: TrendingUp, label: 'Collection Rate',    value: `${stats.fees?.collection_rate ?? 0}%`,             color: stats.fees?.collection_rate >= 70 ? 'from-success-500 to-success-600' : 'from-warning-500 to-warning-600' },
              { icon: CreditCard, label: 'Total Transactions', value: stats.payments?.total_count ?? '—',                 color: 'from-navy-600 to-navy-700' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="bg-navy-50 rounded-xl p-4">
                <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-lg flex items-center justify-center mb-3`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <p className="text-xs font-medium text-navy-500">{label}</p>
                <p className="text-xl font-bold text-navy-900 tabular-nums mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1,2,3,4].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
          </div>
        )}
      </Card>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const Settings = () => {
  const { user, updateUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-navy-900">Settings</h1>
        <p className="text-navy-500 mt-1">Manage your account and view school information</p>
      </div>

      <div className="flex gap-1 border-b border-navy-200">
        <TabButton active={activeTab === 'profile'}  onClick={() => setActiveTab('profile')}  icon={User}>Profile</TabButton>
        <TabButton active={activeTab === 'security'} onClick={() => setActiveTab('security')} icon={Lock}>Security</TabButton>
        <TabButton active={activeTab === 'school'}   onClick={() => setActiveTab('school')}   icon={Building2}>School Info</TabButton>
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'profile'  && <ProfileTab  user={user} updateUser={updateUser} />}
        {activeTab === 'security' && <SecurityTab />}
        {activeTab === 'school'   && <SchoolInfoTab user={user} />}
      </motion.div>
    </div>
  );
};

export default Settings;
