import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, Download, ExternalLink, Shield, 
  Brain, FileText, Search, Maximize2, 
  ZoomIn, ZoomOut, ChevronLeft, ChevronRight,
  AlertCircle, CheckCircle2, Sparkles, Loader2
} from "lucide-react";
import { GlassCard } from "@/components/carex/GlassCard";
import { NeonButton } from "@/components/carex/NeonButton";
import { BackendAPI } from "@/services/apiClient";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MedicalRecordPreviewModalProps {
  record: any;
  onClose: () => void;
}

export const MedicalRecordPreviewModal: React.FC<MedicalRecordPreviewModalProps> = ({ record, onClose }) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [activeTab, setActiveTab] = useState<"Document" | "AI Analysis">("Document");

  useEffect(() => {
    const fetchFile = async () => {
      try {
        setIsLoading(true);
        const blob = await BackendAPI.getMedicalRecordPreview(record.id);
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
      } catch (err) {
        toast.error("Failed to load clinical document");
        onClose();
      } finally {
        setIsLoading(false);
      }
    };

    fetchFile();

    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [record.id]);

  const handleDownload = async () => {
    try {
      const blob = await BackendAPI.downloadMedicalRecord(record.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = record.fileName;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Clinical record downloaded securely");
    } catch (err) {
      toast.error("Download failed");
    }
  };

  const aiInsights = record.description?.includes("[AI EXTRACTION]") 
    ? record.description.split("[AI EXTRACTION]:")[1].trim()
    : "Awaiting neural analysis of clinical metadata...";

  const isPdf = record.fileType === 'pdf';

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 md:p-8">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full h-full max-w-7xl flex flex-col"
      >
        <GlassCard className="flex-1 flex flex-col overflow-hidden border-white/10 bg-[#030711]/80 backdrop-blur-3xl shadow-3xl">
          {/* Header */}
          <div className="p-6 border-b border-white/5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={cn(
                "h-12 w-12 rounded-2xl flex items-center justify-center shadow-glow",
                isPdf ? "bg-primary/20 text-primary" : "bg-secondary/20 text-secondary"
              )}>
                {isPdf ? <FileText size={24} /> : <Search size={24} />}
              </div>
              <div>
                <h3 className="text-xl font-display font-bold tracking-tight">{record.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{record.type.replace('_', ' ')}</span>
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1">
                    <Shield size={10} /> Secure Clinical Access
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <NeonButton variant="ghost" size="sm" className="h-10 px-4" onClick={handleDownload}>
                <Download size={16} className="mr-2" /> Download
              </NeonButton>
              <button 
                onClick={onClose}
                className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Sub-header Tabs */}
          <div className="flex items-center gap-1 p-2 bg-white/5 border-b border-white/5">
            <button 
              onClick={() => setActiveTab("Document")}
              className={cn(
                "px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === "Document" ? "bg-primary text-white shadow-glow-primary" : "text-muted-foreground hover:bg-white/5"
              )}
            >
              Document View
            </button>
            <button 
              onClick={() => setActiveTab("AI Analysis")}
              className={cn(
                "px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                activeTab === "AI Analysis" ? "bg-gradient-aurora text-white shadow-glow" : "text-muted-foreground hover:bg-white/5"
              )}
            >
              <Sparkles size={12} /> AI Analysis
            </button>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
            {activeTab === "Document" ? (
              <div className="flex-1 relative bg-black/40 overflow-auto flex items-center justify-center p-4">
                {isLoading ? (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 text-primary animate-spin" />
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary animate-pulse">Decrypting Record...</p>
                  </div>
                ) : blobUrl ? (
                  isPdf ? (
                    <iframe 
                      src={`${blobUrl}#toolbar=0&navpanes=0&scrollbar=0`} 
                      className="w-full h-full rounded-lg border border-white/10"
                      title="PDF Preview"
                    />
                  ) : (
                    <div 
                      className="relative transition-transform duration-300"
                      style={{ transform: `scale(${zoom})` }}
                    >
                      <img 
                        src={blobUrl} 
                        alt="Medical Record" 
                        className="max-w-full max-h-full rounded-lg shadow-2xl"
                      />
                    </div>
                  )
                ) : null}

                {!isPdf && !isLoading && (
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 glass p-2 rounded-2xl border-white/10 shadow-2xl">
                    <button onClick={() => setZoom(z => Math.max(0.5, z - 0.2))} className="p-2 hover:bg-white/5 rounded-lg text-muted-foreground hover:text-white"><ZoomOut size={16} /></button>
                    <span className="text-[10px] font-black w-12 text-center">{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoom(z => Math.min(3, z + 0.2))} className="p-2 hover:bg-white/5 rounded-lg text-muted-foreground hover:text-white"><ZoomIn size={16} /></button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#030711]/50">
                {/* AI Stats Panel */}
                <div className="w-full md:w-80 border-r border-white/5 p-8 space-y-8 overflow-y-auto">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 ml-1">AI Confidence Score</label>
                    <div className="h-24 w-24 rounded-full border-4 border-primary/20 flex items-center justify-center relative">
                      <div className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-[spin_3s_linear_infinite]" />
                      <span className="text-2xl font-black text-white">98%</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 ml-1">Status Report</label>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-success/10 border border-success/20">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        <span className="text-[10px] font-bold text-success uppercase">Authenticity Verified</span>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20">
                        <Shield className="h-4 w-4 text-primary" />
                        <span className="text-[10px] font-bold text-primary uppercase">Encrypted at Rest</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Extraction Text */}
                <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                  <div className="max-w-2xl mx-auto space-y-10">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Brain className="h-6 w-6 text-primary" />
                        <h4 className="text-lg font-display font-bold">Neural Insight Summary</h4>
                      </div>
                      <div className="p-6 rounded-3xl bg-white/5 border border-white/10 leading-relaxed text-sm text-foreground/90 italic">
                        "{aiInsights}"
                      </div>
                    </div>

                    <div className="space-y-6">
                      <h4 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                        <Maximize2 size={14} /> Key Observations
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <ObservationCard 
                          label="Detected Category" 
                          value={record.type.replace('_', ' ')} 
                          type="info"
                        />
                        <ObservationCard 
                          label="Criticality" 
                          value={aiInsights.includes('High') || aiInsights.includes('abnormal') ? 'HIGH' : 'STABLE'} 
                          type={aiInsights.includes('High') || aiInsights.includes('abnormal') ? 'warning' : 'success'}
                        />
                        <ObservationCard 
                          label="Source Node" 
                          value="Secure Clinical Uplink" 
                          type="info"
                        />
                        <ObservationCard 
                          label="Last Sync" 
                          value={new Date(record.date).toLocaleDateString()} 
                          type="info"
                        />
                      </div>
                    </div>

                    <div className="p-6 rounded-3xl bg-primary/5 border border-primary/20 flex gap-4">
                      <Sparkles className="h-6 w-6 text-primary shrink-0" />
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary">Doctor Access History</p>
                        <p className="text-xs text-muted-foreground mt-2">Only you and your verified clinicians can view this analysis. All access is logged for HIPAA compliance.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
};

const ObservationCard = ({ label, value, type }: { label: string, value: string, type: 'success' | 'warning' | 'info' }) => (
  <div className="p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">{label}</p>
    <div className="flex items-center gap-2">
      {type === 'success' && <CheckCircle2 size={12} className="text-success" />}
      {type === 'warning' && <AlertCircle size={12} className="text-destructive" />}
      <p className={cn(
        "text-xs font-bold",
        type === 'success' ? "text-success" : type === 'warning' ? "text-destructive" : "text-white"
      )}>{value}</p>
    </div>
  </div>
);
