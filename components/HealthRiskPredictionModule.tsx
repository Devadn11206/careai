
import React, { useState, useRef } from 'react';
import { HealthMetrics, AIAnalysisResult, DiseasePrediction, ExtractedParameter } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { GeminiService } from '../services/geminiService';

interface Props {
  metrics: HealthMetrics;
  history: HealthMetrics[];
  aiResult: AIAnalysisResult | null;
  onUpdateMetrics: (metrics: HealthMetrics) => void;
  onAnalyze: (dynamicData?: ExtractedParameter[]) => void; // Update prop signature
  loading: boolean;
  symptomProfile?: { bpRisk: string; glucoseRisk: string };
}

export const HealthRiskPredictionModule: React.FC<Props> = ({ metrics, history, aiResult, onUpdateMetrics, onAnalyze, loading, symptomProfile }) => {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'ESTIMATED' | 'MANUAL' | 'REPORT'>(symptomProfile ? 'ESTIMATED' : 'MANUAL');
  
  // File Upload & Dynamic Data State
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedParameter[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateBMI = (w: number, h: number) => {
    if (w > 0 && h > 0) {
      const bmiVal = parseFloat((w / ((h / 100) ** 2)).toFixed(1));
      onUpdateMetrics({ ...metrics, weight: w, height: h, bmi: bmiVal });
    } else {
      onUpdateMetrics({ ...metrics, weight: w, height: h });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setReportFile(file);
    setIsExtracting(true);
    setExtractError(null);
    setExtractedData([]);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = (reader.result as string).split(',')[1];
      try {
        const data = await GeminiService.extractMetricsFromReport(base64String, file.type);
        setExtractedData(data);
        
        // Auto-update BMI if found in report
        const calculatedBMI = GeminiService.calculateDynamicBMI(data);
        if (calculatedBMI) {
            onUpdateMetrics({ ...metrics, bmi: calculatedBMI });
        }

        setInputMode('REPORT');
      } catch (err) {
        console.error(err);
        setExtractError("Failed to read report. Please ensure image is clear.");
        setReportFile(null);
      } finally {
        setIsExtracting(false);
        e.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'High': return 'bg-red-50 text-red-700 border-red-200';
      case 'High Risk': return 'bg-red-50 text-red-700 border-red-200';
      case 'Moderate': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'Prediabetic Risk': return 'bg-orange-50 text-orange-700 border-orange-200';
      default: return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  const getRiskIcon = (condition: string) => {
    switch (condition) {
      case 'Heart Disease': return '❤️';
      case 'Hypertension': return '🩸';
      case 'Diabetes': return '🍬';
      default: return '⚕️';
    }
  };

  const renderPredictionCard = (pred: DiseasePrediction) => {
    const isExpanded = expandedCard === pred.condition;
    return (
      <motion.div 
        layout
        key={pred.condition}
        className={`bg-white rounded-2xl shadow-sm border transition-all cursor-pointer overflow-hidden ${
          isExpanded ? 'border-teal-500 ring-1 ring-teal-500 col-span-1 md:col-span-3 order-first md:order-none' : 'border-slate-100 hover:shadow-md'
        }`}
        onClick={() => setExpandedCard(isExpanded ? null : pred.condition)}
      >
        <div className="p-5">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl bg-slate-50 w-10 h-10 flex items-center justify-center rounded-full border border-slate-100">{getRiskIcon(pred.condition)}</span>
              <div>
                <h4 className="font-bold text-slate-800">{pred.condition}</h4>
                <p className="text-xs text-slate-500">Confidence: {pred.confidenceScore}%</p>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${getRiskColor(pred.riskLevel)}`}>
              {pred.riskLevel} Risk
            </span>
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-end mb-1">
              <span className="text-3xl font-black text-slate-800">{pred.probability}%</span>
              <span className="text-xs text-slate-400 mb-1">Probability</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${pred.probability}%` }}
                className={`h-full rounded-full ${
                  pred.probability > 70 ? 'bg-red-500' : pred.probability > 30 ? 'bg-yellow-500' : 'bg-emerald-500'
                }`}
              />
            </div>
          </div>

          <div className="flex items-center gap-1 text-xs text-teal-600 font-bold hover:underline mt-2">
            {isExpanded ? 'Hide Details' : 'Why this result?'}
            <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-slate-50 border-t border-slate-100 cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h5 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Factor Analysis
                  </h5>
                  <div className="space-y-3">
                    {pred.topFactors?.map((f, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                        <div>
                          <p className="font-bold text-slate-700 text-sm">{f.factor}</p>
                          <p className="text-[10px] text-slate-500">{f.description}</p>
                        </div>
                        <div className="text-right">
                            <div className={`flex items-center justify-end gap-1 text-xs font-bold ${f.direction === 'Increase' ? 'text-red-500' : 'text-emerald-500'}`}>
                              {f.direction === 'Increase' ? '⬆ Raises' : '⬇ Lowers'}
                            </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-400 uppercase mb-3">AI Recommendation</h5>
                  <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-blue-800 text-sm leading-relaxed mb-4">
                    💡 {pred.recommendation}
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
    <Card title="AI Health Risk Prediction" className="border-t-4 border-t-teal-500 shadow-lg">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: Input Form */}
        <div className="space-y-5 lg:border-r lg:border-slate-100 lg:pr-6">
          
          {/* Mode Switcher */}
          {symptomProfile && (
             <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
               <button onClick={() => setInputMode('ESTIMATED')} className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all ${inputMode === 'ESTIMATED' ? 'bg-white shadow text-teal-700' : 'text-slate-400 hover:text-slate-600'}`}>Estimates</button>
               <button onClick={() => setInputMode('REPORT')} className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all ${inputMode === 'REPORT' || inputMode === 'MANUAL' ? 'bg-white shadow text-teal-700' : 'text-slate-400 hover:text-slate-600'}`}>Lab Report</button>
             </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input label="Height (cm)" type="number" value={metrics.height || ''} onChange={e => updateBMI(metrics.weight || 0, parseFloat(e.target.value))} />
            <Input label="Weight (kg)" type="number" value={metrics.weight || ''} onChange={e => updateBMI(parseFloat(e.target.value), metrics.height || 0)} />
          </div>
          <div className="bg-slate-100 p-2 rounded text-center text-xs font-bold text-slate-600">Calculated BMI: {metrics.bmi || '--'}</div>

          {inputMode === 'REPORT' || inputMode === 'MANUAL' ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                
                {/* FILE UPLOAD SECTION */}
                <div className={`p-4 border-2 border-dashed rounded-xl transition-colors ${reportFile ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:border-teal-300'}`}>
                    <div className="flex flex-col items-center justify-center text-center">
                        {isExtracting ? (
                            <div className="flex flex-col items-center py-2">
                                <svg className="animate-spin h-8 w-8 text-teal-600 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                <span className="text-xs font-bold text-teal-700">Extracting data...</span>
                            </div>
                        ) : reportFile ? (
                            <div className="flex items-center gap-3 w-full">
                                <div className="h-10 w-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <div className="text-left flex-1 min-w-0">
                                    <p className="text-xs font-bold text-emerald-800 truncate">{reportFile.name}</p>
                                    <p className="text-[10px] text-emerald-600">Found {extractedData.length} parameters</p>
                                </div>
                                <button onClick={() => { setReportFile(null); setExtractedData([]); setInputMode('MANUAL'); }} className="text-slate-400 hover:text-red-500">✕</button>
                            </div>
                        ) : (
                            <>
                                <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2 w-full py-4">
                                    <span className="text-3xl">📄</span>
                                    <span className="text-sm font-bold text-slate-600">Upload Lab Report</span>
                                    <span className="text-[10px] text-slate-400">PDF or Image (Required for analysis)</span>
                                </button>
                                <input ref={fileInputRef} type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} />
                            </>
                        )}
                        {extractError && <p className="text-xs text-red-500 mt-2 font-bold">{extractError}</p>}
                    </div>
                </div>

                {/* DYNAMIC EXTRACTED DATA TABLE */}
                {extractedData.length > 0 && (
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 max-h-60 overflow-y-auto custom-scrollbar">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-xs font-bold text-slate-500 uppercase">Extracted Values</h4>
                            <span className="text-[10px] text-slate-400">Editable</span>
                        </div>
                        <div className="space-y-2">
                            {extractedData.map((item, idx) => (
                                <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded border border-slate-100">
                                    <div className="col-span-5 text-xs font-bold text-slate-700 truncate" title={item.testName}>{item.testName}</div>
                                    <input 
                                        type="text" 
                                        value={item.value} 
                                        onChange={(e) => {
                                            const newData = [...extractedData];
                                            newData[idx].value = e.target.value;
                                            setExtractedData(newData);
                                        }}
                                        className="col-span-4 text-xs p-1 border rounded text-center bg-slate-50"
                                    />
                                    <div className="col-span-3 text-[10px] text-slate-400 truncate">{item.unit}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* MANUAL FALLBACK (Only if no file uploaded yet) */}
                {!reportFile && (
                    <div className="opacity-50 pointer-events-none">
                        <Input label="Systolic BP" type="number" placeholder="120" value="" disabled />
                    </div>
                )}
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className={`p-4 rounded-xl border flex items-center justify-between ${getRiskColor(symptomProfile?.bpRisk || 'Low')}`}>
                    <div className="flex items-center gap-3"><span className="text-xl">🩸</span><div><p className="text-xs font-bold uppercase opacity-70">Blood Pressure</p><p className="font-bold text-lg">{symptomProfile?.bpRisk} Risk</p></div></div>
                    <div className="text-[10px] font-bold bg-white/50 px-2 py-1 rounded">AI Est.</div>
                </div>
                <div className={`p-4 rounded-xl border flex items-center justify-between ${getRiskColor(symptomProfile?.glucoseRisk || 'Low')}`}>
                    <div className="flex items-center gap-3"><span className="text-xl">🍬</span><div><p className="text-xs font-bold uppercase opacity-70">Blood Glucose</p><p className="font-bold text-lg">{symptomProfile?.glucoseRisk}</p></div></div>
                    <div className="text-[10px] font-bold bg-white/50 px-2 py-1 rounded">AI Est.</div>
                </div>
            </motion.div>
          )}

          <div className="space-y-3 pt-2">
            <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Activity Level</label>
                <div className="flex bg-slate-100 rounded-lg p-1">
                    {['Low', 'Moderate', 'High'].map(lvl => (
                        <button key={lvl} onClick={() => onUpdateMetrics({...metrics, activityLevel: lvl as any})} className={`flex-1 text-xs font-bold py-2 rounded-md transition-all ${metrics.activityLevel === lvl ? 'bg-white shadow text-teal-700' : 'text-slate-400 hover:text-slate-600'}`}>{lvl}</button>
                    ))}
                </div>
            </div>
          </div>

          <Button 
            onClick={() => onAnalyze(extractedData)} // Pass extracted data to analyze function
            isLoading={loading} 
            disabled={isExtracting || (inputMode === 'REPORT' && !reportFile && extractedData.length === 0)}
            className="w-full mt-4"
          >
            {inputMode === 'REPORT' && !reportFile 
                ? 'Upload Report to Analyze' 
                : 'Run AI Prediction'}
          </Button>
        </div>

        {/* RIGHT COLUMN: Results */}
        <div className="lg:col-span-2 space-y-6">
          {aiResult && aiResult.predictions ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-min">
              {aiResult.predictions.map(pred => renderPredictionCard(pred))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm"><span className="text-3xl">🤖</span></div>
              <h4 className="text-slate-700 font-bold">Ready to Analyze</h4>
              <p className="text-sm text-slate-500 mt-2 max-w-xs">
                  {inputMode === 'ESTIMATED' 
                    ? "AI will estimate risks based on your symptoms." 
                    : inputMode === 'REPORT' && extractedData.length > 0 
                        ? `Extracted ${extractedData.length} values. Ready for analysis.`
                        : "Upload a report to extract vitals automatically."}
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
