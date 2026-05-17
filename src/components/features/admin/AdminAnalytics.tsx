import React from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import { GlassCard } from '@/components/carex/GlassCard';

const data = [
  { name: '00:00', consultations: 12, emergencies: 2 },
  { name: '04:00', consultations: 8, emergencies: 1 },
  { name: '08:00', consultations: 45, emergencies: 5 },
  { name: '12:00', consultations: 82, emergencies: 12 },
  { name: '16:00', consultations: 65, emergencies: 8 },
  { name: '20:00', consultations: 38, emergencies: 4 },
];

const riskData = [
  { name: 'Low', value: 400, color: '#10b981' },
  { name: 'Medium', value: 300, color: '#f59e0b' },
  { name: 'High', value: 200, color: '#ef4444' },
  { name: 'Critical', value: 100, color: '#b91c1c' },
];

export const AdminAnalytics: React.FC = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <GlassCard className="p-6">
        <div className="mb-6">
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">Traffic Analysis</h3>
          <p className="text-xl font-display font-semibold">Consultations vs Emergencies</p>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorConsult" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorEmerg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" />
              <XAxis dataKey="name" stroke="#ffffff30" fontSize={10} />
              <YAxis stroke="#ffffff30" fontSize={10} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0a0a0b', border: '1px solid #ffffff10', borderRadius: '12px' }}
                itemStyle={{ fontSize: '12px' }}
              />
              <Area type="monotone" dataKey="consultations" stroke="#3b82f6" fillOpacity={1} fill="url(#colorConsult)" />
              <Area type="monotone" dataKey="emergencies" stroke="#ef4444" fillOpacity={1} fill="url(#colorEmerg)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      <GlassCard className="p-6">
        <div className="mb-6">
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">Health Risk Profiles</h3>
          <p className="text-xl font-display font-semibold">Population Risk Distribution</p>
        </div>
        <div className="h-[300px] w-full flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={riskData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {riskData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#0a0a0b', border: '1px solid #ffffff10', borderRadius: '12px' }}
              />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
    </div>
  );
};
