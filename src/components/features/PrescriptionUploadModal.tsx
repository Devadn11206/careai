import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, FileText, CheckCircle2, Loader2, AlertCircle, Pill } from "lucide-react";
import { GlassCard } from "@/components/carex/GlassCard";
import { NeonButton } from "@/components/carex/NeonButton";
import { BackendAPI } from "@/services/apiClient";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PrescriptionUploadModalProps {
  patientId: string;
  patientName: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export const PrescriptionUploadModal: React.FC<PrescriptionUploadModalProps> = ({
  patientId,
  patientName,
  onClose,
  onSuccess
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [step, setStep] = useState<"upload" | "review" | "success">("upload");
  const [extractedMeds, setExtractedMeds] = useState<any[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a prescription file");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("prescription", file);
      formData.append("patientId", patientId);
      formData.append("diagnosis", diagnosis);
      formData.append("notes", notes);

      const result = await BackendAPI.sendPrescription(formData);
      
      if (result.aiExtractedJson) {
        setExtractedMeds(Array.isArray(result.aiExtractedJson) ? result.aiExtractedJson : (result.aiExtractedJson.medicines || []));
        setStep("review");
      } else {
        setStep("success");
      }
      
      toast.success("Prescription delivered successfully");
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to deliver prescription");
    } finally {
      setIsUploading(false);
    }
  };

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
        className="relative w-full max-w-2xl"
      >
        <GlassCard className="overflow-hidden border-primary/20">
          <div className="p-6 border-b border-border/50 flex items-center justify-between bg-muted/20">
            <div>
              <h3 className="font-display text-xl font-bold">Clinical Prescription Delivery</h3>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">
                Recipient: <span className="text-primary font-bold">{patientName}</span> · ID: {patientId}
              </p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6">
            <AnimatePresence mode="wait">
              {step === "upload" && (
                <motion.div 
                  key="upload"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all",
                      file ? "border-primary/50 bg-primary/5" : "border-border/50 hover:border-primary/30 hover:bg-muted/30"
                    )}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      className="hidden" 
                      accept="image/*,application/pdf"
                    />
                    {preview ? (
                      <div className="relative w-full max-w-[200px] aspect-[3/4] rounded-lg overflow-hidden border border-border/50">
                        <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <p className="text-[10px] text-white font-bold uppercase">Change File</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                          <Upload className="h-8 w-8 text-primary" />
                        </div>
                        <div className="text-center">
                          <p className="font-bold">Drop handwritten prescription here</p>
                          <p className="text-xs text-muted-foreground mt-1">Supports PNG, JPG, PDF up to 10MB</p>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest ml-1">Clinical Diagnosis</label>
                      <input 
                        type="text"
                        placeholder="e.g. Acute Bronchitis"
                        className="w-full bg-muted/20 border border-border/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                        value={diagnosis}
                        onChange={(e) => setDiagnosis(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest ml-1">Doctor's Notes</label>
                      <input 
                        type="text"
                        placeholder="Additional recovery instructions..."
                        className="w-full bg-muted/20 border border-border/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/5 border border-secondary/20">
                    <AlertCircle className="h-5 w-5 text-secondary shrink-0" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Our AI will automatically extract medicines and dosage from your upload to create a real-time schedule for the patient.
                    </p>
                  </div>

                  <NeonButton 
                    variant="primary" 
                    className="w-full h-12 font-bold uppercase tracking-widest"
                    onClick={handleUpload}
                    disabled={!file || isUploading}
                  >
                    {isUploading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analyzing with Neural OCR...
                      </span>
                    ) : (
                      "Deliver to Patient"
                    )}
                  </NeonButton>
                </motion.div>
              )}

              {step === "review" && (
                <motion.div 
                  key="review"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-success/10 border border-success/30">
                    <CheckCircle2 className="h-6 w-6 text-success" />
                    <div>
                      <p className="font-bold text-sm text-success">AI Extraction Complete</p>
                      <p className="text-xs text-muted-foreground">Neural OCR has successfully mapped {extractedMeds.length} medications.</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest ml-1">Extracted Schedule</p>
                    <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                      {extractedMeds.map((med, i) => (
                        <div key={i} className="p-3 rounded-xl bg-muted/20 border border-border/50 flex items-center gap-4">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Pill className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate">{med.name}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">{med.dosage} · {med.frequency}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-primary uppercase">{med.duration}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <NeonButton 
                    variant="primary" 
                    className="w-full h-12 font-bold uppercase tracking-widest"
                    onClick={() => setStep("success")}
                  >
                    Confirm & Finish
                  </NeonButton>
                </motion.div>
              )}

              {step === "success" && (
                <motion.div 
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-12 flex flex-col items-center justify-center text-center space-y-4"
                >
                  <div className="h-20 w-20 rounded-full bg-success/20 flex items-center justify-center mb-2">
                    <CheckCircle2 className="h-10 w-10 text-success" />
                  </div>
                  <h3 className="text-2xl font-bold">Successfully Delivered</h3>
                  <p className="text-muted-foreground max-w-sm">
                    Prescription has been sent to {patientName}. Patient has been notified and medication reminders have been scheduled.
                  </p>
                  <NeonButton variant="outline" className="mt-8" onClick={onClose}>
                    Close Dashboard
                  </NeonButton>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
};
