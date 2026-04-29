import { Brain, TrendingUp, AlertCircle, Lightbulb, FileText, Upload, Loader2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/carex/AppLayout";
import { GlassCard } from "@/components/carex/GlassCard";
import { NeonButton } from "@/components/carex/NeonButton";
import { RiskBadge } from "@/components/carex/RiskBadge";
import { useHealth } from "@/services/HealthContext";
import { MLRiskAssessor } from "@/components/carex/MLRiskAssessor";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { HealthMetrics, AIAnalysisResult } from "@/types";

const Insights = () => {
  const { vitals, alerts } = useHealth();
  const [localMetrics, setLocalMetrics] = useState<HealthMetrics>(
    vitals[vitals.length - 1] || {
      systolicBP: 120,
      diastolicBP: 80,
      glucose: 100,
      bmi: 22,
      cholesterol: 180,
      smoking: false,
      activityLevel: 'Moderate',
      timestamp: new Date().toISOString()
    }
  );
  const [predictionResult, setPredictionResult] = useState<AIAnalysisResult | null>(null);

  useEffect(() => {
    if (vitals.length > 0 && !predictionResult) {
      setLocalMetrics(vitals[vitals.length - 1]);
    }
  }, [vitals, predictionResult]);

  return (
    <AppLayout title="AI Predictive Insights" subtitle="Neural risk assessment generated via machine learning">
      <div className="space-y-8">
        {/* ML Risk Assessor Section */}
        <MLRiskAssessor 
          metrics={localMetrics}
          onUpdateMetrics={setLocalMetrics}
          onAnalyzeComplete={setPredictionResult}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-2">
              <Sparkles className="h-3 w-3 text-primary" />
              Recent Observations
            </h3>
            {alerts.length > 0 ? alerts.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <GlassCard className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-gradient-aurora flex items-center justify-center shadow-glow shrink-0">
                      <AlertCircle className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="font-display text-lg font-semibold">
                          {a.severity === 'CRITICAL' || a.severity === 'HIGH' ? 'Critical Risk Factor' : 'Health Observation'}
                        </h3>
                        <RiskBadge level={a.severity.toLowerCase() as any} />
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{a.message}</p>
                      
                      <div className="mt-4 flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Detected:</span>
                        <span className="text-[10px] font-mono">{new Date(a.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            )) : (
              <GlassCard className="p-12 text-center text-muted-foreground border-dashed">
                <Info className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No recent AI observations detected.</p>
              </GlassCard>
            )}
          </div>

          <div className="space-y-6">
            <GlassCard className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="h-5 w-5 text-primary" />
                <h3 className="font-display font-semibold">AI Wellness Score</h3>
              </div>
              <div className="relative w-40 h-40 mx-auto my-6">
                <svg className="w-full h-full -rotate-90">
                  <circle cx="80" cy="80" r="70" stroke="hsl(var(--muted))" strokeWidth="10" fill="none" />
                  <motion.circle
                    cx="80" cy="80" r="70" stroke="hsl(var(--primary))" strokeWidth="10" fill="none"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 70}
                    initial={{ strokeDashoffset: 2 * Math.PI * 70 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 70 * (1 - 0.94) }}
                    transition={{ duration: 1.4, ease: "easeOut" }}
                    style={{ filter: "drop-shadow(0 0 8px hsl(var(--primary)))" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-4xl font-bold text-gradient">94</span>
                  <span className="text-xs text-muted-foreground">/ 100</span>
                </div>
              </div>
              <p className="text-sm text-center text-muted-foreground">Excellent overall — top 8% of your demographic.</p>
            </GlassCard>

            <GlassCard className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-success" />
                <h3 className="font-display font-semibold">Recovery Trend</h3>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Sleep-adjusted recovery</span>
                  <span className="text-success font-bold">+12%</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-success w-[78%] shadow-glow-success" />
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Your cardiovascular recovery rate has improved significantly this week. AI suggests maintained workout intensity.
                </p>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

const Info = (props: any) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
);

export default Insights;
