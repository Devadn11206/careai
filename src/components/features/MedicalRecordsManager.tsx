import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FileText, Upload, Plus, Search, Filter, 
  MoreVertical, Download, Eye, Trash2, 
  FileCheck, Shield, Clock, AlertCircle,
  FileBadge, FileType, CheckCircle2, Loader2,
  X
} from "lucide-react";
import { GlassCard } from "@/components/carex/GlassCard";
import { NeonButton } from "@/components/carex/NeonButton";
import { BackendAPI } from "@/services/apiClient";
import { useHealth } from "@/services/HealthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MedicalRecordPreviewModal } from "./MedicalRecordPreviewModal";
import { useEffect } from "react";

export const MedicalRecordsManager = () => {
  const { medicalRecords, refreshMedicalRecords } = useHealth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedRecordForPreview, setSelectedRecordForPreview] = useState<any>(null);

  useEffect(() => {
    const socket = BackendAPI.getSocket();
    if (socket) {
      const handleNewRecord = (record: any) => {
        refreshMedicalRecords();
        toast.info(`New medical record synced: ${record.title}`, {
          icon: <Shield className="h-4 w-4 text-primary" />
        });
      };
      socket.on('records:new', handleNewRecord);
      return () => {
        socket.off('records:new', handleNewRecord);
      };
    }
  }, [refreshMedicalRecords]);

  const handlePreview = (record: any) => {
    setSelectedRecordForPreview(record);
  };

  const handleDownload = async (e: React.MouseEvent, record: any) => {
    e.stopPropagation();
    try {
      const blob = await BackendAPI.downloadMedicalRecord(record.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = record.fileName;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Downloading secure clinical record...");
    } catch (err) {
      toast.error("Download failed");
    }
  };

  const tabs = ["All", "Lab Reports", "Scans", "Prescriptions", "Consultations", "Other"];

  const filteredRecords = medicalRecords.filter(r => {
    const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === "All" || r.type.replace('_', ' ').toLowerCase() === activeTab.toLowerCase().replace('s', '');
    return matchesSearch && matchesTab;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold tracking-tight">Clinical Vault</h2>
          <p className="text-sm text-muted-foreground mt-1">Secure, encrypted medical record storage · HIPAA Standard</p>
        </div>
        <NeonButton 
          variant="primary" 
          size="sm" 
          className="h-10 px-6 font-bold uppercase tracking-wider"
          onClick={() => setIsUploadModalOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" /> Upload Record
        </NeonButton>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all shrink-0 border",
              activeTab === tab 
                ? "bg-primary/20 border-primary/40 text-primary shadow-glow-primary" 
                : "bg-muted/10 border-border/50 text-muted-foreground hover:border-primary/30"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input 
          type="text"
          placeholder="Search records by title, clinic, or date..."
          className="w-full bg-muted/20 border border-border/50 rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredRecords.length > 0 ? (
          filteredRecords.map((record, i) => (
            <motion.div
              key={record.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => handlePreview(record)}
            >
              <GlassCard className="p-4 group hover:border-primary/40 transition-all cursor-pointer">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
                      record.type.includes('SCAN') ? "bg-secondary/10 text-secondary" : 
                      record.type.includes('LAB') ? "bg-success/10 text-success" : "bg-primary/10 text-primary"
                    )}>
                      {record.type.includes('SCAN') ? <FileType className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm truncate">{record.title}</h4>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                        {record.type.replace('_', ' ')} · {new Date(record.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button className="text-muted-foreground hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>
                
                <div className="mt-4 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Shield className="h-3 w-3" /> Secure Sync
                  </span>
                  <div className="flex gap-3">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handlePreview(record); }}
                      className="text-primary hover:text-primary-glow transition-colors"
                    >
                      Preview
                    </button>
                    <button 
                      onClick={(e) => handleDownload(e, record)}
                      className="text-primary hover:text-primary-glow transition-colors"
                    >
                      Download
                    </button>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-center opacity-50">
            <div className="h-20 w-20 rounded-full bg-muted/20 flex items-center justify-center mb-4">
              <FileBadge className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="text-sm font-bold uppercase tracking-widest">No medical records found</p>
            <p className="text-xs mt-1">Your secure clinical vault is currently empty.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isUploadModalOpen && (
          <RecordUploadModal 
            onClose={() => setIsUploadModalOpen(false)} 
            onSuccess={() => {
              setIsUploadModalOpen(false);
              refreshMedicalRecords();
            }}
          />
        )}
        {selectedRecordForPreview && (
          <MedicalRecordPreviewModal 
            record={selectedRecordForPreview} 
            onClose={() => setSelectedRecordForPreview(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const RecordUploadModal = ({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("LAB_REPORT");
  const [description, setDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!file || !title) {
      toast.error("Please provide title and file");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("record", file);
      formData.append("title", title);
      formData.append("type", type);
      formData.append("description", description);

      await BackendAPI.uploadMedicalRecord(formData);
      toast.success("Medical record uploaded securely");
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

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
        className="relative w-full max-w-lg"
      >
        <GlassCard className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold font-display">Secure Record Upload</h3>
            <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div 
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all",
              file ? "border-primary/50 bg-primary/5" : "border-border/50 hover:border-primary/30"
            )}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file ? (
              <>
                <FileCheck className="h-10 w-10 text-primary" />
                <p className="text-sm font-bold truncate max-w-full px-4">{file.name}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Click to change file</p>
              </>
            ) : (
              <>
                <Upload className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-bold">Select Clinical Document</p>
                <p className="text-[10px] text-muted-foreground uppercase">PDF, JPG, PNG up to 25MB</p>
              </>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest ml-1">Document Title</label>
              <input 
                type="text"
                placeholder="e.g. Lipid Profile Aug 2024"
                className="w-full bg-muted/20 border border-border/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest ml-1">Record Category</label>
              <select 
                className="w-full bg-muted/20 border border-border/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all appearance-none cursor-pointer"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="LAB_REPORT">Lab Report</option>
                <option value="SCAN">Scan/Imaging (MRI/CT/X-ray)</option>
                <option value="PRESCRIPTION">Prescription</option>
                <option value="CONSULTATION">Consultation Summary</option>
                <option value="ALLERGY">Allergy Report</option>
                <option value="OTHER">Other Clinical Record</option>
              </select>
            </div>
          </div>

          <NeonButton 
            variant="primary" 
            className="w-full h-12 font-bold uppercase tracking-widest"
            onClick={handleUpload}
            disabled={isUploading}
          >
            {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Encrypt & Store"}
          </NeonButton>
        </GlassCard>
      </motion.div>
    </div>
  );
};
