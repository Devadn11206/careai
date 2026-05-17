import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AIInsight {
  id: string;
  type: 'DIAGNOSIS' | 'SAFETY' | 'RECOMMENDATION' | 'RISK';
  title: string;
  content: string;
  confidence: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface AICopilotPanelProps {
  insights: AIInsight[];
  isAnalyzing: boolean;
  onAction: (id: string, action: string) => void;
}

export const AICopilotPanel: React.FC<AICopilotPanelProps> = ({ insights, isAnalyzing, onAction }) => {
  return (
    <div className="bg-space-950/80 border border-white/5 rounded-[32px] p-6 glass-card h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-neon-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-neon-400 animate-pulse"></span>
            AI Clinical Copilot
          </h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Real-time reasoning active</p>
        </div>
        {isAnalyzing && (
          <div className="flex gap-1">
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                animate={{ height: [4, 12, 4] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
                className="w-1 bg-neon-400 rounded-full"
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
        <AnimatePresence mode="popLayout">
          {insights.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-30 p-8">
              <span className="text-4xl mb-4">🧠</span>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Waiting for clinical data to initiate analysis...</p>
            </div>
          ) : (
            insights.map((insight) => (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`p-4 rounded-[24px] border ${
                  insight.priority === 'CRITICAL' ? 'bg-red-500/10 border-red-500/20' :
                  insight.priority === 'HIGH' ? 'bg-amber-500/10 border-amber-500/20' :
                  'bg-white/5 border-white/10'
                } relative group overflow-hidden`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${
                    insight.type === 'SAFETY' ? 'bg-red-500/20 text-red-400' :
                    insight.type === 'DIAGNOSIS' ? 'bg-neon-500/20 text-neon-400' :
                    'bg-white/10 text-slate-400'
                  }`}>
                    {insight.type}
                  </span>
                  <span className="text-[9px] font-bold text-slate-500">{(insight.confidence * 100).toFixed(0)}% Conf.</span>
                </div>
                
                <h4 className="text-sm font-bold text-white font-['Space_Grotesk'] mb-2">{insight.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">{insight.content}</p>

                <div className="flex gap-2">
                  <button 
                    onClick={() => onAction(insight.id, 'ACCEPT')}
                    className="flex-1 h-9 rounded-xl bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-white hover:bg-neon-400 hover:text-black hover:border-neon-400 transition-all"
                  >
                    Accept
                  </button>
                  <button 
                    onClick={() => onAction(insight.id, 'DISMISS')}
                    className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-red-400 transition-all"
                  >
                    ✕
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      <div className="mt-6 pt-4 border-t border-white/5">
        <div className="p-3 rounded-2xl bg-blue-500/5 border border-blue-500/10">
          <p className="text-[9px] text-blue-400 font-bold uppercase tracking-widest leading-relaxed">
            AI Insights are suggestive and based on available data. Final clinical decisions must be made by a qualified healthcare professional.
          </p>
        </div>
      </div>
    </div>
  );
};
