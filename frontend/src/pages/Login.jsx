import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogIn, Lock, AlertCircle, CheckCircle, User } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import Input from '../components/ui/Input';
import toast from 'react-hot-toast';

const FEATURES = [
  'Automatic M-Pesa paybill reconciliation',
  'Term-by-term fee analytics and reporting',
  'Immutable payments audit trail',
  'Role-based access for admin and teachers',
];

const Login = () => {
  const navigate = useNavigate();
  const { login, isLoading, error } = useAuthStore();
  const [formData, setFormData] = useState({ username: '', password: '' });

  const handleChange = (e) =>
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(formData.username, formData.password);
    if (result.success) {
      toast.success('Welcome back!');
      navigate('/dashboard');
    } else {
      toast.error(result.error || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Left branding panel ─────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[44%] relative flex-col justify-between p-14 overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #033d24 0%, #065f46 50%, #047857 100%)' }}
      >
        {/* Dot grid overlay */}
        <div className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle, #ffffff 1.2px, transparent 1.2px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Ambient glow */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(52,211,153,0.18) 0%, transparent 70%)' }}
        />
        <div className="absolute -bottom-24 -left-12 w-80 h-80 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.14) 0%, transparent 70%)' }}
        />

        {/* Top — Logo + name */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10"
        >
          <div className="flex items-center gap-4 mb-12">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center border border-white/20"
              style={{ background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(8px)' }}
            >
              <img
                src="/file.svg"
                alt="AuditBridge logo"
                className="w-9 h-9"
                style={{ filter: 'brightness(0) invert(1)' }}
              />
            </div>
            <div>
              <p className="text-white font-bold text-xl tracking-tight leading-none">AuditBridge</p>
              <p className="text-emerald-300 text-xs mt-0.5">by Sam Mochache</p>
            </div>
          </div>

          <h2 className="text-[2.6rem] font-bold text-white leading-[1.15] mb-5">
            Financial clarity<br />for Kenyan schools.
          </h2>
          <p className="text-emerald-100 text-base leading-relaxed max-w-xs">
            Reconcile M-Pesa paybill payments with student fee records — automatically and accurately.
          </p>
        </motion.div>

        {/* Middle — Feature list */}
        <motion.ul
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.6 }}
          className="relative z-10 space-y-4"
        >
          {FEATURES.map((feat, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 + i * 0.08 }}
              className="flex items-center gap-3"
            >
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.15)' }}
              >
                <CheckCircle className="w-3.5 h-3.5 text-emerald-300" />
              </div>
              <span className="text-emerald-50 text-sm">{feat}</span>
            </motion.li>
          ))}
        </motion.ul>

        {/* Bottom — Copyright */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="relative z-10 text-emerald-500 text-xs"
        >
          © 2026 Sam Mochache · All rights reserved
        </motion.p>
      </div>

      {/* ── Right form panel ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-white px-8 py-12 lg:px-16">

        {/* Mobile logo */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:hidden flex items-center gap-3 mb-10"
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: '#065f46' }}
          >
            <img src="/file.svg" alt="AuditBridge" className="w-6 h-6"
              style={{ filter: 'brightness(0) invert(1)' }} />
          </div>
          <span className="text-xl font-bold text-gray-900">AuditBridge</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-[360px]"
        >
          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Welcome back</h1>
            <p className="text-gray-400 mt-1 text-sm">Sign in to your school account</p>
          </div>

          {/* Error alert */}
          {error && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 mb-5"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Username"
              name="username"
              type="text"
              value={formData.username}
              onChange={handleChange}
              icon={User}
              placeholder="Enter your username"
              required
              autoFocus
            />
            <Input
              label="Password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              icon={Lock}
              placeholder="Enter your password"
              required
            />

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-semibold text-white text-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background: isLoading
                  ? '#047857'
                  : 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
                boxShadow: '0 4px 14px rgba(4,120,87,0.35)',
              }}
            >
              {isLoading ? (
                <svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <>Sign in <LogIn className="w-4 h-4" /></>
              )}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-8 p-4 rounded-xl border border-gray-100 bg-gray-50">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
              Demo credentials
            </p>
            <div className="space-y-1.5">
              {[['admin', 'admin123'], ['accountant', 'accountant123']].map(([u, p]) => (
                <div key={u} className="flex items-center justify-between">
                  <span className="font-mono text-xs text-gray-600">{u}</span>
                  <span className="font-mono text-xs text-gray-400">{p}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Mobile footer */}
        <p className="lg:hidden mt-10 text-xs text-gray-300">
          © 2026 Sam Mochache · All rights reserved
        </p>
      </div>
    </div>
  );
};

export default Login;
