import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Bell, CheckCircle2, Info, X, ExternalLink } from "lucide-react";
import { AppLayout } from "@/components/carex/AppLayout";
import { GlassCard } from "@/components/carex/GlassCard";
import { NeonButton } from "@/components/carex/NeonButton";
import { useHealth } from "@/services/HealthContext";
import { AlertStatus, AlertSeverity } from "@/types";
import { toast } from "sonner";

const config = {
  CRITICAL: { ring: "border-destructive/40", bg: "bg-destructive/10", icon: "text-destructive", glow: "shadow-glow-destructive" },
  HIGH: { ring: "border-warning/40", bg: "bg-warning/10", icon: "text-warning", glow: "" },
  MEDIUM: { ring: "border-primary/30", bg: "bg-primary/10", icon: "text-primary", glow: "" },
  LOW: { ring: "border-success/40", bg: "bg-success/10", icon: "text-success", glow: "" },
};

const Alerts = () => {
  const { alerts, updateAlertStatus, clearAlerts, user } = useHealth();
  
  // Only show active alerts
  const activeAlerts = alerts.filter(a => a.status === AlertStatus.NEW || a.status === AlertStatus.ACKNOWLEDGED);

  const handleDismiss = (id: string) => {
    updateAlertStatus(id, AlertStatus.DISMISSED);
    toast.info("Alert dismissed across dashboards.");
  };

  const handleMarkAllRead = () => {
    activeAlerts.forEach(a => updateAlertStatus(a.id, AlertStatus.ACKNOWLEDGED));
    toast.success("All alerts marked as read.");
  };

  return (
    <AppLayout title="Neural Alert Center" subtitle="Real-time clinical event synchronization">
      <div className="flex items-center gap-2 mb-6">
        <div className="flex bg-muted/30 p-1 rounded-full border border-border/50">
          {["All", "Critical", "Warnings"].map((tab, i) => (
            <button
              key={tab}
              className={`rounded-full px-5 py-1.5 text-xs font-bold transition-all ${
                i === 0 ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <NeonButton 
          variant="ghost" 
          size="sm" 
          className="ml-auto text-xs font-bold" 
          onClick={handleMarkAllRead}
          disabled={activeAlerts.length === 0}
        >
          Mark all read
        </NeonButton>
      </div>

      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {activeAlerts.length > 0 ? (
            activeAlerts.map((a, i) => {
              const c = config[a.severity as keyof typeof config] || config.MEDIUM;
              const Icon = a.severity === 'CRITICAL' ? AlertTriangle : Bell;
              
              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  layout
                >
                  <GlassCard className={`p-5 border-l-4 ${c.ring}`}>
                    <div className="flex items-start gap-4">
                      <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${c.bg} ${c.glow} shrink-0`}>
                        <Icon className={`h-6 w-6 ${c.icon}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-lg">{a.type}</h3>
                            {a.status === AlertStatus.NEW && (
                              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground font-mono bg-muted/50 px-2 py-1 rounded">
                            {new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                          {user?.role === 'DOCTOR' && a.patient?.name && (
                            <span className="font-bold text-foreground">Patient {a.patient.name}: </span>
                          )}
                          {a.message}
                        </p>
                        <div className="flex gap-3 mt-4">
                          <NeonButton size="sm" variant="neon" className="h-9 px-4">
                            <ExternalLink className="h-3.5 w-3.5 mr-2" /> View Analysis
                          </NeonButton>
                          <NeonButton 
                            size="sm" 
                            variant="ghost" 
                            className="h-9 px-4 border-border hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleDismiss(a.id)}
                          >
                            Dismiss
                          </NeonButton>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDismiss(a.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20 glass rounded-3xl border-dashed border-2 border-border/50"
            >
              <CheckCircle2 className="h-16 w-16 text-success/20 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-muted-foreground">Neural Sky is Clear</h3>
              <p className="text-sm text-muted-foreground mt-1">No active health alerts detected in this cycle.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
};

export default Alerts;

