import React, { useRef, useEffect, useState } from 'react';
import { User, UserRole, SystemNotification } from '@/types';
import { Button } from '@/components/ui/Button';
import { NotificationCenter } from '@/components/features/NotificationCenter';
import { MockBackend } from '@/services/mockBackend';
import { AnimatePresence, motion } from 'framer-motion';
import { HoloBackdrop3D } from '@/components/visuals/HoloBackdrop3D';
import { 
    LayoutDashboard, 
    Activity, 
    FileText, 
    Users, 
    Calendar, 
    BarChart3, 
    Settings, 
    LogOut, 
    Sun, 
    Moon, 
    Menu, 
    X,
    ShieldAlert,
    Radio,
    Terminal,
    Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const [isDark, setIsDark] = useState(true); // Force dark by default

  useEffect(() => {
    // Force dark mode for Midnight Cyber aesthetic
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');

    if (!user) return;

    setActiveHash(window.location.hash);
    const handleHashChange = () => setActiveHash(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [user]);

  const toggleTheme = () => {
    // Dark mode is the core aesthetic, but we allow toggle for accessibility
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
      const element = document.getElementById(id.startsWith('#') ? id.slice(1) : id);
      if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (!user) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-background font-sans selection:bg-primary/30">
        <HoloBackdrop3D className="opacity-40" intensity={0.6} />
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
        className={cn(
            "group flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all relative overflow-hidden",
            isActive ? "text-primary bg-primary/10 shadow-glow-primary/5" : "text-muted-foreground hover:text-white hover:bg-white/5"
        )}
      >
        {isActive && (
          <motion.div
            layoutId="activeNavIndicator"
            className="absolute left-0 top-0 bottom-0 w-1 bg-primary shadow-glow-primary"
            initial={false}
          />
        )}
        <span className={cn("relative z-10 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary")}>
          {icon}
        </span>
        <span className="relative z-10">{label}</span>
      </a>
    );
  };

  const renderNavLinks = () => {
    if (user.role === UserRole.PATIENT) {
      return (
        <div className="space-y-2">
          <NavLink to="#top" label="Neural Matrix" onClick={(e) => handleScroll(e, 'top')} icon={<LayoutDashboard size={20} />} />
          <NavLink to="#history" label="Vitals Stream" onClick={(e) => handleScroll(e, 'history')} icon={<Activity size={20} />} />
          <NavLink to="#documents" label="Health Vault" onClick={(e) => handleScroll(e, 'documents')} icon={<FileText size={20} />} />
        </div>
      );
    }

    if (user.role === UserRole.DOCTOR) {
      return (
        <div className="space-y-2">
          <NavLink to="#dashboard" label="Clinical Hub" onClick={(e) => handleScroll(e, '#dashboard')} icon={<LayoutDashboard size={20} />} />
          <NavLink to="#patients" label="Subject Registry" onClick={(e) => handleScroll(e, '#patients')} icon={<Users size={20} />} />
          <NavLink to="#schedule" label="Cycle Planner" onClick={(e) => handleScroll(e, '#schedule')} icon={<Calendar size={20} />} />
          <NavLink to="#analytics" label="Neural Intel" onClick={(e) => handleScroll(e, '#analytics')} icon={<BarChart3 size={20} />} />
          <NavLink to="#settings" label="Kernel Config" onClick={(e) => handleScroll(e, '#settings')} icon={<Settings size={20} />} />
        </div>
      );
    }

    if (user.role === UserRole.ADMIN) {
      const adminItems = [
        { to: '#overview', label: 'Command Hub', icon: <LayoutDashboard size={20} /> },
        { to: '#users', label: 'Node Registry', icon: <Users size={20} /> },
        { to: '#verification', label: 'Auth Protocols', icon: <Lock size={20} /> },
        { to: '#records', label: 'Datalake Vault', icon: <FileText size={20} /> },
        { to: '#analytics', label: 'Global Telemetry', icon: <BarChart3 size={20} /> },
        { to: '#safety', label: 'System Alert', icon: <ShieldAlert size={20} /> },
        { to: '#settings', label: 'Core Kernel', icon: <Settings size={20} /> },
      ];
      return (
        <div className="space-y-2">
          {adminItems.map((item) => (
            <NavLink key={item.to} to={item.to} label={item.label} onClick={(e) => handleScroll(e, item.to)} icon={item.icon} />
          ))}
        </div>
      );
    }
  };

  const roleColor = user.role === UserRole.DOCTOR
    ? 'var(--secondary)'
    : user.role === UserRole.ADMIN
      ? 'var(--accent)'
      : 'var(--primary)';

  return (
    <div className={cn(
        "min-h-screen bg-background flex flex-col md:flex-row font-sans text-foreground relative overflow-hidden transition-all duration-700",
        !isDark && "bg-slate-50 text-slate-900"
    )}>
      {/* Background Atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,242,255,0.05),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(112,0,255,0.05),transparent_40%)]" />
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
        <HoloBackdrop3D className="opacity-20" intensity={0.3} />
      </div>

      {/* Sidebar */}
      <nav className={cn(
        "fixed md:relative z-[100] flex flex-col h-screen transition-all duration-700 glass border-r border-white/5",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        "w-80 shadow-2xl backdrop-blur-3xl"
      )}>
        {/* Sidebar Header */}
        <div className="p-8">
          <div className="flex items-center gap-4 mb-12">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-background shadow-glow-primary">
              <Terminal size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black font-display tracking-tighter text-white uppercase leading-none">
                CareX<span className="text-primary italic">AI</span>
              </h2>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]" />
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Neural Engine v2.8</span>
              </div>
            </div>
          </div>

          {/* User Profile Area */}
          <div className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl group hover:border-primary/20 transition-all">
            <div className="flex items-center gap-4">
                <div className="relative w-14 h-14">
                    <div className="absolute inset-0 rounded-2xl animate-spin-slow opacity-20" style={{ border: `2px solid ${roleColor}` }} />
                    <div className="absolute inset-1 flex items-center justify-center rounded-2xl bg-background border border-white/10 overflow-hidden shadow-2xl">
                        {user.profilePicUrl ? (
                            <img src={user.profilePicUrl} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-xl font-black" style={{ color: roleColor }}>{user.name.charAt(0)}</span>
                        )}
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-white truncate uppercase tracking-tight">{user.name}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest mt-1" style={{ color: roleColor }}>{user.role} Node</p>
                </div>
                {user.role === UserRole.DOCTOR && <NotificationCenter doctorId={user.id} />}
            </div>
          </div>
        </div>

        {/* Navigation Stream */}
        <div className="px-4 py-2 flex-1 overflow-y-auto custom-scrollbar">
          <div className="px-5 py-6 text-[9px] font-black uppercase tracking-[0.5em] text-muted-foreground/40">
            Operational Matrix
          </div>
          {renderNavLinks()}
        </div>

        {/* Global Control Bar */}
        <div className="p-8 space-y-4 border-t border-white/5">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-primary/20 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className={cn(
                  "p-2 rounded-xl transition-all",
                  isDark ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-500"
              )}>
                {isDark ? <Moon size={16} /> : <Sun size={16} />}
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-white">
                {isDark ? 'Midnight Cyber' : 'Clinical Light'}
              </span>
            </div>
            <div className={cn(
                "w-10 h-5 rounded-full relative transition-all duration-500",
                isDark ? "bg-primary/40" : "bg-slate-300"
            )}>
              <div className={cn(
                  "absolute top-1 w-3 h-3 rounded-full bg-white shadow-lg transition-transform duration-500",
                  isDark ? "translate-x-6" : "translate-x-1"
              )} />
            </div>
          </button>

          <button
            onClick={onLogout}
            className="w-full flex items-center gap-4 p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all border border-transparent hover:border-rose-500/20"
          >
            <LogOut size={16} />
            Initialize Logout
          </button>
        </div>
      </nav>

      {/* Mobile Stream Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-24 flex items-center justify-between px-8 z-[150] glass border-b border-white/5 backdrop-blur-3xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-background shadow-glow-primary">
            <Terminal size={20} />
          </div>
          <span className="text-xl font-black text-white uppercase font-display tracking-tight">CareX<span className="text-primary italic">AI</span></span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-4 rounded-2xl bg-white/5 border border-white/10 text-white"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Application Matrix */}
      <main
        className="flex-1 overflow-x-hidden overflow-y-auto scroll-smooth p-6 md:p-12 pt-32 md:pt-12 z-10"
        ref={mainRef}
      >
        <div className="max-w-7xl mx-auto min-h-full">
            <AnimatePresence mode="wait">
                <motion.div
                    key={user.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.5 }}
                >
                    {children}
                </motion.div>
            </AnimatePresence>
        </div>
      </main>
    </div>
  );
};
