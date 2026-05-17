import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, Clock, ChevronRight, X, Heart, 
  User, CheckCircle, Search, Stethoscope,
  ChevronLeft, AlertCircle, Loader2, Sparkles
} from 'lucide-react';
import { GlassCard } from '@/components/carex/GlassCard';
import { NeonButton } from '@/components/carex/NeonButton';
import { BackendAPI, BackendDoctor } from '@/services/apiClient';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useHealth } from '@/services/HealthContext';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDoctor?: BackendDoctor;
}

export const BookingModal: React.FC<BookingModalProps> = ({ isOpen, onClose, initialDoctor }) => {
  const { socket, refreshData } = useHealth();
  const [step, setStep] = useState(initialDoctor ? 2 : 1);
  const [doctors, setDoctors] = useState<BackendDoctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<BackendDoctor | null>(initialDoctor || null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [specialization, setSpecialization] = useState("All");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchDoctors();
      if (initialDoctor) {
        setSelectedDoctor(initialDoctor);
        setStep(2);
      }
    }
  }, [isOpen, initialDoctor]);

  useEffect(() => {
    if (isOpen && selectedDoctor && selectedDate) {
      fetchSlots();
    }
  }, [isOpen, selectedDoctor, selectedDate]);

  // Real-time synchronization (Requirement 6)
  useEffect(() => {
    if (!socket) return;

    const handleSlotUpdate = (updatedSlot: any) => {
      if (selectedDoctor?.id === updatedSlot.doctorId && selectedDate === updatedSlot.date) {
        setSlots(prev => prev.map(s => s.id === updatedSlot.id ? { ...s, ...updatedSlot } : s));
      }
    };

    const handleSlotsCreated = (data: { doctorId: string, date: string, slots: any[] }) => {
      if (selectedDoctor?.id === data.doctorId && selectedDate === data.date) {
        setSlots(data.slots);
      }
    };

    socket.on('slot:updated', handleSlotUpdate);
    socket.on('slot:created', handleSlotsCreated);

    return () => {
      socket.off('slot:updated', handleSlotUpdate);
      socket.off('slot:created', handleSlotsCreated);
    };
  }, [socket, selectedDoctor, selectedDate]);

  const fetchDoctors = async () => {
    try {
      setIsLoading(true);
      const data = await BackendAPI.getActiveDoctors();
      setDoctors(data);
    } catch (err) {
      toast.error("Failed to load clinical grid");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSlots = async () => {
    if (!selectedDoctor) return;
    try {
      setIsLoading(true);
      const data = await BackendAPI.getDoctorSlots(selectedDoctor.id, selectedDate);
      setSlots(data);
    } catch (err) {
      console.error("Failed to load availability");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBook = async () => {
    if (!selectedDoctor || !selectedSlot) return;
    try {
      setIsLoading(true);
      await BackendAPI.bookAppointment({
        doctorId: selectedDoctor.id,
        slotId: selectedSlot.id,
        reason: reason || "General Consultation"
      });
      
      // Force refresh of health data to ensure dashboard visibility
      refreshData();
      
      toast.success("Appointment secured in the clinical grid.", {
        icon: <Sparkles className="h-4 w-4 text-primary" />
      });
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Booking failed");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredDoctors = doctors.filter(d => 
    (specialization === "All" || d.specialization === specialization) &&
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  const specializations = ["All", ...Array.from(new Set(doctors.map(d => d.specialization).filter(Boolean)))];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl bg-background border border-primary/20 shadow-glow-primary rounded-3xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-border/50 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-display font-bold text-xl tracking-tight text-foreground">Clinical Appointment</h2>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">Secure Slot Allocation · Step {step} of 3</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted/50 rounded-full transition-colors text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input 
                      type="text" 
                      placeholder="Search clinicians..."
                      className={cn(
                        "w-full bg-[#0a0f19]/85 backdrop-blur-2xl border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-white text-sm",
                        "placeholder:text-white/30 font-medium transition-all duration-500",
                        "focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10",
                        "hover:border-white/20 hover:bg-[#0d1425]/90"
                      )}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="relative">
                    <Stethoscope className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <select 
                      className="bg-muted/20 border border-border/50 rounded-xl py-3 pl-12 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 appearance-none cursor-pointer min-w-[180px]"
                      value={specialization}
                      onChange={(e) => setSpecialization(e.target.value)}
                    >
                      {specializations.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {isLoading && doctors.length === 0 ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-24 glass rounded-2xl animate-pulse" />
                    ))
                  ) : filteredDoctors.map(doc => (
                    <div 
                      key={doc.id}
                      onClick={() => { setSelectedDoctor(doc); setStep(2); }}
                      className="group glass p-4 rounded-2xl border border-border/50 hover:border-primary/50 cursor-pointer transition-all hover:bg-primary/5 relative overflow-hidden"
                    >
                      <div className="flex items-center gap-4 relative z-10">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20">
                          {doc.profilePicUrl ? (
                            <img src={doc.profilePicUrl} className="h-full w-full rounded-full object-cover" />
                          ) : (
                            doc.name.split(" ").map(n => n[0]).join("")
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm truncate text-foreground group-hover:text-primary transition-colors">{doc.name}</h4>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-widest truncate">{doc.specialization || "General Clinician"}</p>
                          <p className="text-[10px] text-primary font-black mt-1">₹{doc.consultationFee || 500}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                      </div>
                    </div>
                  ))}
                  {filteredDoctors.length === 0 && !isLoading && (
                    <div className="col-span-full py-12 flex flex-col items-center justify-center opacity-40">
                      <AlertCircle className="h-12 w-12 mb-3" />
                      <p className="text-xs font-bold uppercase tracking-widest italic">No active clinicians found in grid</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {step === 2 && selectedDoctor && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-4 p-4 glass rounded-2xl border border-primary/20 bg-primary/5">
                  <div className="h-14 w-14 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xl border border-primary/40 shadow-glow-primary">
                    {selectedDoctor.profilePicUrl ? (
                      <img src={selectedDoctor.profilePicUrl} className="h-full w-full rounded-full object-cover" />
                    ) : (
                      selectedDoctor.name.split(" ").map(n => n[0]).join("")
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-lg">{selectedDoctor.name}</h3>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">{selectedDoctor.specialization}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[9px] bg-primary/30 text-primary px-2 py-0.5 rounded font-black uppercase tracking-tighter border border-primary/40">Verified</span>
                      <span className="text-[9px] text-muted-foreground uppercase font-black">{selectedDoctor.experienceYears || 5}+ Years Exp</span>
                    </div>
                  </div>
                  <button onClick={() => setStep(1)} className="ml-auto text-[10px] font-black uppercase text-primary hover:text-primary-glow underline underline-offset-4 decoration-primary/30 tracking-widest">Change</button>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1 flex items-center justify-between">
                    <span className="flex items-center gap-2"><Calendar size={12} /> Select Consultation Date</span>
                    <input 
                      type="date"
                      className="bg-muted/30 border border-border/50 rounded-lg px-2 py-1 text-[10px] font-bold text-primary focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all cursor-pointer"
                      value={selectedDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setSelectedDate(e.target.value)}
                    />
                  </label>
                  <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide custom-scrollbar">
                    {[0, 1, 2, 3, 4, 5, 6].map(offset => {
                      const d = new Date();
                      d.setDate(d.getDate() + offset);
                      const iso = d.toISOString().split('T')[0];
                      const active = selectedDate === iso;
                      return (
                        <button 
                          key={iso}
                          onClick={() => setSelectedDate(iso)}
                          className={cn(
                            "flex flex-col items-center justify-center min-w-[75px] h-24 rounded-2xl border transition-all duration-300",
                            active 
                              ? "bg-primary border-primary text-primary-foreground shadow-glow-primary scale-105" 
                              : "glass border-border/50 text-muted-foreground hover:border-primary/40"
                          )}
                        >
                          <span className={cn("text-[10px] uppercase font-black tracking-tighter opacity-70", active ? "text-primary-foreground" : "text-muted-foreground")}>{d.toLocaleDateString([], { weekday: 'short' })}</span>
                          <span className="text-2xl font-black mt-1">{d.getDate()}</span>
                          <span className={cn("text-[8px] uppercase font-black tracking-widest mt-1", active ? "text-primary-foreground/70" : "text-muted-foreground/50")}>{d.toLocaleDateString([], { month: 'short' })}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1 flex items-center gap-2">
                    <Clock size={12} /> Clinical Grid Availability
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                    {isLoading && slots.length === 0 ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-10 glass rounded-xl animate-pulse" />
                      ))
                    ) : slots.map(slot => {
                      const isAvailable = slot.status === 'AVAILABLE';
                      const isBooked = slot.status === 'BOOKED';
                      const isBlocked = slot.status === 'BLOCKED';
                      
                      return (
                        <button
                          key={slot.id}
                          disabled={!isAvailable}
                          onClick={() => { setSelectedSlot(slot); setStep(3); }}
                          className={cn(
                            "py-3 px-4 rounded-xl border text-[10px] font-black tracking-widest transition-all relative overflow-hidden",
                            selectedSlot?.id === slot.id ? "bg-primary border-primary text-primary-foreground shadow-glow-primary" : 
                            isBooked ? "bg-destructive/10 border-destructive/30 text-destructive/60 cursor-not-allowed" :
                            isBlocked ? "bg-muted/10 border-border/50 text-muted-foreground/40 cursor-not-allowed" :
                            "glass border-border/50 text-foreground hover:border-primary/60 hover:text-primary transition-all"
                          )}
                        >
                          {slot.startTime}
                          {isBooked && <span className="absolute inset-0 bg-destructive/5 pointer-events-none" />}
                        </button>
                      );
                    })}
                    {slots.length === 0 && !isLoading && (
                      <div className="col-span-full py-10 glass rounded-2xl border border-dashed border-border/50 flex flex-col items-center justify-center opacity-50">
                        <Loader2 className="h-6 w-6 text-muted-foreground mb-2" />
                        <p className="text-[10px] font-black uppercase tracking-widest italic">No clinical slots defined for this cycle</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && selectedDoctor && selectedSlot && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="text-center space-y-3">
                  <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/20 shadow-glow-primary">
                    <CheckCircle className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="font-display font-bold text-2xl tracking-tight text-foreground">Confirm Clinical Session</h3>
                  <p className="text-muted-foreground text-xs uppercase tracking-widest font-medium">Verify your consultation parameters below</p>
                </div>

                <div className="space-y-3">
                   <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-black text-primary/60 tracking-[0.3em] ml-1 mb-2 block">Consultation Objective</label>
                      <div className="relative group">
                        <input 
                          type="text"
                          placeholder="e.g. Fever, Chronic Fatigue, Neural Sync..."
                          className={cn(
                            "w-full bg-[#0a0f19]/85 backdrop-blur-2xl border border-white/10 rounded-2xl px-6 py-4 text-white text-sm",
                            "placeholder:text-white/30 font-medium transition-all duration-500",
                            "focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 focus:shadow-[0_0_25px_rgba(0,242,255,0.15)]",
                            "hover:border-white/20 hover:bg-[#0d1425]/90"
                          )}
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        />
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 to-secondary/20 opacity-0 group-focus-within:opacity-10 pointer-events-none transition-opacity duration-500" />
                      </div>
                   </div>

                   <GlassCard className="p-6 space-y-4 border-primary/10 bg-primary/[0.02]">
                    <div className="flex justify-between items-center border-b border-border/40 pb-4">
                      <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Clinician</span>
                      <span className="text-sm font-bold text-foreground">{selectedDoctor.name}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-border/40 pb-4">
                      <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Temporal Allocation</span>
                      <span className="text-sm font-bold text-foreground">{new Date(selectedDate).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })} · {selectedSlot.startTime}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Access Mode</span>
                      <div className="flex items-center gap-2 text-xs font-black text-primary uppercase tracking-widest">
                        <Sparkles className="h-3 w-3" /> Secure HD Tele-Health
                      </div>
                    </div>
                  </GlassCard>
                </div>

                <div className="flex gap-4 pt-4">
                  <NeonButton variant="ghost" className="flex-1 h-12 uppercase font-black tracking-[0.2em] text-[10px]" onClick={() => setStep(2)}>Adjust Schedule</NeonButton>
                  <NeonButton variant="primary" className="flex-1 h-12 uppercase font-black tracking-[0.2em] text-[10px]" onClick={handleBook} isLoading={isLoading}>
                    Authorize Session
                  </NeonButton>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
