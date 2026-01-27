
import React, { useRef, useEffect, useState } from 'react';
import { User, UserRole, SystemNotification } from '../types';
import { Button } from './ui/Button';
import { NotificationCenter } from './NotificationCenter';
import { MockBackend } from '../services/mockBackend';
import { AnimatePresence, motion } from 'framer-motion';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  const mainRef = useRef<HTMLDivElement>(null);
  const [sysNotif, setSysNotif] = useState<SystemNotification | null>(null);
  const [activeHash, setActiveHash] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Initialize Theme
    const storedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (storedTheme === 'dark' || (!storedTheme && prefersDark)) {
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
    return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans">{children}</div>;
  }

  const NavLink = ({ to, label, icon, onClick }: { to: string, label: string, icon: React.ReactNode, onClick: (e: any) => void }) => {
      const isActive = activeHash === to || (!activeHash && (to === '#overview' || to === '#dashboard' || to === '#top'));
      
      return (
        <a 
            href={to} 
            onClick={onClick} 
            className={`
                group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-300 relative overflow-hidden
                ${isActive 
                    ? 'text-white shadow-lg shadow-rose-500/20' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }
            `}
        >
            {/* Active Background Gradient */}
            {isActive && (
                <motion.div 
                    layoutId="activeNav"
                    className="absolute inset-0 bg-gradient-to-r from-rose-500 to-pink-600"
                    initial={false}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
            )}
            
            <span className={`relative z-10 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-rose-500 transition-colors'}`}>
                {icon}
            </span>
            <span className="relative z-10">{label}</span>
        </a>
      );
  };

  const renderNavLinks = () => {
      if (user.role === UserRole.PATIENT) {
          return (
              <>
                <NavLink to="#top" label="Dashboard" onClick={(e) => handleScroll(e, 'top')} icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z" /></svg>} />
                <NavLink to="#history" label="History & Trends" onClick={(e) => handleScroll(e, 'history')} icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>} />
                <NavLink to="#documents" label="Medical Records" onClick={(e) => handleScroll(e, 'documents')} icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} />
              </>
          );
      }
      
      if (user.role === UserRole.DOCTOR) {
          return (
               <div className="space-y-1">
               <NavLink to="#dashboard" label="Dashboard" onClick={(e) => handleScroll(e, '#dashboard')} icon={<span className="text-lg">📊</span>} />
               <NavLink to="#patients" label="My Patients" onClick={(e) => handleScroll(e, '#patients')} icon={<span className="text-lg">👥</span>} />
               <NavLink to="#schedule" label="Schedule" onClick={(e) => handleScroll(e, '#schedule')} icon={<span className="text-lg">📅</span>} />
               <NavLink to="#analytics" label="Analytics" onClick={(e) => handleScroll(e, '#analytics')} icon={<span className="text-lg">📈</span>} />
               </div>
          );
      }

      if (user.role === UserRole.ADMIN) {
          return (
              <div className="space-y-1">
                 <NavLink to="#overview" label="Overview" onClick={(e) => handleScroll(e, '#overview')} icon={<span className="text-lg">📊</span>} />
                 <NavLink to="#users" label="Users" onClick={(e) => handleScroll(e, '#users')} icon={<span className="text-lg">👥</span>} />
                 <NavLink to="#verification" label="Verification" onClick={(e) => handleScroll(e, '#verification')} icon={<span className="text-lg">🆔</span>} />
                 <NavLink to="#appointments" label="Appointments" onClick={(e) => handleScroll(e, '#appointments')} icon={<span className="text-lg">📅</span>} />
                 <NavLink to="#records" label="Records" onClick={(e) => handleScroll(e, '#records')} icon={<span className="text-lg">📂</span>} />
                 <NavLink to="#analytics" label="Analytics" onClick={(e) => handleScroll(e, '#analytics')} icon={<span className="text-lg">📈</span>} />
                 <NavLink to="#safety" label="Safety" onClick={(e) => handleScroll(e, '#safety')} icon={<span className="text-lg">🚨</span>} />
                 <NavLink to="#broadcast" label="Broadcast" onClick={(e) => handleScroll(e, '#broadcast')} icon={<span className="text-lg">📢</span>} />
                 <NavLink to="#settings" label="Config" onClick={(e) => handleScroll(e, '#settings')} icon={<span className="text-lg">⚙️</span>} />
                 <NavLink to="#logs" label="Logs" onClick={(e) => handleScroll(e, '#logs')} icon={<span className="text-lg">🛡️</span>} />
              </div>
          );
      }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] flex flex-col md:flex-row font-sans text-slate-600 dark:text-slate-300 relative selection:bg-rose-100 selection:text-rose-900 transition-colors duration-500">
      
      {/* System Notification Toast */}
      <AnimatePresence>
        {sysNotif && (
            <motion.div 
                initial={{ opacity: 0, y: -50, x: '-50%' }}
                animate={{ opacity: 1, y: 0, x: '-50%' }}
                exit={{ opacity: 0, y: -50, x: '-50%' }}
                className="fixed top-6 left-1/2 z-[100] bg-rose-900/95 backdrop-blur-md dark:bg-rose-950/95 text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-4 max-w-lg w-full mx-4 border border-rose-800 ring-1 ring-white/10"
            >
                <div className="p-2 bg-white/10 rounded-full animate-pulse">
                    <svg className="w-5 h-5 text-rose-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                </div>
                <div className="flex-1">
                    <p className="text-[10px] font-bold text-rose-200 uppercase tracking-wider mb-0.5">System Alert</p>
                    <p className="text-sm font-medium leading-snug text-white">{sysNotif.message}</p>
                </div>
                <button 
                    onClick={() => {
                        MockBackend.markNotificationRead(sysNotif.id, user.id);
                        setSysNotif(null);
                    }}
                    className="text-rose-300 hover:text-white transition-colors"
                >
                    ✕
                </button>
            </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <nav className={`fixed inset-y-0 left-0 bg-white/80 dark:bg-slate-900/90 backdrop-blur-xl border-r border-slate-200/60 dark:border-slate-800 flex-shrink-0 z-30 flex flex-col shadow-2xl md:shadow-none transition-transform duration-300 md:static md:translate-x-0 w-[280px] ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:h-screen`}>
        <div className="p-8 pb-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-rose-500/20 ring-2 ring-rose-100 dark:ring-rose-900/30">C</div>
            <span className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">CareX<span className="text-rose-500">AI</span></span>
          </div>
          <button className="md:hidden text-slate-400 hover:text-rose-600" onClick={() => setMobileMenuOpen(false)}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* User Profile Snippet */}
        <div className="px-6 mb-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800/50 border border-slate-200 dark:border-slate-700/50 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center text-rose-600 font-bold border border-slate-100 dark:border-slate-600">
                    {user.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user.name}</p>
                    <p className="text-[10px] uppercase font-bold tracking-wide text-slate-400 dark:text-slate-500">{user.role}</p>
                </div>
                {user.role === UserRole.DOCTOR && <NotificationCenter doctorId={user.id} />}
            </div>
        </div>

        <div className="px-4 py-2 flex-1 overflow-y-auto custom-scrollbar space-y-1">
            <div className="px-4 py-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest opacity-80">Menu</div>
            {renderNavLinks()}
        </div>

        <div className="p-6 border-t border-slate-200/60 dark:border-slate-800 space-y-3 bg-slate-50/50 dark:bg-slate-900/50">
          <button 
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-rose-300 dark:hover:border-slate-500 transition-all group shadow-sm hover:shadow-md"
          >
             <div className="flex items-center gap-3">
               {isDark ? (
                 <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                 </div>
               ) : (
                 <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                 </div>
               )}
               <span className="text-xs font-bold">{isDark ? 'Dark Mode' : 'Light Mode'}</span>
             </div>
             <div className={`w-9 h-5 rounded-full relative transition-colors ${isDark ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-300 ${isDark ? 'translate-x-5' : 'translate-x-1'}`}></div>
             </div>
          </button>

          <Button variant="ghost" className="w-full justify-start gap-3 hover:bg-rose-50 text-slate-500 hover:text-rose-600 font-medium text-sm" onClick={onLogout}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Log Out
          </Button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-20 md:hidden" onClick={() => setMobileMenuOpen(false)} />}

      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 z-20 shadow-sm">
         <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-rose-500 to-pink-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">C</div>
            <span className="text-lg font-bold text-slate-800 dark:text-white">CareXAI</span>
         </div>
         <button onClick={() => setMobileMenuOpen(true)} className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
         </button>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F8FAFC] dark:bg-[#0B1120] p-4 md:p-8 pt-20 md:pt-8" ref={mainRef}>
         <div className="max-w-7xl mx-auto h-full">
            {children}
         </div>
      </main>
    </div>
  );
};
