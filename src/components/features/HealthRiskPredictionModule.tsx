import React, { useState, useRef } from 'react';
import { HealthMetrics, AIAnalysisResult, DiseasePrediction, ExtractedParameter } from '@/types';
import { GlassCard as Card } from '@/components/carex/GlassCard';
import { NeonButton as Button } from '@/components/carex/NeonButton';
import { NeonInput as Input } from '@/components/carex/NeonInput';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { GeminiService } from '@/services/geminiService';

interface Props {
  metrics: HealthMetrics;
  history: HealthMetrics[];
  aiResult: AIAnalysisResult | null;
  onUpdateMetrics: (metrics: HealthMetrics) => void;
  onAnalyze: (dynamicData?: ExtractedParameter[]) => void;
  loading: boolean;
  symptomProfile?: { bpRisk: string; glucoseRisk: string };
}

export const HealthRiskPredictionModule: React.FC<Props> = ({ metrics, history, aiResult, onUpdateMetrics, onAnalyze, loading, symptomProfile }) => {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dynamicData, setDynamicData] = useState<ExtractedParameter[]>([]);
  const fileUploadRef = useRef<HTMLInputElement>(null);

  const updateBMI = (w: number, h: number) => {
    if (w > 0 && h > 0) {
      const bmiVal = parseFloat((w / ((h / 100) ** 2)).toFixed(1));
      onUpdateMetrics({ ...metrics, weight: w, height: h, bmi: bmiVal });
    } else {
      onUpdateMetrics({ ...metrics, weight: w, height: h });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          setIsUploading(true);
          const file = e.target.files[0];
          try {
              const reader = new FileReader();
              reader.readAsDataURL(file);
              reader.onload = async () => {
                  const base64 = (reader.result as string).split(',')[1];
                  const extracted = await GeminiService.extractMetricsFromReport(base64, file.type);
                  
                  if (extracted && extracted.length > 0) {
                      setDynamicData(extracted);
                      const mappedMetrics = GeminiService.mapExtractedToMetrics(extracted);
                      onUpdateMetrics({ ...metrics, ...mappedMetrics });
                  } else {
                      alert("No readable health metrics found in the report.");
                  }
                  setIsUploading(false);
              };
          } catch (err) {
              console.error("OCR Extraction failed", err);
              alert("Failed to extract data from report.");
              setIsUploading(false);
          } finally {
              if (fileUploadRef.current) fileUploadRef.current.value = '';
          }
      }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'High': return 'bg-pulse-500/20 text-pulse-400 border-pulse-500/40 shadow-[0_0_10px_rgba(255,0,110,0.5)]';
      case 'High Risk': return 'bg-pulse-500/20 text-pulse-400 border-pulse-500/40 shadow-[0_0_10px_rgba(255,0,110,0.5)]';
      case 'Moderate': return 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.5)]';
      case 'Prediabetic Risk': return 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.5)]';
      default: return 'bg-bio-500/20 text-bio-400 border-bio-500/40 shadow-[0_0_10px_rgba(0,255,179,0.5)]';
    }
  };

  const getRiskIcon = (condition: string) => {
    switch (condition) {
      case 'Heart Disease': return '🫀';
      case 'Hypertension': return '🩸';
      case 'Diabetes': return '🧬';
      default: return '⚕️';
    }
  };

  const renderPredictionCard = (pred: DiseasePrediction) => {
    const isExpanded = expandedCard === pred.condition;
    return (
      <motion.div 
        layout
        key={pred.condition}
        className={`bg-space-900/80 backdrop-blur-xl rounded-2xl shadow-sm border transition-all cursor-pointer overflow-hidden ${
          isExpanded ? 'border-neon-500 ring-1 ring-neon-500 col-span-1 md:col-span-3 order-first md:order-none shadow-[0_0_20px_rgba(0,212,255,0.2)]' : 'border-white/10 hover:border-neon-500/50 hover:shadow-[0_0_15px_rgba(0,212,255,0.1)]'
        }`}
        onClick={() => setExpandedCard(isExpanded ? null : pred.condition)}
      >
        <div className="p-5">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl bg-white/5 w-10 h-10 flex items-center justify-center rounded-xl border border-white/10 shadow-inner">{getRiskIcon(pred.condition)}</span>
              <div>
                <h4 className="font-bold text-white tracking-wide font-['Space_Grotesk']">{pred.condition}</h4>
                <p className="text-[10px] text-neon-400 uppercase tracking-widest font-bold">Confidence: {pred.confidenceScore}%</p>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border ${getRiskColor(pred.riskLevel)}`}>
              {pred.riskLevel} Risk
            </span>
          </div>

          <div className="mb-4 mt-6">
            <div className="flex justify-between items-end mb-2">
              <span className={`text-4xl font-black font-['Space_Grotesk'] ${pred.probability > 70 ? 'text-pulse-400' : pred.probability > 30 ? 'text-amber-400' : 'text-bio-400'}`}>{pred.probability}%</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Probability</span>
            </div>
            <div className="h-1.5 w-full bg-space-950 rounded-full overflow-hidden border border-white/5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${pred.probability}%` }}
                className={`h-full rounded-full ${
                  pred.probability > 70 ? 'bg-pulse-500 shadow-[0_0_10px_rgba(255,0,110,0.8)]' : pred.probability > 30 ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]' : 'bg-bio-500 shadow-[0_0_10px_rgba(0,255,179,0.8)]'
                }`}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-neon-400 font-bold uppercase tracking-widest mt-4 group">
            {isExpanded ? 'Hide Details' : 'Explain AI Result'}
            <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180 text-neon-300' : 'group-hover:translate-x-1'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-white/5 border-t border-white/10 cursor-default backdrop-blur-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h5 className="text-[10px] font-bold text-neon-400 uppercase tracking-widest mb-4 flex items-center gap-2 drop-shadow-[0_0_5px_rgba(0,212,255,0.5)]">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    XAI Feature Attribution
                  </h5>
                  <div className="space-y-3">
                    {pred.topFactors?.map((f, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-space-950/50 p-4 rounded-xl border border-white/10 shadow-inner group hover:border-neon-500/30 transition-colors">
                        <div>
                          <p className="font-bold text-white text-sm font-['Space_Grotesk'] tracking-wide">{f.factor}</p>
                          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">{f.description}</p>
                        </div>
                        <div className="text-right shrink-0">
                            <div className={`flex items-center justify-end gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${f.direction === 'Increase' ? 'bg-pulse-500/20 text-pulse-400 border border-pulse-500/30' : 'bg-bio-500/20 text-bio-400 border border-bio-500/30'}`}>
                              {f.direction === 'Increase' ? '⬆ Elevates' : '⬇ Lowers'}
                            </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h5 className="text-[10px] font-bold text-bio-400 uppercase tracking-widest mb-4 drop-shadow-[0_0_5px_rgba(0,255,179,0.5)]">AI Recommendation Protocol</h5>
                  <div className="bg-bio-500/10 border border-bio-500/30 p-5 rounded-xl text-bio-100 text-sm leading-relaxed mb-4 shadow-[inset_0_0_20px_rgba(0,255,179,0.05)] backdrop-blur-sm relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 text-6xl opacity-10">💡</div>
                    <span className="relative z-10">{pred.recommendation}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <Card title="Neural Risk Assessment" className="border-neon-500/20 shadow-[0_0_30px_rgba(0,212,255,0.05)] glass-card-dark relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-neon-600/10 rounded-full blur-[80px] pointer-events-none"></div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10 mt-2">
        
        {/* LEFT COLUMN: Input Form & OCR */}
        <div className="space-y-6 lg:border-r lg:border-white/10 lg:pr-8">
          
          {/* File Upload Zone */}
          <div 
            onClick={() => fileUploadRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${isUploading ? 'border-neon-500 bg-neon-500/10 animate-pulse' : 'border-white/20 hover:border-neon-400 hover:bg-white/5'} group`}
          >
            <input 
              type="file" 
              ref={fileUploadRef} 
              className="hidden" 
              accept="image/*,application/pdf"
              onChange={handleFileUpload}
            />
            <div className="w-12 h-12 mx-auto bg-space-900 rounded-xl flex items-center justify-center text-2xl shadow-inner border border-white/10 group-hover:scale-110 transition-transform mb-3">
              {isUploading ? '⚙️' : '📄'}
            </div>
            <p className="text-white font-bold text-sm tracking-wide font-['Space_Grotesk']">
              {isUploading ? 'Extracting via Neural Net...' : 'Auto-Fill via Lab Report'}
            </p>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-2">Upload PDF or Image for OCR</p>
            {dynamicData.length > 0 && !isUploading && (
              <div className="mt-3 inline-block bg-bio-500/20 text-bio-400 border border-bio-500/30 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest shadow-[0_0_10px_rgba(0,255,179,0.2)]">
                ✓ Extracted {dynamicData.length} parameters
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
             <div className="h-px bg-white/10 flex-1"></div>
             <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Or Manual Entry</span>
             <div className="h-px bg-white/10 flex-1"></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Height (cm)"
              type="number"
              value={metrics.height || ''}
              onChange={e => updateBMI(metrics.weight || 0, parseFloat(e.target.value))}
            />
            <Input
              label="Weight (kg)"
              type="number"
              value={metrics.weight || ''}
              onChange={e => updateBMI(parseFloat(e.target.value), metrics.height || 0)}
            />
          </div>
          <div className="bg-white/5 border border-white/10 p-3 rounded-xl text-center text-[10px] font-bold text-neon-400 uppercase tracking-widest shadow-inner">
            Calculated BMI: <span className="text-sm ml-2 text-white">{metrics.bmi || '--'}</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Systolic BP (mmHg)"
              type="number"
              value={metrics.systolicBP || ''}
              onChange={e => onUpdateMetrics({ ...metrics, systolicBP: parseFloat(e.target.value) || 0 })}
            />
            <Input
              label="Diastolic BP (mmHg)"
              type="number"
              value={metrics.diastolicBP || ''}
              onChange={e => onUpdateMetrics({ ...metrics, diastolicBP: parseFloat(e.target.value) || 0 })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Glucose (mg/dL)"
              type="number"
              value={metrics.glucose || ''}
              onChange={e => onUpdateMetrics({ ...metrics, glucose: parseFloat(e.target.value) || 0 })}
            />
            <Input
              label="Cholesterol (mg/dL)"
              type="number"
              value={metrics.cholesterol || ''}
              onChange={e => onUpdateMetrics({ ...metrics, cholesterol: parseFloat(e.target.value) || 0 })}
            />
          </div>

          <Button
            variant="neon"
            onClick={() => onAnalyze(dynamicData)}
            isLoading={loading || isUploading}
            className="w-full mt-6 py-4 rounded-xl font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(0,212,255,0.4)]"
          >
            Execute ML Risk Prediction
          </Button>
        </div>

        {/* RIGHT COLUMN: Results */}
        <div className="lg:col-span-2 space-y-6">
          {aiResult && aiResult.predictions ? (
            <div className="grid grid-cols-1 gap-4 auto-rows-min">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-neon-400 animate-pulse"></div>
                Prediction Matrix
              </h3>
              {aiResult.predictions.map(pred => renderPredictionCard(pred))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-white/5 rounded-3xl border border-dashed border-white/10 shadow-inner min-h-[400px]">
              <div className="w-24 h-24 bg-space-900 rounded-3xl flex items-center justify-center mb-6 shadow-2xl border border-white/5 relative overflow-hidden group">
                <div className="absolute inset-0 bg-neon-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <span className="text-5xl relative z-10 group-hover:scale-110 transition-transform duration-500">🧠</span>
              </div>
              <h4 className="text-white font-bold text-xl font-['Space_Grotesk'] tracking-tight mb-2">Awaiting Telemetry</h4>
              <p className="text-[11px] text-slate-400 max-w-sm uppercase font-bold tracking-widest leading-relaxed">
                {symptomProfile
                  ? 'AI will process risk trajectories based on symptom vectors.'
                  : 'Upload lab results or input biometrics manually to initialize the ML prediction matrix.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
