import React, { useState, useEffect } from 'react';
import { RiskAlert, AlertSeverity, AlertStatus } from '@/types';
import { MockBackend } from '@/services/mockBackend';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Bell, 
    ShieldAlert, 
    CheckCircle2, 
    Eye, 
    Clock, 
    ArrowRight,
    Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  doctorId: string;
}

export const NotificationCenter: React.FC<Props> = ({ doctorId }) => {
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchAlerts = async () => {
    const data = await MockBackend.getAlerts(doctorId);
    setAlerts(data);
    setUnreadCount(data.filter(a => a.status === AlertStatus.NEW).length);
  };

  useEffect(() => {
    fetchAlerts();
    const unsubscribe = MockBackend.subscribe(fetchAlerts);
    return () => unsubscribe();
  }, [doctorId]);

  const handleAcknowledge = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await MockBackend.updateAlertStatus(id, AlertStatus.ACKNOWLEDGED);
    fetchAlerts();
  };

  const handleResolve = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await MockBackend.updateAlertStatus(id, AlertStatus.RESOLVED);
    fetchAlerts();
  };

  const getSeverityStyle = (severity: AlertSeverity) => {
    switch (severity) {
      case AlertSeverity.CRITICAL: 
        return 'bg-rose-500/10 border-rose-500/20 text-rose-500 shadow-glow-rose-500/10';
      case AlertSeverity.HIGH: 
        return 'bg-amber-500/10 border-amber-500/20 text-amber-500 shadow-glow-amber-500/10';
      case AlertSeverity.MEDIUM: 
        return 'bg-primary/10 border-primary/20 text-primary shadow-glow-primary/10';
      default: 
        return 'bg-white/5 border-white/10 text-muted-foreground';
    }
  };

  return (
    <div className="relative">
      {/* Bell Icon */}
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className={cn(
            "relative p-3 rounded-xl border transition-all duration-300",
            isOpen ? "bg-primary text-background border-primary shadow-glow-primary" : "bg-white/5 border-white/10 text-muted-foreground hover:text-white hover:bg-white/10"
        )}
      >
        <Bell size={20} className={cn(unreadCount > 0 && "animate-pulse")} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-5 w-5 bg-rose-600 text-[10px] font-black text-white justify-center items-center shadow-lg">{unreadCount}</span>
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[190] bg-background/20 backdrop-blur-sm" 
                onClick={() => setIsOpen(false)} 
            />
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: 20, scale: 0.95, filter: 'blur(10px)' }}
              className="absolute right-0 mt-4 w-[400px] bg-[#060912]/95 rounded-[2rem] shadow-[0_40px_100px_rgba(0,0,0,0.8)] border border-white/10 z-[200] overflow-hidden backdrop-blur-3xl"
            >
              <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary via-secondary to-transparent" />
                <div className="flex items-center gap-3">
                    <Zap size={18} className="text-primary shadow-glow-primary" />
                    <h3 className="font-black text-sm uppercase tracking-widest text-white">Neural Alert Stream</h3>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-white/5 px-3 py-1 rounded-full border border-white/5">
                    {alerts.length} Active Nodes
                </span>
              </div>
              
              <div className="max-h-[500px] overflow-y-auto custom-scrollbar p-2">
                {alerts.length === 0 ? (
                   <div className="p-16 text-center space-y-4">
                      <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/5">
                        <CheckCircle2 size={32} className="text-emerald-500/20" />
                      </div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/40">Nexus Quiet Zone</p>
                   </div>
                ) : (
                  <div className="space-y-2">
                    {alerts.map(alert => (
                        <div 
                        key={alert.id} 
                        className={cn(
                            "group p-6 rounded-2xl border transition-all relative overflow-hidden",
                            alert.status === AlertStatus.NEW ? "bg-white/5 border-primary/20" : "bg-transparent border-white/5 opacity-60"
                        )}
                        >
                        {alert.status === AlertStatus.NEW && (
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary shadow-glow-primary" />
                        )}
                        
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xs font-black text-white">
                                    {alert.patientName.charAt(0)}
                                </div>
                                <span className="font-black text-white text-sm tracking-tight">{alert.patientName}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest">
                                <Clock size={10} />
                                {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                        
                        <div className={cn(
                            "inline-flex items-center gap-2 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] mb-4 border",
                            getSeverityStyle(alert.severity)
                        )}>
                            <ShieldAlert size={12} />
                            {alert.severity} RISK · VECTOR {alert.riskScore}
                        </div>
                        
                        <p className="text-xs text-slate-300 font-medium leading-relaxed mb-4">{alert.message}</p>
                        
                        <div className="flex flex-wrap gap-2 mb-6">
                            {alert.keyFactors.map((factor, i) => (
                            <span key={i} className="text-[9px] font-black bg-white/5 border border-white/5 px-2 py-1 rounded-md text-muted-foreground/60 uppercase tracking-widest">
                                {factor}
                            </span>
                            ))}
                        </div>

                        <div className="flex gap-2 justify-end">
                            {alert.status === AlertStatus.NEW ? (
                            <button 
                                onClick={(e) => handleAcknowledge(alert.id, e)} 
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-primary text-background hover:scale-105 transition-all shadow-glow-primary"
                            >
                                <Eye size={12} />
                                Acknowledge
                            </button>
                            ) : null}
                            <button 
                                onClick={(e) => handleResolve(alert.id, e)} 
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white/5 border border-white/10 text-emerald-400 hover:bg-emerald-400/10 hover:border-emerald-400/20 transition-all"
                            >
                                <CheckCircle2 size={12} />
                                Resolve
                            </button>
                        </div>
                        </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 bg-white/5 border-t border-white/5 text-center">
                 <button className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/30 hover:text-primary transition-colors flex items-center justify-center gap-2 mx-auto">
                    View Full Neural History
                    <ArrowRight size={10} />
                 </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};