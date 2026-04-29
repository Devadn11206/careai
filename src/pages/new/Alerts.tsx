import { motion } from "framer-motion";
import { AlertTriangle, Bell, CheckCircle2, Info, X } from "lucide-react";
import { AppLayout } from "@/components/carex/AppLayout";
import { GlassCard } from "@/components/carex/GlassCard";
import { NeonButton } from "@/components/carex/NeonButton";
import { useHealth } from "@/services/HealthContext";

const config = {
  critical: { ring: "border-destructive/40", bg: "bg-destructive/10", icon: "text-destructive", glow: "shadow-glow-destructive" },
  warning: { ring: "border-warning/40", bg: "bg-warning/10", icon: "text-warning", glow: "" },
  info: { ring: "border-primary/30", bg: "bg-primary/10", icon: "text-primary", glow: "" },
  success: { ring: "border-success/40", bg: "bg-success/10", icon: "text-success", glow: "shadow-glow-success" },
};

const Alerts = () => {
  const { alerts, clearAlerts } = useHealth();
  
  const displayAlerts = alerts.length > 0 ? alerts.map((a, i) => ({
    id: a.id,
    severity: a.severity === 'CRITICAL' || a.severity === 'HIGH' ? 'critical' : 'info',
    icon: a.severity === 'CRITICAL' || a.severity === 'HIGH' ? AlertTriangle : Bell,
    title: a.severity === 'CRITICAL' || a.severity === 'HIGH' ? 'Critical Risk Alert' : 'Health Update',
    desc: a.message,
    time: new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  })) : [
    { id: 1, severity: "info", icon: Info, title: "Medication reminder", desc: "Atorvastatin 20mg scheduled at 21:00.", time: "Yesterday" }
  ];

  return (
    <AppLayout title="Alerts & Notifications" subtitle="Prioritized by AI severity scoring">
      <div className="flex items-center gap-2 mb-6">
        {["All", "Critical", "Warnings", "Info"].map((tab, i) => (
          <button
            key={tab}
            className={`glass rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
              i === 0 ? "bg-gradient-primary text-primary-foreground shadow-glow border-0" : "hover:border-primary/40"
            }`}
          >
            {tab}
          </button>
        ))}
        <NeonButton variant="ghost" size="sm" className="ml-auto" onClick={clearAlerts}>Mark all read</NeonButton>
      </div>

      <div className="space-y-3">
        {displayAlerts.map((a, i) => {
          const c = config[a.severity as keyof typeof config];
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07 }}
            >
              <GlassCard className={`p-5 border ${c.ring}`}>
                <div className="flex items-start gap-4">
                  <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${c.bg} ${c.glow}`}>
                    <a.icon className={`h-5 w-5 ${c.icon}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h3 className="font-semibold">{a.title}</h3>
                      <span className="text-xs text-muted-foreground font-mono">{a.time}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{a.desc}</p>
                    <div className="flex gap-2 mt-3">
                      <NeonButton size="sm" variant="neon">View Details</NeonButton>
                      <NeonButton size="sm" variant="ghost">Dismiss</NeonButton>
                    </div>
                  </div>
                  <button className="text-muted-foreground hover:text-foreground transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </GlassCard>
            </motion.div>
          );
        })}
      </div>
    </AppLayout>
  );
};

export default Alerts;
