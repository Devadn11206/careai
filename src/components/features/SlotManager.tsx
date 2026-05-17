import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calendar, Clock, Plus, Trash2, 
  Lock, Unlock, CheckCircle2, AlertCircle,
  Loader2, Save, X, Settings2, Grid
} from "lucide-react";
import { GlassCard } from "@/components/carex/GlassCard";
import { NeonButton } from "@/components/carex/NeonButton";
import { BackendAPI } from "@/services/apiClient";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { useHealth } from "@/services/HealthContext";

export const SlotManager = () => {
  const { socket } = useHealth();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [slots, setSlots] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  
  // Slot Creation Config
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [duration, setDuration] = useState(30);
  const [maxPatients, setMaxPatients] = useState(1);
  const [createDate, setCreateDate] = useState(new Date().toISOString().split('T')[0]);
  const [daysToGenerate, setDaysToGenerate] = useState(1);

  useEffect(() => {
    fetchSlots();
  }, [date]);

  // --- REAL-TIME SYNCHRONIZATION ---
  useEffect(() => {
    if (!socket) return;

    const handleSlotUpdated = (updatedSlot: any) => {
      setSlots(prev => prev.map(s => s.id === updatedSlot.id ? { ...s, ...updatedSlot } : s));
    };

    const handleSlotsCreated = (data: any) => {
      if (data.date === date) {
        setSlots(data.slots);
      }
    };

    socket.on('slot:updated', handleSlotUpdated);
    socket.on('slot:created', handleSlotsCreated);

    return () => {
      socket.off('slot:updated', handleSlotUpdated);
      socket.off('slot:created', handleSlotsCreated);
    };
  }, [socket, date]);

  const fetchSlots = async () => {
    setIsLoading(true);
    try {
      const data = await BackendAPI.getDoctorSlots("", date);
      setSlots(data);
    } catch (err) {
      console.error("Failed to fetch slots");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSlots = async () => {
    setIsLoading(true);
    try {
      const start = new Date(createDate);
      for (let i = 0; i < daysToGenerate; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        
        await BackendAPI.createDoctorSlots({
          date: dateStr,
          startTime,
          endTime,
          durationMinutes: duration,
          maxPatientsPerSlot: maxPatients
        });
      }
      
      toast.success(`Clinical grid synchronized for ${daysToGenerate > 1 ? `${daysToGenerate} days starting from ${createDate}` : createDate}`);
      setIsConfigOpen(false);
      fetchSlots(); // Refresh view
    } catch (err: any) {
      toast.error(err.message || "Failed to generate grid");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleBlockSlot = async (slotId: string, currentBlocked: boolean) => {
    try {
      await BackendAPI.blockDoctorSlot(slotId, !currentBlocked);
      // State will be updated via 'slot:updated' socket event
    } catch (err) {
      toast.error("Action failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold tracking-tight">Slot Orchestrator</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage consultation availability · Real-time clinical grid</p>
        </div>
        <div className="flex items-center gap-3">
          <input 
            type="date"
            className="bg-muted/20 border border-border/50 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all cursor-pointer"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <NeonButton 
            variant="primary" 
            size="sm" 
            className="h-10 px-6 font-bold uppercase tracking-wider"
            onClick={() => {
              setCreateDate(date);
              setIsConfigOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" /> Bulk Create
          </NeonButton>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
        {isLoading ? (
          Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted/10 rounded-xl animate-pulse" />
          ))
        ) : slots.length > 0 ? (
          slots.map((slot) => (
            <motion.div
              key={slot.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                "p-3 rounded-2xl border transition-all relative group",
                slot.isBlocked ? "bg-muted/10 border-border/30 text-muted-foreground opacity-60" :
                slot.bookedCount >= slot.maxPatients ? "bg-destructive/5 border-destructive/30 text-destructive shadow-glow-destructive" :
                "bg-success/5 border-success/30 text-success shadow-glow-success hover:border-success/60"
              )}
            >
              <div className="flex flex-col items-center justify-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-sm font-bold">{slot.startTime}</span>
                <span className="text-[9px] font-black uppercase tracking-tighter">
                  {slot.isBlocked ? "BLOCKED" : (slot.bookedCount >= slot.maxPatients ? "BOOKED" : `${slot.bookedCount}/${slot.maxPatients}`)}
                </span>
              </div>
              
              <button 
                onClick={() => toggleBlockSlot(slot.id, slot.isBlocked)}
                className="absolute top-1 right-1 p-1 rounded-lg bg-background/50 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {slot.isBlocked ? <Unlock size={10} /> : <Lock size={10} />}
              </button>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-center opacity-40">
            <Calendar className="h-12 w-12 mb-4" />
            <p className="text-sm font-bold uppercase tracking-widest">No slots defined for this date</p>
            <p className="text-xs mt-1">Use 'Bulk Create' to generate consultation slots.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isConfigOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsConfigOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg"
            >
              <GlassCard className="p-6 space-y-6 border-primary/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Settings2 className="h-5 w-5 text-primary" />
                    <h3 className="text-xl font-bold font-display">Bulk Slot Configuration</h3>
                  </div>
                  <button onClick={() => setIsConfigOpen(false)} className="text-muted-foreground hover:text-white">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest ml-1">Clinical Date</label>
                    <input 
                      type="date"
                      className="w-full bg-muted/20 border border-border/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all cursor-pointer"
                      value={createDate}
                      onChange={(e) => setCreateDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest ml-1">Days to Generate</label>
                    <input 
                      type="number"
                      min="1"
                      max="14"
                      className="w-full bg-muted/20 border border-border/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                      value={daysToGenerate}
                      onChange={(e) => setDaysToGenerate(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest ml-1">Start Time</label>
                    <input 
                      type="time"
                      className="w-full bg-muted/20 border border-border/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest ml-1">End Time</label>
                    <input 
                      type="time"
                      className="w-full bg-muted/20 border border-border/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest ml-1">Duration (Min)</label>
                    <select 
                      className="w-full bg-muted/20 border border-border/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all appearance-none cursor-pointer"
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                    >
                      <option value={15}>15 Minutes</option>
                      <option value={20}>20 Minutes</option>
                      <option value={30}>30 Minutes</option>
                      <option value={45}>45 Minutes</option>
                      <option value={60}>1 Hour</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest ml-1">Max Patients</label>
                    <input 
                      type="number"
                      min="1"
                      className="w-full bg-muted/20 border border-border/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                      value={maxPatients}
                      onChange={(e) => setMaxPatients(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <AlertCircle className="h-5 w-5 text-primary shrink-0" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed uppercase tracking-widest">
                    Generated slots will instantly sync with the patient-facing booking grid. Existing slots for the same timings will be updated.
                  </p>
                </div>

                <NeonButton 
                  variant="primary" 
                  className="w-full h-12 font-bold uppercase tracking-widest"
                  onClick={handleCreateSlots}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Generate Clinical Grid"}
                </NeonButton>
              </GlassCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
