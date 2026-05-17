import React, { useState } from 'react';
import { HealthMetrics, AIAnalysisResult } from '@/types';
import { GlassCard as Card } from '@/components/carex/GlassCard';
import { NeonInput as Input } from '@/components/carex/NeonInput';
import { NeonButton as Button } from '@/components/carex/NeonButton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Stethoscope, 
    Activity, 
    TrendingUp, 
    TrendingDown, 
    Zap, 
    ShieldAlert, 
    Brain,
    Thermometer,
    Droplets,
    Heart,
    Radio
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
    if (history.length < 2) return <span className="text-muted-foreground/40">Stable</span>;
    const current = (metrics[key] as number) || 0;
    const previous = (history[history.length - 2][key] as number) || 0;
    
    if (Math.abs(current - previous) < 0.1) return <span className="text-muted-foreground/60 flex items-center gap-1">Stable</span>;

    if (type === 'lower_better') {
        if (current < previous) return <span className="text-emerald-400 font-black flex items-center gap-1"><TrendingDown size={14} /> Improving</span>;
        return <span className="text-rose-500 font-black flex items-center gap-1"><TrendingUp size={14} /> Worsening</span>;
    } else {
        if (current > previous) return <span className="text-amber-400 font-black flex items-center gap-1"><TrendingUp size={14} /> Increasing</span>;
        return <span className="text-primary font-black flex items-center gap-1"><TrendingDown size={14} /> Decreasing</span>;
    }
  };

  const renderCKDTab = () => (
    <div className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <Activity size={18} className="text-primary" />
                    <h4 className="font-black text-white uppercase tracking-tight text-sm">Kidney Health Vectors</h4>
                </div>
                <Input 
                    label="Serum Creatinine (mg/dL)" 
                    type="number" step="0.1"
                    value={metrics.serumCreatinine || ''} 
                    onChange={e => onUpdateMetrics({...metrics, serumCreatinine: parseFloat(e.target.value)})}
                    placeholder="e.g., 0.9"
                    tooltip="Waste product in blood. High levels may indicate kidney issues."
                />
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 group hover:border-primary/20 transition-all">
                    <input 
                        type="checkbox" 
                        id="diabetesHistory"
                        checked={metrics.diabetesHistory || false}
                        onChange={e => onUpdateMetrics({...metrics, diabetesHistory: e.target.checked})}
                        className="w-5 h-5 bg-white/5 border-white/20 rounded text-primary focus:ring-primary focus:ring-offset-0 transition-all"
                    />
                    <label htmlFor="diabetesHistory" className="text-sm text-slate-300 font-black uppercase tracking-widest cursor-pointer group-hover:text-white transition-colors">History of Diabetes?</label>
                </div>
                <Button onClick={onAnalyze} isLoading={loading} className="w-full h-14 rounded-2xl shadow-glow-primary">Execute Neural Analysis</Button>
            </div>
            
            <div className="bg-[#03050a] p-8 rounded-3xl border border-white/5 relative overflow-hidden flex flex-col justify-center">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[50px] -mr-16 -mt-16" />
                <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em] mb-6">CKD Risk Status</h4>
                {aiResult?.ckdRiskLevel ? (
                    <div className="text-center space-y-4 relative z-10">
                        <div className={cn(
                            "text-5xl font-black uppercase tracking-tighter",
                            aiResult.ckdRiskLevel === 'High' ? 'text-rose-500 shadow-glow-rose-500/20' : 
                            aiResult.ckdRiskLevel === 'Medium' ? 'text-amber-500 shadow-glow-amber-500/20' : 'text-emerald-400 shadow-glow-emerald-400/20'
                        )}>
                            {aiResult.ckdRiskLevel} Risk
                        </div>
                        <p className="text-[10px] text-muted-foreground/60 font-black uppercase tracking-widest">Multi-Factor AI Assessment</p>
                        <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest text-white mt-6 shadow-2xl">
                             {getTrendArrow('serumCreatinine', 'lower_better')}
                        </div>
                    </div>
                ) : (
                    <div className="text-center space-y-4 py-8">
                        <Brain size={48} className="mx-auto text-white/5 animate-pulse" />
                        <p className="text-[10px] font-black text-muted-foreground/20 uppercase tracking-[0.3em]">Initialize parameters for analysis</p>
                    </div>
                )}
            </div>
        </div>
        
        {history.some(h => h.serumCreatinine) && (
            <div className="h-64 w-full mt-8 rounded-3xl bg-white/5 border border-white/5 p-6">
                <div className="flex items-center justify-between mb-6">
                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">Neural Vector: Creatinine</p>
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                </div>
                <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={history}>
                            <defs>
                                <linearGradient id="colorCreatinine" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="timestamp" hide />
                            <YAxis domain={[0.5, 2.0]} stroke="rgba(255,255,255,0.2)" fontSize={10} tickFormatter={(v) => v.toFixed(1)} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#060912', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
                                itemStyle={{ color: 'var(--primary)' }}
                            />
                            <Area type="monotone" dataKey="serumCreatinine" stroke="var(--primary)" strokeWidth={2} fill="url(#colorCreatinine)" name="Creatinine" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        )}
    </div>
  );

  const renderStrokeTab = () => (
    <div className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <ShieldAlert size={18} className="text-secondary" />
                    <h4 className="font-black text-white uppercase tracking-tight text-sm">Stroke Risk Vectors</h4>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                        <label className="block text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">Systolic BP</label>
                        <div className="text-2xl font-black text-white tracking-tighter">{metrics.systolicBP} <span className="text-[10px] text-muted-foreground/40">mmHg</span></div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
                        <label className="block text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">Smoking Profile</label>
                        <div className={cn(
                            "text-sm font-black uppercase tracking-widest px-3 py-1 rounded-lg w-fit",
                            metrics.smoking ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        )}>
                            {metrics.smoking ? 'Active User' : 'Non-User'}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 group hover:border-secondary/20 transition-all">
                    <input 
                        type="checkbox" 
                        id="hasFatigue"
                        checked={metrics.hasFatigue || false}
                        onChange={e => onUpdateMetrics({...metrics, hasFatigue: e.target.checked})}
                        className="w-5 h-5 bg-white/5 border-white/20 rounded text-secondary focus:ring-secondary focus:ring-offset-0 transition-all"
                    />
                    <label htmlFor="hasFatigue" className="text-sm text-slate-300 font-black uppercase tracking-widest cursor-pointer group-hover:text-white transition-colors">Neural Fatigue / Numbness?</label>
                </div>
                <Button onClick={onAnalyze} isLoading={loading} variant="secondary" className="w-full h-14 rounded-2xl shadow-glow-secondary">Verify Neural Integrity</Button>
            </div>

            <div className="bg-[#03050a] p-8 rounded-3xl border border-white/5 relative overflow-hidden flex flex-col items-center justify-center">
                <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 blur-[50px] -mr-16 -mt-16" />
                <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em] mb-8 w-full text-left">Awareness Matrix</h4>
                {aiResult?.strokeRiskScore !== undefined ? (
                    <div className="text-center space-y-6 w-full">
                        <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle cx="64" cy="64" r="58" stroke="rgba(255,255,255,0.05)" strokeWidth="12" fill="none" />
                                <circle 
                                    cx="64" cy="64" r="58" 
                                    stroke={aiResult.strokeRiskScore > 50 ? "#f43f5e" : "#00f2ff"} 
                                    strokeWidth="12" fill="none" 
                                    strokeDasharray={364} 
                                    strokeDashoffset={364 - (364 * aiResult.strokeRiskScore) / 100}
                                    strokeLinecap="round"
                                    className="transition-all duration-1000 ease-out shadow-glow-primary"
                                />
                            </svg>
                            <span className="absolute text-3xl font-black text-white tracking-tighter">{aiResult.strokeRiskScore}%</span>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground/60 font-black uppercase tracking-widest">Global Predictive Risk Index</p>
                            {aiResult.strokeRiskScore > 50 && (
                                <div className="flex items-center justify-center gap-2 text-rose-500 font-black text-[10px] uppercase tracking-widest mt-2">
                                    <ShieldAlert size={14} /> ⚠️ Critical Intervention Required
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="text-center space-y-4 py-8">
                        <Radio size={48} className="mx-auto text-white/5 animate-pulse" />
                        <p className="text-[10px] font-black text-muted-foreground/20 uppercase tracking-[0.3em]">Listening for biometric vectors</p>
                    </div>
                )}
            </div>
        </div>
    </div>
  );

  const renderThyroidTab = () => (
    <div className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <Thermometer size={18} className="text-amber-500" />
                    <h4 className="font-black text-white uppercase tracking-tight text-sm">Thyroid Biometric Inputs</h4>
                </div>
                <Input 
                    label="TSH Level (mIU/L)" 
                    type="number" step="0.1"
                    value={metrics.tshLevel || ''} 
                    onChange={e => onUpdateMetrics({...metrics, tshLevel: parseFloat(e.target.value)})}
                    placeholder="e.g., 2.5"
                />
                <Input 
                    label="Weight Change Vector (kg)" 
                    type="number"
                    value={metrics.weightChange || ''} 
                    onChange={e => onUpdateMetrics({...metrics, weightChange: parseFloat(e.target.value)})}
                    placeholder="+/- kg"
                />
                <Button onClick={onAnalyze} isLoading={loading} className="w-full h-14 rounded-2xl bg-amber-600 hover:bg-amber-500 text-background border-none shadow-[0_0_20px_rgba(245,158,11,0.4)]">
                    Synchronize Thyroid Hub
                </Button>
            </div>

            <div className="bg-[#03050a] p-8 rounded-3xl border border-white/5 relative overflow-hidden flex flex-col justify-center">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-[50px] -mr-16 -mt-16" />
                <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em] mb-8">Endocrine Analysis</h4>
                {metrics.tshLevel ? (
                    <div className="text-center space-y-6">
                        <div className={cn(
                            "text-3xl font-black uppercase tracking-tighter px-6 py-4 rounded-[1.8rem] border inline-block mx-auto",
                            metrics.tshLevel > 4.5 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-glow-amber-500/10' : 
                            metrics.tshLevel < 0.4 ? 'bg-primary/10 text-primary border-primary/20 shadow-glow-primary/10' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        )}>
                            {metrics.tshLevel > 4.5 ? 'Hypothyroid Risk' : metrics.tshLevel < 0.4 ? 'Hyperthyroid Risk' : 'Optimal Metabolic State'}
                        </div>
                        <div className="flex justify-center gap-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                            <span className="flex items-center gap-2">Vector Trend: {getTrendArrow('tshLevel', 'range_better')}</span>
                        </div>
                    </div>
                ) : (
                    <div className="text-center space-y-4 py-8">
                        <Zap size={48} className="mx-auto text-white/5 animate-pulse" />
                        <p className="text-[10px] font-black text-muted-foreground/20 uppercase tracking-[0.3em]">TSH data required for profile</p>
                    </div>
                )}
            </div>
        </div>
        
        {history.some(h => h.tshLevel) && (
            <div className="h-64 w-full mt-8 rounded-3xl bg-white/5 border border-white/5 p-6">
                <div className="flex items-center justify-between mb-6">
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em]">TSH Kinetic Stream</p>
                    <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                </div>
                <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={history}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="timestamp" hide />
                            <YAxis domain={[0, 10]} stroke="rgba(255,255,255,0.2)" fontSize={10} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#060912', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
                                itemStyle={{ color: '#f59e0b' }}
                            />
                            <Line type="monotone" dataKey="tshLevel" stroke="#f59e0b" strokeWidth={3} dot={{r:6, fill:'#03050a', strokeWidth:2, stroke:'#f59e0b'}} activeDot={{r:8}} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        )}
    </div>
  );

  return (
    <Card className="mt-12 border-white/5 p-10 bg-background/40 backdrop-blur-3xl shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-12 gap-8 relative z-10">
            <div className="space-y-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                        <Stethoscope size={24} />
                    </div>
                    <h3 className="text-3xl font-black text-white uppercase tracking-tighter font-display">
                        Neural <span className="text-primary italic">Bio-Monitor</span>
                    </h3>
                </div>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em]">Dedicated Multi-Vector Risk Tracking (CKD, Stroke, Endocrine)</p>
            </div>
            <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/10 backdrop-blur-xl">
                {(['CKD', 'STROKE', 'THYROID'] as TabType[]).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                            "px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all duration-300",
                            activeTab === tab 
                                ? 'bg-primary text-background shadow-glow-primary' 
                                : 'text-muted-foreground hover:text-white hover:bg-white/5'
                        )}
                    >
                        {tab === 'CKD' ? 'Kidney (CKD)' : tab === 'STROKE' ? 'Stroke Link' : 'Endocrine Hub'}
                    </button>
                ))}
            </div>
        </div>

        <div className="relative min-h-[400px] z-10">
            <AnimatePresence mode='wait'>
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, scale: 0.98, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, scale: 1.02, filter: 'blur(10px)' }}
                    transition={{ duration: 0.4 }}
                >
                    {activeTab === 'CKD' && renderCKDTab()}
                    {activeTab === 'STROKE' && renderStrokeTab()}
                    {activeTab === 'THYROID' && renderThyroidTab()}
                </motion.div>
            </AnimatePresence>
        </div>

        {/* Neural Analysis Insight Stream */}
        {aiResult && (
            <div className="mt-12 p-8 bg-primary/5 rounded-[2.5rem] border border-primary/10 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 blur-[60px] group-hover:bg-primary/10 transition-all" />
                <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.5em] mb-4 flex items-center gap-3">
                    <Zap size={16} className="animate-pulse" />
                    Nexus Neural Intelligence Output
                </h4>
                <p className="text-lg text-slate-200 font-medium leading-relaxed relative z-10">
                    {activeTab === 'CKD' && "Autonomous kidney health vectors indicate stability across all renal markers. " + (aiResult.ckdRiskLevel === 'High' ? "Elevated creatinine detected—immediate hydration protocol and specialist node consultation recommended." : "Continue optimal hydration.")}
                    {activeTab === 'STROKE' && "Cerebrovascular risk matrix analysis complete. " + (aiResult.strokeRiskScore && aiResult.strokeRiskScore > 30 ? "Hypertensive flags detected. Suggesting real-time BP optimization and sodium reduction." : "Systemic vascular integrity remains within optimal parameters.")}
                    {activeTab === 'THYROID' && (aiResult.thyroidAnalysis || "Thyroid kinetic data synchronized. Metabolic stability is currently processing.")}
                </p>
                <div className="mt-6 flex items-center gap-4">
                    <div className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                        Neural Confidence: <span className="text-primary">{aiResult.confidenceLevel}</span>
                    </div>
                    <div className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                        Sync Integrity: <span className="text-secondary">99.9%</span>
                    </div>
                </div>
            </div>
        )}

        <div className="mt-8 pt-8 border-t border-white/5 relative z-10">
            <p className="text-[9px] font-black text-center text-muted-foreground/30 uppercase tracking-[0.3em] leading-relaxed">
                ⚠️ CLASSIFIED DATA OVERVIEW: THIS NEURAL ENGINE PROVIDES DECISION SUPPORT VECTORS ONLY. PROPRIETARY CAREXAI PROTOCOLS IN EFFECT.
            </p>
        </div>
    </Card>
  );
};
