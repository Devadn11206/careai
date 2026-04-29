
import React, { useState } from 'react';
import { HealthMetrics, AIAnalysisResult } from '@/types';
import { GlassCard as Card } from '@/components/carex/GlassCard';
import { NeonInput as Input } from '@/components/carex/NeonInput';
import { NeonButton as Button } from '@/components/carex/NeonButton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  metrics: HealthMetrics;
  history: HealthMetrics[];
  aiResult: AIAnalysisResult | null;
  onUpdateMetrics: (metrics: HealthMetrics) => void;
  onAnalyze: () => void;
  loading: boolean;
}

type TabType = 'CKD' | 'STROKE' | 'THYROID';

export const MultiDiseaseHealthModule: React.FC<Props> = ({ metrics, history, aiResult, onUpdateMetrics, onAnalyze, loading }) => {
  const [activeTab, setActiveTab] = useState<TabType>('CKD');

  const getTrendArrow = (key: keyof HealthMetrics, type: 'lower_better' | 'range_better') => {
    if (history.length < 2) return <span className="text-slate-400">➖</span>;
    const current = (metrics[key] as number) || 0;
    const previous = (history[history.length - 2][key] as number) || 0;
    
    if (Math.abs(current - previous) < 0.1) return <span className="text-slate-400">➖ Stable</span>;

    if (type === 'lower_better') {
        if (current < previous) return <span className="text-emerald-500 font-bold">⬇ Improving</span>;
        return <span className="text-red-500 font-bold">⬆ Worsening</span>;
    } else {
        // Range better logic (simplified: normalization is good)
        // For simplicity in this mock, improving/worsening logic is generalized
        if (current > previous) return <span className="text-orange-500">⬆ Increasing</span>;
        return <span className="text-blue-500">⬇ Decreasing</span>;
    }
  };

  const renderCKDTab = () => (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
                <h4 className="font-bold text-slate-700">Kidney Health Inputs</h4>
                <Input 
                    label="Serum Creatinine (mg/dL)" 
                    type="number" step="0.1"
                    value={metrics.serumCreatinine || ''} 
                    onChange={e => onUpdateMetrics({...metrics, serumCreatinine: parseFloat(e.target.value)})}
                    placeholder="e.g., 0.9"
                    tooltip="Waste product in blood. High levels may indicate kidney issues."
                />
                <div className="flex items-center gap-2 pt-2">
                    <input 
                        type="checkbox" 
                        checked={metrics.diabetesHistory || false}
                        onChange={e => onUpdateMetrics({...metrics, diabetesHistory: e.target.checked})}
                        className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                    />
                    <label className="text-sm text-slate-700 font-medium">History of Diabetes?</label>
                </div>
                <Button onClick={onAnalyze} isLoading={loading} size="sm" className="w-full mt-2">Check Kidney Risk</Button>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-700 mb-2">CKD Risk Status</h4>
                {aiResult?.ckdRiskLevel ? (
                    <div className="text-center py-6">
                        <span className={`text-3xl font-extrabold ${aiResult.ckdRiskLevel === 'High' ? 'text-red-600' : aiResult.ckdRiskLevel === 'Medium' ? 'text-amber-500' : 'text-emerald-600'}`}>
                            {aiResult.ckdRiskLevel} Risk
                        </span>
                        <p className="text-xs text-slate-500 mt-2">Based on BP, Diabetes & Creatinine</p>
                        <div className="mt-4 text-sm font-medium bg-white p-2 rounded shadow-sm">
                            Trend: {getTrendArrow('serumCreatinine', 'lower_better')}
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-slate-400 py-8 italic">Enter data and analyze</div>
                )}
            </div>
        </div>
        
        {history.some(h => h.serumCreatinine) && (
            <div className="h-48 w-full mt-4 flex flex-col">
                <p className="text-xs font-bold text-slate-400 uppercase mb-2 flex-shrink-0">Creatinine Trend</p>
                <div className="flex-1 min-h-0 w-full">
                    <ResponsiveContainer width="100%" height={192} minWidth={0} debounce={50}>
                        <AreaChart data={history}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="timestamp" hide />
                            <YAxis domain={[0.5, 2.0]} />
                            <Tooltip />
                            <Area type="monotone" dataKey="serumCreatinine" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} name="Creatinine" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        )}
    </div>
  );

  const renderStrokeTab = () => (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
                <h4 className="font-bold text-slate-700">Stroke Risk Factors</h4>
                <div className="flex gap-4">
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Systolic BP</label>
                        <div className="bg-slate-100 p-2 rounded text-slate-700 font-mono">{metrics.systolicBP}</div>
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Smoking</label>
                        <div className={`p-2 rounded font-bold text-sm ${metrics.smoking ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {metrics.smoking ? 'Yes' : 'No'}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                    <input 
                        type="checkbox" 
                        checked={metrics.hasFatigue || false}
                        onChange={e => onUpdateMetrics({...metrics, hasFatigue: e.target.checked})}
                        className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                    />
                    <label className="text-sm text-slate-700 font-medium">Frequent Fatigue / Numbness?</label>
                </div>
                <Button onClick={onAnalyze} isLoading={loading} size="sm" className="w-full mt-2">Assess Stroke Risk</Button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-700 mb-2">Awareness Score</h4>
                {aiResult?.strokeRiskScore !== undefined ? (
                    <div className="text-center py-4">
                        <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle cx="48" cy="48" r="40" stroke="#e2e8f0" strokeWidth="8" fill="none" />
                                <circle cx="48" cy="48" r="40" stroke={aiResult.strokeRiskScore > 50 ? "#ef4444" : "#10b981"} strokeWidth="8" fill="none" strokeDasharray={251} strokeDashoffset={251 - (251 * aiResult.strokeRiskScore) / 100} />
                            </svg>
                            <span className="absolute text-xl font-bold">{aiResult.strokeRiskScore}%</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">Preventive Risk Score</p>
                        {aiResult.strokeRiskScore > 50 && <p className="text-[10px] text-red-500 font-bold mt-1">⚠️ Consult a doctor regarding BP control</p>}
                    </div>
                ) : (
                    <div className="text-center text-slate-400 py-8 italic">Enter data and analyze</div>
                )}
            </div>
        </div>
    </div>
  );

  const renderThyroidTab = () => (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
                <h4 className="font-bold text-slate-700">Thyroid Indicators</h4>
                <Input 
                    label="TSH Level (mIU/L)" 
                    type="number" step="0.1"
                    value={metrics.tshLevel || ''} 
                    onChange={e => onUpdateMetrics({...metrics, tshLevel: parseFloat(e.target.value)})}
                    placeholder="e.g., 2.5"
                />
                <Input 
                    label="Recent Weight Change (kg)" 
                    type="number"
                    value={metrics.weightChange || ''} 
                    onChange={e => onUpdateMetrics({...metrics, weightChange: parseFloat(e.target.value)})}
                    placeholder="+/- kg"
                />
                <Button onClick={onAnalyze} isLoading={loading} size="sm" className="w-full mt-2">Check Thyroid Status</Button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-700 mb-2">Thyroid Status</h4>
                {metrics.tshLevel ? (
                    <div className="text-center py-6">
                        <span className={`text-2xl font-bold px-4 py-2 rounded-lg ${
                            metrics.tshLevel > 4.5 ? 'bg-orange-100 text-orange-700' : 
                            metrics.tshLevel < 0.4 ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                        }`}>
                            {metrics.tshLevel > 4.5 ? 'Hypothyroid Risk' : metrics.tshLevel < 0.4 ? 'Hyperthyroid Risk' : 'Normal Range'}
                        </span>
                        <div className="mt-6 text-sm flex justify-center gap-4">
                            <span className="text-slate-500">Trend: {getTrendArrow('tshLevel', 'range_better')}</span>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-slate-400 py-8 italic">Enter TSH value</div>
                )}
            </div>
        </div>
        
        {history.some(h => h.tshLevel) && (
            <div className="h-48 w-full mt-4 flex flex-col">
                <p className="text-xs font-bold text-slate-400 uppercase mb-2 flex-shrink-0">TSH Level Trend</p>
                <div className="flex-1 min-h-0 w-full">
                    <ResponsiveContainer width="100%" height={192} minWidth={0} debounce={50}>
                        <LineChart data={history}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="timestamp" hide />
                            <YAxis domain={[0, 10]} />
                            <Tooltip />
                            <Line type="monotone" dataKey="tshLevel" stroke="#f59e0b" strokeWidth={2} dot={{r:4}} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        )}
    </div>
  );

  return (
    <Card className="mt-8 border-indigo-100 shadow-md">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <span className="text-2xl">🩺</span> Multi-Disease Health Monitor
                </h3>
                <p className="text-sm text-slate-500">Dedicated tracking for Kidney, Stroke & Thyroid risks</p>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl self-start">
                {(['CKD', 'STROKE', 'THYROID'] as TabType[]).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === tab ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        {tab === 'CKD' ? 'Kidney (CKD)' : tab === 'STROKE' ? 'Stroke Risk' : 'Thyroid'}
                    </button>
                ))}
            </div>
        </div>

        <div className="bg-white rounded-xl min-h-[300px]">
            <AnimatePresence mode='wait'>
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                >
                    {activeTab === 'CKD' && renderCKDTab()}
                    {activeTab === 'STROKE' && renderStrokeTab()}
                    {activeTab === 'THYROID' && renderThyroidTab()}
                </motion.div>
            </AnimatePresence>
        </div>

        {/* AI Insight Section */}
        {aiResult && (
            <div className="mt-6 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                <h4 className="text-xs font-bold text-indigo-800 uppercase mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    AI Health Insight
                </h4>
                <p className="text-sm text-indigo-900/80 leading-relaxed">
                    {activeTab === 'CKD' && "Your kidney health indicators suggest stability. " + (aiResult.ckdRiskLevel === 'High' ? "However, creatinine levels are elevated." : "")}
                    {activeTab === 'STROKE' && "Stroke risk factors analyzed. " + (aiResult.strokeRiskScore && aiResult.strokeRiskScore > 30 ? "Blood pressure management is recommended." : "Risk appears managed.")}
                    {activeTab === 'THYROID' && (aiResult.thyroidAnalysis || "Thyroid trend analysis requires more data points.")}
                </p>
                <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase">Confidence: {aiResult.confidenceLevel}</span>
                </div>
            </div>
        )}

        <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-[10px] text-center text-slate-400">
                ⚠️ <span className="font-bold">Disclaimer:</span> This system provides health monitoring and risk awareness only and does not replace professional medical diagnosis. Consult a specialist for concerns.
            </p>
        </div>
    </Card>
  );
};
