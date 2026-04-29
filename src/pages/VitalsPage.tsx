import React from 'react';
import { HealthMetrics } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { useHealth } from '../services/HealthContext';
import { Activity, Heart, Thermometer, Droplets } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const VitalsPage: React.FC = () => {
  const { vitals } = useHealth();

  const latest = (vitals[vitals.length - 1] || {}) as HealthMetrics;

  const stats = [
    { label: 'Heart Rate', value: latest.heartRate || '--', unit: 'BPM', icon: Heart, color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { label: 'Temperature', value: latest.temperature || '--', unit: '°C', icon: Thermometer, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: 'Oxygen Saturation', value: latest.oxygenLevel || '--', unit: '%', icon: Droplets, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Respiratory Rate', value: latest.respiratoryRate || '--', unit: 'RPM', icon: Activity, color: 'text-success', bg: 'bg-success/10' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight">Vitals Monitoring</h2>
        <p className="text-text-muted">Real-time biometric data and historical trends.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <Card key={i}>
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                <stat.icon size={24} />
              </div>
              <div>
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-bold">
                  {stat.value} <span className="text-sm font-normal text-text-dim">{stat.unit}</span>
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="h-[400px]">
        <CardHeader>
          <CardTitle>Biometric Trends (24h)</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={vitals}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="timestamp" hide />
              <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                itemStyle={{ color: '#38bdf8' }}
              />
              <Line type="monotone" dataKey="heartRate" stroke="#f43f5e" strokeWidth={2} dot={false} name="Heart Rate" />
              <Line type="monotone" dataKey="oxygenLevel" stroke="#38bdf8" strokeWidth={2} dot={false} name="Oxygen %" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
