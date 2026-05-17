import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ShieldCheck, User, Award, FileText, 
  CheckCircle, XCircle, Search, Filter,
  MoreVertical, ChevronRight, Eye, ShieldAlert,
  Calendar, MapPin, Mail, Phone, ExternalLink,
  Loader2, BadgeCheck, AlertTriangle
} from "lucide-react";
import { GlassCard } from "@/components/carex/GlassCard";
import { NeonButton } from "@/components/carex/NeonButton";
import { NeonSelect } from "@/components/carex/NeonSelect";
import { BackendAPI } from "@/services/apiClient";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const AdminDoctorVerification = () => {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    setIsLoading(true);
    try {
      const data = await BackendAPI.getAdminDoctorsList();
      setDoctors(data);
    } catch (err) {
      toast.error("Failed to load clinician applications");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (id: string, action: 'VERIFY' | 'REJECT' | 'SUSPEND', reason?: string) => {
    setIsVerifying(true);
    try {
      await BackendAPI.performAdminDoctorAction(id, action, reason);
      toast.success(`Clinician marked as ${action}ED`);
      fetchDoctors();
      setSelectedDoctor(null);
    } catch (err) {
      toast.error("Verification failed");
    } finally {
      setIsVerifying(false);
    }
  };

  const filteredDoctors = doctors.filter(d => 
    (statusFilter === "ALL" || d.doctorStatus === statusFilter) &&
    (d.name.toLowerCase().includes(search.toLowerCase()) || d.email.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search clinicians by name, email, or registry ID..."
            className="w-full bg-muted/20 border border-border/50 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <NeonSelect 
          className="min-w-[240px]"
          options={[
            { label: "All Statuses", value: "ALL" },
            { label: "Pending Verification", value: "PENDING_VERIFICATION" },
            { label: "Under Review", value: "UNDER_REVIEW" },
            { label: "Verified", value: "VERIFIED" },
            { label: "Rejected", value: "REJECTED" },
            { label: "Suspended", value: "SUSPENDED" }
          ]}
          value={statusFilter}
          onChange={setStatusFilter}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Doctor List */}
        <div className="lg:col-span-1 space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 glass rounded-2xl animate-pulse" />
            ))
          ) : filteredDoctors.map(doc => (
            <div 
              key={doc.id}
              onClick={() => setSelectedDoctor(doc)}
              className={cn(
                "p-4 glass rounded-2xl border transition-all cursor-pointer hover:bg-primary/5",
                selectedDoctor?.id === doc.id ? "border-primary/50 bg-primary/10 shadow-glow-primary/20" : "border-border/50"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-muted/30 flex items-center justify-center border border-border/50">
                  {doc.profilePicUrl ? (
                    <img src={doc.profilePicUrl} className="h-full w-full rounded-xl object-cover" />
                  ) : (
                    <User className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold truncate text-foreground">{doc.name}</h4>
                  <p className="text-[10px] text-muted-foreground truncate uppercase tracking-widest">{doc.specialization}</p>
                </div>
                <div className={cn(
                  "h-2 w-2 rounded-full",
                  doc.doctorStatus === 'VERIFIED' ? "bg-success shadow-glow-success" :
                  doc.doctorStatus === 'REJECTED' ? "bg-destructive" :
                  doc.doctorStatus === 'UNDER_REVIEW' ? "bg-warning animate-pulse" :
                  "bg-muted-foreground"
                )} />
              </div>
            </div>
          ))}
          {!isLoading && filteredDoctors.length === 0 && (
            <div className="py-12 text-center opacity-30">
              <ShieldAlert className="mx-auto mb-2" />
              <p className="text-[10px] font-black uppercase tracking-widest">No matching clinicians</p>
            </div>
          )}
        </div>

        {/* Doctor Details & Verification */}
        <GlassCard className="lg:col-span-2 p-6 min-h-[500px]">
          <AnimatePresence mode="wait">
            {selectedDoctor ? (
              <motion.div 
                key={selectedDoctor.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  <div className="h-24 w-24 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-glow-primary shrink-0">
                    {selectedDoctor.profilePicUrl ? (
                      <img src={selectedDoctor.profilePicUrl} className="h-full w-full rounded-2xl object-cover" />
                    ) : (
                      <User className="h-10 w-10 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-2xl font-bold text-foreground">{selectedDoctor.name}</h3>
                      {selectedDoctor.doctorStatus === 'VERIFIED' && <BadgeCheck className="text-primary h-6 w-6" />}
                    </div>
                    <p className="text-sm text-primary uppercase font-black tracking-widest">{selectedDoctor.specialization}</p>
                    <div className="flex flex-wrap gap-4 pt-2">
                       <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                         <Mail size={12} /> {selectedDoctor.email}
                       </div>
                       <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                         <Phone size={12} /> {selectedDoctor.phone || "Not provided"}
                       </div>
                       <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                         <Award size={12} /> {selectedDoctor.experienceYears || 0} Years Exp
                       </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                      selectedDoctor.doctorStatus === 'VERIFIED' ? "bg-success/10 text-success border-success/20" :
                      selectedDoctor.doctorStatus === 'REJECTED' ? "bg-destructive/10 text-destructive border-destructive/20" :
                      "bg-warning/10 text-warning border-warning/20"
                    )}>
                      {selectedDoctor.doctorStatus.replace('_', ' ')}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-tighter">Registered: {new Date(selectedDoctor.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Documents Section */}
                  <div className="space-y-4">
                    <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                      <FileText size={14} /> Clinical Credentials ({selectedDoctor.documents?.length || 0})
                    </h5>
                    <div className="space-y-2">
                      {selectedDoctor.documents?.map((doc: any) => (
                        <div key={doc.id} className="p-3 glass rounded-xl border border-border/40 flex items-center justify-between hover:border-primary/40 transition-all group">
                          <div className="flex items-center gap-3">
                             <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                               <FileText size={14} />
                             </div>
                             <div>
                               <p className="text-[10px] font-bold text-foreground uppercase tracking-tight">{doc.title}</p>
                               <p className="text-[8px] text-muted-foreground uppercase">{doc.type}</p>
                             </div>
                          </div>
                          <a href={doc.fileUrl} target="_blank" className="p-1.5 hover:bg-primary/20 rounded-lg text-muted-foreground hover:text-primary transition-all">
                            <Eye size={14} />
                          </a>
                        </div>
                      ))}
                      {(!selectedDoctor.documents || selectedDoctor.documents.length === 0) && (
                        <div className="p-6 border-2 border-dashed border-border/40 rounded-xl text-center opacity-40">
                           <AlertTriangle size={20} className="mx-auto mb-2" />
                           <p className="text-[10px] font-black uppercase tracking-widest">No documents uploaded yet</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Section */}
                  <div className="space-y-4">
                    <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                      <ShieldCheck size={14} /> Authorization Controls
                    </h5>
                    <div className="glass p-5 rounded-2xl border border-primary/20 bg-primary/5 space-y-4">
                       <p className="text-xs text-muted-foreground leading-relaxed italic">
                         "Manual verification is required. Cross-reference the uploaded license number ({selectedDoctor.registrationNumber || 'N/A'}) with the National Medical Registry before approval."
                       </p>
                       <div className="flex flex-col gap-3">
                             <NeonButton 
                            variant="primary" 
                            className="w-full h-11 uppercase font-black tracking-widest text-[10px]"
                            onClick={() => handleVerify(selectedDoctor.id, 'VERIFY')}
                            disabled={isVerifying || selectedDoctor.doctorStatus === 'VERIFIED'}
                            isLoading={isVerifying}
                          >
                            Authorize Clinician
                          </NeonButton>
                          <div className="flex gap-3">
                             <NeonButton 
                               variant="outline" 
                               className="flex-1 h-10 uppercase font-black tracking-widest text-[10px] border-warning/40 text-warning hover:bg-warning/10"
                               onClick={() => handleVerify(selectedDoctor.id, 'SUSPEND', 'Additional information required')}
                               disabled={isVerifying}
                             >
                               Flag Review
                             </NeonButton>
                             <NeonButton 
                               variant="outline" 
                               className="flex-1 h-10 uppercase font-black tracking-widest text-[10px] border-destructive/40 text-destructive hover:bg-destructive/10"
                               onClick={() => handleVerify(selectedDoctor.id, 'REJECT', 'Failed clinical validation')}
                               disabled={isVerifying}
                             >
                               Decline App
                             </NeonButton>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>

                {/* Audit Logs */}
                <div className="space-y-4 pt-4 border-t border-border/40">
                   <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Verification Audit Log</h5>
                   <div className="space-y-2">
                      {selectedDoctor.logs?.map((log: any) => (
                        <div key={log.id} className="text-[10px] flex items-center gap-4 text-muted-foreground">
                           <span className="font-mono text-[9px] min-w-[120px]">{new Date(log.createdAt).toLocaleString()}</span>
                           <span className="uppercase font-black text-primary min-w-[80px]">{log.newStatus}</span>
                           <span className="italic">{log.reason || "Manual status update"}</span>
                        </div>
                      ))}
                      {(!selectedDoctor.logs || selectedDoctor.logs.length === 0) && (
                        <p className="text-[10px] italic text-muted-foreground opacity-50">No log entries for this node</p>
                      )}
                   </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-40">
                 <ShieldCheck size={80} className="text-primary" />
                 <div>
                   <h3 className="text-xl font-bold uppercase tracking-widest">Administrative Verification Engine</h3>
                   <p className="text-[10px] uppercase tracking-[0.2em] mt-2">Select a clinician node to begin clinical audit and authorization</p>
                 </div>
              </div>
            )}
          </AnimatePresence>
        </GlassCard>
      </div>
    </div>
  );
};
