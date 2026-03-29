import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Upload,
  Users,
  CreditCard,
  BarChart2,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import clsx from 'clsx';

const navigation = [
  { name: 'Dashboard',       href: '/dashboard',  icon: LayoutDashboard },
  { name: 'Upload Payments', href: '/upload',      icon: Upload },
  { name: 'Students',        href: '/students',    icon: Users },
  { name: 'Payments',        href: '/payments',    icon: CreditCard },
  { name: 'Analytics',       href: '/analytics',   icon: BarChart2 },
  { name: 'Settings',        href: '/settings',    icon: Settings },
];

const Sidebar = () => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-navy-900 border-b border-navy-800 px-4 py-3 flex items-center justify-between z-40">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">AB</span>
          </div>
          <span className="ml-2 text-lg font-semibold text-white">AuditBridge</span>
        </div>
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2 rounded-lg hover:bg-white/10 transition-smooth text-white"
        >
          {isMobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setIsMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="lg:hidden fixed top-0 left-0 bottom-0 w-72 bg-navy-900 z-50 overflow-y-auto"
            >
              <SidebarContent onNavigate={() => setIsMobileOpen(false)} user={user} onLogout={handleLogout} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:w-72 bg-navy-900 z-30">
        <SidebarContent user={user} onLogout={handleLogout} />
      </aside>
    </>
  );
};

const SidebarContent = ({ onNavigate, user, onLogout }) => (
  <div className="flex flex-col h-full">
    {/* Logo */}
    <div className="flex items-center h-16 px-6 border-b border-navy-800">
      <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-premium">
        <span className="text-white font-bold text-lg">AB</span>
      </div>
      <div className="ml-3">
        <span className="text-xl font-bold text-white">AuditBridge</span>
        <p className="text-[10px] text-navy-400 font-medium tracking-widest uppercase">Fee Management</p>
      </div>
    </div>

    {/* User info */}
    <div className="p-4 border-b border-navy-800">
      <div className="flex items-center">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
          {user?.first_name?.[0]}{user?.last_name?.[0]}
        </div>
        <div className="ml-3 flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {user?.first_name} {user?.last_name}
          </p>
          <p className="text-xs text-navy-400 truncate">{user?.school_name}</p>
        </div>
      </div>
    </div>

    {/* Navigation */}
    <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
      {navigation.map((item) => (
        <NavLink
          key={item.name}
          to={item.href}
          onClick={onNavigate}
          className={({ isActive }) =>
            clsx(
              'flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-smooth group',
              isActive
                ? 'bg-white/10 text-white'
                : 'text-navy-400 hover:bg-white/5 hover:text-navy-100'
            )
          }
        >
          {({ isActive }) => (
            <>
              <item.icon
                className={clsx(
                  'w-5 h-5 mr-3 flex-shrink-0 transition-smooth',
                  isActive ? 'text-primary-400' : 'text-navy-500 group-hover:text-navy-300'
                )}
              />
              <span className="flex-1">{item.name}</span>
              {isActive && <ChevronRight className="w-4 h-4 text-primary-400" />}
            </>
          )}
        </NavLink>
      ))}
    </nav>

    {/* Logout */}
    <div className="p-3 border-t border-navy-800">
      <button
        onClick={onLogout}
        className="w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg text-navy-400 hover:bg-white/5 hover:text-navy-100 transition-smooth group"
      >
        <LogOut className="w-5 h-5 mr-3 text-navy-500 group-hover:text-navy-300 transition-smooth" />
        Sign out
      </button>
    </div>
  </div>
);

export default Sidebar;
