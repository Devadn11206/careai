import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHealth } from '@/services/HealthContext';
import { Button } from '@/components/ui/Button';
import { Bell, Video, Calendar, X } from 'lucide-react';

export const ReminderPopup: React.FC = () => {
  const { activeReminder, dismissReminder } = useHealth();

  return (
    <AnimatePresence>
      {activeReminder && (
        <motion.div
          initial={{ opacity: 0, y: 100, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.9 }}
          className="fixed bottom-8 left-8 z-[200] w-[380px] glass-card border-neon-400/30 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden"
        >
          {/* Animated Background Pulse */}
          <motion.div 
            animate={{ opacity: [0.05, 0.15, 0.05] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute inset-0 bg-neon-400 pointer-events-none"
          />
          
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-2xl bg-neon-400/10 flex items-center justify-center text-neon-400 shadow-[0_0_20px_rgba(0,212,255,0.2)]">
                <Bell size={24} className="animate-bounce" />
              </div>
              <button 
                onClick={dismissReminder}
                className="p-2 hover:bg-white/5 rounded-xl text-slate-500 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 mb-6">
              <h3 className="text-xl font-black text-white font-orbitron tracking-tight uppercase">
                {activeReminder.title}
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                {activeReminder.message}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Start Time</p>
                <div className="flex items-center gap-2 text-white">
                  <Calendar size={12} className="text-neon-400" />
                  <span className="text-xs font-bold">{activeReminder.startTime}</span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Session Type</p>
                <div className="flex items-center gap-2 text-white">
                  <Video size={12} className="text-bio-400" />
                  <span className="text-xs font-bold">{activeReminder.type}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button 
                variant="neon" 
                className="flex-1 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest"
                onClick={dismissReminder}
              >
                Acknowledge
              </Button>
            </div>
          </div>

          {/* Glowing Border Animation */}
          <motion.div
            animate={{
              left: ['-100%', '100%'],
            }}
            transition={{
              repeat: Infinity,
              duration: 3,
              ease: "linear"
            }}
            className="absolute top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-neon-400 to-transparent"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
