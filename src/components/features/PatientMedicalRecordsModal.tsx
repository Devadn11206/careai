import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, FileText, ShieldAlert, Lock, Unlock, 
  Search, Filter, Download, Eye, Loader2,
  FileBadge, History, Activity, Pill
} from "lucide-react";
import { GlassCard } from "@/components/carex/GlassCard";
import { NeonButton } from "@/components/carex/NeonButton";
import { BackendAPI } from "@/services/apiClient";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PatientMedicalRecordsModalProps {
  patientId: string;
  patientName: string;
  onClose: () => void;
}

export const PatientMedicalRecordsModal: React.FC<PatientMedicalRecordsModalProps> = ({
  patientId,
  patientName,
  onClose
}) => {
  const [records, setRecords] = useState<any[]>([]);
  const [status, setStatus] = useState<"loading" | "authorized" | "unauthorized">("loading");
  const [isRequesting, setIsRequesting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchRecords();
  }, [patientId]);

  const fetchRecords = async () => {
    setStatus("loading");
    try {
      const data = await BackendAPI.getPatientRecordsByDoctor(patientId);
      setRecords(data);
      setStatus("authorized");
    } catch (err: any) {
      if (err.message.includes("Access denied")) {
        setStatus("unauthorized");
      } else {
        toast.error("Failed to fetch medical records");
      }
    }
  };

  const handleRequestAccess = async () => {
    setIsRequesting(true);
    try {
      await BackendAPI.requestRecordAccess(patientId);
      toast.success("Access request sent to patient");
    } catch (err: any) {
      toast.error(err.message || "Failed to request access");
    } finally {
      setIsRequesting(false);
    }
  };

  const filteredRecords = records.filter(r => 
    r.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
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
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col"
      >
        <GlassCard className="flex-1 overflow-hidden border-primary/20 flex flex-col">
          <div className="p-6 border-b border-border/50 flex items-center justify-between bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <History className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-display text-xl font-bold">Comprehensive Medical History</h3>
                <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">
                  Patient: <span className="text-primary font-bold">{patientName}</span> · Secure Clinical Node
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {status === "loading" ? (
              <div className="h-full flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Synchronizing Clinical Data...</p>
              </div>
            ) : status === "unauthorized" ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-6 py-12">
                <div className="h-24 w-24 rounded-full bg-destructive/10 flex items-center justify-center relative">
                  <Lock className="h-10 w-10 text-destructive" />
                  <ShieldAlert className="absolute -top-1 -right-1 h-8 w-8 text-destructive animate-pulse" />
                </div>
                <div className="max-w-md space-y-2">
                  <h4 className="text-2xl font-bold">Access Gated</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    You do not have active permission to view {patientName}'s clinical history. Per HIPAA & CareXAI security protocols, patients must explicitly grant record access.
                  </p>
                </div>
                <NeonButton 
                  variant="primary" 
                  className="px-12 h-12 font-bold uppercase tracking-[0.2em]"
                  onClick={handleRequestAccess}
                  disabled={isRequesting}
                >
                  {isRequesting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Request Secure Access"}
                </NeonButton>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                  Patient will receive an instant notification to approve your request.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input 
                      type="text"
                      placeholder="Search reports, scans, or prescriptions..."
                      className="w-full bg-muted/20 border border-border/50 rounded-xl pl-12 pr-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-success/10 border border-success/30 rounded-xl">
                    <Unlock className="h-4 w-4 text-success" />
                    <span className="text-[10px] font-bold text-success uppercase tracking-widest">Authorized Session</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredRecords.length > 0 ? (
                    filteredRecords.map((record, i) => (
                      <GlassCard key={record.id} className="p-4 group hover:border-primary/40 transition-all cursor-pointer">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <FileBadge className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <h5 className="font-bold text-sm truncate">{record.title}</h5>
                              <p className="text-[9px] text-muted-foreground uppercase mt-0.5">
                                {record.type.replace('_', ' ')} · {new Date(record.date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="h-8 w-8 rounded-lg bg-muted/20 flex items-center justify-center hover:bg-primary/20 transition-colors">
                              <Eye size={14} className="text-primary" />
                            </button>
                            <button className="h-8 w-8 rounded-lg bg-muted/20 flex items-center justify-center hover:bg-primary/20 transition-colors">
                              <Download size={14} className="text-primary" />
                            </button>
                          </div>
                        </div>
                      </GlassCard>
                    ))
                  ) : (
                    <div className="col-span-full py-12 text-center opacity-40">
                      <p className="text-xs font-bold uppercase tracking-[0.2em]">No records found in this vault</p>
                    </div>
                  )}
                </div>

                <div className="pt-6 border-t border-border/50">
                   <div className="flex items-center gap-2 mb-4">
                      <Activity className="h-4 w-4 text-primary" />
                      <h4 className="text-xs font-bold uppercase tracking-widest">Vital Trends & AI Insights</h4>
                   </div>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl bg-muted/10 border border-border/30">
                        <p className="text-[9px] text-muted-foreground uppercase font-bold">Risk Level</p>
                        <p className="text-sm font-bold text-success">LOW</p>
                      </div>
                      <div className="p-3 rounded-xl bg-muted/10 border border-border/30">
                        <p className="text-[9px] text-muted-foreground uppercase font-bold">Wellness Score</p>
                        <p className="text-sm font-bold text-primary">94/100</p>
                      </div>
                      <div className="p-3 rounded-xl bg-muted/10 border border-border/30">
                        <p className="text-[9px] text-muted-foreground uppercase font-bold">Last BP</p>
                        <p className="text-sm font-bold">118/76</p>
                      </div>
                      <div className="p-3 rounded-xl bg-muted/10 border border-border/30">
                        <p className="text-[9px] text-muted-foreground uppercase font-bold">Blood Glucose</p>
                        <p className="text-sm font-bold">92 mg/dL</p>
                      </div>
                   </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="p-4 bg-muted/20 border-t border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-4">
               <span className="text-[9px] text-muted-foreground flex items-center gap-1 uppercase tracking-tighter">
                  <ShieldAlert size={10} /> Encryption: AES-256
               </span>
               <span className="text-[9px] text-muted-foreground flex items-center gap-1 uppercase tracking-tighter">
                  <Lock size={10} /> Role: Clinician-Level
               </span>
            </div>
            <NeonButton variant="outline" size="sm" onClick={onClose} className="h-8 text-[9px] font-black uppercase">
               Close Vault
            </NeonButton>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
};
