import { useEffect, useState } from "react";
import { Heart, Activity, Droplets, Wind, Thermometer, Gauge } from "lucide-react";
import { AppLayout } from "@/components/carex/AppLayout";
import { GlassCard } from "@/components/carex/GlassCard";
import { VitalCard } from "@/components/carex/VitalCard";
import { RiskBadge } from "@/components/carex/RiskBadge";
import { useHealth } from "@/services/HealthContext";
import {
  Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from "recharts";

const initialEcg = Array.from({ length: 60 }, (_, i) => ({
  t: i,
  v: Math.sin(i / 2) * 20 + (i % 8 === 0 ? 40 : 0) + 60,
}));

const sparkData = (vitals: any[], key: string) =>
  vitals.slice(-20).map(v => ({ v: v[key] }));

const Vitals = () => {
  const [ecg, setEcg] = useState(initialEcg);
  const { vitals } = useHealth();
  
  const current = vitals[vitals.length - 1] || { 
    systolicBP: 120, 
    diastolicBP: 80, 
    glucose: 95, 
    heartRate: 72,
    bloodOxygen: 98,
    temperature: 36.8
  };

  useEffect(() => {
    const id = setInterval(() => {
      setEcg((prev) => {
        const next = [...prev.slice(1)];
        const t = (prev[prev.length - 1].t + 1) % 1000;
        next.push({ t, v: Math.sin(t / 2) * 20 + (t % 8 === 0 ? 40 : 0) + 60 + Math.random() * 5 });
        return next;
      });
    }, 200);
    return () => clearInterval(id);
  }, []);

  return (
    <AppLayout title="Live Vitals" subtitle="Continuous biometric monitoring · streaming">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <VitalCard label="Heart Rate" value={current.heartRate || 72} unit="bpm" icon={Heart} color="destructive" data={sparkData(vitals, 'heartRate')} trend={2} />
        <VitalCard label="Systolic BP" value={current.systolicBP || 120} unit="mmHg" icon={Activity} color="primary" data={sparkData(vitals, 'systolicBP')} />
        <VitalCard label="Diastolic BP" value={current.diastolicBP || 80} unit="mmHg" icon={Gauge} color="primary" data={sparkData(vitals, 'diastolicBP')} />
        <VitalCard label="Glucose" value={current.glucose || 98} unit="mg/dL" icon={Droplets} color="success" data={sparkData(vitals, 'glucose')} trend={-3} />
        <VitalCard label="SpO₂" value={current.bloodOxygen || 98} unit="%" icon={Wind} color="secondary" data={sparkData(vitals, 'bloodOxygen')} />
        <VitalCard label="Temperature" value={current.temperature || 36.8} unit="°C" decimals={1} icon={Thermometer} color="warning" data={sparkData(vitals, 'temperature')} />
      </div>

      <GlassCard className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="font-display text-xl font-semibold">ECG · Live Stream</h2>
            <p className="text-sm text-muted-foreground">Lead II · Sinus rhythm detected</p>
          </div>
          <div className="flex items-center gap-3">
            <RiskBadge level="low" label="Normal Rhythm" />
            <span className="flex items-center gap-1.5 text-xs text-success">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" /> Streaming
            </span>
          </div>
        </div>
        <div className="h-72 grid-bg rounded-xl p-2">
          <ResponsiveContainer width="100%" height={288} minWidth={0} debounce={50}>
            <LineChart data={ecg}>
              <CartesianGrid stroke="hsl(var(--primary) / 0.1)" />
              <XAxis dataKey="t" hide />
              <YAxis hide domain={[20, 120]} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
              <Line
                type="monotone"
                dataKey="v"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                style={{ filter: "drop-shadow(0 0 6px hsl(var(--primary)))" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
    </AppLayout>
  );
};

export default Vitals;
