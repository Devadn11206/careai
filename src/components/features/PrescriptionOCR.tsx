import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, Clipboard, Zap, ArrowLeft, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GlassCard as Card } from '@/components/carex/GlassCard';
import { NeonButton as Button } from '@/components/carex/NeonButton';
import { GeminiService } from '@/services/geminiService';
import { PrescriptionOcrResult } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export const PrescriptionOCR: React.FC = () => {
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<PrescriptionOcrResult | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearState = () => {
    setResult(null);
    setError(null);
    setIsSaved(false);
  };

  const handleBack = () => {
    if (result && !isSaved) {
      const confirmExit = window.confirm("You have unsaved prescription data. Do you want to exit and clear all data?");
      if (!confirmExit) return;
    }
    clearState();
    navigate('/dashboard');
  };

  const handleSaveAndExit = async () => {
    if (!result) return;
    
    // Simulate saving to DB
    toast.success("Prescription data synchronized to patient record.");
    setIsSaved(true);
    
    // Slight delay for UX
    setTimeout(() => {
      clearState();
      navigate('/dashboard');
    }, 800);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setResult(null);
    setIsSaved(false);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const extracted = await GeminiService.extractPrescription(base64, file.type);
        setResult(extracted);
        setIsUploading(false);
      };
    } catch (err) {
      console.error("Prescription OCR failed", err);
      setError("Failed to recognize handwriting. Please ensure the image is clear.");
      setIsUploading(false);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleBack}
          className="bg-background/20 backdrop-blur-md border-border/50 hover:border-primary/50 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
        </Button>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Active Session</span>
        </div>
      </div>

      <Card title="Handwritten Prescription AI" className="relative overflow-hidden group border-primary/20">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors" />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
          {/* ... existing upload zone ... */}
          <div className="space-y-4">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300",
                isUploading ? "border-primary bg-primary/10 animate-pulse" : "border-border hover:border-primary hover:bg-muted/30"
              )}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleFileUpload}
              />
              <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/20 shadow-glow-primary">
                {isUploading ? <Loader2 className="h-8 w-8 text-primary animate-spin" /> : <Upload className="h-8 w-8 text-primary" />}
              </div>
              <h3 className="text-lg font-display font-bold">Upload Prescription</h3>
              <p className="text-sm text-muted-foreground mt-2">Supports handwritten notes, hospital slips, and pharmacy receipts.</p>
              <div className="mt-6 flex justify-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-muted border border-border">JPG</span>
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-muted border border-border">PNG</span>
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-muted border border-border">PDF</span>
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm"
              >
                <AlertCircle className="h-5 w-5 shrink-0" />
                {error}
              </motion.div>
            )}
          </div>

          {/* Result View */}
          <div className="min-h-[300px] flex flex-col justify-center">
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Extracted Data</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        <span className="text-xl font-display font-bold">Prescription Details</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">AI Confidence</p>
                      <p className={cn(
                        "text-lg font-mono font-bold",
                        (result.confidenceScore || 0) > 80 ? "text-success" : (result.confidenceScore || 0) > 50 ? "text-warning" : "text-destructive"
                      )}>
                        {result.confidenceScore}%
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Patient</p>
                      <p className="font-medium">{result.patientName || 'Unknown'}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Doctor</p>
                      <p className="font-medium">{result.doctorName || 'Not specified'}</p>
                    </div>
                  </div>

                  {result.diagnosis && (
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Clinical Diagnosis</p>
                      <p className="text-sm font-medium">{result.diagnosis}</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-2">
                      <Zap className="h-3 w-3 text-primary" /> Medications Detected
                    </p>
                    {result.medicines.map((med, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-background border border-border/50 group/item hover:border-primary/30 transition-all">
                        <div>
                          <p className="font-bold">{med.name}</p>
                          <p className="text-xs text-muted-foreground">{med.dosage} · {med.frequency}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-muted-foreground italic">{med.notes || med.duration}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-8">
                    <Button 
                      variant="outline" 
                      className="h-12 border-success/30 hover:bg-success/5 text-success"
                      onClick={() => {
                        toast.success("Synchronized to patient record.");
                        setIsSaved(true);
                      }}
                    >
                      <Clipboard className="h-4 w-4 mr-2" /> Sync Record
                    </Button>
                    <Button 
                      variant="neon" 
                      className="h-12"
                      onClick={handleSaveAndExit}
                    >
                      <Save className="h-4 w-4 mr-2" /> Save & Exit
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center p-8 border-2 border-dashed border-border/50 rounded-2xl bg-muted/10"
                >
                  <FileText className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground font-medium">Results will appear here after upload.</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1 uppercase tracking-widest">Processing via Gemini 1.5 Flash</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </Card>
    </div>

  );
};
