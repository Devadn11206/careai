import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClientAction, Hospital, BackendDoctor } from '@/types';
import { 
    X, Mic, Send, Sparkles, Activity, Brain, Navigation, Calendar, Heart, 
    AlertCircle, Stethoscope, ChevronRight, MapPin, Clock, Zap, FileText, 
    Pill, Microscope, Video, BarChart2, CheckCircle2, Loader2, Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NeonButton } from '../carex/NeonButton';
import { GlassCard } from '../carex/GlassCard';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    hidden?: boolean;
    actions?: ClientAction[];
    reasoning?: string;
    isTool?: boolean;
    status?: 'EXECUTING' | 'SUCCESS' | 'FAILED';
}

const sanitizeContent = (text: string) => {
    if (!text) return "";
    return text
        .replace(/\[Tool Call\][\s\S]*?(?=\[|$)/gi, '')
        .replace(/\[PLAN\][\s\S]*?(?=\[|$)/gi, '')
        .replace(/\[REASONING\][\s\S]*?(?=\[|$)/gi, '')
        .replace(/\[THOUGHT\][\s\S]*?(?=\[|$)/gi, '')
        .replace(/\[CHAIN OF THOUGHT\][\s\S]*?(?=\[|$)/gi, '')
        .replace(/<function=[\s\S]*?<\/function>/gi, '')
        .replace(/function=\w+=[\s\S]*?$/gi, '')
        .replace(/\[RETRY TOOL CALL\]/gi, '')
        .replace(/\[ACTION\][\s\S]*?(?=\[|$)/gi, '')
        .replace(/infrastructure/gi, '')
        .replace(/retry/gi, '')
        .replace(/contact_clinic\(.*?\)/gi, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};

const isTechnicalArtifact = (text: string) => {
    const patterns = [
        /\[Tool Call\]/i, /\[PLAN\]/i, /\[REASONING\]/i, /<function=/i, 
        /infrastructure/i, /retry/i, /tool_call/i, /contact_clinic\(/i,
        /\{.*?\}/s, // JSON-like structures
        /orchestration/i
    ];
    return patterns.some(p => p.test(text));
};

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onAction?: (action: ClientAction) => void;
}

declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

export const AutomationAssistant: React.FC<Props> = ({ isOpen, onClose, onAction }) => {
    const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:4000';
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [history, setHistory] = useState<Message[]>([]);
    const [textInput, setTextInput] = useState('');
    const [thinkingState, setThinkingState] = useState<{agent: string, step: string} | null>(null);

    const recognitionRef = useRef<any>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [history, isProcessing]);

    const startRecording = () => {
        const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        try {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.onstart = () => {
                setIsRecording(true);
                setTextInput('');
                window.speechSynthesis.cancel();
            };
            recognition.onresult = (event: any) => {
                const currentTranscript = Array.from(event.results)
                    .map((result: any) => (result as any)[0].transcript)
                    .join('');
                setTextInput(currentTranscript);
            };
            recognition.onend = () => {
                setIsRecording(false);
                if (textInput.trim()) handleTextSubmit(new Event('submit') as any);
            };
            recognition.start();
            recognitionRef.current = recognition;
        } catch (error) {
            setIsRecording(false);
        }
    };

    const handleTextSubmit = async (e: React.FormEvent) => {
        e?.preventDefault();
        if (!textInput.trim() || isProcessing) return;
        const text = textInput.trim();
        setTextInput('');
        setHistory(prev => [...prev, { role: 'user', content: text }]);
        await processInput(text);
    };

    const processInput = async (text: string) => {
        setIsProcessing(true);
        setThinkingState({ agent: 'Nexus Orchestrator', step: 'PLANNING_WORKFLOW' });
        
        try {
            const token = localStorage.getItem('carexai_token');
            const formData = new FormData();
            formData.append('text', text);
            formData.append('history', JSON.stringify(history.slice(-6)));

            const res = await fetch(`${API_BASE}/ai/command`, {
                method: 'POST',
                headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                body: formData
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Clinical core link error');

            // Detect tool execution from response to update UI state
            if (data.reasoning?.includes('[TOOL]')) {
                const toolName = data.reasoning.split('[TOOL]:')[1]?.split('\n')[0]?.trim();
                setThinkingState({ agent: 'Workflow Engine', step: `EXECUTING_${toolName?.toUpperCase() || 'TASK'}` });
                await new Promise(r => setTimeout(r, 800)); // Visual spacing for execution
            }

            const rawResponse = data.response || '';
            const cleanResponse = sanitizeContent(rawResponse);
            
            setHistory(prev => [...prev, { 
                role: 'assistant', 
                content: cleanResponse || (data.actions && data.actions.length > 0 ? "I've updated your clinical view with the requested data." : "I have processed your request."),
                actions: data.actions,
                status: 'SUCCESS'
            }]);

            if (data.response) speakText(data.response);

            if (data.actions) {
                data.actions.forEach((action: ClientAction) => {
                    if (onAction) onAction(action);
                    window.dispatchEvent(new CustomEvent('carexai-action', { detail: action }));
                    // Trigger UI Sync feedback
                    setThinkingState({ agent: 'Neural Link', step: 'SYNCING_DASHBOARDS' });
                });
            }
        } catch (error: any) {
            setHistory(prev => [...prev, { 
                role: 'assistant', 
                content: error.message || 'Neural Link Failure. Retrying...',
                status: 'FAILED'
            }]);
        } finally {
            setIsProcessing(false);
            setThinkingState(null);
        }
    };

    const speakText = (text: string) => {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text.replace(/<.*?>/g, '').trim());
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
    };

    const renderActionCard = (action: ClientAction) => {
        const baseClass = "p-4 glass rounded-2xl border transition-all cursor-pointer group mb-3 shadow-lg";
        
        switch (action.type) {
            case 'SHOW_HOSPITALS':
                return (
                    <div className="space-y-3 mt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Navigation size={12} className="text-primary" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">Emergency Facilities Detected</p>
                        </div>
                        {action.payload?.map((h: any, i: number) => (
                            <motion.div key={h.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                                className={cn(baseClass, "border-primary/20 hover:border-primary/50")}>
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-glow-primary/20">
                                        <MapPin size={18} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-bold truncate">{h.name}</h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={cn("h-1.5 w-1.5 rounded-full", h.emergency ? "bg-success" : "bg-warning")} />
                                            <p className="text-[10px] text-muted-foreground uppercase font-mono">{h.emergency ? 'Trauma Ready' : 'General Care'} · {h.address}</p>
                                        </div>
                                    </div>
                                    <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                                </div>
                            </motion.div>
                        ))}
                    </div>
                );
            case 'SHOW_DOCTORS':
                return (
                    <div className="space-y-3 mt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Stethoscope size={12} className="text-secondary" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-secondary/60">Verified Clinician Nodes</p>
                        </div>
                        {action.payload?.map((d: any, i: number) => (
                            <motion.div key={d.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                                className={cn(baseClass, "border-secondary/20 hover:border-secondary/50")}>
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary group-hover:bg-secondary group-hover:text-white transition-all">
                                        <Activity size={18} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-bold truncate">{d.name}</h4>
                                        <p className="text-[10px] text-muted-foreground uppercase font-mono mt-0.5">{d.spec} · Consultation: ₹{d.fee}</p>
                                    </div>
                                    <ChevronRight size={16} className="text-muted-foreground group-hover:text-secondary" />
                                </div>
                            </motion.div>
                        ))}
                    </div>
                );
            case 'SHOW_PHARMACY':
                return (
                    <div className="space-y-3 mt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Pill size={12} className="text-warning" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-warning/60">Pharmacy Logistics Sync</p>
                        </div>
                        {action.payload?.map((p: any, i: number) => (
                            <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                                className={cn(baseClass, "border-warning/20 hover:border-warning/50")}>
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-xl bg-warning/10 flex items-center justify-center text-warning group-hover:bg-warning group-hover:text-white transition-all">
                                        <Zap size={18} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-bold truncate">{p.name}</h4>
                                        <p className="text-[10px] text-muted-foreground uppercase font-mono mt-0.5">{p.address}</p>
                                    </div>
                                    <div className="text-[10px] text-success font-bold font-mono">STOCK: OK</div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                );
            case 'SHOW_LAB_TESTS':
                return (
                    <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        className="mt-4 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 space-y-3 shadow-glow-indigo/10">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Microscope size={14} className="text-indigo-400" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Diagnostic Hub Sync</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-success/20 text-success text-[8px] font-black uppercase">Confirmed</span>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-indigo-100">{action.payload.test} Scheduled</p>
                            <p className="text-[10px] text-muted-foreground mt-1 font-mono">ID: {action.payload.id || 'LAB-NODE-772'}</p>
                        </div>
                        <div className="flex gap-2">
                             <div className="flex-1 h-1.5 rounded-full bg-indigo-500/20 overflow-hidden"><div className="h-full bg-indigo-500 w-[60%] animate-pulse" /></div>
                        </div>
                    </motion.div>
                );
            case 'SHOW_MEDICAL_RECORDS':
                return (
                    <div className="space-y-3 mt-4">
                         <div className="flex items-center gap-2 mb-1">
                            <FileText size={12} className="text-primary" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">Digital Health Vault</p>
                        </div>
                        {action.payload?.map((r: any, i: number) => (
                             <motion.div key={r.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                                className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:border-primary/30 transition-all group cursor-pointer">
                                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                                    <FileText size={14} />
                                </div>
                                <div className="flex-1">
                                    <h5 className="text-[11px] font-bold">{r.title}</h5>
                                    <p className="text-[9px] text-muted-foreground font-mono">{new Date(r.date).toLocaleDateString()}</p>
                                </div>
                                <Search size={14} className="text-muted-foreground group-hover:text-primary" />
                             </motion.div>
                        ))}
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none p-4 md:p-8">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
                        className="absolute inset-0 bg-background/60 backdrop-blur-sm pointer-events-auto" />

                    <motion.div initial={{ opacity: 0, y: 40, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 40, scale: 0.95 }}
                        className="relative w-full max-w-[500px] h-[750px] glass-card border-primary/20 flex flex-col overflow-hidden pointer-events-auto shadow-3xl bg-[#060912]/90">
                        
                        {/* Autonomous Neural Header */}
                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-b from-white/5 to-transparent">
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <div className="h-12 w-12 rounded-2xl bg-gradient-aurora flex items-center justify-center shadow-glow">
                                        <Brain className="h-6 w-6 text-white" />
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-success rounded-full border-2 border-[#060912] shadow-glow-success" />
                                </div>
                                <div>
                                    <h3 className="font-display font-bold text-lg tracking-tight">CareXAI Nexus</h3>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="flex h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-success/80">Autonomous Engine Online</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex flex-col items-end mr-3">
                                    <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Core Latency</span>
                                    <span className="text-[10px] font-mono text-success">14ms</span>
                                </div>
                                <button onClick={onClose} className="h-10 w-10 rounded-xl hover:bg-white/5 flex items-center justify-center transition-colors text-muted-foreground hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Live Telemetry Bar */}
                        <div className="px-6 py-2.5 bg-primary/5 border-b border-primary/10 flex items-center justify-around">
                            <div className="flex items-center gap-2"><Heart size={12} className="text-destructive animate-pulse" /><span className="text-[10px] font-mono text-muted-foreground">72 BPM</span></div>
                            <div className="flex items-center gap-2"><Activity size={12} className="text-primary" /><span className="text-[10px] font-mono text-muted-foreground">120/80</span></div>
                            <div className="flex items-center gap-2"><Zap size={12} className="text-warning" /><span className="text-[10px] font-mono text-muted-foreground">98.6°F</span></div>
                            <div className="h-4 w-px bg-white/5" />
                            <div className="flex items-center gap-2"><BarChart2 size={12} className="text-success" /><span className="text-[10px] font-mono text-success">88%</span></div>
                        </div>

                        {/* Dynamic Workflow Stream */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar pr-4">
                            {history.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                                    <motion.div animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }} transition={{ repeat: Infinity, duration: 4 }}
                                        className="h-24 w-24 rounded-[2rem] bg-primary/10 border border-primary/20 flex items-center justify-center mb-8 shadow-glow-primary/10">
                                        <Sparkles size={40} className="text-primary/60" />
                                    </motion.div>
                                    <h4 className="text-xl font-display font-bold mb-3 tracking-tight">Initiate Autonomous Task</h4>
                                    <p className="text-sm text-muted-foreground max-w-[300px] mb-8 leading-relaxed">
                                        The Nexus Orchestrator is ready to execute clinical workflows, book procedures, and analyze telemetry in real-time.
                                    </p>
                                    <div className="grid grid-cols-1 gap-3 w-full">
                                        {[
                                            "Analyze my chronic care metrics",
                                            "Book cardiologist for tomorrow 5pm",
                                            "Find 24/7 pharmacies with stock",
                                            "Initiate emergency hospital routing"
                                        ].map((tip, i) => (
                                            <button key={i} onClick={() => { setTextInput(tip); handleTextSubmit(new Event('submit') as any); }}
                                                className="group p-4 rounded-2xl border border-white/5 bg-white/5 text-xs text-left hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center text-primary opacity-0 group-hover:opacity-100 transition-all"><Zap size={12} /></div>
                                                    <span>{tip}</span>
                                                </div>
                                                <ChevronRight size={14} className="text-muted-foreground opacity-30 group-hover:opacity-100 transition-all" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                history.map((msg, i) => {
                                    if (msg.role === 'assistant' && isTechnicalArtifact(msg.content)) return null;
                                    return (
                                    <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                        className={cn("flex flex-col gap-2", msg.role === 'user' ? "items-end" : "items-start")}>
                                        
                                        <div className={cn(
                                            "max-w-[85%] p-5 rounded-2xl text-sm leading-relaxed shadow-2xl relative group",
                                            msg.role === 'user' 
                                                ? "bg-primary text-primary-foreground rounded-tr-none font-medium" 
                                                : "glass border border-white/10 text-foreground rounded-tl-none"
                                        )}>
                                            {sanitizeContent(msg.content)}
                                            {msg.status === 'SUCCESS' && (
                                                <div className="absolute -bottom-2 -right-2 h-5 w-5 bg-success rounded-full flex items-center justify-center border-2 border-[#060912] shadow-glow-success">
                                                    <CheckCircle2 size={12} className="text-white" />
                                                </div>
                                            )}
                                            {msg.actions && msg.actions.map((action, idx) => (
                                                <div key={idx}>{renderActionCard(action)}</div>
                                            ))}
                                        </div>
                                        
                                        <div className="flex items-center gap-2 px-2">
                                            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">
                                                {msg.role === 'assistant' ? 'Clinical Core' : 'Authorized User'} · {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            {msg.status === 'EXECUTING' && <Loader2 size={10} className="text-primary animate-spin" />}
                                        </div>
                                    </motion.div>
                                    );
                                })
                            )}
                            
                            {isProcessing && (
                                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                                    className="flex flex-col gap-3 p-5 glass border-primary/30 rounded-2xl rounded-tl-none w-[320px] shadow-glow-primary/5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="flex gap-1">
                                                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
                                                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.2s]" />
                                                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.4s]" />
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-primary">{thinkingState?.agent || 'Nexus Engine'}</span>
                                        </div>
                                        <div className="h-4 w-4 rounded-full border border-primary/20 flex items-center justify-center"><Loader2 size={10} className="text-primary animate-spin" /></div>
                                    </div>
                                    <div className="p-3 bg-primary/5 rounded-xl border border-primary/10">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[9px] text-muted-foreground font-mono uppercase">Current Step</span>
                                            <span className="text-[9px] text-primary font-bold font-mono">ACTIVE</span>
                                        </div>
                                        <h5 className="text-[10px] font-black text-primary tracking-widest uppercase truncate">{thinkingState?.step || 'ORCHESTRATING_WORKFLOW'}</h5>
                                        <div className="mt-3 h-1 w-full bg-primary/10 rounded-full overflow-hidden">
                                            <motion.div initial={{ x: '-100%' }} animate={{ x: '100%' }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                                                className="h-full w-1/3 bg-gradient-to-r from-transparent via-primary to-transparent" />
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Secure Neural Input Hub */}
                        <div className="p-6 bg-[#060912]/80 backdrop-blur-2xl border-t border-white/5 shadow-3xl">
                            <form onSubmit={handleTextSubmit} className="flex items-center gap-4">
                                <div className="relative flex-1 group">
                                    <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/50 to-secondary/50 rounded-2xl blur opacity-0 group-focus-within:opacity-30 transition-all duration-500" />
                                    <input type="text" value={textInput} onChange={(e) => setTextInput(e.target.value)}
                                        placeholder="Execute clinical command or query..."
                                        className="relative w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 pr-14 text-sm focus:outline-none focus:border-primary/40 transition-all placeholder:text-muted-foreground/30 font-medium"
                                        disabled={isProcessing} />
                                    <button type="submit" disabled={!textInput.trim() || isProcessing}
                                        className="absolute right-2 top-2 h-10 w-10 rounded-xl bg-primary text-white flex items-center justify-center disabled:opacity-30 transition-all hover:scale-105 active:scale-95 shadow-glow-primary">
                                        <Send size={18} />
                                    </button>
                                </div>
                                <button type="button" onClick={isRecording ? () => recognitionRef.current?.stop() : startRecording}
                                    className={cn("h-14 w-14 rounded-2xl flex items-center justify-center transition-all duration-300 relative group",
                                        isRecording ? "bg-destructive text-white shadow-glow-destructive scale-110" : "glass border-white/10 text-muted-foreground hover:text-primary hover:border-primary/40")}>
                                    {isRecording ? (
                                        <div className="h-6 w-6 bg-white rounded-full animate-pulse" />
                                    ) : (
                                        <>
                                            <Mic size={24} className="relative z-10" />
                                            <div className="absolute inset-0 rounded-2xl bg-primary/10 scale-0 group-hover:scale-100 transition-transform duration-300" />
                                        </>
                                    )}
                                </button>
                            </form>
                            <div className="flex items-center justify-center gap-6 mt-5 opacity-40">
                                <div className="flex items-center gap-2"><div className="h-1 w-1 rounded-full bg-success" /><span className="text-[8px] font-black uppercase tracking-widest">Secure Link</span></div>
                                <div className="flex items-center gap-2"><div className="h-1 w-1 rounded-full bg-primary" /><span className="text-[8px] font-black uppercase tracking-widest">TLS 1.3</span></div>
                                <div className="flex items-center gap-2"><div className="h-1 w-1 rounded-full bg-secondary" /><span className="text-[8px] font-black uppercase tracking-widest">HIPAA Compliant</span></div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
