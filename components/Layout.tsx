
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
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
      const notifs = await MockBackend.getSystemNotifications(user.id, user.role);
      if (notifs.length > 0) {
        setSysNotif(notifs[0]);
        setTimeout(() => {
          if (notifs[0]) MockBackend.markNotificationRead(notifs[0].id, user.id);
          setSysNotif(null);
        }, 8000);
      }
    };

    checkNotifications();
    const unsubscribe = MockBackend.subscribe(checkNotifications);

    setActiveHash(window.location.hash);
    const handleHashChange = () => setActiveHash(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      unsubscribe();
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
        {/* Active background */}
        {isActive && (
          <motion.div
            layoutId="activeNav"
            className="absolute inset-0 rounded-xl"
            style={{
              background: isDark
                ? 'linear-gradient(135deg, rgba(0,212,255,0.15) 0%, rgba(0,255,179,0.1) 100%)'
                : 'linear-gradient(135deg, #2563eb 0%, #0d9488 100%)',
              borderLeft: isDark ? '2px solid #00D4FF' : '2px solid #2563eb',
              boxShadow: isDark ? '0 0 20px rgba(0,212,255,0.15), inset 0 0 20px rgba(0,212,255,0.05)' : undefined,
            }}
            initial={false}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          />
        )}

        <span className={`relative z-10 transition-colors ${isActive
          ? isDark ? 'text-neon-400' : 'text-white'
          : 'text-slate-400 dark:text-slate-500 group-hover:text-primary-600 dark:group-hover:text-neon-400'
          }`}>
          {icon}
        </span>
        <span className={`relative z-10 ${isActive && isDark ? 'text-neon-400' : isActive ? 'text-white' : ''}`}>
          {label}
        </span>

        {/* Hover glow line */}
        {!isActive && (
          <span className="absolute right-0 top-1/2 -translate-y-1/2 w-0 group-hover:w-0.5 h-4 rounded-full bg-neon-400/50 dark:bg-neon-400/80 transition-all duration-300" />
        )}
      </a>
    );
  };

  const renderNavLinks = () => {
    if (user.role === UserRole.PATIENT) {
      return (
        <>
          <NavLink to="#top" label="Dashboard" onClick={(e) => handleScroll(e, 'top')} icon={<DashboardIcon />} />
          <NavLink to="#history" label="History & Trends" onClick={(e) => handleScroll(e, 'history')} icon={<HistoryIcon />} />
          <NavLink to="#documents" label="Medical Records" onClick={(e) => handleScroll(e, 'documents')} icon={<DocsIcon />} />
        </>
      );
    }

    if (user.role === UserRole.DOCTOR) {
      return (
        <div className="space-y-0.5">
          <NavLink to="#dashboard" label="Dashboard" onClick={(e) => handleScroll(e, '#dashboard')} icon={<DashboardIcon />} />
          <NavLink to="#patients" label="My Patients" onClick={(e) => handleScroll(e, '#patients')} icon={<PatientsIcon />} />
          <NavLink to="#schedule" label="Schedule" onClick={(e) => handleScroll(e, '#schedule')} icon={<ScheduleIcon />} />
          <NavLink to="#analytics" label="Analytics" onClick={(e) => handleScroll(e, '#analytics')} icon={<AnalyticsIcon />} />
        </div>
      );
    }

    if (user.role === UserRole.ADMIN) {
      const adminItems = [
        { to: '#overview', label: 'Overview', icon: <DashboardIcon /> },
        { to: '#users', label: 'Users', icon: <PatientsIcon /> },
        { to: '#verification', label: 'Verification', icon: <DocsIcon /> },
        { to: '#appointments', label: 'Appointments', icon: <ScheduleIcon /> },
        { to: '#records', label: 'Records', icon: <DocsIcon /> },
        { to: '#analytics', label: 'Analytics', icon: <AnalyticsIcon /> },
        { to: '#safety', label: 'Safety', icon: <span className="text-base">🚨</span> },
        { to: '#broadcast', label: 'Broadcast', icon: <span className="text-base">📢</span> },
        { to: '#settings', label: 'Config', icon: <span className="text-base">⚙️</span> },
        { to: '#logs', label: 'Logs', icon: <span className="text-base">🛡️</span> },
      ];
      return (
        <div className="space-y-0.5">
          {adminItems.map((item) => (
            <NavLink key={item.to} to={item.to} label={item.label} onClick={(e) => handleScroll(e, item.to)} icon={item.icon} />
          ))}
        </div>
      );
    }
  };

  const roleColor = user.role === UserRole.DOCTOR
    ? isDark ? '#00FFB3' : '#0d9488'
    : user.role === UserRole.ADMIN
      ? isDark ? '#FF006E' : '#7c3aed'
      : isDark ? '#00D4FF' : '#2563eb';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-space-950 flex flex-col md:flex-row font-sans text-slate-600 dark:text-slate-300 relative overflow-hidden transition-colors duration-500">
      <HoloBackdrop3D className="opacity-60" intensity={0.55} />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_15%_20%,rgba(0,212,255,0.08),transparent_26%),radial-gradient(circle_at_85%_15%,rgba(0,255,179,0.07),transparent_24%),radial-gradient(circle_at_60%_85%,rgba(255,0,110,0.05),transparent_28%)]" />

      {/* System Notification Toast */}
      <AnimatePresence>
        {sysNotif && (
          <motion.div
            initial={{ opacity: 0, y: -60, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -60, x: '-50%' }}
            className="fixed top-6 left-1/2 z-[100] px-6 py-4 rounded-2xl flex items-center gap-4 max-w-lg w-full mx-4"
            style={{
              background: isDark ? 'rgba(5,10,20,0.95)' : 'rgba(30,41,59,0.95)',
              border: '1px solid rgba(0,212,255,0.3)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 0 30px rgba(0,212,255,0.2), 0 20px 40px rgba(0,0,0,0.4)',
            }}
          >
            <div className="p-2 rounded-full" style={{ background: 'rgba(0,212,255,0.15)', boxShadow: '0 0 10px rgba(0,212,255,0.3)' }}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#00D4FF">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: '#00D4FF' }}>System Alert</p>
              <p className="text-sm font-medium leading-snug text-white">{sysNotif.message}</p>
            </div>
            <button
              onClick={() => { MockBackend.markNotificationRead(sysNotif.id, user.id); setSysNotif(null); }}
              className="text-slate-400 hover:text-white transition-colors"
            >✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <nav className={`fixed inset-y-0 left-0 flex-shrink-0 z-30 flex flex-col transition-transform duration-300 md:static md:translate-x-0 w-[268px] ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:h-screen`}
        style={{
          background: isDark ? 'rgba(5,10,20,0.95)' : 'rgba(255,255,255,0.95)',
          borderRight: isDark ? '1px solid rgba(0,212,255,0.1)' : '1px solid rgba(226,232,240,0.8)',
          backdropFilter: 'blur(24px)',
          boxShadow: isDark ? '4px 0 30px rgba(0,0,0,0.5), 1px 0 0 rgba(0,212,255,0.05)' : '4px 0 20px rgba(0,0,0,0.06)',
        }}
      >
        {/* Logo */}
        <div className="p-6 pb-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {/* Logo icon with rotating ring */}
            <div className="relative w-10 h-10 flex items-center justify-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 rounded-full"
                style={{ border: '1px solid rgba(0,212,255,0.3)', borderStyle: 'dashed' }}
              />
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-base relative z-10"
                style={{
                  background: 'linear-gradient(135deg, #00D4FF 0%, #00FFB3 100%)',
                  boxShadow: isDark ? '0 0 15px rgba(0,212,255,0.5)' : '0 4px 12px rgba(37,99,235,0.3)',
                  color: '#050A14',
                }}
              >
                C
              </div>
            </div>
            <div className="leading-tight">
              <span
                className="text-xl font-bold tracking-tight dark:text-white text-slate-800"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                CareX<span style={{ color: '#00D4FF', textShadow: isDark ? '0 0 10px rgba(0,212,255,0.6)' : 'none' }}>AI</span>
              </span>
            </div>
          </div>
          <button className="md:hidden text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" onClick={() => setMobileMenuOpen(false)}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Separator */}
        <div className="mx-6 mb-4 h-px" style={{ background: isDark ? 'linear-gradient(90deg, rgba(0,212,255,0.3), transparent)' : 'rgba(226,232,240,1)' }} />

        {/* User Profile */}
        <div className="px-4 mb-4">
          <div
            className="p-3 rounded-xl flex items-center gap-3"
            style={{
              background: isDark ? 'rgba(0,212,255,0.05)' : 'rgba(248,250,252,1)',
              border: isDark ? '1px solid rgba(0,212,255,0.1)' : '1px solid rgba(226,232,240,1)',
            }}
          >
            {/* Avatar with neon ring */}
            <div className="relative w-10 h-10 flex-shrink-0">
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `conic-gradient(${roleColor}, transparent, ${roleColor})`,
                  padding: '1px',
                  animation: 'orbit-slow 4s linear infinite',
                  borderRadius: '50%',
                  boxShadow: `0 0 8px ${roleColor}40`,
                }}
              />
              <div
                className="absolute inset-[2px] flex items-center justify-center rounded-full font-bold text-sm"
                style={{
                  background: isDark ? '#0B1120' : '#fff',
                  color: roleColor,
                }}
              >
                {user.name.charAt(0)}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {user.name}
              </p>
              <p className="text-[10px] uppercase font-bold tracking-wide" style={{ color: roleColor }}>
                {user.role}
              </p>
            </div>
            {user.role === UserRole.DOCTOR && <NotificationCenter doctorId={user.id} />}
          </div>
        </div>

        {/* Nav Links */}
        <div className="px-3 py-2 flex-1 overflow-y-auto custom-scrollbar space-y-0.5">
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest opacity-50 dark:text-neon-400 text-slate-400">
            Navigation
          </div>
          {renderNavLinks()}
        </div>

        {/* Bottom actions */}
        <div className="p-4 space-y-2"
          style={{ borderTop: isDark ? '1px solid rgba(0,212,255,0.08)' : '1px solid rgba(226,232,240,1)' }}
        >
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group"
            style={{
              background: isDark ? 'rgba(0,212,255,0.05)' : 'rgba(248,250,252,1)',
              border: isDark ? '1px solid rgba(0,212,255,0.1)' : '1px solid rgba(226,232,240,1)',
            }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="p-1.5 rounded-lg"
                style={{ background: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(251,191,36,0.15)' }}
              >
                {isDark
                  ? <MoonIcon />
                  : <SunIcon />
                }
              </div>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {isDark ? 'Dark Mode' : 'Light Mode'}
              </span>
            </div>
            {/* Toggle pill */}
            <div
              className="w-9 h-5 rounded-full relative transition-colors"
              style={{ background: isDark ? 'rgba(99,102,241,0.6)' : 'rgba(203,213,225,1)' }}
            >
              <div className={`absolute top-1 w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-300 ${isDark ? 'translate-x-5' : 'translate-x-1'}`} />
            </div>
          </button>

          {/* Logout */}
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-pulse-400 hover:bg-red-50 dark:hover:bg-pulse-400/5"
          >
            <LogoutIcon />
            Log Out
          </button>
        </div>
      </nav>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-20 md:hidden"
          style={{ background: 'rgba(5,10,20,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 flex items-center justify-between px-4 z-20"
        style={{
          background: isDark ? 'rgba(5,10,20,0.95)' : 'rgba(255,255,255,0.95)',
          borderBottom: isDark ? '1px solid rgba(0,212,255,0.1)' : '1px solid rgba(226,232,240,1)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
            style={{ background: 'linear-gradient(135deg, #00D4FF, #00FFB3)', color: '#050A14' }}
          >C</div>
          <span
            className="text-lg font-bold dark:text-white text-slate-800"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            CareX<span style={{ color: '#00D4FF' }}>AI</span>
          </span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 rounded-lg transition-colors text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
          </svg>
        </button>
      </div>

      {/* Main content */}
      <main
        className="flex-1 overflow-x-hidden overflow-y-auto scroll-smooth bg-slate-50/40 dark:bg-space-950/40 p-4 md:p-8 pt-20 md:pt-8 backdrop-blur-[2px]"
        ref={mainRef}
      >
        <div className="max-w-7xl mx-auto h-full">
          {children}
        </div>
      </main>
    </div>
  );
};
