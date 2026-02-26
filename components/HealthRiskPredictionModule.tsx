
import React, { useState } from 'react';
import { HealthMetrics, AIAnalysisResult, DiseasePrediction, ExtractedParameter } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

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

  const updateBMI = (w: number, h: number) => {
    if (w > 0 && h > 0) {
      const bmiVal = parseFloat((w / ((h / 100) ** 2)).toFixed(1));
      onUpdateMetrics({ ...metrics, weight: w, height: h, bmi: bmiVal });
    } else {
      onUpdateMetrics({ ...metrics, weight: w, height: h });
    }
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
          
          {/* Mode switcher removed: only direct input used now */}

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
          <div className="bg-slate-100 p-2 rounded text-center text-xs font-bold text-slate-600">Calculated BMI: {metrics.bmi || '--'}</div>

          <div className="grid grid-cols-2 gap-4 mt-4">
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

          <div className="grid grid-cols-2 gap-4 mt-4">
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

          <div className="grid grid-cols-2 gap-4 mt-4">
            <Input
              label="Max Heart Rate"
              type="number"
              value={metrics.maxHeartRate || ''}
              onChange={e => onUpdateMetrics({ ...metrics, maxHeartRate: parseFloat(e.target.value) || 0 })}
            />
            <Input
              label="ST Depression (0-6)"
              type="number"
              value={metrics.stDepression || ''}
              onChange={e => onUpdateMetrics({ ...metrics, stDepression: parseFloat(e.target.value) || 0 })}
            />
          </div>

          <Button
            onClick={() => onAnalyze()}
            isLoading={loading}
            className="w-full mt-6"
          >
            Run AI Prediction
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
                {symptomProfile
                  ? 'AI will estimate risks based on your symptoms.'
                  : 'Enter your details and run AI prediction to see your risk profile.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
