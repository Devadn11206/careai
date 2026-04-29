import React, { useRef, useEffect, useState } from 'react';
import { User, UserRole, SystemNotification } from '../types';
import { Button } from './ui/Button';
import { NotificationCenter } from './NotificationCenter';
import { MockBackend } from '../services/mockBackend';
import { AnimatePresence, motion } from 'framer-motion';
import { HoloBackdrop3D } from './visuals/HoloBackdrop3D';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
}

// Neon SVG icons for nav items
const DashboardIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);
const HistoryIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);
const DocsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);
const PatientsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const ScheduleIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" />
  </svg>
);
const AnalyticsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);
const SunIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);
const MoonIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </svg>
);
const LogoutIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

export const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  const mainRef = useRef<HTMLDivElement>(null);
  const [sysNotif, setSysNotif] = useState<SystemNotification | null>(null);
  const [activeHash, setActiveHash] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Initialize Theme — default to dark for futuristic look
    const storedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (storedTheme === 'dark' || (!storedTheme && (prefersDark || true))) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDark(false);
      document.documentElement.classList.remove('dark');
    }

    if (!user) return;

    const checkNotifications = async () => {
      setSysNotif(null);
    };

    checkNotifications();

    setActiveHash(window.location.hash);
    const handleHashChange = () => setActiveHash(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [user]);

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    if (newDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleScroll = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);

    if (user?.role === UserRole.ADMIN || user?.role === UserRole.DOCTOR) {
      window.location.hash = id;
      return;
    }

    if (id === 'top') {
      if (mainRef.current) mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const element = document.getElementById(id);
      if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (!user) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-slate-50 dark:bg-space-950 font-sans transition-colors duration-500">
        <HoloBackdrop3D className="opacity-70" intensity={0.75} />
        <div className="relative z-10">
          {children}
        </div>
      </div>
    );
  }

  const NavLink = ({ to, label, icon, onClick }: { to: string; label: string; icon: React.ReactNode; onClick: (e: any) => void }) => {
    const isActive = activeHash === to || (!activeHash && (to === '#overview' || to === '#dashboard' || to === '#top'));

    return (
      <a
        href={to}
        onClick={onClick}
        className={`
          group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 relative overflow-hidden
          ${isActive
            ? 'text-space-950 dark:text-white'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5'
          }
        `}
      >
        {isActive && (
          <motion.div
            layoutId="activeNav"
            className="absolute inset-0 rounded-xl"
            style={{
              background: isDark
                ? 'linear-gradient(135deg, rgba(0,212,255,0.15) 0%, rgba(0,255,179,0.1) 100%)'
                : 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
              borderLeft: '2px solid var(--accent-primary)',
              boxShadow: isDark ? 'var(--neon-glow)' : undefined,
            }}
            initial={false}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          />
        )}

        <span className={`relative z-10 transition-colors ${isActive
          ? 'text-[var(--accent-primary)]'
          : 'text-[var(--text-muted)] group-hover:text-[var(--accent-primary)]'
          }`}>
          {icon}
        </span>
        <span className={`relative z-10 font-bold ${isActive ? 'text-[var(--text-main)]' : ''}`}>
          {label}
        </span>
      </a>
    );
  };

  const renderNavLinks = () => {
    if (user.role === UserRole.PATIENT) {
      return (
        <div className="space-y-1">
          <NavLink to="#top" label="Health Matrix" onClick={(e) => handleScroll(e, 'top')} icon={<DashboardIcon />} />
          <NavLink to="#history" label="Vitals Analysis" onClick={(e) => handleScroll(e, 'history')} icon={<HistoryIcon />} />
          <NavLink to="#documents" label="Neural Records" onClick={(e) => handleScroll(e, 'documents')} icon={<DocsIcon />} />
        </div>
      );
    }

    if (user.role === UserRole.DOCTOR) {
      return (
        <div className="space-y-1">
          <NavLink to="#dashboard" label="Practice IQ" onClick={(e) => handleScroll(e, '#dashboard')} icon={<DashboardIcon />} />
          <NavLink to="#patients" label="Subject Database" onClick={(e) => handleScroll(e, '#patients')} icon={<PatientsIcon />} />
          <NavLink to="#schedule" label="Cycle Planner" onClick={(e) => handleScroll(e, '#schedule')} icon={<ScheduleIcon />} />
          <NavLink to="#analytics" label="Efficacy Metrics" onClick={(e) => handleScroll(e, '#analytics')} icon={<AnalyticsIcon />} />
          <NavLink to="#settings" label="Protocol Settings" onClick={(e) => handleScroll(e, '#settings')} icon={<span className="text-lg">⚙️</span>} />
        </div>
      );
    }

    if (user.role === UserRole.ADMIN) {
      const adminItems = [
        { to: '#overview', label: 'Command Center', icon: <DashboardIcon /> },
        { to: '#users', label: 'User Nodes', icon: <PatientsIcon /> },
        { to: '#verification', label: 'Identity Auth', icon: <DocsIcon /> },
        { to: '#appointments', label: 'Scheduling', icon: <ScheduleIcon /> },
        { to: '#records', label: 'Data Vault', icon: <DocsIcon /> },
        { to: '#analytics', label: 'Global Intel', icon: <AnalyticsIcon /> },
        { to: '#safety', label: 'System Safety', icon: <span className="text-base">🚨</span> },
        { to: '#broadcast', label: 'Net Broadcast', icon: <span className="text-base">📢</span> },
        { to: '#settings', label: 'Kernel Config', icon: <span className="text-base">⚙️</span> },
        { to: '#logs', label: 'Security Logs', icon: <span className="text-base">🛡️</span> },
      ];
      return (
        <div className="space-y-1">
          {adminItems.map((item) => (
            <NavLink key={item.to} to={item.to} label={item.label} onClick={(e) => handleScroll(e, item.to)} icon={item.icon} />
          ))}
        </div>
      );
    }
  };

  const roleColor = user.role === UserRole.DOCTOR
    ? 'var(--accent-secondary)'
    : user.role === UserRole.ADMIN
      ? 'var(--accent-pulse)'
      : 'var(--accent-primary)';

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] flex flex-col md:flex-row font-sans text-[var(--text-main)] relative overflow-hidden transition-colors duration-500 grid-overlay">
      <HoloBackdrop3D className="opacity-40" intensity={0.4} />
      <div className="absolute inset-0 pointer-events-none aurora-bg opacity-30" />

      {/* Sidebar */}
      <nav className={`
        fixed md:relative z-30 flex flex-col h-screen transition-all duration-500 glass-card rounded-none border-r border-[var(--glass-border)]
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        w-72 shadow-[var(--glass-shadow)]
      `}>
        {/* Sidebar Header */}
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center shadow-[0_0_20px_rgba(0,212,255,0.4)]">
              <span className="text-white font-black text-2xl tracking-tighter italic">X</span>
            </div>
            <div>
              <h2 className="text-2xl font-black font-orbitron tracking-tighter text-[var(--text-main)] leading-none">
                CARE<span className="premium-gradient-text">XAI</span>
              </h2>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] opacity-60">Quantum Core Active</span>
              </div>
            </div>
          </div>

          {/* User Profile Summary */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 dark:bg-black/20 border border-[var(--glass-border)] backdrop-blur-md shadow-inner transition-transform hover:scale-[1.02] active:scale-[0.98]">
            <div className="relative w-12 h-12 flex-shrink-0">
              <div
                className="absolute inset-0 rounded-2xl animate-spin-slow opacity-50"
                style={{
                  border: `2px solid ${roleColor}`,
                  boxShadow: `0 0 12px ${roleColor}60`,
                }}
              />
              <div
                className="absolute inset-[2px] flex items-center justify-center rounded-2xl font-bold text-lg overflow-hidden glass-card"
                style={{
                  color: roleColor,
                }}
              >
                {user.profilePicUrl ? (
                  <img
                    src={user.profilePicUrl}
                    alt={user.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  user.name.charAt(0)
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[var(--text-main)] truncate font-display">
                {user.name}
              </p>
              <p className="text-[10px] uppercase font-black tracking-[0.15em]" style={{ color: roleColor }}>
                {user.role}
              </p>
            </div>
            {user.role === UserRole.DOCTOR && <NotificationCenter doctorId={user.id} />}
          </div>
        </div>

        {/* Nav Links */}
        <div className="px-4 py-2 flex-1 overflow-y-auto custom-scrollbar space-y-1">
          <div className="px-3 py-4 text-[10px] font-black uppercase tracking-[0.25em] text-[var(--text-muted)] opacity-60">
            Systems Control
          </div>
          {renderNavLinks()}
        </div>

        {/* Bottom actions */}
        <div className="p-6 space-y-3 border-t border-[var(--glass-border)]">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-4 py-3 rounded-2xl glass-card transition-all group hover:scale-[1.02]"
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-xl transition-all ${isDark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-amber-500/20 text-amber-600'}`}
              >
                {isDark ? <MoonIcon /> : <SunIcon />}
              </div>
              <span className="text-xs font-bold text-[var(--text-main)]">
                {isDark ? 'Obsidian Protocol' : 'Solar Interface'}
              </span>
            </div>
            <div
              className={`w-10 h-6 rounded-full relative transition-all duration-500 ${isDark ? 'bg-indigo-500/40' : 'bg-slate-300'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-lg transition-transform duration-500 ${isDark ? 'translate-x-5' : 'translate-x-1'}`} />
            </div>
          </button>

          {/* Logout */}
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-500/10 hover:border hover:border-rose-500/20"
          >
            <LogoutIcon />
            Deauthorize
          </button>
        </div>
      </nav>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-20 md:hidden bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-20 flex items-center justify-between px-6 z-20 glass-card border-b border-[var(--glass-border)]">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center shadow-lg">
            <span className="text-white font-black text-xl tracking-tighter italic">X</span>
          </div>
          <span className="text-lg font-black font-orbitron tracking-tighter text-[var(--text-main)]">
            CARE<span className="premium-gradient-text">XAI</span>
          </span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-3 rounded-2xl transition-all glass-card text-[var(--text-main)] hover:border-[var(--accent-primary)]/40"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
          </svg>
        </button>
      </div>

      {/* Main content */}
      <main
        className="flex-1 overflow-x-hidden overflow-y-auto scroll-smooth p-4 md:p-8 pt-24 md:pt-8"
        ref={mainRef}
      >
        <div className="max-w-7xl mx-auto h-full">
          {children}
        </div>
      </main>
    </div>
  );
};
