import { Users, AlertTriangle, Activity, Clock, ArrowUpRight, Zap, Brain, ChevronLeft, Video, Search, Filter } from "lucide-react";
import { AppLayout } from "@/components/carex/AppLayout";
import { GlassCard } from "@/components/carex/GlassCard";
import { RiskBadge } from "@/components/carex/RiskBadge";
import { AnimatedCounter } from "@/components/carex/AnimatedCounter";
import { NeonButton } from "@/components/carex/NeonButton";
import { useHealth } from "@/services/HealthContext";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import React, { useState, lazy, Suspense } from "react";
import { UserRole } from "@/types";

const LazyVideoCall = lazy(() => import('../../components/features/VideoCall').then((module) => ({ default: module.VideoCall })));
import { PatientSummaryHistory } from "@/components/features/PatientSummaryHistory";
import { PrescriptionUploadModal } from "@/components/features/PrescriptionUploadModal";
import { PatientMedicalRecordsModal } from "@/components/features/PatientMedicalRecordsModal";
import { SlotManager } from "@/components/features/SlotManager";
import { BackendAPI } from "@/services/apiClient";
import { Pill, FileText, LayoutDashboard, Calendar as CalendarIcon, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { VerificationRequired } from "@/components/features/VerificationRequired";
import { NeonSelect } from "@/components/carex/NeonSelect";
import { AutomationAssistant } from "@/components/features/AutomationAssistant";
import { ClientAction } from "@/types";

const DoctorDashboard = () => {
  const { 
    user, 
    doctorStats, 
    patientRoster, 
    upcomingSessions, 
    isLoading, 
    refreshDoctorData,
    alerts 
  } = useHealth();

  const [selectedPatient, setSelectedPatient] = useState<{ id: string; name: string } | null>(null);
  const [activeCall, setActiveCall] = useState<any>(null);
  const [prescriptionModal, setPrescriptionModal] = useState<{ id: string; name: string } | null>(null);
  const [recordsModal, setRecordsModal] = useState<{ id: string; name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("All");
  const [activeTab, setActiveTab] = useState<"Console" | "Slots">("Console");
  const [isAiOpen, setIsAiOpen] = useState(false);

  const handleCancel = async (id: string) => {
    try {
      await BackendAPI.cancelAppointment(id);
      refreshDoctorData();
      toast.success("Consultation cancelled successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel consultation");
    }
  };

  const filteredRoster = patientRoster.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         p.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRisk = riskFilter === "All" || p.risk === riskFilter;
    return matchesSearch && matchesRisk;
  });

  const stats = [
    { label: "Active Patients", value: doctorStats.activePatients, icon: Users, color: "text-primary", decimals: 0, suffix: "" },
    { label: "Critical Alerts", value: doctorStats.criticalAlerts, icon: AlertTriangle, color: "text-destructive", decimals: 0, suffix: "" },
    { label: "Appointments Today", value: doctorStats.appointmentsToday, icon: Activity, color: "text-secondary", decimals: 0, suffix: "" },
    { label: "Pending Consults", value: doctorStats.pendingConsults, icon: Clock, color: "text-success", decimals: 0, suffix: "" },
  ];

  const isVerified = user?.status === 'VERIFIED';

  if (!isVerified && !isLoading) {
    return (
      <AppLayout title="Verification Required" subtitle="Clinical credentials pending administrative review">
        <VerificationRequired status={user?.status || 'PENDING_VERIFICATION'} />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Doctor Console" subtitle={`Live patient overview · Dr. ${user?.name || 'Kapoor'}`}>
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => setActiveTab("Console")}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold uppercase tracking-[0.2em] text-[10px] transition-all",
            activeTab === "Console" ? "bg-primary/20 text-primary border border-primary/40 shadow-glow-primary" : "bg-muted/10 text-muted-foreground border border-border/50 hover:bg-muted/20"
          )}
        >
          <LayoutDashboard size={14} /> Clinical Console
        </button>
        <button 
          onClick={() => setActiveTab("Slots")}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold uppercase tracking-[0.2em] text-[10px] transition-all",
            activeTab === "Slots" ? "bg-primary/20 text-primary border border-primary/40 shadow-glow-primary" : "bg-muted/10 text-muted-foreground border border-border/50 hover:bg-muted/20"
          )}
        >
          <CalendarIcon size={14} /> Slot Orchestrator
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "Console" ? (
          <motion.div
            key="console"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <GlassCard className="lg:col-span-2 p-0 overflow-hidden">
          <div className="p-6 border-b border-border/50 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-semibold">Patient Roster</h2>
                <p className="text-sm text-muted-foreground">Live clinical network · Synchronized with AI metrics</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative hidden md:block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input 
                    type="text" 
                    placeholder="Search patients..." 
                    className="bg-muted/20 border border-border/50 rounded-lg py-1.5 pl-9 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40 w-48 transition-all"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                  <NeonSelect 
                    className="min-w-[140px]"
                    options={[
                      { label: "All Risk", value: "All" },
                      { label: "Critical", value: "CRITICAL" },
                      { label: "High", value: "HIGH" },
                      { label: "Medium", value: "MEDIUM" },
                      { label: "Low", value: "LOW" }
                    ]}
                    value={riskFilter}
                    onChange={setRiskFilter}
                  />
              </div>
            </div>
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
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/30 animate-pulse">
                      <td className="p-4"><div className="h-10 w-40 bg-muted/20 rounded-lg" /></td>
                      <td className="p-4 hidden md:table-cell"><div className="h-4 w-24 bg-muted/20 rounded" /></td>
                      <td className="p-4"><div className="h-6 w-16 bg-muted/20 rounded-full" /></td>
                      <td className="p-4 hidden lg:table-cell"><div className="h-4 w-20 bg-muted/20 rounded" /></td>
                      <td className="p-4 text-right"><div className="h-4 w-12 bg-muted/20 rounded ml-auto" /></td>
                    </tr>
                  ))
                ) : filteredRoster.length > 0 ? (
                  filteredRoster.map((p) => (
                    <tr 
                      key={p.id} 
                      onClick={() => setSelectedPatient({ id: p.id, name: p.name })}
                      className={cn(
                        "border-b border-border/30 last:border-0 cursor-pointer transition-colors group",
                        selectedPatient?.id === p.id ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/30"
                      )}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-gradient-aurora flex items-center justify-center text-xs font-semibold text-primary-foreground overflow-hidden">
                            {p.profilePicUrl ? (
                              <img src={p.profilePicUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              p.name.split(" ").map((n: string) => n[0]).join("")
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground font-mono truncate max-w-[120px]">{p.id} · {p.age}y</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground hidden md:table-cell">{p.gender}</td>
                      <td className="p-4"><RiskBadge level={p.risk.toLowerCase() as any} /></td>
                      <td className="p-4 text-muted-foreground hidden lg:table-cell">{new Date(p.lastUpdate).toLocaleDateString()}</td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setRecordsModal({ id: p.id, name: p.name });
                            }}
                            className="h-8 w-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center hover:bg-secondary/20 transition-colors"
                            title="View Records"
                          >
                            <FileText size={14} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setPrescriptionModal({ id: p.id, name: p.name });
                            }}
                            className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors"
                            title="Send Prescription"
                          >
                            <Pill size={14} />
                          </button>
                          <button className={cn(
                            "transition-all text-primary hover:text-primary-glow inline-flex items-center gap-1 text-xs",
                            selectedPatient?.id === p.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          )}>
                            {selectedPatient?.id === p.id ? 'Viewing' : 'Open'} <ArrowUpRight className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-muted-foreground uppercase tracking-widest text-[10px]">
                      {searchQuery ? "No patients matching search criteria" : "No patients found in clinical grid"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>

        <div className="space-y-6">
          {/* Upcoming Sessions Card */}
          <GlassCard className="p-6 border-primary/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold uppercase tracking-wider text-xs text-muted-foreground">Upcoming Sessions</h3>
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <div className="space-y-3">
              {isLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-20 bg-muted/10 rounded-xl animate-pulse" />
                ))
              ) : upcomingSessions.length > 0 ? (
                upcomingSessions
                .filter(a => a.status !== 'COMPLETED' && a.status !== 'CANCELLED')
                .slice(0, 3)
                .map((appt) => {
                  const isToday = appt.date === new Date().toISOString().split('T')[0];
                  const canJoin = isToday && appt.consultationType === 'VIDEO';
                  
                  return (
                    <div key={appt.id} className={cn(
                      "p-3 rounded-xl border transition-all flex flex-col gap-2",
                      canJoin ? "bg-primary/5 border-primary/40 shadow-glow-primary" : "bg-muted/10 border-border/50"
                    )}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{appt.patientName}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">{appt.time} · {appt.consultationType}</p>
                        </div>
                        {isToday && <span className="text-[9px] font-black bg-primary/20 text-primary px-2 py-0.5 rounded uppercase flex-shrink-0">Today</span>}
                      </div>
                      {canJoin ? (
                        <div className="flex gap-2">
                          <NeonButton 
                            variant="primary" 
                            size="sm" 
                            className="flex-1 h-8 text-[10px] font-black uppercase"
                            onClick={() => setActiveCall(appt)}
                          >
                            Join Consultation
                          </NeonButton>
                          <button 
                            onClick={() => handleCancel(appt.id)}
                            className="px-3 h-8 text-[10px] font-bold uppercase text-destructive border border-destructive/20 hover:bg-destructive/10 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => handleCancel(appt.id)}
                          className="w-full h-8 text-[10px] font-bold uppercase text-destructive/60 border border-destructive/10 hover:bg-destructive/5 rounded-lg transition-colors"
                        >
                          Cancel Consultation
                        </button>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-[10px] text-center text-muted-foreground py-4 uppercase tracking-widest">No active sessions</p>
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    </motion.div>
      ) : (
        <motion.div
          key="slots"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
        >
          <SlotManager />
        </motion.div>
      )}
    </AnimatePresence>
      
      {/* Video Call Modal */}
      {activeCall && (
        <Suspense fallback={<div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center text-white font-mono uppercase tracking-[0.3em]">Connecting to Secure Health-Link...</div>}>
          <LazyVideoCall 
            appointmentId={activeCall.id}
            otherUserName={activeCall.patientName}
            currentUserRole={UserRole.DOCTOR}
            onClose={() => setActiveCall(null)}
          />
        </Suspense>
      )}

      {/* Prescription Upload Modal */}
      <AnimatePresence>
        {prescriptionModal && (
          <PrescriptionUploadModal 
            patientId={prescriptionModal.id}
            patientName={prescriptionModal.name}
            onClose={() => setPrescriptionModal(null)}
            onSuccess={() => refreshDoctorData()}
          />
        )}
      </AnimatePresence>

      {/* Patient Records Modal */}
      <AnimatePresence>
        {recordsModal && (
          <PatientMedicalRecordsModal 
            patientId={recordsModal.id}
            patientName={recordsModal.name}
            onClose={() => setRecordsModal(null)}
          />
        )}
      </AnimatePresence>

      {/* Agentic AI Assistant */}
      <AutomationAssistant 
        isOpen={isAiOpen}
        onClose={() => setIsAiOpen(false)}
        onAction={(action: ClientAction) => {
          if (action.type === 'SELECT_PATIENT' && action.target) {
             // Logic to find patient name from roster or similar would go here
             // For now we just focus the UI
             setSelectedPatient({ id: action.target, name: 'Selected Patient' });
          } else if (action.type === 'OPEN_SCHEDULE') {
             setActiveTab('Slots');
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
          <p className="text-[10px] font-black uppercase tracking-widest text-primary">Clinical Copilot</p>
          <p className="text-[8px] text-muted-foreground mt-0.5">Ready for commands</p>
        </div>
      </motion.button>
    </AppLayout>
  );
};

export default DoctorDashboard;
