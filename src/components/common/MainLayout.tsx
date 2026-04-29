import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Activity, 
  LineChart, 
  Bell, 
  User as UserIcon, 
  LogOut, 
  Menu, 
  X,
  Stethoscope
} from 'lucide-react';
import { useHealth } from '../../services/HealthContext';
import { Button } from '../ui/Button';

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  to: string;
  active: boolean;
  onClick?: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ icon: Icon, label, to, active, onClick }) => (
  <Link to={to} onClick={onClick}>
    <motion.div
      whileHover={{ x: 4 }}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
        active 
          ? 'bg-primary/10 text-primary border border-primary/20' 
          : 'text-text-muted hover:bg-white/5 hover:text-text-main'
      }`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
      {active && (
        <motion.div
          layoutId="active-pill"
          className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(56,189,248,0.6)]"
        />
      )}
    </motion.div>
  </Link>
);

export const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, setUser } = useHealth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('token');
    navigate('/login');
  };

  const patientItems = [
    { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
    { icon: Activity, label: 'Vitals', to: '/vitals' },
    { icon: LineChart, label: 'Insights', to: '/insights' },
    { icon: Bell, label: 'Alerts', to: '/alerts' },
  ];

  const doctorItems = [
    { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
    { icon: Activity, label: 'My Patients', to: '/dashboard#patients' },
    { icon: LineChart, label: 'Analytics', to: '/dashboard#analytics' },
    { icon: Bell, label: 'Alerts', to: '/alerts' },
  ];

  const navItems = user?.role === 'DOCTOR' ? doctorItems : patientItems;

  return (
    <div className="min-h-screen bg-bg-deep text-text-main flex overflow-hidden">
      {/* Grid Overlay */}
      <div className="fixed inset-0 bg-grid pointer-events-none opacity-20" />

      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-[280px] flex-col border-r border-glass-border bg-bg-deep/50 backdrop-blur-xl z-30">
        <div className="p-8">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-all">
              <Stethoscope className="text-primary" size={24} />
            </div>
            <span className="font-mono text-xl font-bold tracking-tight">Care<span className="text-primary">XAI</span></span>
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => (
            <SidebarItem
              key={item.to}
              {...item}
              active={location.pathname === item.to}
            />
          ))}
        </nav>

        <div className="p-4 mt-auto border-t border-glass-border">
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 text-text-muted hover:text-error"
            onClick={handleLogout}
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </Button>
        </div>
      </aside>

      {/* Sidebar - Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-[280px] bg-bg-deep border-r border-glass-border z-50 p-6 flex flex-col lg:hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <span className="font-mono text-xl font-bold">Care<span className="text-primary">XAI</span></span>
                <button onClick={() => setIsSidebarOpen(false)} className="text-text-muted">
                  <X size={24} />
                </button>
              </div>
              <nav className="flex-1 space-y-2">
                {navItems.map((item) => (
                  <SidebarItem
                    key={item.to}
                    {...item}
                    active={location.pathname === item.to}
                    onClick={() => setIsSidebarOpen(false)}
                  />
                ))}
              </nav>
              <Button 
                variant="ghost" 
                className="w-full justify-start gap-3 mt-auto text-text-muted hover:text-error"
                onClick={handleLogout}
              >
                <LogOut size={20} />
                <span>Sign Out</span>
              </Button>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Header */}
        <header className="h-[80px] flex items-center justify-between px-6 lg:px-10 border-b border-glass-border bg-bg-deep/50 backdrop-blur-md sticky top-0 z-20">
          <button className="lg:hidden text-text-main" onClick={() => setIsSidebarOpen(true)}>
            <Menu size={24} />
          </button>

          <div className="flex-1 lg:flex-none">
            <h1 className="text-lg font-bold lg:hidden">
              {navItems.find(item => item.to === location.pathname)?.label || 'CareXAI'}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 text-text-muted hover:text-primary transition-colors relative">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-accent rounded-full border border-bg-deep" />
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-glass-border">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-bold">{user?.name || 'User'}</p>
                <p className="text-[10px] text-text-muted uppercase tracking-wider font-mono">{user?.role || 'Patient'}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-secondary p-[1px]">
                <div className="w-full h-full rounded-full bg-bg-deep flex items-center justify-center overflow-hidden">
                  <UserIcon size={20} className="text-text-muted" />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-10 custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};
