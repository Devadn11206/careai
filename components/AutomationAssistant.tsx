import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClientAction } from '../types';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface Props {
    onAction?: (action: ClientAction) => void;
}

// Global augmentation for SpeechRecognition if not in types
declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

export const AutomationAssistant: React.FC<Props> = ({ onAction }) => {
    const [isOpen, setIsOpen] = useState(false);
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
        
        // Optimistically add user text if it's a text command
        if (text) {
            setHistory(prev => [...prev, { role: 'user', content: text }]);
        }

        try {
            const token = localStorage.getItem('carexai_token');
            const formData = new FormData();
            
            if (audioBlob) {
                formData.append('audio', audioBlob, 'audio.webm');
            } else if (text) {
                formData.append('text', text);
            }
            
            formData.append('history', JSON.stringify(history.slice(-10))); // Send last 10 turns

            const res = await fetch('http://localhost:4000/ai/command', {
                method: 'POST',
                headers: {
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: formData
            });

            if (!res.ok) throw new Error('Failed to process AI command');

            const data = await res.json();
            
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
        <div className="fixed top-4 right-4 z-[100] flex flex-col items-end gap-3">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.9 }}
                        className="bg-slate-900/95 backdrop-blur-xl border border-blue-500/30 shadow-2xl shadow-blue-500/20 rounded-3xl w-[350px] relative overflow-hidden flex flex-col h-[500px] order-2"
                    >
                        {/* Glowing Background Effect */}
                        {(isRecording || isProcessing || isSpeaking) && (
                            <motion.div 
                                animate={{ 
                                    opacity: [0.1, 0.2, 0.1],
                                    scale: isSpeaking ? [1, 1.1, 1] : 1
                                }}
                                transition={{ repeat: Infinity, duration: isSpeaking ? 1.5 : 2 }}
                                className={`absolute inset-0 rounded-3xl ${
                                    isRecording ? 'bg-red-500/20' : 
                                    isProcessing ? 'bg-amber-500/20' : 
                                    'bg-blue-500/20'
                                } pointer-events-none`}
                            />
                        )}

                        {/* Header */}
                        <div className="flex justify-between items-center p-4 border-b border-slate-800 relative z-10 bg-slate-900/50">
                            <h3 className="text-white font-bold text-md flex items-center gap-2">
                                <span className="text-blue-400">✨</span> AI Copilot
                            </h3>
                            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                                ✕
                            </button>
                        </div>

                        {/* Chat History */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 relative z-10 custom-scrollbar">
                            {history.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                                    <span className="text-4xl mb-2">🤖</span>
                                    <p className="text-slate-300 text-sm">How can I assist you today?</p>
                                    <p className="text-slate-500 text-xs mt-1">Try saying "Book an appointment"</p>
                                </div>
                            ) : (
                                history.map((msg, idx) => (
                                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                                            msg.role === 'user' 
                                                ? 'bg-blue-600 text-white rounded-br-sm' 
                                                : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-sm'
                                        }`}>
                                            {msg.content}
                                        </div>
                                    </div>
                                ))
                            )}
                            {isProcessing && (
                                <div className="flex justify-start">
                                    <div className="bg-slate-800 text-slate-400 border border-slate-700 p-3 rounded-2xl rounded-bl-sm text-xs flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
                                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-slate-900/80 border-t border-slate-800 relative z-10 flex gap-2 items-center">
                            <form id="ai-text-form" onSubmit={handleTextSubmit} className="flex-1 relative">
                                <input
                                    id="ai-text-input"
                                    type="text"
                                    value={textInput}
                                    onChange={(e) => setTextInput(e.target.value)}
                                    placeholder="Type a command..."
                                    disabled={isRecording || isProcessing}
                                    className="w-full bg-slate-800 text-white text-sm rounded-full py-2.5 pl-4 pr-10 border border-slate-700 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
                                />
                                <button 
                                    id="ai-submit-btn"
                                    type="submit"
                                    disabled={!textInput.trim() || isProcessing || isRecording}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-700 text-white rounded-full flex items-center justify-center transition-colors"
                                >
                                    <svg className="w-3.5 h-3.5 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </form>
                            
                            <button
                                onClick={toggleRecording}
                                disabled={isProcessing}
                                className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center transition-all ${
                                    isProcessing ? 'bg-amber-500/50 cursor-not-allowed' :
                                    isRecording ? 'bg-red-500 hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.5)]' :
                                    'bg-slate-800 border border-slate-700 hover:border-blue-500 hover:text-blue-400'
                                }`}
                            >
                                {isRecording ? (
                                    <div className="w-3 h-3 bg-white rounded-sm" />
                                ) : (
                                    <svg className={`w-4 h-4 ${isRecording ? 'text-white' : 'text-slate-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {!isOpen && (
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsOpen(true)}
                    title="AI Copilot"
                    className="order-1 w-12 h-12 bg-slate-900 border border-blue-500/50 rounded-2xl flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:shadow-[0_0_25px_rgba(59,130,246,0.5)] transition-all group relative"
                >
                    <div className="absolute inset-0 bg-blue-500/20 rounded-2xl blur-md group-hover:bg-blue-500/30 transition-colors" />
                    <span className="text-xl relative z-10 group-hover:scale-110 transition-transform">✨</span>
                </motion.button>
            )}
        </div>
    );
};
