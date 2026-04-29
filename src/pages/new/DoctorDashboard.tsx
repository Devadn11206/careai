import { Users, AlertTriangle, Activity, Clock, ArrowUpRight } from "lucide-react";
import { AppLayout } from "@/components/carex/AppLayout";
import { GlassCard } from "@/components/carex/GlassCard";
import { RiskBadge } from "@/components/carex/RiskBadge";
import { AnimatedCounter } from "@/components/carex/AnimatedCounter";
import { NeonButton } from "@/components/carex/NeonButton";
import { useHealth } from "@/services/HealthContext";

const DoctorDashboard = () => {
  const { user } = useHealth();

  const patients = [
    { name: "Sarah Adams", id: "P-1024", age: 54, condition: "Hypertension", risk: "high" as const, lastSeen: "10 min ago" },
    { name: "Marcus Lee", id: "P-1025", age: 38, condition: "Type 2 Diabetes", risk: "medium" as const, lastSeen: "1 hr ago" },
    { name: "Elena Vasquez", id: "P-1026", age: 67, condition: "Atrial Fibrillation", risk: "high" as const, lastSeen: "2 hr ago" },
    { name: "James O'Connor", id: "P-1027", age: 45, condition: "Post-op Recovery", risk: "low" as const, lastSeen: "5 hr ago" },
    { name: "Priya Shah", id: "P-1028", age: 29, condition: "Asthma Monitor", risk: "low" as const, lastSeen: "Yesterday" },
  ];

  const stats = [
    { label: "Active Patients", value: 124, icon: Users, color: "text-primary" },
    { label: "Critical Alerts", value: 7, icon: AlertTriangle, color: "text-destructive" },
    { label: "Vitals Today", value: 1842, icon: Activity, color: "text-secondary" },
    { label: "Avg Response", value: 4.2, suffix: " min", icon: Clock, color: "text-success", decimals: 1 },
  ];

  return (
    <AppLayout title="Doctor Console" subtitle={`Live patient overview · Dr. ${user?.name || 'Kapoor'}`}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <GlassCard key={s.label} className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
                <AnimatedCounter
                  value={s.value}
                  decimals={s.decimals || 0}
                  suffix={s.suffix || ""}
                  className="font-display text-3xl font-bold mt-2 block"
                />
              </div>
              <s.icon className={`h-6 w-6 ${s.color}`} />
            </div>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="p-0 overflow-hidden">
        <div className="p-6 border-b border-border/50 flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold">Patient Roster</h2>
            <p className="text-sm text-muted-foreground">Sorted by risk priority</p>
          </div>
          <NeonButton variant="neon" size="sm">View All</NeonButton>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground uppercase tracking-wider border-b border-border/50">
                <th className="text-left p-4 font-medium">Patient</th>
                <th className="text-left p-4 font-medium hidden md:table-cell">Condition</th>
                <th className="text-left p-4 font-medium">Risk</th>
                <th className="text-left p-4 font-medium hidden lg:table-cell">Last Update</th>
                <th className="text-right p-4 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id} className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors group">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-gradient-aurora flex items-center justify-center text-xs font-semibold text-primary-foreground">
                        {p.name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{p.id} · {p.age}y</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-muted-foreground hidden md:table-cell">{p.condition}</td>
                  <td className="p-4"><RiskBadge level={p.risk} /></td>
                  <td className="p-4 text-muted-foreground hidden lg:table-cell">{p.lastSeen}</td>
                  <td className="p-4 text-right">
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:text-primary-glow inline-flex items-center gap-1 text-xs">
                      Open <ArrowUpRight className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </AppLayout>
  );
};

export default DoctorDashboard;
