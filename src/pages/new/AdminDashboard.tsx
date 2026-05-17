import { 
  Shield, Server, Users, Lock, Activity, ArrowUpRight, Zap, Database, 
  ShieldCheck, Map as MapIcon, BarChart3, Terminal, AlertTriangle, 
  Plus, Settings, Activity as Pulse
} from "lucide-react";
import { AppLayout } from "@/components/carex/AppLayout";
import { GlassCard } from "@/components/carex/GlassCard";
import { AnimatedCounter } from "@/components/carex/AnimatedCounter";
import { NeonButton } from "@/components/carex/NeonButton";
import { useHealth } from "@/services/HealthContext";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import React, { useState, useEffect } from "react";
import { BackendAPI } from "@/services/apiClient";

import { AdminDoctorVerification } from "@/components/features/AdminDoctorVerification";
import { AutomationAssistant } from "@/components/features/AutomationAssistant";
import { ClientAction } from "@/types";
import { Brain } from "lucide-react";

// Admin specialized components
import { AdminCommandMap } from "@/components/features/admin/AdminCommandMap";
import { AdminAnalytics } from "@/components/features/admin/AdminAnalytics";
import { AdminAuditLogs } from "@/components/features/admin/AdminAuditLogs";
import { AdminSystemHealth } from "@/components/features/admin/AdminSystemHealth";

type AdminTab = "Overview" | "Map" | "Analytics" | "Verification" | "Audit" | "Infrastructure";

