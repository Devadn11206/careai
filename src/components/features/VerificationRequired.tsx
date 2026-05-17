import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, Upload, FileCheck, Clock, 
  AlertCircle, CheckCircle, Sparkles, Loader2,
  Stethoscope, Award, Fingerprint, MapPin, 
  BadgeCheck, ExternalLink
} from 'lucide-react';
import { GlassCard } from '@/components/carex/GlassCard';
import { NeonButton } from '@/components/carex/NeonButton';
import { BackendAPI } from '@/services/apiClient';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface VerificationRequiredProps {
  status: string;
}

export const VerificationRequired: React.FC<VerificationRequiredProps> = ({ status }) => {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState<{ [key: string]: File | null }>({
    license: null,
    idProof: null,
    degree: null,
    specialization: null
  });

  const handleFileUpload = (type: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFiles(prev => ({ ...prev, [type]: file }));
      toast.success(`${type.toUpperCase()} selected for upload`);
    }
  };

  const handleSubmitDocuments = async () => {
    setIsLoading(true);
    try {
      // Simulate multiple uploads
      for (const [type, file] of Object.entries(files)) {
        if (file) {
          await BackendAPI.uploadDoctorDocument({
            type: type.toUpperCase(),
            title: `${type.toUpperCase()} Certificate`,
            fileUrl: "https://storage.carexai.com/docs/" + file.name, // Simulated URL
            fileName: file.name,
            fileType: file.type
          });
        }
      }
      toast.success("Documents submitted for administrative review.", {
        icon: <Sparkles className="h-4 w-4 text-primary" />
      });
      // In a real app, this would trigger a refresh of the user status
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit documents");
    } finally {
      setIsLoading(false);
    }
  };

  const steps = [
    { id: 1, title: "Professional Identity", icon: Fingerprint },
    { id: 2, title: "Clinical Credentials", icon: Award },
    { id: 3, title: "Review & Authorize", icon: BadgeCheck }
  ];

  const isUnderReview = status === 'UNDER_REVIEW';

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl w-full"
      >
        <GlassCard className="p-8 border-primary/20 bg-primary/5 relative overflow-hidden">
          {/* Futuristic background decoration */}
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <ShieldCheck size={180} className="text-primary" />
          </div>

          <div className="relative z-10 text-center mb-12">
            <div className="h-20 w-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-primary/20 shadow-glow-primary">
              <ShieldCheck className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-3xl font-display font-bold tracking-tight text-foreground mb-3">Clinical Authentication Node</h1>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto leading-relaxed">
              To maintain the integrity of the CareXAI clinical grid, all healthcare professionals must undergo a rigorous multi-factor verification process.
            </p>
          </div>

          <AnimatePresence mode="wait">
            {isUnderReview ? (
              <motion.div 
                key="review"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12 space-y-8"
              >
                <div className="flex justify-center items-center gap-4">
                   <div className="h-12 w-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                   <div className="text-left">
                     <h3 className="text-xl font-bold text-foreground">Verification in Progress</h3>
                     <p className="text-xs text-muted-foreground uppercase tracking-widest font-black">Neural Verification Layer 4: Active</p>
                   </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
                   <GlassCard className="p-4 border-primary/10 bg-primary/5 space-y-2">
                     <Clock size={20} className="text-primary mx-auto" />
                     <p className="text-[9px] font-black uppercase tracking-widest">ETA: 24-48h</p>
                   </GlassCard>
                   <GlassCard className="p-4 border-secondary/10 bg-secondary/5 space-y-2">
                     <FileCheck size={20} className="text-secondary mx-auto" />
                     <p className="text-[9px] font-black uppercase tracking-widest">Audit Active</p>
                   </GlassCard>
                   <GlassCard className="p-4 border-success/10 bg-success/5 space-y-2">
                     <MapPin size={20} className="text-success mx-auto" />
                     <p className="text-[9px] font-black uppercase tracking-widest">Registry Sync</p>
                   </GlassCard>
                </div>

                <div className="bg-muted/10 border border-border/40 p-4 rounded-2xl text-xs text-muted-foreground leading-relaxed italic max-w-xl mx-auto">
                  "Your documents are currently being cross-referenced with national medical registries. Access to clinical tools will be granted automatically upon successful authorization."
                </div>

                <NeonButton variant="outline" className="uppercase font-black tracking-widest text-[10px]" onClick={() => window.location.reload()}>
                  Refresh Status
                </NeonButton>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
                {/* Progress Tracker */}
                <div className="flex items-center justify-between max-w-md mx-auto relative px-4">
                  <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-border/40 -translate-y-1/2 z-0" />
                  {steps.map((s, i) => (
                    <div key={s.id} className="relative z-10 flex flex-col items-center gap-2">
                      <div className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center border transition-all duration-500",
                        step > s.id ? "bg-success border-success text-success-foreground" :
                        step === s.id ? "bg-primary border-primary text-primary-foreground shadow-glow-primary scale-110" :
                        "bg-muted border-border/50 text-muted-foreground"
                      )}>
                        {step > s.id ? <CheckCircle size={16} /> : <s.icon size={16} />}
                      </div>
                      <span className={cn(
                        "text-[8px] font-black uppercase tracking-widest absolute -bottom-6 w-max text-center",
                        step === s.id ? "text-primary" : "text-muted-foreground"
                      )}>{s.title}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-8">
                  {step === 1 && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">National Medical License (PDF/JPG)</label>
                        <div className="relative group">
                          <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => handleFileUpload('license', e)} />
                          <div className={cn(
                            "h-32 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-3 transition-all",
                            files.license ? "bg-primary/10 border-primary/40" : "bg-muted/10 border-border/40 group-hover:border-primary/40"
                          )}>
                            {files.license ? <FileCheck className="text-primary" /> : <Upload className="text-muted-foreground" />}
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">{files.license ? files.license.name : "Select License File"}</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Government ID Proof</label>
                        <div className="relative group">
                          <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => handleFileUpload('idProof', e)} />
                          <div className={cn(
                            "h-32 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-3 transition-all",
                            files.idProof ? "bg-primary/10 border-primary/40" : "bg-muted/10 border-border/40 group-hover:border-primary/40"
                          )}>
                            {files.idProof ? <FileCheck className="text-primary" /> : <Upload className="text-muted-foreground" />}
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">{files.idProof ? files.idProof.name : "Select ID Proof"}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {step === 2 && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Medical Degree Certificate</label>
                        <div className="relative group">
                          <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => handleFileUpload('degree', e)} />
                          <div className={cn(
                            "h-32 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-3 transition-all",
                            files.degree ? "bg-primary/10 border-primary/40" : "bg-muted/10 border-border/40 group-hover:border-primary/40"
                          )}>
                            {files.degree ? <FileCheck className="text-primary" /> : <Upload className="text-muted-foreground" />}
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">{files.degree ? files.degree.name : "Select Degree"}</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Specialization Docs (Optional)</label>
                        <div className="relative group">
                          <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => handleFileUpload('specialization', e)} />
                          <div className={cn(
                            "h-32 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-3 transition-all",
                            files.specialization ? "bg-primary/10 border-primary/40" : "bg-muted/10 border-border/40 group-hover:border-primary/40"
                          )}>
                            {files.specialization ? <FileCheck className="text-primary" /> : <Upload className="text-muted-foreground" />}
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">{files.specialization ? files.specialization.name : "Select Specialization"}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {step === 3 && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                       <GlassCard className="p-6 border-warning/20 bg-warning/5">
                          <div className="flex gap-4">
                            <AlertCircle className="text-warning shrink-0" />
                            <div className="space-y-2">
                              <h4 className="text-sm font-bold text-foreground">Declaration of Accuracy</h4>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                By authorizing this submission, you confirm that all provided documents are genuine and that any misrepresentation may lead to immediate suspension and legal clinical audit.
                              </p>
                            </div>
                          </div>
                       </GlassCard>

                       <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 glass rounded-xl border border-border/40 space-y-2">
                             <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Files Collected</span>
                             <p className="text-sm font-bold text-foreground">{Object.values(files).filter(Boolean).length} / 4</p>
                          </div>
                          <div className="p-4 glass rounded-xl border border-border/40 space-y-2">
                             <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Auth Level</span>
                             <p className="text-sm font-bold text-primary">Level 2 (Professional)</p>
                          </div>
                       </div>
                    </motion.div>
                  )}
                </div>

                <div className="flex gap-4 pt-4">
                  {step > 1 && (
                    <NeonButton variant="outline" className="flex-1 uppercase font-black tracking-widest text-[10px]" onClick={() => setStep(s => s - 1)}>
                      Previous Phase
                    </NeonButton>
                  )}
                  {step < 3 ? (
                    <NeonButton 
                      variant="primary" 
                      className="flex-1 uppercase font-black tracking-widest text-[10px]" 
                      onClick={() => setStep(s => s + 1)}
                      disabled={step === 1 ? (!files.license || !files.idProof) : (!files.degree)}
                    >
                      Continue Authorization
                    </NeonButton>
                  ) : (
                    <NeonButton 
                      variant="primary" 
                      className="flex-1 uppercase font-black tracking-widest text-[10px]" 
                      onClick={handleSubmitDocuments}
                      isLoading={isLoading}
                    >
                      Authorize & Submit
                    </NeonButton>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>

        <div className="mt-8 flex items-center justify-center gap-8 opacity-40 grayscale pointer-events-none">
           <div className="flex items-center gap-2"><ShieldCheck size={16} /><span className="text-[10px] font-black uppercase tracking-tighter">HIPAA COMPLIANT</span></div>
           <div className="flex items-center gap-2"><Award size={16} /><span className="text-[10px] font-black uppercase tracking-tighter">BOARD CERTIFIED</span></div>
           <div className="flex items-center gap-2"><Fingerprint size={16} /><span className="text-[10px] font-black uppercase tracking-tighter">SECURE AUTH</span></div>
        </div>
      </motion.div>
    </div>
  );
};
