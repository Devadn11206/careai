
import React, { useState } from 'react';
import { HealthPassportData, HealthMetrics, AIAnalysisResult, DiseasePrediction } from '@/types';
import { NeonButton as Button } from '@/components/carex/NeonButton';

interface Props {
  data: HealthPassportData;
  onClose?: () => void;
  isDoctorView?: boolean;
}

// Declare html2pdf for TypeScript since we are loading it from CDN
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

    // Use html2pdf library loaded from index.html
    if (typeof html2pdf !== 'undefined') {
        html2pdf().set(opt).from(element).save().then(() => {
            setIsDownloading(false);
        }).catch((err: any) => {
            console.error("PDF generation failed", err);
            setIsDownloading(false);
            alert("Could not generate PDF. Please try printing instead.");
        });
    } else {
        // Fallback if library fails to load
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
    <div className="bg-white text-slate-900 font-sans print-passport fixed inset-0 z-[120] overflow-y-auto">
      {/* SCREEN-ONLY CONTROLS */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 p-4 flex justify-between items-center print-hidden shadow-sm">
        <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
          <span className="text-2xl">📋</span> CareXAI Health Passport
        </h2>
        <div className="flex gap-3">
          <Button 
            variant="secondary" 
            onClick={handleDownloadPdf} 
            isLoading={isDownloading}
            className="bg-rose-600 hover:bg-rose-700 text-white border-none flex items-center gap-2 shadow-lg shadow-rose-500/20"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Download PDF
          </Button>
          {onClose && (
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      </div>

      {/* PRINTABLE REPORT CONTENT */}
      <div id="health-passport-content" className="max-w-5xl mx-auto p-8 bg-white print:p-0 print:max-w-none print:w-full">
        
        {/* HEADER */}
        <div className="flex justify-between items-end border-b-2 border-slate-100 pb-6 mb-8 relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-rose-500 via-pink-500 to-rose-400"></div>
           
           <div>
             <h1 className="text-4xl font-black text-slate-800 tracking-tight mb-2 pt-4">Health Passport</h1>
             <p className="text-slate-500 font-medium tracking-wide">Comprehensive Clinical Report</p>
           </div>
           <div className="text-right">
             <div className="flex items-center justify-end gap-2 text-rose-700 font-bold text-2xl">
                <span className="bg-rose-50 p-1.5 rounded-lg border border-rose-100">⚕️</span> CareXAI
             </div>
             <div className="mt-2 text-xs text-slate-400 font-mono text-right">
                <p>GEN: {formatDate(data.generatedDate)}</p>
                <p>REF: {data.patientId.toUpperCase().slice(0,8)}</p>
             </div>
           </div>
        </div>

        {/* PATIENT IDENTITY CARD */}
        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 mb-8 shadow-sm flex flex-col md:flex-row gap-6 print:break-inside-avoid">
           <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-1">
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Patient Name</p>
                 <p className="text-xl font-bold text-slate-800">{data.patientName}</p>
              </div>
              <div className="space-y-1">
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Demographics</p>
                 <p className="text-lg font-medium text-slate-700">{data.patientAge} Yrs / {data.patientGender}</p>
              </div>
              <div className="space-y-1">
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Blood Group</p>
                 <span className="inline-block px-3 py-1 bg-white rounded-md border border-slate-200 font-bold text-slate-700 shadow-sm">{data.bloodGroup || 'N/A'}</span>
              </div>
              <div className="space-y-1">
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</p>
                 <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                    data.aiAnalysis.confidenceLevel === 'High' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                 }`}>
                    <span className={`w-2 h-2 rounded-full ${data.aiAnalysis.confidenceLevel === 'High' ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                    Active Monitoring
                 </span>
              </div>
           </div>
        </div>

        {/* VITALS CARDS */}
        <div className="mb-10">
           <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-lg shadow-sm">📊</span>
              Current Clinical Vitals
           </h3>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                 <div className="absolute top-0 right-0 w-16 h-16 bg-rose-50 rounded-bl-full -mr-8 -mt-8 z-0 group-hover:scale-110 transition-transform"></div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase relative z-10">Blood Pressure</p>
                 <div className="mt-2 flex items-baseline gap-1 relative z-10">
                    <span className="text-2xl font-black text-slate-800">{data.metrics.systolicBP}/{data.metrics.diastolicBP}</span>
                    <span className="text-xs font-medium text-slate-400">mmHg</span>
                 </div>
              </div>
              <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                 <div className="absolute top-0 right-0 w-16 h-16 bg-amber-50 rounded-bl-full -mr-8 -mt-8 z-0 group-hover:scale-110 transition-transform"></div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase relative z-10">Glucose</p>
                 <div className="mt-2 flex items-baseline gap-1 relative z-10">
                    <span className="text-2xl font-black text-slate-800">{data.metrics.glucose}</span>
                    <span className="text-xs font-medium text-slate-400">mg/dL</span>
                 </div>
              </div>
              <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                 <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-bl-full -mr-8 -mt-8 z-0 group-hover:scale-110 transition-transform"></div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase relative z-10">BMI</p>
                 <div className="mt-2 flex items-baseline gap-1 relative z-10">
                    <span className="text-2xl font-black text-slate-800">{data.metrics.bmi}</span>
                    <span className="text-xs font-medium text-slate-400">kg/m²</span>
                 </div>
              </div>
              <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                 <div className="absolute top-0 right-0 w-16 h-16 bg-purple-50 rounded-bl-full -mr-8 -mt-8 z-0 group-hover:scale-110 transition-transform"></div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase relative z-10">Cholesterol</p>
                 <div className="mt-2 flex items-baseline gap-1 relative z-10">
                    <span className="text-2xl font-black text-slate-800">{data.metrics.cholesterol}</span>
                    <span className="text-xs font-medium text-slate-400">mg/dL</span>
                 </div>
              </div>
           </div>
        </div>

        {/* AI ANALYSIS SECTION */}
        <div className="mb-10 p-1 rounded-3xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-blue-100 print:break-inside-avoid">
           <div className="bg-white/60 backdrop-blur-sm rounded-[20px] p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                 <span className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-lg shadow-sm">🧠</span>
                 AI Risk Assessment
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                 {data.aiAnalysis.predictions?.map((pred, i) => (
                    <div key={i} className={`p-4 rounded-xl border relative overflow-hidden ${
                       pred.riskLevel === 'High' ? 'bg-red-50 border-red-100' : 
                       pred.riskLevel === 'Moderate' ? 'bg-orange-50 border-orange-100' : 'bg-emerald-50 border-emerald-100'
                    }`}>
                       <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1">{pred.condition}</p>
                       <div className="flex items-center gap-2 relative z-10">
                          <span className={`text-2xl font-black ${
                             pred.riskLevel === 'High' ? 'text-red-700' : 
                             pred.riskLevel === 'Moderate' ? 'text-orange-700' : 'text-emerald-700'
                          }`}>{pred.riskLevel}</span>
                          <span className="text-xs font-bold opacity-60 uppercase">Risk</span>
                       </div>
                    </div>
                 ))}
              </div>

              <div className="space-y-4">
                 <h4 className="text-sm font-bold text-slate-700 border-b border-slate-200 pb-2">Key Clinical Insights</h4>
                 <div className="grid grid-cols-1 gap-3">
                    {data.aiAnalysis.predictions?.map((pred, i) => (
                        <div key={i} className="flex gap-4 p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                           <div className={`w-1.5 shrink-0 rounded-full ${
                              pred.riskLevel === 'High' ? 'bg-red-400' : 
                              pred.riskLevel === 'Moderate' ? 'bg-orange-400' : 'bg-emerald-400'
                           }`}></div>
                           <div className="flex-1">
                              <div className="flex justify-between items-start">
                                <p className="font-bold text-slate-800 text-sm">{pred.condition}</p>
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">{pred.probability}% Prob</span>
                              </div>
                              <p className="text-sm text-slate-600 mt-1 leading-relaxed">{pred.recommendation}</p>
                              {pred.topFactors && pred.topFactors.length > 0 && (
                                 <div className="mt-3 flex flex-wrap gap-2">
                                    {pred.topFactors.map((f, idx) => (
                                       <span key={idx} className={`text-[10px] px-2 py-1 rounded-md font-bold border flex items-center gap-1 ${
                                           f.direction === 'Increase' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                       }`}>
                                          {f.factor} {f.direction === 'Increase' ? '↑' : '↓'}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 print:break-inside-avoid">
           {/* MEDICATIONS */}
           <div>
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                 <span className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center text-lg shadow-sm">💊</span>
                 Active Medications
              </h3>
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm h-full">
                 {data.medications.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                       {data.medications.map((med, i) => (
                          <div key={i} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                             <div>
                                <p className="font-bold text-slate-800 text-sm">{med.name}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{med.dosage}</p>
                             </div>
                             <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded uppercase tracking-wide">{med.time}</span>
                          </div>
                       ))}
                    </div>
                 ) : (
                    <div className="p-8 text-center text-slate-400 italic bg-slate-50">No active medications prescribed.</div>
                 )}
              </div>
           </div>

           {/* HISTORY TABLE */}
           <div>
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                 <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center text-lg shadow-sm">📅</span>
                 Recent History
              </h3>
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm h-full">
                 <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                       <tr>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">BP</th>
                          <th className="px-4 py-3">Glucose</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {data.history.slice(-5).reverse().map((h, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                             <td className="px-4 py-3 text-slate-600 font-medium">{new Date(h.timestamp).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</td>
                             <td className="px-4 py-3 font-mono text-slate-700">{h.systolicBP}/{h.diastolicBP}</td>
                             <td className="px-4 py-3 font-mono text-slate-700">{h.glucose}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>

        {/* FOOTER */}
        <div className="mt-12 pt-6 border-t border-slate-200 text-center print:break-inside-avoid">
           <p className="text-xs text-slate-400 font-medium">Generated by CareXAI Clinical Decision Support System</p>
           <p className="text-[10px] text-slate-300 mt-1 uppercase tracking-wider">Disclaimer: Not a substitute for professional medical diagnosis</p>
        </div>

      </div>
    </div>
  );
};
