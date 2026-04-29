import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Activity, Droplets, Heart, AlertTriangle, ChevronDown, Upload, Loader2, Info } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { NeonButton } from './NeonButton';
import { NeonInput } from './NeonInput';
import { RiskBadge } from './RiskBadge';
import { HealthMetrics, AIAnalysisResult, DiseasePrediction, ExtractedParameter } from '@/types';
import { GeminiService } from '@/services/geminiService';
import { BackendAPI } from '@/services/apiClient';
import { toast } from 'sonner';

interface Props {
  metrics: HealthMetrics;
  onUpdateMetrics: (metrics: HealthMetrics) => void;
  onAnalyzeComplete: (result: AIAnalysisResult) => void;
}

export const MLRiskAssessor: React.FC<Props> = ({ metrics, onUpdateMetrics, onAnalyzeComplete }) => {
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [expandedPrediction, setExpandedPrediction] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const fileUploadRef = useRef<HTMLInputElement>(null);

  const handleManualUpdate = (field: keyof HealthMetrics, value: any) => {
    onUpdateMetrics({ ...metrics, [field]: value });
  };

  const calculateBMI = (w?: number, h?: number) => {
    if (!w || !h || h === 0) return 0;
    return parseFloat((w / ((h / 100) ** 2)).toFixed(1));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    toast.info("Analyzing report via Neural Engine...");

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const extracted = await GeminiService.extractMetricsFromReport(base64, file.type);
        
        if (extracted && extracted.length > 0) {
          const mappedMetrics = GeminiService.mapExtractedToMetrics(extracted);
          onUpdateMetrics({ ...metrics, ...mappedMetrics });
          toast.success(`Extracted ${extracted.length} parameters successfully.`);
        } else {
          toast.error("No readable metrics found in the report.");
        }
        setIsUploading(false);
      };
    } catch (err) {
      toast.error("OCR Extraction failed");
      setIsUploading(false);
    } finally {
      if (fileUploadRef.current) fileUploadRef.current.value = '';
    }
  };

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const result = await BackendAPI.analyzeHealthRisk({
        metrics,
        age: 40, // Should come from user profile
        gender: 'Male' // Should come from user profile
      });
      setAiResult(result);
      onAnalyzeComplete(result);
      toast.success("Risk Matrix Generated");
    } catch (err) {
      toast.error("ML Prediction Failed: Check your biometric inputs.");
    } finally {
      setLoading(false);
    }
  };

  const getConditionIcon = (condition: string) => {
    switch (condition) {
      case 'Heart Disease': return <Heart className="h-5 w-5" />;
      case 'Diabetes': return <Droplets className="h-5 w-5" />;
      case 'Hypertension': return <Activity className="h-5 w-5" />;
      default: return <AlertTriangle className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Input Parameters */}
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary shadow-glow">
              <Activity className="h-4 w-4" />
            </div>
            <h3 className="font-display font-semibold text-lg">Biometric Input</h3>
          </div>

          <div 
            onClick={() => fileUploadRef.current?.click()}
            className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all mb-6 group"
          >
            <input type="file" ref={fileUploadRef} className="hidden" onChange={handleFileUpload} accept="image/*,application/pdf" />
            {isUploading ? (
              <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
            ) : (
              <Upload className="h-8 w-8 mx-auto text-muted-foreground group-hover:text-primary transition-colors" />
            )}
            <p className="text-sm font-medium mt-2">Auto-Fill via Lab Report</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Upload PDF or Image for OCR</p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <NeonInput label="Systolic BP" type="number" value={metrics.systolicBP || ''} onChange={e => handleManualUpdate('systolicBP', parseFloat(e.target.value))} />
              <NeonInput label="Diastolic BP" type="number" value={metrics.diastolicBP || ''} onChange={e => handleManualUpdate('diastolicBP', parseFloat(e.target.value))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <NeonInput label="Glucose" type="number" value={metrics.glucose || ''} onChange={e => handleManualUpdate('glucose', parseFloat(e.target.value))} />
              <NeonInput label="Cholesterol" type="number" value={metrics.cholesterol || ''} onChange={e => handleManualUpdate('cholesterol', parseFloat(e.target.value))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <NeonInput label="Weight (kg)" type="number" value={metrics.weight || ''} onChange={e => {
                const w = parseFloat(e.target.value);
                onUpdateMetrics({ ...metrics, weight: w, bmi: calculateBMI(w, metrics.height) });
              }} />
              <NeonInput label="Height (cm)" type="number" value={metrics.height || ''} onChange={e => {
                const h = parseFloat(e.target.value);
                onUpdateMetrics({ ...metrics, height: h, bmi: calculateBMI(metrics.weight, h) });
              }} />
            </div>
            
            <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Calculated BMI</span>
              <p className="text-xl font-display font-bold text-primary">{metrics.bmi || '--'}</p>
            </div>

            <NeonButton variant="neon" className="w-full h-12 mt-4" onClick={runAnalysis} disabled={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Brain className="h-5 w-5 mr-2" />}
              Execute ML Risk Prediction
            </NeonButton>
          </div>
        </GlassCard>

        {/* Right: Results Matrix */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Prediction Matrix
            </h3>
            {aiResult && (
              <span className="text-[10px] text-muted-foreground font-mono">Analysis Timestamp: {new Date(aiResult.timestamp).toLocaleTimeString()}</span>
            )}
          </div>

          {!aiResult ? (
            <div className="h-[500px] flex flex-col items-center justify-center text-center p-8 bg-muted/20 rounded-3xl border border-dashed border-border shadow-inner">
              <div className="w-20 h-20 bg-muted rounded-2xl flex items-center justify-center mb-6 shadow-glow-primary/20 border border-border group overflow-hidden">
                <Brain className="h-10 w-10 text-muted-foreground group-hover:text-primary transition-colors group-hover:scale-110 duration-500" />
              </div>
              <h4 className="font-display text-xl font-bold mb-2">Awaiting Telemetry</h4>
              <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                Upload lab results or input biometrics manually to initialize the neural risk assessment matrix.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {aiResult.predictions.map((pred) => (
                <GlassCard 
                  key={pred.condition} 
                  className={`overflow-hidden transition-all duration-300 ${expandedPrediction === pred.condition ? 'ring-2 ring-primary/50 shadow-glow' : 'hover:border-primary/40'}`}
                >
                  <div 
                    className="p-5 cursor-pointer" 
                    onClick={() => setExpandedPrediction(expandedPrediction === pred.condition ? null : pred.condition)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-gradient-aurora flex items-center justify-center text-white shadow-glow">
                          {getConditionIcon(pred.condition)}
                        </div>
                        <div>
                          <h4 className="font-display font-bold text-lg">{pred.condition}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Confidence: {pred.confidenceScore}%</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <RiskBadge level={pred.riskLevel.toLowerCase() as any} />
                        <div className="mt-2">
                          <span className={`text-3xl font-display font-black ${pred.probability > 70 ? 'text-destructive' : pred.probability > 30 ? 'text-warning' : 'text-success'}`}>
                            {pred.probability}%
                          </span>
                          <span className="text-[10px] block text-muted-foreground uppercase font-bold tracking-tighter">Probability</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-6 flex items-center gap-2 text-[10px] font-bold text-primary uppercase tracking-widest">
                      {expandedPrediction === pred.condition ? 'Hide Analysis' : 'Explain AI Result'}
                      <ChevronDown className={`h-3 w-3 transition-transform ${expandedPrediction === pred.condition ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedPrediction === pred.condition && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-border bg-muted/30"
                      >
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div>
                            <h5 className="text-[10px] font-bold text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                              <Info className="h-3 w-3" /> XAI Feature Attribution
                            </h5>
                            <div className="space-y-2">
                              {pred.topFactors?.map((f, i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border group hover:border-primary/30 transition-colors">
                                  <div>
                                    <p className="text-sm font-semibold">{f.factor}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase">{f.description}</p>
                                  </div>
                                  <span className={`text-[10px] font-bold px-2 py-1 rounded border ${f.direction === 'Increase' ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-success/10 text-success border-success/20'}`}>
                                    {f.direction === 'Increase' ? '⬆ Elevates' : '⬇ Lowers'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <h5 className="text-[10px] font-bold text-success uppercase tracking-widest mb-4">AI Recommendation Protocol</h5>
                            <div className="p-4 rounded-xl bg-success/10 border border-success/20 text-sm leading-relaxed text-foreground relative overflow-hidden">
                              <Lightbulb className="absolute -right-2 -top-2 h-12 w-12 opacity-10 text-success" />
                              <p className="relative z-10">{pred.recommendation}</p>
                            </div>
                            <div className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/20">
                              <h6 className="text-[10px] font-bold uppercase tracking-wider mb-2">Confidence Insight</h6>
                              <p className="text-xs text-muted-foreground">{aiResult.confidenceReason}</p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Lightbulb = (props: any) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .5 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
    <path d="M9 18h6" />
    <path d="M10 22h4" />
  </svg>
);
