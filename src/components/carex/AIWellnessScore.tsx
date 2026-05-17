import React from 'react';
import { motion } from 'framer-motion';
import { Shield, TrendingDown, TrendingUp, Activity, Heart, Droplets } from 'lucide-react';
import { HealthMetrics, AIAnalysisResult, AiInsight } from '@/types';
import { HealthRiskEngine, WellnessScoreResult } from '@/services/HealthRiskEngine';
import { GlassCard } from './GlassCard';
import { cn } from '@/lib/utils';

interface Props {
  metrics: HealthMetrics;
  aiResult: AIAnalysisResult | null;
  persistedInsight?: AiInsight | null;
}

export const AIWellnessScore: React.FC<Props> = ({ metrics, aiResult, persistedInsight }) => {
  const result = HealthRiskEngine.calculateWellnessScore(metrics, aiResult, persistedInsight);
  
  if (typeof result === 'string') {
    return (
      <GlassCard className="p-8 text-center flex flex-col items-center justify-center min-h-[320px] border-dashed border-border/50 bg-card/20 shadow-inner group">
        <div className="w-16 h-16 rounded-2xl bg-card border border-border/50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 shadow-glow-primary/5">
          <Activity className="h-8 w-8 text-muted-foreground/30 group-hover:text-primary transition-colors" />
        </div>
        <h3 className="font-display font-bold text-xl text-foreground mb-2">Insufficient Data</h3>
        <p className="text-sm text-muted-foreground/80 max-w-[240px] mx-auto leading-relaxed">
          Generate ML risk predictions to view your real-time wellness score.
        </p>
      </GlassCard>
    );
  }

  const { wellness_score, status, risk_breakdown } = result;

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'Excellent': return 'text-success border-success/20 bg-success/10';
      case 'Good': return 'text-primary border-primary/20 bg-primary/10';
      case 'Moderate': return 'text-warning border-warning/20 bg-warning/10';
      default: return 'text-destructive border-destructive/20 bg-destructive/10';
    }
  };

  const getGaugeColor = (score: number) => {
    if (score >= 85) return '#10b981'; // Emerald
    if (score >= 70) return '#6366f1'; // Indigo (Primary)
    if (score >= 50) return '#f59e0b'; // Amber
    return '#ef4444'; // Red
  };

  return (
    <GlassCard className="p-6 relative overflow-hidden group">
      {/* Background Pulse */}
      <div className={cn(
        "absolute -right-20 -top-20 w-64 h-64 rounded-full blur-[100px] opacity-10 transition-colors duration-1000",
        wellness_score >= 85 ? "bg-success" : wellness_score >= 70 ? "bg-primary" : "bg-warning"
      )} />

      <div className="flex flex-col items-center relative z-10">
        <div className="flex items-center gap-2 mb-6 self-start">
          <Shield className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Real-time Wellness Score</h3>
        </div>

        {/* Circular Gauge */}
        <div className="relative w-48 h-48 flex items-center justify-center mb-6">
          <svg className="w-full h-full -rotate-90">
            <circle
              cx="96"
              cy="96"
              r="80"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              className="text-muted/20"
            />
            <motion.circle
              cx="96"
              cy="96"
              r="80"
              stroke={getGaugeColor(wellness_score)}
              strokeWidth="10"
              fill="transparent"
              strokeDasharray={2 * Math.PI * 80}
              initial={{ strokeDashoffset: 2 * Math.PI * 80 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 80 * (1 - wellness_score / 100) }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              strokeLinecap="round"
              className="filter drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span 
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-5xl font-display font-black"
            >
              {wellness_score}
            </motion.span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-1">Score</span>
          </div>
        </div>

        {/* Status Label */}
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={cn(
            "px-6 py-2 rounded-full border text-sm font-bold uppercase tracking-widest shadow-sm mb-8",
            getStatusColor(status)
          )}
        >
          {status}
        </motion.div>

        {/* Risk Breakdown */}
        <div className="w-full space-y-4">
          <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 px-1">
            <span>Clinical Risk Breakdown</span>
            <Activity className="h-3 w-3" />
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            {[
              { label: 'Diabetes', value: risk_breakdown.diabetes, icon: Droplets, color: 'text-sky-400' },
              { label: 'Hypertension', value: risk_breakdown.hypertension, icon: Activity, color: 'text-rose-400' },
              { label: 'Heart Disease', value: risk_breakdown.heart, icon: Heart, color: 'text-primary' },
            ].map((risk) => (
              <div key={risk.label} className="bg-muted/30 border border-border/50 rounded-xl p-3 flex items-center justify-between group/item hover:border-primary/30 transition-all">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg bg-background/50 border border-border shadow-inner", risk.color)}>
                    <risk.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold">{risk.label}</p>
                    <p className="text-[10px] text-muted-foreground">Probability Prediction</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-display font-bold">{risk.value}%</span>
                  <div className="flex items-center gap-1 justify-end">
                    {risk.value > 50 ? <TrendingUp className="h-3 w-3 text-destructive" /> : <TrendingDown className="h-3 w-3 text-success" />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Insight */}
        <div className="mt-8 pt-6 border-t border-border/50 w-full">
          <p className="text-[10px] leading-relaxed text-muted-foreground text-center italic">
            "Your Wellness Score is dynamically calculated using weighted risk probabilities and real-time biometric telemetry. Stay active to improve your score."
          </p>
        </div>
      </div>
    </GlassCard>
  );
};
