import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Activity, Droplets, Brain, ArrowUpRight, Calendar, Pill, Zap, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppLayout } from "@/components/carex/AppLayout";
import { GlassCard } from "@/components/carex/GlassCard";
import { VitalCard } from "@/components/carex/VitalCard";
import { RiskBadge } from "@/components/carex/RiskBadge";
import { NeonButton } from "@/components/carex/NeonButton";
import { useHealth } from "@/services/HealthContext";
import { AIWellnessScore } from "@/components/carex/AIWellnessScore";
import { BackendAPI } from "@/services/apiClient";
import { toast } from "sonner";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar, LineChart, Line
} from "recharts";
import { lazy, Suspense } from "react";
import { UserRole, BackendDoctor } from "@/types";

const LazyVideoCall = lazy(() => import('../../components/features/VideoCall').then((module) => ({ default: module.VideoCall })));
import { BookingModal } from "@/components/features/BookingModal";
import { MedicalRecordsManager } from "@/components/features/MedicalRecordsManager";
import { AutomationAssistant } from "@/components/features/AutomationAssistant";
import { useNavigate } from "react-router-dom";
import { User as UserIcon, Star, MapPin, Database, Activity as ActivityIcon } from "lucide-react";

const sparkData = (vitals: any[], key: string) =>
  vitals.slice(-12).map(v => ({ v: v[key] }));

