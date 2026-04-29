import React, { lazy } from 'react';
import { motion } from 'framer-motion';
import { HealthMetrics } from '../types';
import { 
  Activity, 
  TrendingUp, 
  Calendar, 
  FileText, 
  ShieldAlert,
  ArrowRight,
  Heart,
  Droplets,
  Thermometer
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useHealth } from '../services/HealthContext';
import { Link } from 'react-router-dom';
import { ChatSystem } from '../components/features/ChatSystem';
import { HealthRiskPredictionModule } from '../components/features/HealthRiskPredictionModule';
import { HealthPassport } from '../components/features/HealthPassport';
import { HealthLinkBridge } from '../components/features/HealthLinkBridge';
import { AutomationAssistant } from '../components/features/AutomationAssistant';

const LazyVideoCall = lazy(() => import('../components/features/VideoCall').then((module) => ({ default: module.VideoCall })));

export const PatientDashboard: React.FC = () => {
  const { user, vitals, alerts } = useHealth();
  
  const latestVital = (vitals[vitals.length - 1] || {}) as HealthMetrics;

  const quickStats = [
    { label: 'Heart Rate', value: latestVital.heartRate || '--', unit: 'BPM', icon: Heart, color: 'text-rose-500' },
    { label: 'Blood Glucose', value: latestVital.glucose || '--', unit: 'mg/dL', icon: Droplets, color: 'text-primary' },
    { label: 'Temperature', value: latestVital.temperature || '--', unit: '°C', icon: Thermometer, color: 'text-warning' },
  ];

  return (
    <div className="space-y-10">
      {/* Welcome Section */}
      <section className="relative overflow-hidden rounded-[32px] p-8 md:p-12 glass">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] -mr-32 -mt-32" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div>
            <Badge variant="primary" className="mb-4">System Online</Badge>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
              Welcome back, <span className="gradient-text">{user?.name?.split(' ')[0]}</span>
            </h1>
            <p className="text-text-muted text-lg max-w-xl">
              Your health metrics are being monitored in real-time. Everything looks stable today.
            </p>
          </div>
          <div className="flex gap-4">
            <Button variant="primary" size="lg">Book Appointment</Button>
            <Button variant="outline" size="lg">Emergency Alert</Button>
          </div>
        </div>
      </section>

      {/* Quick Vitals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {quickStats.map((stat, i) => (
          <Card key={i} className="flex items-center gap-6">
            <div className={`w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center ${stat.color}`}>
              <stat.icon size={28} />
            </div>
            <div>
              <p className="text-sm font-medium text-text-muted uppercase tracking-wider">{stat.label}</p>
              <p className="text-2xl font-bold">
                {stat.value} <span className="text-sm font-normal text-text-dim">{stat.unit}</span>
              </p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-8">
          {/* Recent Insights */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp size={20} className="text-primary" />
                AI Health Insights
              </CardTitle>
              <Link to="/insights">
                <Button variant="ghost" size="sm" className="text-primary gap-2">
                  View Full Report <ArrowRight size={14} />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <p className="text-sm leading-relaxed">
                  "Based on your recent heart rate and activity levels, your cardiovascular endurance has improved by <span className="text-success font-bold">4.2%</span> this week. Keep up the 20-minute daily walks."
                </p>
                <div className="flex gap-2">
                  <Badge variant="success">Low Risk</Badge>
                  <Badge variant="primary">Optimal Recovery</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vitals Summary */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Activity size={20} className="text-primary" />
                Real-time Vitals
              </CardTitle>
              <Link to="/vitals">
                <Button variant="ghost" size="sm" className="text-primary gap-2">
                  Live View <ArrowRight size={14} />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="h-48 w-full bg-white/5 rounded-2xl flex items-center justify-center border border-dashed border-white/10 text-text-dim">
                <p className="text-xs uppercase tracking-widest font-mono">Telemetry Link Streaming...</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Area */}
        <div className="space-y-8">
          {/* Upcoming Appointments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar size={18} className="text-secondary" />
                Upcoming
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold">Dr. Ananya Sharma</p>
                    <p className="text-[10px] text-text-muted uppercase">Cardiology · Video Call</p>
                  </div>
                  <Badge variant="primary">Tomorrow</Badge>
                </div>
                <Button variant="secondary" size="sm" className="w-full">Join Room</Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText size={18} className="text-primary" />
                Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { name: 'Blood_Test_Final.pdf', date: 'Oct 12' },
                { name: 'ECG_Scan_Result.pdf', date: 'Oct 08' },
              ].map((doc, i) => (
                <div key={i} className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg transition-colors cursor-pointer group">
                  <span className="text-sm group-hover:text-primary transition-colors">{doc.name}</span>
                  <span className="text-[10px] text-text-dim">{doc.date}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Critical Alerts */}
          <Card className="border-error/20 bg-error/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-error">
                <ShieldAlert size={18} />
                Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-text-muted mb-4">No critical alerts detected in the last 24 hours.</p>
              <Link to="/alerts">
                <Button variant="ghost" size="sm" className="w-full text-error">View Alert History</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
