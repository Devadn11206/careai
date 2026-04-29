import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClientAction } from '@/types';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onAction?: (action: ClientAction) => void;
}

// Global augmentation for SpeechRecognition if not in types
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

    // Use separate refs for clarity
    const recognitionRef = useRef<any>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Cleanup on unmount
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            window.speechSynthesis.cancel();
        };
    }, []);

    useEffect(() => {
        // Auto-scroll chat
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [history]);

    const startRecording = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error('Speech recognition not supported.');
            setHistory(prev => [...prev, { role: 'assistant', content: 'Speech recognition is not supported in this browser. Please use Chrome or Edge.' }]);
            return;
        }

        try {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = true;

            recognition.onstart = () => {
                setIsRecording(true);
                setTextInput('');
                window.speechSynthesis.cancel(); // Stop any ongoing speech
            };

            recognition.onresult = (event: any) => {
                const currentTranscript = Array.from(event.results)
                    .map((result: any) => result[0].transcript)
                    .join('');
                setTextInput(currentTranscript);
            };

            recognition.onend = () => {
                setIsRecording(false);
                // Auto-submit if we have text. Small delay to ensure textInput is synchronized
                setTimeout(() => {
                    const textInputEl = document.getElementById('ai-text-input') as HTMLInputElement;
                    const currentText = textInputEl?.value;
                    if (currentText && currentText.trim().length > 0) {
                        const submitBtn = document.getElementById('ai-submit-btn') as HTMLButtonElement;
                        if (submitBtn) submitBtn.click();
                    }
                }, 300);
            };

            recognition.start();
            recognitionRef.current = recognition;
        } catch (error) {
            console.error('Error starting recognition:', error);
            setIsRecording(false);
        }
    };

    const stopRecording = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            setIsRecording(false);
        }
    };


    const toggleRecording = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    const handleTextSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!textInput.trim() || isProcessing) return;

        const text = textInput.trim();
        setTextInput('');
        await processInput({ text });
    };

    const processInput = async ({ audioBlob, text }: { audioBlob?: Blob; text?: string }) => {
        setIsProcessing(true);
        const trimmedText = text?.trim();

        // Optimistically add user text if it's a text command
        if (trimmedText) {
            setHistory(prev => [...prev, { role: 'user', content: trimmedText }]);
        }

        try {
            const token = localStorage.getItem('carexai_token');
            const formData = new FormData();

            if (audioBlob) {
                formData.append('audio', audioBlob, 'audio.webm');
            } else if (trimmedText) {
                formData.append('text', trimmedText);
            }

            // Include the current user message in the turn context so the model stays in sync.
            const recentHistory = history.slice(-10);
            const requestHistory = trimmedText
                ? [...recentHistory, { role: 'user', content: trimmedText }]
                : recentHistory;
            formData.append('history', JSON.stringify(requestHistory));

            const res = await fetch(`${API_BASE}/ai/command`, {
                method: 'POST',
                headers: {
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: formData
            });

            if (!res.ok) {
                let serverError = 'Failed to process AI command';
                try {
                    const err = await res.json();
                    if (err?.error) serverError = err.error;
                } catch {
                    // Keep default error when response body is not JSON.
                }
                throw new Error(serverError);
            }

            const data = await res.json().catch(() => null);
            if (!data) throw new Error('Invalid server response from AI assistant');

            setHistory(prev => {
                // If it was voice, we didn't add the user's message optimistically, so add it now
                let newHist = [...prev];
                if (audioBlob && data.transcription) {
                    newHist.push({ role: 'user', content: data.transcription });
                }
                newHist.push({ role: 'assistant', content: data.response });
                return newHist;
            });

            speakText(data.response, data.language);

            // Execute Client Actions (UI tasks like scrolling, opening modals)
            if (data.actions && data.actions.length > 0) {
                data.actions.forEach((action: ClientAction) => {
                    if (onAction) {
                        onAction(action);
                    } else {
                        // Global broadcast for actions if no local handler
                        window.dispatchEvent(new CustomEvent('carexai-action', { detail: action }));

                        // Legacy/Specific fallbacks for common actions
                        if (action.type === 'REFRESH_DATA') {
                            window.dispatchEvent(new CustomEvent('refresh-dashboard'));
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Processing error:', error);
            setHistory(prev => [...prev, { role: 'assistant', content: 'An error occurred connecting to the assistant.' }]);
        } finally {
            setIsProcessing(false);
        }
    };

    useEffect(() => {
        const loadVoices = () => {
            window.speechSynthesis.getVoices();
        };
        loadVoices();
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }

        return () => {
            if (typeof window !== 'undefined' && window.speechSynthesis) {
                window.speechSynthesis.onvoiceschanged = null;
            }
        };
    }, []);

    const speakText = (text: string, langHint?: string) => {
        if (!window.speechSynthesis) return;

        window.speechSynthesis.cancel();

        // Clean text before speaking (strip tags, JSON, and special markers)
        const cleanText = text.replace(/<.*?>/g, '').replace(/\{.*?\}/gs, '').replace(/```.*?```/gs, '').trim();
        if (!cleanText) return;

        const utterance = new SpeechSynthesisUtterance(cleanText);

        // Use hint if provided, otherwise detect from script
        let langCode = 'en-US';
        if (langHint === 'te' || /[\u0C00-\u0C7F]/.test(text)) langCode = 'te-IN';
        else if (langHint === 'hi' || /[\u0900-\u097F]/.test(text)) langCode = 'hi-IN';
        else if (langHint === 'ta' || /[\u0B80-\u0BFF]/.test(text)) langCode = 'ta-IN';
        else if (langHint === 'kn' || /[\u0C80-\u0CFF]/.test(text)) langCode = 'kn-IN';
        else if (langHint === 'ml' || /[\u0D00-\u0D7F]/.test(text)) langCode = 'ml-IN';

        utterance.lang = langCode;

        // Try to find the best voice for this language
        const voices = window.speechSynthesis.getVoices();

        // Prioritize: 1. Exact lang match, 2. Name contains language name, 3. Prefix match
        const languageNames: Record<string, string> = {
            'te-IN': 'Telugu',
            'ta-IN': 'Tamil',
            'hi-IN': 'Hindi',
            'kn-IN': 'Kannada',
            'ml-IN': 'Malayalam'
        };

        const targetLangName = languageNames[langCode];

        let selectedVoice = voices.find(v => v.lang === langCode);

        if (!selectedVoice && targetLangName) {
            selectedVoice = voices.find(v =>
                v.name.includes(targetLangName) ||
                v.lang.startsWith(langCode.split('-')[0])
            );
        }

        if (!selectedVoice) {
            selectedVoice = voices.find(v => v.lang.startsWith(langCode.split('-')[0]));
        }

        if (selectedVoice) {
            utterance.voice = selectedVoice;
        } else {
            console.warn(`No native voice found for ${langCode} (${targetLangName}). Falling back to default browser voice.`);
        }

        // Pitch and rate adjustments for better Indian language clarity
        utterance.pitch = 1.0;
        utterance.rate = 1.0;

        utterance.onstart = () => {
            console.log(`Speaking in ${langCode} using voice: ${utterance.voice?.name || 'Default'}`);
            setIsSpeaking(true);
        };
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = (e) => {
            console.error('TTS Error:', e);
            setIsSpeaking(false);
            // If it failed because of the voice/lang, try once more with default
            if (utterance.lang !== 'en-US') {
                console.log('Retrying with English fallback...');
                const fallback = new SpeechSynthesisUtterance(cleanText);
                fallback.lang = 'en-US';
                window.speechSynthesis.speak(fallback);
            }
        };

        window.speechSynthesis.speak(utterance);
    };

    return (
        <div className="fixed bottom-24 right-8 z-[100] flex flex-col items-end gap-3">
            <AnimatePresence>
                {isOpen && (
                        <motion.div
                        initial={{ opacity: 0, y: -20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.9 }}
                        className="glass-card border-[var(--accent-primary)]/30 w-[380px] relative overflow-hidden flex flex-col h-[550px] order-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
                    >
                        {/* Glowing Background Effect */}
                        {(isRecording || isProcessing || isSpeaking) && (
                            <motion.div
                                animate={{
                                    opacity: [0.1, 0.25, 0.1],
                                    scale: isSpeaking ? [1, 1.05, 1] : 1
                                }}
                                transition={{ repeat: Infinity, duration: isSpeaking ? 1 : 2 }}
                                className={`absolute inset-0 ${isRecording ? 'bg-rose-500/10' :
                                        isProcessing ? 'bg-amber-500/10' :
                                            'bg-[var(--accent-primary)]/10'
                                    } pointer-events-none`}
                            />
                        )}

                        {/* Header */}
                        <div className="flex justify-between items-center p-5 border-b border-[var(--glass-border)] relative z-10 bg-white/5 backdrop-blur-md">
                            <h3 className="text-white font-black text-sm flex items-center gap-2 font-orbitron tracking-widest uppercase">
                                <span className="premium-gradient-text">✨</span> Neural Copilot
                            </h3>
                            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 text-slate-400 hover:text-white transition-all">
                                ✕
                            </button>
                        </div>

                        {/* Chat History */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4 relative z-10 custom-scrollbar bg-black/20">
                            {history.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(0,212,255,0.2)]">
                                        <span className="text-4xl">🤖</span>
                                    </div>
                                    <p className="text-white font-bold text-sm tracking-tight mb-1">How can I assist you?</p>
                                    <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest">Awaiting Command Input</p>
                                </div>
                            ) : (
                                history.map((msg, idx) => (
                                    <motion.div 
                                        initial={{ opacity: 0, x: msg.role === 'user' ? 10 : -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        key={idx} 
                                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-[85%] p-4 rounded-2xl text-sm font-medium leading-relaxed ${msg.role === 'user'
                                                ? 'bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-indigo)] text-white rounded-tr-none shadow-[0_4px_15px_rgba(0,212,255,0.2)]'
                                                : 'glass-card border-[var(--glass-border)] text-slate-200 rounded-tl-none'
                                            }`}>
                                            {msg.content}
                                        </div>
                                    </motion.div>
                                ))
                            )}
                            {isProcessing && (
                                <div className="flex justify-start">
                                    <div className="glass-card border-[var(--glass-border)] p-4 rounded-2xl rounded-tl-none text-xs flex items-center gap-3">
                                        <div className="flex gap-1">
                                            <div className="w-1.5 h-1.5 bg-[var(--accent-primary)] rounded-full animate-bounce shadow-[0_0_8px_var(--accent-primary)]" />
                                            <div className="w-1.5 h-1.5 bg-[var(--accent-primary)] rounded-full animate-bounce shadow-[0_0_8px_var(--accent-primary)]" style={{ animationDelay: '0.2s' }} />
                                            <div className="w-1.5 h-1.5 bg-[var(--accent-primary)] rounded-full animate-bounce shadow-[0_0_8px_var(--accent-primary)]" style={{ animationDelay: '0.4s' }} />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Processing Neural Link</span>
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-5 bg-white/5 backdrop-blur-xl border-t border-[var(--glass-border)] relative z-10 flex gap-3 items-center">
                            <form id="ai-text-form" onSubmit={handleTextSubmit} className="flex-1 relative">
                                <input
                                    id="ai-text-input"
                                    type="text"
                                    value={textInput}
                                    onChange={(e) => setTextInput(e.target.value)}
                                    placeholder="Neural Command Input..."
                                    disabled={isRecording || isProcessing}
                                    className="input-cyber w-full py-3 pr-12 text-sm disabled:opacity-50"
                                />
                                <button
                                    id="ai-submit-btn"
                                    type="submit"
                                    disabled={!textInput.trim() || isProcessing || isRecording}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 premium-gradient-bg text-bg-deep rounded-xl flex items-center justify-center transition-all hover:scale-105 disabled:opacity-30 disabled:grayscale shadow-lg"
                                >
                                    <svg className="w-4 h-4 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 12h14M12 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </form>

                            <button
                                onClick={toggleRecording}
                                disabled={isProcessing}
                                className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center transition-all ${isProcessing ? 'bg-amber-500/20 cursor-not-allowed text-amber-500' :
                                        isRecording ? 'bg-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.5)]' :
                                            'glass-card hover:border-[var(--accent-primary)]/50 hover:text-[var(--accent-primary)] text-slate-400'
                                    }`}
                            >
                                {isRecording ? (
                                    <div className="w-4 h-4 bg-white rounded-sm animate-pulse" />
                                ) : (
                                    <svg className={`w-5 h-5 ${isRecording ? 'text-white' : 'inherit'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* External trigger is handled via AIOrb in AppLayout */}
        </div>
    );
};
