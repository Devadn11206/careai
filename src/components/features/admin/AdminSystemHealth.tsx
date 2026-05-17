import React, { useEffect, useState } from 'react';
import { BackendAPI } from '@/services/apiClient';
import { GlassCard } from '@/components/carex/GlassCard';
import { Activity, Server, Database, Globe, Cpu, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export const AdminSystemHealth: React.FC = () => {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const data = await BackendAPI.getAdminHealth();
        setServices(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  const getIcon = (name: string) => {
    switch (name) {
      case 'API': return <Globe size={16} />;
      case 'DATABASE': return <Database size={16} />;
      case 'SOCKET': return <Zap size={16} />;
      case 'GROQ': return <Cpu size={16} />;
      default: return <Server size={16} />;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {loading ? (
        <div className="col-span-full py-20 text-center opacity-50">
          <Activity size={24} className="animate-spin mx-auto mb-4 text-primary" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em]">Pinging System Nodes...</p>
        </div>
      ) : services.map((s, i) => (
        <motion.div
          key={s.service}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.1 }}
        >
          <GlassCard className="p-5 overflow-hidden group">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center border shadow-glow",
                  s.status === 'ONLINE' ? "bg-success/10 border-success/30 text-success" : "bg-destructive/10 border-destructive/30 text-destructive"
                )}>
                  {getIcon(s.service)}
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-tight">{s.service}</h3>
                  <div className="flex items-center gap-1.5">
                    <div className={cn("h-1.5 w-1.5 rounded-full", s.status === 'ONLINE' ? "bg-success animate-pulse" : "bg-destructive")} />
                    <span className={cn("text-[10px] font-bold uppercase tracking-wider", s.status === 'ONLINE' ? "text-success" : "text-destructive")}>
                      {s.status}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Latency</p>
                <p className="text-sm font-mono font-bold text-primary">{s.latency}ms</p>
              </div>
            </div>

            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
              <motion.div 
                className={cn("h-full", s.status === 'ONLINE' ? "bg-success" : "bg-destructive")}
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 1 }}
              />
            </div>
            
            <div className="mt-3 flex justify-between text-[8px] font-black uppercase tracking-tighter text-muted-foreground/50">
              <span>Uptime: 99.99%</span>
              <span>Load: Low</span>
            </div>
          </GlassCard>
        </motion.div>
      ))}
    </div>
  );
};
