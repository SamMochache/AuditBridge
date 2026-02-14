import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Upload,
  Users,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import Button from '../ui/Button';
import clsx from 'clsx';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Upload Payments', href: '/upload', icon: Upload },
  { name: 'Students', href: '/students', icon: Users },
  { name: 'Payments', href: '/payments', icon: CreditCard },
  { name: 'Settings', href: '/settings', icon: Settings },
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
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b border-navy-200 px-4 py-3 flex items-center justify-between z-40">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-primary-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">AB</span>
          </div>
          <span className="ml-2 text-lg font-semibold text-navy-900">AuditBridge</span>
        </div>
        
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2 rounded-lg hover:bg-navy-100 transition-smooth"
        >
          {isMobileOpen ? (
            <X className="w-6 h-6 text-navy-700" />
          ) : (
            <Menu className="w-6 h-6 text-navy-700" />
          )}
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
              className="lg:hidden fixed inset-0 bg-navy-900/50 backdrop-blur-sm z-40"
              onClick={() => setIsMobileOpen(false)}
            />
            
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="lg:hidden fixed top-0 left-0 bottom-0 w-72 bg-white border-r border-navy-200 z-50 overflow-y-auto"
            >
              <SidebarContent onNavigate={() => setIsMobileOpen(false)} user={user} onLogout={handleLogout} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:w-72 bg-white border-r border-navy-200 z-30">
        <SidebarContent user={user} onLogout={handleLogout} />
      </aside>
    </>
  );
};

const SidebarContent = ({ onNavigate, user, onLogout }) => {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center h-16 px-6 border-b border-navy-200">
        <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-500 rounded-xl flex items-center justify-center shadow-premium">
          <span className="text-white font-bold text-lg">AB</span>
        </div>
        <span className="ml-3 text-xl font-bold text-navy-900">AuditBridge</span>
      </div>

      {/* User info */}
      <div className="p-4 border-b border-navy-200">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-semibold">
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </div>
          <div className="ml-3 flex-1 min-w-0">
            <p className="text-sm font-semibold text-navy-900 truncate">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-xs text-navy-500 truncate">
              {user?.school_name}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            onClick={onNavigate}
            className={({ isActive }) =>
              clsx(
                'flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-smooth group',
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-navy-600 hover:bg-navy-50 hover:text-navy-900'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={clsx(
                    'w-5 h-5 mr-3 transition-smooth',
                    isActive ? 'text-primary-600' : 'text-navy-400 group-hover:text-navy-600'
                  )}
                />
                <span className="flex-1">{item.name}</span>
                {isActive && (
                  <ChevronRight className="w-4 h-4 text-primary-600" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Logout button */}
      <div className="p-4 border-t border-navy-200">
        <Button
          variant="ghost"
          fullWidth
          icon={LogOut}
          onClick={onLogout}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;