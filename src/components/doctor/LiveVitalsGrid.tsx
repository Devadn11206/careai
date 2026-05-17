import React from 'react';
import { motion } from 'framer-motion';

export interface VitalMetric {
  label: string;
  value: string | number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
  trend?: 'up' | 'down' | 'stable';
  icon: string;
}

interface LiveVitalsGridProps {
  vitals: VitalMetric[];
  patientName: string;
}

export const LiveVitalsGrid: React.FC<LiveVitalsGridProps> = ({ vitals, patientName }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {vitals.map((v, i) => (
        <motion.div
          key={v.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className={`relative p-5 rounded-[24px] border border-white/5 overflow-hidden group hover:scale-[1.02] transition-all ${
            v.status === 'critical' ? 'bg-red-500/10 border-red-500/30' :
            v.status === 'warning' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-space-950/50'
          }`}
        >
          {/* Animated Glow for Critical */}
          {v.status === 'critical' && (
            <div className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none" />
          )}

          <div className="flex justify-between items-start mb-3 relative z-10">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{v.label}</span>
            <span className="text-xl">{v.icon}</span>
          </div>

          <div className="flex items-baseline gap-1 relative z-10">
            <span className={`text-3xl font-black font-['Space_Grotesk'] tracking-tight ${
              v.status === 'critical' ? 'text-red-400' :
              v.status === 'warning' ? 'text-amber-400' : 'text-white'
            }`}>
              {v.value}
            </span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{v.unit}</span>
          </div>

          <div className="mt-4 flex items-center justify-between relative z-10">
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${
                v.status === 'critical' ? 'bg-red-500 animate-ping' :
                v.status === 'warning' ? 'bg-amber-500' : 'bg-green-500'
              }`} />
              <span className={`text-[9px] font-black uppercase tracking-widest ${
                v.status === 'critical' ? 'text-red-500' :
                v.status === 'warning' ? 'text-amber-500' : 'text-green-500'
              }`}>
                {v.status}
              </span>
            </div>
            {v.trend && (
              <span className={`text-[10px] ${v.trend === 'up' ? 'text-red-400' : v.trend === 'down' ? 'text-blue-400' : 'text-slate-500'}`}>
                {v.trend === 'up' ? '↑' : v.trend === 'down' ? '↓' : '→'}
              </span>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
};
