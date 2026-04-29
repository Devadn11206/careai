import React from 'react';
import { Card, CardContent } from '../components/ui/Card';
import { Bell, AlertTriangle, CheckCircle, Info, ShieldAlert } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

export const AlertsPage: React.FC = () => {
  const alerts = [
    { 
      id: 1, 
      type: 'critical', 
      title: 'Irregular Heart Rate Detected', 
      desc: 'Slight tachycardia detected (105 BPM). Please sit down and rest.', 
      time: '12 mins ago',
      icon: ShieldAlert,
      color: 'text-error',
      bg: 'bg-error/10'
    },
    { 
      id: 2, 
      type: 'warning', 
      title: 'Medication Reminder', 
      desc: 'Take your Blood Pressure medication (Lisinopril).', 
      time: '1 hour ago',
      icon: AlertTriangle,
      color: 'text-warning',
      bg: 'bg-warning/10'
    },
    { 
      id: 3, 
      type: 'info', 
      title: 'Sync Successful', 
      desc: 'Smartwatch data synchronized with medical cloud.', 
      time: '3 hours ago',
      icon: CheckCircle,
      color: 'text-success',
      bg: 'bg-success/10'
    },
    { 
      id: 4, 
      type: 'info', 
      title: 'Analysis Ready', 
      desc: 'Your weekly health report is now available for review.', 
      time: 'Yesterday',
      icon: Info,
      color: 'text-primary',
      bg: 'bg-primary/10'
    }
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-bold tracking-tight">Health Alerts</h2>
          <p className="text-text-muted">Stay updated with critical health notifications and system status.</p>
        </div>
        <Button variant="outline" size="sm">Mark all as read</Button>
      </div>

      <div className="grid gap-4">
        {alerts.map((alert) => (
          <Card key={alert.id} className="border-l-4">
            <div className={`p-6 flex items-start gap-4 ${alert.type === 'critical' ? 'border-l-error' : alert.type === 'warning' ? 'border-l-warning' : 'border-l-primary'}`}>
              <div className={`p-3 rounded-xl ${alert.bg} ${alert.color}`}>
                <alert.icon size={24} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-lg">{alert.title}</h3>
                  <span className="text-xs text-text-dim">{alert.time}</span>
                </div>
                <p className="text-text-muted text-sm">{alert.desc}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Badge variant={alert.type === 'critical' ? 'error' : alert.type === 'warning' ? 'warning' : 'primary'}>
                  {alert.type}
                </Badge>
                {alert.type === 'critical' && (
                  <Button variant="error" size="sm" className="text-[10px] py-1 px-2">Contact Dr.</Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="bg-primary/5 border border-primary/20">
        <CardContent className="flex items-center gap-4 py-4">
          <Bell className="text-primary animate-pulse" size={20} />
          <p className="text-sm font-medium text-primary">Notification system is active and monitoring in real-time.</p>
        </CardContent>
      </Card>
    </div>
  );
};