const PatientDashboard = () => {
  const navigate = useNavigate();
  const { user, vitals, alerts, appointments, medications, adherence, latestAiInsight, refreshData, setAppointments } = useHealth();
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [activeCall, setActiveCall] = useState<any>(null);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [recommendedDoctors, setRecommendedDoctors] = useState<BackendDoctor[]>([]);
  const [isDoctorsLoading, setIsDoctorsLoading] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<BackendDoctor | undefined>(undefined);
  const [dashboardTab, setDashboardTab] = useState<"Metrics" | "Records">("Metrics");
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [insightHistory, setInsightHistory] = useState<any[]>([]);

  useEffect(() => {
    BackendAPI.getPatientHistory().then(setHistory).catch(console.error);
    BackendAPI.getAiInsightsHistory().then(setInsightHistory).catch(console.error);
    fetchActiveDoctors();
  }, []);

  const fetchActiveDoctors = async () => {
    try {
      setIsDoctorsLoading(true);
      const data = await BackendAPI.getActiveDoctors();
      setRecommendedDoctors(data);
    } catch (err) {
      console.error("Failed to load clinical grid");
    } finally {
      setIsDoctorsLoading(false);
    }
  };

  // Single Source of Truth for top-level metrics
  const hasData = !!latestAiInsight;
  const current = {
    heartRate: latestAiInsight?.heart_rate || 'No data',
    bp: latestAiInsight?.blood_pressure || 'No data',
    glucose: latestAiInsight?.glucose || 'No data',
    wellness: typeof latestAiInsight?.ai_wellness_score === 'number' ? Math.max(0, latestAiInsight.ai_wellness_score) : 'No data'
  };

  const trendData = vitals.slice(-24).map(v => ({
    hour: new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    hr: v.heartRate || 72,
    bp: v.systolicBP || 120,
  }));

  const insightHistoryData = insightHistory.map(h => ({
    hour: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    bp: h.hypertensionRisk || 0,
    heart: h.heartDiseaseRisk || 0,
    diabetes: h.diabetesRisk || 0,
  }));

  // Ensure latest point in trend matches AI Insight if available
  if (hasData && trendData.length > 0) {
    const lastPoint = trendData[trendData.length - 1];
    lastPoint.hr = latestAiInsight.heart_rate;
    lastPoint.bp = parseInt(latestAiInsight.blood_pressure.split('/')[0]);
  }

  const adherenceData = adherence.map(a => ({
    day: new Date(a.date).toLocaleDateString([], { weekday: 'short' }),
    v: Math.round((a.taken / a.total) * 100),
    taken: a.taken,
    total: a.total
  }));

  const handleDownloadReport = async () => {
    try {
      setIsGeneratingReport(true);
      const blob = await BackendAPI.downloadReport();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `carexai_report_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Health report generated and downloaded.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate report.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await BackendAPI.cancelAppointment(id);
      // Manually update state for immediate feedback
      setAppointments(prev => prev.filter(a => a.id !== id));
      toast.success("Appointment cancelled successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel appointment");
    }
  };

  const upcomingAppointments = appointments
    .filter(a => a.status === 'SCHEDULED' || a.status === 'PENDING' || a.status === 'IN_PROGRESS')
    .slice(0, 3)
    .map(a => {
      const isToday = a.date === new Date().toISOString().split('T')[0];
      return {
        id: a.id,
        day: new Date(a.date).toLocaleDateString([], { month: 'short', day: 'numeric' }),
        time: a.time,
        title: `${a.type} · ${a.doctorName}`,
        type: a.consultationType === 'VIDEO' ? 'Video' : 'In-person',
        isToday,
        canJoin: isToday && a.consultationType === 'VIDEO',
        doctorName: a.doctorName
      };
    });

  const observations = alerts.length > 0 ? alerts.slice(0, 5).map(a => ({
    time: new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    text: a.message,
    type: a.severity === 'CRITICAL' ? 'warning' : 'ai',
    icon: a.severity === 'CRITICAL' ? Activity : Brain
  })) : [
    { time: "Just now", text: "Awaiting real-time biometric telemetry...", type: "ai", icon: Brain }
  ];

  return (
    <AppLayout title="Patient Dashboard" subtitle={`Welcome back, ${user?.name || 'User'}`}>
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => setDashboardTab("Metrics")}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold uppercase tracking-[0.2em] text-[10px] transition-all",
            dashboardTab === "Metrics" ? "bg-primary/20 text-primary border border-primary/40 shadow-glow-primary" : "bg-muted/10 text-muted-foreground border border-border/50 hover:bg-muted/20"
          )}
        >
          <ActivityIcon size={14} /> Health Metrics
        </button>
        <button
          onClick={() => setDashboardTab("Records")}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold uppercase tracking-[0.2em] text-[10px] transition-all",
            dashboardTab === "Records" ? "bg-primary/20 text-primary border border-primary/40 shadow-glow-primary" : "bg-muted/10 text-muted-foreground border border-border/50 hover:bg-muted/20"
          )}
        >
          <Database size={14} /> Medical Vault
        </button>

        <div className="flex-1" />

        <NeonButton
          variant="primary"
          size="sm"
          className="h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-[0.2em]"
          onClick={() => navigate('/doctors')}
        >
          <Stethoscope size={14} className="mr-2" /> Consult Doctors
        </NeonButton>
      </div>

      <AnimatePresence mode="wait">
        {dashboardTab === "Metrics" ? (
          <motion.div
            key="metrics"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            {/* Top row: vitals */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <VitalCard
                label="Heart Rate"
                value={current.heartRate}
                unit={typeof current.heartRate === 'number' ? "bpm" : ""}
                icon={Heart}
                color="destructive"
                data={sparkData(vitals, 'heartRate')}
                trend={2}
              />
              <VitalCard
                label="Blood Pressure"
                value={current.bp}
                unit={typeof current.bp === 'string' && current.bp.includes('/') ? "mmHg" : ""}
                icon={Activity}
                color="primary"
                data={sparkData(vitals, 'systolicBP')}
                trend={-1}
              />
              <VitalCard
                label="Glucose"
                value={current.glucose}
                unit={typeof current.glucose === 'number' ? "mg/dL" : ""}
                icon={Droplets}
                color="success"
                data={sparkData(vitals, 'glucose')}
                trend={3}
              />
              <VitalCard
                label="AI Wellness"
                value={current.wellness}
                unit={typeof current.wellness === 'number' ? "/100" : ""}
                icon={Brain}
                color="secondary"
                data={sparkData(vitals, 'heartRate')}
                trend={5}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Trend chart */}
              <GlassCard className="lg:col-span-2 p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="font-display text-xl font-semibold">AI Risk Trends</h2>
                    <p className="text-sm text-muted-foreground">Continuous monitoring · live</p>
                  </div>
                  <RiskBadge level="low" />
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height={256} minWidth={0} debounce={50}>
                    <LineChart data={insightHistoryData}>
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
                      <Line type="monotone" dataKey="bp" name="BP Risk %" stroke="hsl(var(--secondary))" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="heart" name="Heart Risk %" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="diabetes" name="Diabetes Risk %" stroke="hsl(var(--success))" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>

              {/* AI Insight Details - Now showing the full Risk Matrix */}
              <div className="space-y-6">
                <AIWellnessScore
                  metrics={vitals[vitals.length - 1] || {
                    systolicBP: 120,
                    diastolicBP: 80,
                    glucose: 100,
                    bmi: 22,
                    cholesterol: 180,
                    smoking: false,
                    activityLevel: 'Moderate',
                    timestamp: new Date().toISOString()
                  }}
                  aiResult={null}
                  persistedInsight={latestAiInsight}
                />

                <GlassCard className="p-4">
                  <NeonButton
                    variant="neon"
                    size="sm"
                    className="w-full"
                    onClick={handleDownloadReport}
                    isLoading={isGeneratingReport}
                  >
                    {isGeneratingReport ? "Analyzing..." : "View Full Report"} <ArrowUpRight className="h-3.5 w-3.5 ml-2" />
                  </NeonButton>
                </GlassCard>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                      <Tooltip
                        cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                        contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-popover border border-border p-2 rounded-lg shadow-xl text-[10px]">
                                <p className="font-bold text-foreground">{data.day}</p>
                                <p className="text-primary">Adherence: {data.v}%</p>
                                <p className="text-muted-foreground">Taken: {data.taken}/{data.total}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="v" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>

              {/* Appointments */}
              <GlassCard className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-semibold">Upcoming</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsBookingOpen(true)}
                      className="text-[10px] uppercase font-bold text-primary hover:text-primary-glow transition-colors border border-primary/20 px-2 py-1 rounded"
                    >
                      + New
                    </button>
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <div className="space-y-3">
                  {upcomingAppointments.length > 0 ? upcomingAppointments.map((a, i) => (
                    <div key={i} className={cn(
                      "glass rounded-xl p-3 flex flex-col gap-3 transition-all",
                      a.canJoin ? "border-primary/60 bg-primary/5" : "hover:border-primary/40"
                    )}>
                      <div className="flex items-center gap-3">
                        <div className="text-center px-2">
                          <p className="text-[10px] text-muted-foreground uppercase">{a.day.split(" ")[0]}</p>
                          <p className="font-display font-bold">{a.day.split(" ")[1]}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{a.title}</p>
                          <p className="text-xs text-muted-foreground">{a.time} · {a.type}</p>
                        </div>
                      </div>
                      {a.canJoin ? (
                        <div className="flex gap-2">
                          <NeonButton
                            variant="primary"
                            size="sm"
                            className="flex-1 h-8 text-[10px] font-black uppercase"
                            onClick={() => setActiveCall(a)}
                          >
                            Establish Uplink
                          </NeonButton>
                          <button
                            onClick={() => handleCancel(a.id)}
                            className="px-3 h-8 text-[10px] font-bold uppercase text-destructive border border-destructive/20 hover:bg-destructive/10 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleCancel(a.id)}
                          className="w-full h-8 text-[10px] font-bold uppercase text-destructive/60 border border-destructive/10 hover:bg-destructive/5 rounded-lg transition-colors"
                        >
                          Cancel Appointment
                        </button>
                      )}
                    </div>
                  )) : (
                    <p className="text-xs text-muted-foreground text-center py-4">No upcoming appointments</p>
                  )}
                </div>
              </GlassCard>


              {/* Consultation History */}
              <GlassCard className="p-6 lg:col-span-2">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <h3 className="font-display font-bold uppercase tracking-wider text-xs text-muted-foreground">Consultation History</h3>
                  </div>
                </div>

                <div className="space-y-4">
                  {history.length > 0 ? history.map((h, i) => (
                    <div key={i} className="flex items-center justify-between p-4 glass rounded-2xl border border-border/50 hover:border-primary/30 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <UserIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold">{h.doctorName}</h4>
                          <p className="text-[10px] text-muted-foreground uppercase">{new Date(h.date).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })} · {h.type}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {h.summary && (
                          <NeonButton variant="ghost" size="sm" className="h-8 text-[10px] font-bold uppercase">View Summary</NeonButton>
                        )}
                      </div>
                    </div>
                  )) : (
                    <p className="text-xs text-muted-foreground text-center py-8">No consultation history available yet.</p>
                  )}
                </div>
              </GlassCard>

              {/* Recommended Doctors Section */}
              <GlassCard className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-primary" />
                    <h3 className="font-display font-bold uppercase tracking-wider text-xs text-muted-foreground">Clinician Network</h3>
                  </div>
                  <NeonButton variant="ghost" size="sm" className="text-[10px] uppercase font-bold" onClick={() => navigate('/doctors')}>
                    View All
                  </NeonButton>
                </div>

                <div className="space-y-3">
                  {isDoctorsLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-24 w-full glass rounded-xl animate-pulse bg-muted/10" />
                    ))
                  ) : recommendedDoctors.length > 0 ? (
                    recommendedDoctors.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-3 glass rounded-xl border border-border/50 hover:border-primary/30 transition-all cursor-pointer group"
                        onClick={() => {
                          setSelectedDoctor(doc);
                          setIsBookingOpen(true);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-aurora flex items-center justify-center text-primary-foreground font-bold text-xs">
                            {doc.profilePicUrl ? (
                              <img src={doc.profilePicUrl} alt="" className="h-full w-full rounded-full object-cover" />
                            ) : (
                              doc.name.split(" ").map(n => n[0]).join("")
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold truncate group-hover:text-primary transition-colors">{doc.name}</h4>
                            <p className="text-[10px] text-muted-foreground uppercase truncate">{doc.specialization}</p>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1 justify-end text-yellow-500">
                              <Star className="h-3 w-3 fill-yellow-500" />
                              <span className="text-[10px] font-black">{doc.rating || '4.8'}</span>
                            </div>
                            <p className="text-[9px] text-primary font-black mt-1">₹{doc.consultationFee || 500}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-6 text-center">
                      <p className="text-xs text-muted-foreground">No doctors available currently</p>
                    </div>
                  )}
                </div>
              </GlassCard>

              {/* Activity */}
              <GlassCard className="p-6 lg:col-span-3 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors" />

                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary animate-pulse" />
                    <h3 className="font-display font-bold uppercase tracking-wider text-xs text-muted-foreground">Recent Observations</h3>
                  </div>
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-success">
                    <span className="h-1.5 w-1.5 rounded-full bg-success animate-ping" /> Real-time Analysis
                  </span>
                </div>

                {observations.length > 0 ? (
                  <ul className="space-y-4">
                    {observations.map((obs, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1, type: "spring", stiffness: 100 }}
                        className="flex items-center gap-4 group/item"
                      >
                        <div className={cn(
                          "h-10 w-10 rounded-xl flex items-center justify-center border transition-all duration-300 group-hover/item:scale-110",
                          obs.type === "warning" ? "bg-destructive/10 border-destructive/20 text-destructive shadow-glow-destructive" :
                            "bg-primary/10 border-primary/20 text-primary shadow-glow-primary"
                        )}>
                          <obs.icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground leading-snug">{obs.text}</p>
                          <p className="text-[10px] text-muted-foreground mt-1 font-mono">{obs.time}</p>
                        </div>
                      </motion.li>
                    ))}
                  </ul>
                ) : (
                  <div className="h-48 border-2 border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center text-center p-8 bg-muted/20">
                    <div className="h-12 w-12 rounded-full bg-background border flex items-center justify-center mb-4 text-muted-foreground">
                      <Activity className="h-6 w-6 opacity-20" />
                    </div>
                    <p className="text-sm text-muted-foreground font-medium">No recent AI observations detected.</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1 uppercase tracking-widest">Awaiting sensor telemetry...</p>
                  </div>
                )}
              </GlassCard>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="records"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <MedicalRecordsManager />
          </motion.div>
        )}
      </AnimatePresence>

      <BookingModal
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        initialDoctor={selectedDoctor}
      />

      {/* Video Call Modal */}
      {activeCall && (
        <Suspense fallback={<div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center text-white font-mono uppercase tracking-[0.3em]">Connecting to Secure Health-Link...</div>}>
          <LazyVideoCall
            appointmentId={activeCall.id}
            otherUserName={activeCall.doctorName}
            currentUserRole={UserRole.PATIENT}
            onClose={() => setActiveCall(null)}
          />
        </Suspense>
      )}

      {/* Agentic AI Assistant */}
      <AutomationAssistant
        isOpen={isAiOpen}
        onClose={() => setIsAiOpen(false)}
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

        {/* Tooltip */}
        <div className="absolute right-20 bg-background/90 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary">Neural Copilot</p>
          <p className="text-[8px] text-muted-foreground mt-0.5">Clinical Intelligence Active</p>
        </div>
      </motion.button>
    </AppLayout>
  );
};

export default PatientDashboard;
