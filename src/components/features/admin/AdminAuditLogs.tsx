import React, { useEffect, useState } from 'react';
import { BackendAPI } from '@/services/apiClient';
import { GlassCard } from '@/components/carex/GlassCard';
import { format } from 'date-fns';
import { Terminal, Shield, User, Activity, Search } from 'lucide-react';
import { motion } from 'framer-motion';

export const AdminAuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await BackendAPI.getAdminLogs();
        setLogs(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(l => 
    l.action.toLowerCase().includes(filter.toLowerCase()) || 
    l.details?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <GlassCard className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-xl font-display font-bold flex items-center gap-2">
            <Terminal size={20} className="text-primary" /> System Audit Chain
          </h2>
          <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest font-black">Immutable immutable event log</p>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
          <input 
            type="text" 
            placeholder="Filter operations..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-xs focus:border-primary/50 outline-none transition-all"
          />
        </div>
      </div>

      <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-widest">Accessing Ledger...</p>
          </div>
        ) : filteredLogs.map((log, i) => (
          <motion.div
            key={log.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/[0.08] transition-all group"
          >
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center border shadow-inner ${
              log.action === 'APPROVAL' ? 'bg-success/10 border-success/20 text-success' :
              log.action === 'LOGIN' ? 'bg-primary/10 border-primary/20 text-primary' :
              'bg-muted/10 border-white/10 text-muted-foreground'
            }`}>
              {log.action === 'APPROVAL' ? <Shield size={18} /> : 
               log.action === 'LOGIN' ? <User size={18} /> : <Activity size={18} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">{log.action}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{format(new Date(log.timestamp), 'MMM dd, HH:mm:ss')}</span>
              </div>
              <p className="text-sm font-medium mt-0.5 truncate group-hover:text-primary transition-colors">{log.details}</p>
              <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground font-mono">
                <span>ID: {log.id.slice(-8)}</span>
                <span className="h-1 w-1 rounded-full bg-white/10" />
                <span>USER: {log.userId?.slice(-8) || 'SYSTEM'}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </GlassCard>
  );
};
