import React, { lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HealthMetrics, UserRole } from '../types';
import {
  Activity,
  TrendingUp,
  Calendar,
  ShieldAlert,
  ArrowRight,
  Heart,
  Droplets,
  Thermometer,
  Sparkles,
  Zap,
  Lock,
  Search,
  Navigation,
  Clock,
  ChevronRight,
  Bell
} from 'lucide-react';
import { useHealth } from '@/services/HealthContext';
import { Link } from 'react-router-dom';
import { GlassCard } from '../components/carex/GlassCard';
import { NeonButton } from '../components/carex/NeonButton';
import { AIWellnessRing } from '../components/carex/AIWellnessRing';
import { AutomationAssistant } from '../components/features/AutomationAssistant';
import { CareMap } from '../components/carex/CareMap';
import { BookingModal } from '../components/features/BookingModal';
import { cn } from '@/lib/utils';

const LazyVideoCall = lazy(() => import('../components/features/VideoCall').then((module) => ({ default: module.VideoCall })));

export const PatientDashboard: React.FC = () => {
  const { user, vitals, alerts, appointments } = useHealth();
  const [activeCall, setActiveCall] = React.useState<any>(null);
  const [isBookingOpen, setIsBookingOpen] = React.useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = React.useState(false);

  const latestVital = (vitals[vitals.length - 1] || {}) as HealthMetrics;

  return (
    <div className="min-h-screen pb-20 space-y-10">
      {/* Cinematic Hero Header */}
      <section className="relative h-[400px] rounded-[48px] overflow-hidden group">
        {/* Animated Background Layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-secondary/20" />
        <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
        <motion.div
          animate={{ scale: [1, 1.1, 1], rotate: [0, 5, 0] }}
          transition={{ duration: 20, repeat: Infinity }}
          className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px]"
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], rotate: [0, -5, 0] }}
          transition={{ duration: 15, repeat: Infinity }}
          className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[100px]"
        />

        {/* Content Overlay */}
        <div className="relative z-10 h-full flex flex-col justify-center px-12 md:px-20">
          <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }}>
            <div className="flex items-center gap-4 mb-6">
              <div className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md flex items-center gap-3">
                <div className="status-pulse"><span></span><span></span></div>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400">CareXAI Nexus Online</span>
              </div>
              <div className="h-px w-24 bg-gradient-to-r from-cyan-400/50 to-transparent" />
            </div>

            <h1 className="text-5xl md:text-8xl font-black tracking-tighter mb-6 leading-none">
              Welcome back,<br />
              <span className="hologram-text">{user?.name?.split(' ')[0]}</span>
            </h1>

            <p className="text-muted-foreground text-lg md:text-xl max-w-2xl font-medium leading-relaxed mb-10">
              Your autonomous health engine is processing live telemetry.
              <span className="text-white"> Everything looks optimal.</span>
            </p>

            <div className="flex flex-wrap gap-4">
              <NeonButton size="lg" onClick={() => setIsBookingOpen(true)}>
                <Calendar size={18} /> Book Procedure
              </NeonButton>
              <NeonButton variant="ghost" size="lg">
                <ShieldAlert size={18} /> Emergency Protocol
              </NeonButton>
            </div>
          </motion.div>
        </div>

        {/* Floating Telemetry Stats */}
        <div className="absolute top-12 right-12 hidden xl:flex gap-8">
          <AIWellnessRing value={88} label="Stability" color="var(--primary)" />
          <AIWellnessRing value={94} label="Cognitive" color="var(--secondary)" />
          <AIWellnessRing value={72} label="Endurance" color="var(--accent)" />
        </div>
      </section>

      {/* Global Medical Navigation - Centerpiece */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="w-full"
      >
        <GlassCard className="p-0 overflow-hidden border-primary/20 shadow-glow-primary/5">
          <div className="p-8 flex items-center justify-between border-b border-white/5">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                <Navigation size={24} />
              </div>
              <div>
                <h2 className="text-3xl font-black tracking-tighter uppercase">Intelligence Map <span className="text-primary italic">Command</span></h2>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em]">Autonomous Clinical Node Tracking</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="hidden md:flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Neural Sync: 14ms</span>
              </div>
              <NeonButton size="sm" variant="ghost">Expand Command Center</NeonButton>
            </div>
          </div>
          <CareMap className="h-[700px] border-none grayscale-[0.2] hover:grayscale-0 transition-all duration-1000" />
        </GlassCard>
      </motion.section>

      {/* Realtime Intelligence Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

        {/* Core Vitals Control Panel */}
        <div className="lg:col-span-3 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: 'Heart Rate', value: latestVital.heartRate || '72', unit: 'BPM', icon: Heart, color: 'text-rose-500', trend: '+2%' },
              { label: 'Oxygen Sat', value: '98', unit: '%', icon: Activity, color: 'text-cyan-400', trend: 'Stable' },
              { label: 'Temp', value: latestVital.temperature || '36.6', unit: '°C', icon: Thermometer, color: 'text-amber-400', trend: '-0.1' },
            ].map((stat, i) => (
              <GlassCard key={i} delay={i * 0.1} className="p-0 overflow-hidden">
                <div className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-5">
                    <div className={cn("h-14 w-14 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5", stat.color)}>
                      <stat.icon size={28} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{stat.label}</p>
                      <h3 className="text-3xl font-black font-mono tracking-tighter">{stat.value}<span className="text-xs font-medium ml-1 opacity-40">{stat.unit}</span></h3>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <TrendingUp size={14} className="text-success mb-1" />
                    <span className="text-[10px] font-bold text-success font-mono">{stat.trend}</span>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-white/5 relative">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '70%' }}
                    className={cn("h-full absolute top-0 left-0", stat.color.replace('text', 'bg'))}
                  />
                </div>
              </GlassCard>
            ))}
          </div>

          {/* AI Intelligence Stream */}
          <GlassCard className="p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary animate-pulse shadow-glow-primary">
                  <Sparkles size={20} />
                </div>
                <h2 className="text-2xl font-bold tracking-tight uppercase tracking-tighter">Nexus Intelligence Insight</h2>
              </div>
              <NeonButton variant="ghost" size="sm">Download Audit</NeonButton>
            </div>

            <div className="relative p-8 rounded-[32px] bg-white/5 border border-white/10 overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[50px] -mr-16 -mt-16" />
              <p className="text-xl leading-relaxed text-slate-200 relative z-10 font-medium">
                "Autonomous analysis complete. Your cardiovascular recovery index is <span className="text-primary font-black">optimal</span>. Predicted wellness score for Q3: <span className="text-accent font-black">94/100</span>. Suggesting vitamin D synchronization based on local uv telemetry."
              </p>
              <div className="flex gap-4 mt-8">
                <div className="flex items-center gap-2 px-5 py-2 rounded-full bg-success/10 border border-success/30">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-glow-success" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-success">Low Risk Profile</span>
                </div>
                <div className="flex items-center gap-2 px-5 py-2 rounded-full bg-primary/10 border border-primary/30">
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse shadow-glow-primary" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary">Live Optimization Active</span>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Unified Clinical Sidebar */}
        <div className="space-y-8">
          {/* Active Status Card */}
          <GlassCard className="bg-gradient-to-br from-primary/10 to-transparent border-primary/30">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center text-black shadow-glow-primary">
                <Lock size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Secure Vault</p>
                <h3 className="text-xl font-bold">Health Passport</h3>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
              Your medical credentials and clinical history are encrypted and ready for global interoperability.
            </p>
            <NeonButton className="w-full">Access Records</NeonButton>
          </GlassCard>

          {/* Upcoming Intelligence Panels */}
          <GlassCard className="pb-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
                <Calendar size={18} className="text-secondary" /> Schedule
              </h3>
              <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-muted-foreground hover:text-white cursor-pointer transition-colors">
                <ChevronRight size={14} />
              </div>
            </div>

            <div className="space-y-4">
              {appointments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-30">
                  <Zap size={32} className="mb-2" />
                  <p className="text-[10px] font-black uppercase tracking-widest">No active nodes</p>
                </div>
              ) : (
                appointments.slice(0, 3).map((appt, i) => (
                  <div key={i} className="group p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-secondary/40 hover:bg-secondary/5 transition-all cursor-pointer">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-sm font-bold group-hover:text-secondary transition-colors">{appt.doctorName}</h4>
                      <div className="px-2 py-0.5 rounded-md bg-white/5 text-[8px] font-black uppercase tracking-widest">{appt.date}</div>
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-tighter mb-3">{appt.type} · {appt.time}</p>
                    {appt.consultationType === 'VIDEO' && (
                      <NeonButton size="sm" variant="secondary" className="w-full" onClick={() => setActiveCall(appt)}>Join Session</NeonButton>
                    )}
                  </div>
                ))
              )}
            </div>
          </GlassCard>

          {/* Neural Feed */}
          <GlassCard>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Bell size={18} className="text-accent" /> Neural Feed
              </h3>
            </div>
            <div className="space-y-4">
              {[
                { msg: "Bloodwork analysis synchronized", time: "1h ago" },
                { msg: "Tele-imaging verified by Dr. Deva", time: "3h ago" },
              ].map((item, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="h-2 w-2 rounded-full bg-accent mt-1.5 shadow-glow-success" />
                  <div>
                    <p className="text-xs font-medium">{item.msg}</p>
                    <p className="text-[9px] text-muted-foreground font-mono">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Floating Agent Hub */}
      <div className="fixed bottom-8 right-8 z-[100]">
        <motion.button
          whileHover={{ scale: 1.1, rotate: 5 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsAssistantOpen(true)}
          className="h-20 w-20 rounded-[2.5rem] bg-primary flex items-center justify-center text-black shadow-glow-primary relative group overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <Sparkles size={32} />
          <div className="absolute -inset-2 bg-primary/20 rounded-full animate-ping opacity-20" />
        </motion.button>
      </div>

      {/* Overlays */}
      <BookingModal isOpen={isBookingOpen} onClose={() => setIsBookingOpen(false)} />
      <AutomationAssistant isOpen={isAssistantOpen} onClose={() => setIsAssistantOpen(false)} />

      <AnimatePresence>
        {activeCall && (
          <Suspense fallback={<div className="fixed inset-0 z-[200] bg-black flex items-center justify-center text-primary font-mono uppercase tracking-[0.5em]">Linking Neural Stream...</div>}>
            <LazyVideoCall
              appointmentId={activeCall.id}
              otherUserName={activeCall.doctorName}
              currentUserRole={UserRole.PATIENT}
              onClose={() => setActiveCall(null)}
            />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  );
};