const AdminDashboard = () => {
  const { user } = useHealth();
  const [activeTab, setActiveTab] = useState<AdminTab>("Overview");
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [emergencyData, setEmergencyData] = useState<any>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [s, e] = await Promise.all([
          BackendAPI.getAdminStats(),
          BackendAPI.getAdminEmergency()
        ]);
        setStats(s);
        setEmergencyData(e);
      } catch (err) {
        console.error("Failed to fetch admin stats", err);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const sysStats = [
    { label: "Active Nodes", value: stats?.activeHospitals || 0, icon: Server, color: "text-primary" },
    { label: "Live Users", value: (stats?.onlinePatients || 0) + (stats?.onlineDoctors || 0), icon: Users, color: "text-secondary" },
    { label: "Pending Verify", value: stats?.pendingDoctors || 0, icon: ShieldCheck, color: "text-warning" },
    { label: "Critical Alerts", value: stats?.alertsToday || 0, icon: AlertTriangle, color: "text-destructive" },
  ];

  const navigation = [
    { id: "Overview", icon: Activity, label: "Matrix Overview" },
    { id: "Map", icon: MapIcon, label: "Command Map" },
    { id: "Analytics", icon: BarChart3, label: "Intelligence" },
    { id: "Verification", icon: ShieldCheck, label: "Identity Nexus" },
    { id: "Audit", icon: Terminal, label: "Audit Ledger" },
    { id: "Infrastructure", icon: Zap, label: "Node Health" },
  ];

  return (
    <AppLayout title="Admin Command" subtitle="Nexus Console · Level 4 Authorization">
      {/* Navigation Matrix */}
      <div className="flex flex-wrap items-center gap-2 mb-8">
        {navigation.map((item) => (
          <button 
            key={item.id}
            onClick={() => setActiveTab(item.id as AdminTab)}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold uppercase tracking-[0.2em] text-[9px] transition-all border",
              activeTab === item.id 
                ? "bg-primary/20 text-primary border-primary/40 shadow-glow-primary scale-105" 
                : "bg-muted/10 text-muted-foreground border-white/5 hover:bg-muted/20"
            )}
          >
            <item.icon size={14} /> {item.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="space-y-6"
        >
          {activeTab === "Overview" && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {sysStats.map((s) => (
                  <GlassCard key={s.label} className="p-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-1 opacity-10 group-hover:opacity-20 transition-opacity">
                      <s.icon size={60} />
                    </div>
                    <div className="relative z-10">
                      <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">{s.label}</p>
                      <div className="flex items-baseline gap-2 mt-2">
                        <AnimatedCounter
                          value={s.value}
                          className="font-display text-3xl font-bold block"
                        />
                        <Pulse size={12} className={cn("animate-pulse", s.color)} />
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <AdminCommandMap />
                  
                  <GlassCard className="p-6">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="font-display text-lg font-bold">Active Emergency Broadcasts</h3>
                      <span className="px-3 py-1 rounded-full bg-destructive/10 text-destructive text-[10px] font-black uppercase tracking-widest animate-pulse">Live</span>
                    </div>
                    <div className="space-y-4">
                      {emergencyData?.activeAlerts?.length > 0 ? (
                        emergencyData.activeAlerts.map((alert: any) => (
                          <div key={alert.id} className="flex items-center gap-4 p-4 rounded-xl border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-all">
                            <div className="h-10 w-10 rounded-full bg-destructive/20 flex items-center justify-center text-destructive border border-destructive/30">
                              <AlertTriangle size={20} />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-bold">{alert.patient.name} - {alert.message}</p>
                              <p className="text-[10px] text-muted-foreground">Location: GRID-ID-342 · {new Date(alert.createdAt).toLocaleTimeString()}</p>
                            </div>
                            <NeonButton size="sm" variant="neon" className="bg-destructive hover:bg-destructive/80">Dispatch</NeonButton>
                          </div>
                        ))
                      ) : (
                        <div className="py-12 text-center opacity-50 border-2 border-dashed border-white/5 rounded-2xl">
                          <Pulse size={24} className="mx-auto mb-2 text-muted-foreground/30" />
                          <p className="text-xs uppercase tracking-widest font-black">Scanning for Emergencies...</p>
                        </div>
                      )}
                    </div>
                  </GlassCard>
                </div>

                <div className="space-y-6">
                  <GlassCard className="p-6 h-full">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="font-display text-lg font-bold">Priority Objectives</h3>
                      <Settings size={14} className="text-muted-foreground" />
                    </div>
                    <div className="space-y-4">
                      {[
                        { title: "Review Identity Logs", count: stats?.pendingDoctors || 0, type: "Verification" },
                        { title: "Monitor Video Sessions", count: stats?.activeConsultations || 0, type: "Safety" },
                        { title: "Sync Clinical Nodes", count: 12, type: "Infra" },
                        { title: "Audit AI Summaries", count: 4, type: "Compliance" }
                      ].map((task, i) => (
                        <div key={i} className="group p-4 rounded-xl border border-white/5 bg-white/5 hover:border-primary/30 transition-all cursor-pointer">
                          <div className="flex justify-between items-start">
                            <span className="text-[9px] font-black uppercase tracking-widest text-primary">{task.type}</span>
                            <span className="h-2 w-2 rounded-full bg-primary animate-ping" />
                          </div>
                          <h4 className="text-sm font-bold mt-1 group-hover:text-primary transition-colors">{task.title}</h4>
                          <p className="text-[10px] text-muted-foreground mt-1">{task.count} pending items in queue</p>
                        </div>
                      ))}
                    </div>
                    <NeonButton className="w-full mt-6" variant="outline">Advanced Command Panel</NeonButton>
                  </GlassCard>
                </div>
              </div>
            </>
          )}

          {activeTab === "Map" && <AdminCommandMap className="h-[700px]" />}
          {activeTab === "Analytics" && <AdminAnalytics />}
          {activeTab === "Verification" && <AdminDoctorVerification />}
          {activeTab === "Audit" && <AdminAuditLogs />}
          {activeTab === "Infrastructure" && <AdminSystemHealth />}
        </motion.div>
      </AnimatePresence>

      {/* Agentic AI Assistant */}
      <AutomationAssistant 
        isOpen={isAiOpen}
        onClose={() => setIsAiOpen(false)}
        onAction={(action: ClientAction) => {
          if (action.type === 'NAVIGATE' && action.target) {
            const target = action.target.toLowerCase();
            if (target.includes('map')) setActiveTab('Map');
            else if (target.includes('verification')) setActiveTab('Verification');
            else if (target.includes('analytics')) setActiveTab('Analytics');
            else if (target.includes('audit')) setActiveTab('Audit');
            else if (target.includes('infrastructure')) setActiveTab('Infrastructure');
            else setActiveTab('Overview');
          } else {
             window.dispatchEvent(new CustomEvent('carexai-action', { detail: action }));
          }
        }}
      />

      {/* Floating AI Orb Trigger */}
      <motion.button
        whileHover={{ scale: 1.1, rotate: 5 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsAiOpen(true)}
        className="fixed bottom-8 right-8 h-16 w-16 rounded-full bg-gradient-aurora flex items-center justify-center shadow-glow border border-white/20 z-[90] group"
      >
        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping group-hover:animate-none" />
        <Brain className="h-7 w-7 text-white relative z-10" />
        
        <div className="absolute right-20 bg-background/90 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary">Nexus Copilot</p>
          <p className="text-[8px] text-muted-foreground mt-0.5">Control System Online</p>
        </div>
      </motion.button>
    </AppLayout>
  );
};

export default AdminDashboard;
