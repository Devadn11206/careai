import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Brain, TrendingUp, ShieldCheck, Zap } from 'lucide-react';
import { Badge } from '../components/ui/Badge';

export const InsightsPage: React.FC = () => {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight text-white">AI Health Insights</h2>
        <p className="text-slate-400">Deep neural analysis of your health metrics and long-term trends.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Clinical Summary</CardTitle>
            <Badge variant="success">Protocol Stable</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-sm leading-relaxed">
                Our AI model has analyzed your vitals over the last 7 days. Heart rate variability is within optimal range (65-78 ms), and oxygen saturation remains consistent at 98%. 
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-primary/20 bg-primary/5">
                <p className="text-xs text-primary uppercase font-bold mb-1">Health Score</p>
                <p className="text-3xl font-bold">92/100</p>
              </div>
              <div className="p-4 rounded-xl border border-secondary/20 bg-secondary/5">
                <p className="text-xs text-secondary uppercase font-bold mb-1">Trend Index</p>
                <p className="text-3xl font-bold">+4.2%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain size={20} className="text-primary" />
              Risk Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {[
              { label: 'Cardiovascular', risk: 'Low', color: 'text-success' },
              { label: 'Respiratory', risk: 'Stable', color: 'text-primary' },
              { label: 'Sleep Hygiene', risk: 'Moderate', color: 'text-warning' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm font-medium">{item.label}</span>
                <span className={`text-sm font-bold ${item.color}`}>{item.risk}</span>
              </div>
            ))}
            <div className="pt-4 border-t border-white/5">
              <p className="text-xs text-slate-500 italic">Analysis powered by CareXAI Llama 3.1 Model.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { title: 'Sleep Cycle', value: '7.5h', icon: Zap, label: 'Optimizing' },
          { title: 'Daily Steps', value: '8.4k', icon: TrendingUp, label: 'Target +2%' },
          { title: 'Stress Level', value: 'Low', icon: ShieldCheck, label: 'Consistent' },
        ].map((card, i) => (
          <Card key={i}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                <card.icon className="text-primary" size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">{card.title}</p>
                <p className="text-xl font-bold">{card.value}</p>
                <p className="text-[10px] text-primary/80 mt-1">{card.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
