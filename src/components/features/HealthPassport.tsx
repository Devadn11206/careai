import React, { useState } from 'react';
import { HealthPassportData, HealthMetrics, AIAnalysisResult, DiseasePrediction } from '@/types';
import { NeonButton as Button } from '@/components/carex/NeonButton';
import { GlassCard } from '@/components/carex/GlassCard';
import { cn } from '@/lib/utils';
import { 
    Download, 
    X, 
    ClipboardList, 
    Activity, 
    Heart, 
    Droplets, 
    Thermometer, 
    Brain, 
    ShieldCheck, 
    Calendar,
    Stethoscope
} from 'lucide-react';

interface Props {
  data: HealthPassportData;
  onClose?: () => void;
  isDoctorView?: boolean;
}

declare const html2pdf: any;

export const HealthPassport: React.FC<Props> = ({ data, onClose, isDoctorView }) => {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadPdf = () => {
    setIsDownloading(true);
    const element = document.getElementById('health-passport-content');
    
    if (!element) {
        setIsDownloading(false);
        return;
    }

    const opt = {
      margin:       10,
      filename:     `Health_Passport_${data.patientName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    if (typeof html2pdf !== 'undefined') {
        html2pdf().set(opt).from(element).save().then(() => {
            setIsDownloading(false);
        }).catch((err: any) => {
            console.error("PDF generation failed", err);
            setIsDownloading(false);
            alert("Could not generate PDF. Please try printing instead.");
        });
    } else {
        window.print();
        setIsDownloading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="bg-background text-foreground fixed inset-0 z-[120] overflow-y-auto selection:bg-primary/30 font-sans">
      {/* SCREEN-ONLY CONTROLS */}
      <div className="sticky top-0 z-50 glass backdrop-blur-3xl border-b border-white/5 p-6 flex justify-between items-center print:hidden shadow-2xl">
        <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-glow-primary">
                <ClipboardList size={20} />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tighter font-display">
                Health <span className="text-primary">Passport</span>
            </h2>
        </div>
        <div className="flex items-center gap-4">
          <Button 
            variant="secondary" 
            onClick={handleDownloadPdf} 
            isLoading={isDownloading}
            className="h-12 px-6 rounded-xl flex items-center gap-2"
          >
            <Download size={16} />
            Initialize Export
          </Button>
          {onClose && (
            <button 
                onClick={onClose} 
                className="h-12 w-12 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-muted-foreground hover:text-white transition-all"
            >
              <X size={24} />
            </button>
          )}
        </div>
      </div>

      {/* REPORT CONTENT */}
      <div id="health-passport-content" className="max-w-5xl mx-auto p-12 bg-background print:bg-white print:text-black">
        
        {/* HEADER */}
        <div className="flex justify-between items-end border-b border-white/5 pb-10 mb-12 relative print:border-slate-200">
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary to-primary print:hidden"></div>
           
           <div className="space-y-2">
             <h1 className="text-5xl font-black tracking-tighter text-white uppercase font-display print:text-slate-800">Clinical Dossier</h1>
             <p className="text-muted-foreground font-bold uppercase tracking-[0.3em] text-[10px] print:text-slate-500">Autonomous Biometric Audit Report</p>
           </div>
           <div className="text-right">
             <div className="flex items-center justify-end gap-3 text-primary font-black text-3xl uppercase tracking-tighter font-display print:text-slate-800">
                CareX<span className="text-white print:text-slate-600">AI</span>
             </div>
             <div className="mt-4 text-[10px] text-muted-foreground font-black tracking-widest uppercase print:text-slate-400">
                <p>SYNC: {formatDate(data.generatedDate)}</p>
                <p>NODE: {data.patientId.toUpperCase().slice(0,12)}</p>
             </div>
           </div>
        </div>

        {/* PATIENT IDENTITY */}
        <GlassCard className="p-10 mb-12 border-white/5 print:bg-slate-50 print:border-slate-200">
           <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
              <div className="space-y-2">
                 <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Subject Identity</p>
                 <p className="text-2xl font-black text-white print:text-slate-800">{data.patientName}</p>
              </div>
              <div className="space-y-2">
                 <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Biometrics</p>
                 <p className="text-lg font-bold text-white/80 print:text-slate-700">{data.patientAge} Y / {data.patientGender}</p>
              </div>
              <div className="space-y-2">
                 <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Blood Group</p>
                 <span className="inline-block px-4 py-1.5 bg-white/5 rounded-xl border border-white/10 font-black text-primary shadow-glow-primary print:bg-white print:text-slate-800">{data.bloodGroup || 'O+'}</span>
              </div>
              <div className="space-y-2">
                 <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">System Status</p>
                 <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_#10b981]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Active Node Monitoring</span>
                 </div>
              </div>
           </div>
        </GlassCard>

        {/* VITALS TELEMETRY */}
        <div className="mb-16">
           <div className="flex items-center gap-4 mb-8">
              <Activity className="text-primary" size={20} />
              <h3 className="text-xl font-black text-white uppercase tracking-tight print:text-slate-800">Telemetry Snapshot</h3>
           </div>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { label: 'Blood Pressure', value: `${data.metrics.systolicBP}/${data.metrics.diastolicBP}`, unit: 'mmHg', icon: Heart, color: 'text-rose-500' },
                { label: 'Glucose Index', value: data.metrics.glucose, unit: 'mg/dL', icon: Droplets, color: 'text-amber-500' },
                { label: 'Metabolic BMI', value: data.metrics.bmi, unit: 'kg/m²', icon: Activity, color: 'text-primary' },
                { label: 'Cholesterol', value: data.metrics.cholesterol, unit: 'mg/dL', icon: Thermometer, color: 'text-secondary' },
              ].map((v, i) => (
                <div key={i} className="p-6 rounded-3xl bg-white/5 border border-white/10 relative overflow-hidden group print:bg-white print:border-slate-200">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4">{v.label}</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-white print:text-slate-800">{v.value}</span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">{v.unit}</span>
                    </div>
                    <v.icon className={cn("absolute -bottom-4 -right-4 opacity-5 group-hover:opacity-10 transition-opacity", v.color)} size={80} />
                </div>
              ))}
           </div>
        </div>

        {/* AI RISK ASSESSMENT */}
        <div className="mb-16 rounded-[3rem] p-1 bg-gradient-to-br from-primary/20 via-white/5 to-secondary/20 border border-white/5 print:bg-slate-50 print:border-slate-200 print:rounded-2xl">
           <div className="bg-background/80 backdrop-blur-3xl rounded-[2.8rem] p-10 print:bg-white print:p-6">
              <div className="flex items-center gap-4 mb-10">
                <Brain className="text-primary" size={24} />
                <h3 className="text-2xl font-black text-white uppercase tracking-tight print:text-slate-800">Neural Risk Assessment</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                 {data.aiAnalysis.predictions?.map((pred, i) => (
                    <div key={i} className={cn(
                        "p-6 rounded-2xl border relative overflow-hidden",
                        pred.riskLevel === 'High' ? 'bg-rose-500/10 border-rose-500/20' : 
                        pred.riskLevel === 'Moderate' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-emerald-500/10 border-emerald-500/20'
                    )}>
                       <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">{pred.condition}</p>
                       <div className="flex items-center gap-3">
                          <span className={cn(
                              "text-3xl font-black uppercase",
                              pred.riskLevel === 'High' ? 'text-rose-500' : 
                              pred.riskLevel === 'Moderate' ? 'text-amber-500' : 'text-emerald-500'
                          )}>{pred.riskLevel}</span>
                          <span className="text-[10px] font-black opacity-40 uppercase tracking-widest">Risk Factor</span>
                       </div>
                    </div>
                 ))}
              </div>

              <div className="space-y-6">
                 <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] border-b border-white/5 pb-4">Biometric Insight Stream</h4>
                 <div className="space-y-4">
                    {data.aiAnalysis.predictions?.map((pred, i) => (
                        <div key={i} className="flex gap-6 p-6 bg-white/5 rounded-[2rem] border border-white/5 hover:border-primary/20 transition-all group print:bg-slate-50 print:border-slate-100">
                           <div className={cn(
                               "w-1.5 shrink-0 rounded-full",
                               pred.riskLevel === 'High' ? 'bg-rose-500 shadow-glow-rose-500/50' : 
                               pred.riskLevel === 'Moderate' ? 'bg-amber-500 shadow-glow-amber-500/50' : 'bg-emerald-500 shadow-glow-emerald-500/50'
                           )}></div>
                           <div className="flex-1">
                              <div className="flex justify-between items-center mb-2">
                                <p className="font-black text-white text-lg uppercase tracking-tight print:text-slate-800">{pred.condition}</p>
                                <span className="text-[10px] font-black text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">{pred.probability}% PROB</span>
                              </div>
                              <p className="text-muted-foreground font-medium leading-relaxed mb-4 print:text-slate-600">{pred.recommendation}</p>
                              {pred.topFactors && pred.topFactors.length > 0 && (
                                 <div className="flex flex-wrap gap-2">
                                    {pred.topFactors.map((f, idx) => (
                                       <span key={idx} className={cn(
                                           "text-[9px] px-3 py-1.5 rounded-lg font-black uppercase tracking-widest border flex items-center gap-2",
                                           f.direction === 'Increase' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                       )}>
                                          {f.factor} {f.direction === 'Increase' ? '▲' : '▼'}
                                       </span>
                                    ))}
                                 </div>
                              )}
                           </div>
                        </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
           {/* PHARMACEUTICALS */}
           <div className="space-y-6">
              <div className="flex items-center gap-4">
                 <ShieldCheck className="text-primary" size={20} />
                 <h3 className="text-xl font-black text-white uppercase tracking-tight print:text-slate-800">Registry: Medications</h3>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden print:bg-white print:border-slate-200">
                 {data.medications.length > 0 ? (
                    <div className="divide-y divide-white/5">
                       {data.medications.map((med, i) => (
                          <div key={i} className="p-6 flex items-center justify-between hover:bg-white/10 transition-all group">
                             <div>
                                <p className="font-black text-white text-base print:text-slate-800">{med.name}</p>
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">{med.dosage}</p>
                             </div>
                             <span className="text-[10px] font-black bg-white/10 text-primary px-4 py-1.5 rounded-xl uppercase tracking-[0.2em]">{med.time}</span>
                          </div>
                       ))}
                    </div>
                 ) : (
                    <div className="p-12 text-center text-muted-foreground font-black uppercase tracking-widest text-[10px]">No active pharmacological sync detected.</div>
                 )}
              </div>
           </div>

           {/* LOGS */}
           <div className="space-y-6">
              <div className="flex items-center gap-4">
                 <Calendar className="text-primary" size={20} />
                 <h3 className="text-xl font-black text-white uppercase tracking-tight print:text-slate-800">Vector History</h3>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden print:bg-white print:border-slate-200">
                 <table className="w-full text-left">
                    <thead className="bg-white/5 text-muted-foreground font-black uppercase text-[10px] tracking-[0.25em]">
                       <tr>
                          <th className="px-6 py-4">Timeline</th>
                          <th className="px-6 py-4">BP (mmhg)</th>
                          <th className="px-6 py-4">GLC (mg/dl)</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                       {data.history.slice(-5).reverse().map((h, i) => (
                          <tr key={i} className="hover:bg-white/10 transition-colors">
                             <td className="px-6 py-4 text-white font-black text-xs uppercase tracking-tighter print:text-slate-600">{new Date(h.timestamp).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</td>
                             <td className="px-6 py-4 font-mono text-primary text-sm print:text-slate-800">{h.systolicBP}/{h.diastolicBP}</td>
                             <td className="px-6 py-4 font-mono text-white text-sm print:text-slate-800">{h.glucose}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>

        {/* FOOTER */}
        <div className="mt-20 pt-10 border-t border-white/5 text-center space-y-4 print:border-slate-200">
           <p className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.5em]">CareXAI Neural Link · Clinical Audit v2.8.4</p>
           <div className="flex items-center justify-center gap-8">
              <div className="flex items-center gap-2">
                 <ShieldCheck size={12} className="text-emerald-500" />
                 <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/40">Verified Practitioner Node</span>
              </div>
              <div className="flex items-center gap-2">
                 <Brain size={12} className="text-primary" />
                 <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/40">AI Decision Support Engine</span>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
};
