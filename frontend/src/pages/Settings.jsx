import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Lock,
  Building2,
  Save,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import toast from 'react-hot-toast';

const Settings = () => {
  const { user, updateUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-navy-900">Settings</h1>
        <p className="text-navy-500 mt-1">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-navy-200">
        <TabButton
          active={activeTab === 'profile'}
          onClick={() => setActiveTab('profile')}
          icon={User}
        >
          Profile
        </TabButton>
        <TabButton
          active={activeTab === 'security'}
          onClick={() => setActiveTab('security')}
          icon={Lock}
        >
          Security
        </TabButton>
        <TabButton
          active={activeTab === 'school'}
          onClick={() => setActiveTab('school')}
          icon={Building2}
        >
          School Info
        </TabButton>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'profile' && <ProfileTab user={user} updateUser={updateUser} />}
        {activeTab === 'security' && <SecurityTab />}
        {activeTab === 'school' && <SchoolInfoTab user={user} />}
      </div>
    </div>
  );
};

// Tab Button Component
const TabButton = ({ active, onClick, icon: Icon, children }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-smooth ${
      active
        ? 'border-primary-500 text-primary-700'
        : 'border-transparent text-navy-600 hover:text-navy-900 hover:border-navy-300'
    }`}
  >
    <Icon className="w-4 h-4" />
    {children}
  </button>
);

// Profile Tab Component
const ProfileTab = ({ user, updateUser }) => {
  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    phone_number: user?.phone_number || '',
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const updatedUser = await authService.updateProfile(formData);
      updateUser(updatedUser);
      toast.success('Profile updated successfully!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Profile Info Card */}
      <Card className="lg:col-span-1">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold text-3xl mb-4">
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </div>
          <h3 className="text-xl font-bold text-navy-900">
            {user?.first_name} {user?.last_name}
          </h3>
          <p className="text-sm text-navy-500 mt-1">{user?.email}</p>
          <div className="mt-4">
            <Badge variant="primary" size="lg">
              {user?.role}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Edit Form */}
      <Card className="lg:col-span-2" title="Personal Information">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="First Name"
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              required
            />
            <Input
              label="Last Name"
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              required
            />
          </div>

          <Input
            label="Email Address"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            required
          />

          <Input
            label="Phone Number"
            name="phone_number"
            type="tel"
            value={formData.phone_number}
            onChange={handleChange}
            hint="Optional"
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-navy-200">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setFormData({
                  first_name: user?.first_name || '',
                  last_name: user?.last_name || '',
                  email: user?.email || '',
                  phone_number: user?.phone_number || '',
                });
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              icon={Save}
              loading={saving}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

// Security Tab Component
const SecurityTab = () => {
  const [formData, setFormData] = useState({
    old_password: '',
    new_password: '',
    new_password_confirm: '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    // Clear error for this field
    if (errors[e.target.name]) {
      setErrors({
        ...errors,
        [e.target.name]: '',
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (formData.new_password.length < 8) {
      newErrors.new_password = 'Password must be at least 8 characters';
    }

    if (formData.new_password !== formData.new_password_confirm) {
      newErrors.new_password_confirm = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSaving(true);

    try {
      await authService.changePassword(
        formData.old_password,
        formData.new_password,
        formData.new_password_confirm
      );
      
      toast.success('Password changed successfully!');
      
      // Reset form
      setFormData({
        old_password: '',
        new_password: '',
        new_password_confirm: '',
      });
    } catch (error) {
      const errorMessage = error.response?.data?.old_password?.[0] || 
                          error.response?.data?.detail || 
                          'Failed to change password';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const passwordStrength = (password) => {
    if (!password) return { strength: 0, label: '', color: '' };
    
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
    if (password.match(/\d/)) strength++;
    if (password.match(/[^a-zA-Z\d]/)) strength++;

    const levels = [
      { strength: 0, label: '', color: '' },
      { strength: 1, label: 'Weak', color: 'bg-error-500' },
      { strength: 2, label: 'Fair', color: 'bg-warning-500' },
      { strength: 3, label: 'Good', color: 'bg-success-500' },
      { strength: 4, label: 'Strong', color: 'bg-success-600' },
    ];

    return levels[strength];
  };

  const strength = passwordStrength(formData.new_password);

  return (
    <Card title="Change Password" subtitle="Update your password to keep your account secure">
      <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
        <Input
          label="Current Password"
          name="old_password"
          type="password"
          value={formData.old_password}
          onChange={handleChange}
          error={errors.old_password}
          required
        />

        <div>
          <Input
            label="New Password"
            name="new_password"
            type="password"
            value={formData.new_password}
            onChange={handleChange}
            error={errors.new_password}
            hint="Minimum 8 characters"
            required
          />
          {formData.new_password && (
            <div className="mt-2">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 h-1.5 bg-navy-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${strength.color}`}
                    style={{ width: `${(strength.strength / 4) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-navy-600">
                  {strength.label}
                </span>
              </div>
            </div>
          )}
        </div>

        <Input
          label="Confirm New Password"
          name="new_password_confirm"
          type="password"
          value={formData.new_password_confirm}
          onChange={handleChange}
          error={errors.new_password_confirm}
          required
        />

        <div className="bg-navy-50 border border-navy-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-navy-500 mr-2 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-navy-600">
              <p className="font-medium mb-1">Password Requirements:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>At least 8 characters long</li>
                <li>Mix of uppercase and lowercase letters</li>
                <li>Include at least one number</li>
                <li>Include at least one special character</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-navy-200">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setFormData({
                old_password: '',
                new_password: '',
                new_password_confirm: '',
              });
              setErrors({});
            }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon={Save}
            loading={saving}
          >
            Update Password
          </Button>
        </div>
      </form>
    </Card>
  );
};

// School Info Tab Component
const SchoolInfoTab = ({ user }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card title="School Information">
        <div className="space-y-4">
          <InfoItem
            label="School Name"
            value={user?.school_name || 'Not available'}
          />
          <InfoItem
            label="Your Role"
            value={
              <Badge variant="primary" size="lg">
                {user?.role}
              </Badge>
            }
          />
          <InfoItem
            label="Member Since"
            value={new Date(user?.date_joined).toLocaleDateString('en-KE', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          />
        </div>
      </Card>

      <Card title="System Information">
        <div className="space-y-4">
          <InfoItem
            label="Account Status"
            value={
              user?.is_active ? (
                <Badge variant="success" dot>
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              ) : (
                <Badge variant="error" dot>
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Inactive
                </Badge>
              )
            }
          />
          <InfoItem
            label="User ID"
            value={<span className="font-mono text-sm">{user?.id}</span>}
          />
          <InfoItem
            label="Username"
            value={user?.username}
          />
        </div>
      </Card>

      {/* Additional Settings - Placeholder */}
      <Card title="Preferences" className="lg:col-span-2">
        <div className="text-center py-8 text-navy-500">
          <p>Additional preferences and settings will be available here</p>
        </div>
      </Card>
    </div>
  );
};

// Info Item Component
const InfoItem = ({ label, value }) => (
  <div>
    <label className="text-sm font-medium text-navy-500">{label}</label>
    <div className="mt-1 text-base text-navy-900">
      {typeof value === 'string' ? <p>{value}</p> : value}
    </div>
  </div>
);

export default Settings;