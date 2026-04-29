import { motion } from "framer-motion";
import { Heart, Activity, Droplets, Brain, ArrowUpRight, Calendar, Pill } from "lucide-react";
import { AppLayout } from "@/components/carex/AppLayout";
import { GlassCard } from "@/components/carex/GlassCard";
import { VitalCard } from "@/components/carex/VitalCard";
import { RiskBadge } from "@/components/carex/RiskBadge";
import { NeonButton } from "@/components/carex/NeonButton";
import { useHealth } from "@/services/HealthContext";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar
} from "recharts";

const sparkData = (vitals: any[], key: string) =>
  vitals.slice(-12).map(v => ({ v: v[key] }));

const PatientDashboard = () => {
  const { user, vitals, alerts, appointments } = useHealth();
  
  // Get latest values
  const current = vitals[vitals.length - 1] || { systolicBP: 120, diastolicBP: 80, glucose: 95, heartRate: 72 };

  const trendData = vitals.slice(-24).map(v => ({
    hour: new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    hr: v.heartRate || 72,
    bp: v.systolicBP || 120,
  }));

  const adherenceData = [
    { day: "Mon", v: 90 },
    { day: "Tue", v: 100 },
    { day: "Wed", v: 85 },
    { day: "Thu", v: 100 },
    { day: "Fri", v: 95 },
    { day: "Sat", v: 100 },
    { day: "Sun", v: 100 },
  ];

  const upcomingAppointments = appointments
    .filter(a => a.status === 'SCHEDULED' || a.status === 'PENDING')
    .slice(0, 2)
    .map(a => ({
      day: new Date(a.date).toLocaleDateString([], { month: 'short', day: 'numeric' }),
      time: a.time,
      title: `${a.type} · ${a.doctorName}`,
      type: a.consultationType === 'VIDEO' ? 'Video' : 'In-person'
    }));

  const activities = alerts.slice(0, 5).map(a => ({
    time: new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    text: a.message,
    type: a.severity === 'CRITICAL' ? 'warning' : 'success'
  }));

  return (
    <AppLayout title={`Welcome back, ${user?.name || 'Sarah'}`} subtitle="Here's your health snapshot for today">
      {/* Top row: vitals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <VitalCard label="Heart Rate" value={current.heartRate || 72} unit="bpm" icon={Heart} color="destructive" data={sparkData(vitals, 'heartRate')} trend={2} />
        <VitalCard label="Blood Pressure" value={current.systolicBP || 120} unit={`/${current.diastolicBP || 80} mmHg`} icon={Activity} color="primary" data={sparkData(vitals, 'systolicBP')} trend={-1} />
        <VitalCard label="Glucose" value={current.glucose || 98} unit="mg/dL" icon={Droplets} color="success" data={sparkData(vitals, 'glucose')} trend={3} />
        <VitalCard label="AI Wellness" value={94} unit="/100" icon={Brain} color="secondary" data={sparkData(vitals, 'heartRate')} trend={5} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend chart */}
        <GlassCard className="lg:col-span-2 p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="font-display text-xl font-semibold">24-Hour Vitals Trend</h2>
              <p className="text-sm text-muted-foreground">Continuous monitoring · live</p>
            </div>
            <RiskBadge level="low" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height={256} minWidth={0} debounce={50}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="bpGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--secondary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--secondary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    boxShadow: "var(--glow-primary)",
                  }}
                />
                <Area type="monotone" dataKey="hr" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#hrGrad)" />
                <Area type="monotone" dataKey="bp" stroke="hsl(var(--secondary))" strokeWidth={2} fill="url(#bpGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* AI Insight */}
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-9 w-9 rounded-lg bg-gradient-aurora flex items-center justify-center shadow-glow">
              <Brain className="h-4 w-4 text-primary-foreground" />
            </div>
            <h3 className="font-display font-semibold">AI Insight</h3>
          </div>
          <p className="text-sm text-foreground leading-relaxed">
            Your sleep-adjusted recovery is <span className="text-primary font-semibold">+12%</span> this week.
            Heart rate variability suggests good cardiovascular fitness. Keep current routine.
          </p>
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Recovery</span>
              <span className="font-mono text-success">87%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <motion.div
                initial={{ width: 0 }} animate={{ width: "87%" }} transition={{ duration: 1.2, ease: "easeOut" }}
                className="h-full bg-gradient-primary shadow-glow"
              />
            </div>
          </div>
          <NeonButton variant="neon" size="sm" className="w-full mt-5">
            View Full Report <ArrowUpRight className="h-3.5 w-3.5" />
          </NeonButton>
        </GlassCard>

        {/* Adherence */}
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-semibold">Medication Adherence</h3>
              <p className="text-xs text-muted-foreground">Past 7 days</p>
            </div>
            <Pill className="h-5 w-5 text-primary" />
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height={160} minWidth={0} debounce={50}>
              <BarChart data={adherenceData}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.3)" }} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Bar dataKey="v" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Appointments */}
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold">Upcoming</h3>
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-3">
            {upcomingAppointments.length > 0 ? upcomingAppointments.map((a, i) => (
              <div key={i} className="glass rounded-xl p-3 flex items-center gap-3 hover:border-primary/40 transition-colors">
                <div className="text-center px-2">
                  <p className="text-[10px] text-muted-foreground uppercase">{a.day.split(" ")[0]}</p>
                  <p className="font-display font-bold">{a.day.split(" ")[1]}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.time} · {a.type}</p>
                </div>
              </div>
            )) : (
              <p className="text-xs text-muted-foreground text-center py-4">No upcoming appointments</p>
            )}
          </div>
        </GlassCard>

        {/* Activity */}
        <GlassCard className="p-6 lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold">Activity Feed</h3>
            <span className="flex items-center gap-1.5 text-xs text-success">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" /> Live
            </span>
          </div>
          <ul className="space-y-3">
            {activities.map((a, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-4 py-2 border-b border-border/50 last:border-0"
              >
                <span className={`h-2 w-2 rounded-full ${a.type === "warning" ? "bg-warning shadow-[0_0_8px_hsl(var(--warning))]" : a.type === "success" ? "bg-success shadow-[0_0_8px_hsl(var(--success))]" : "bg-primary shadow-[0_0_8px_hsl(var(--primary))]"}`} />
                <span className="flex-1 text-sm">{a.text}</span>
                <span className="text-xs text-muted-foreground font-mono">{a.time}</span>
              </motion.li>
            ))}
          </ul>
        </GlassCard>
      </div>
    </AppLayout>
  );
};

export default PatientDashboard;
