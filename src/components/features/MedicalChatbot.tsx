import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Chat } from '@google/genai';
import { NeonButton as Button } from '@/components/carex/NeonButton';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    MessageSquare, 
    X, 
    Send, 
    Sparkles, 
    Brain, 
    Bot, 
    User,
    ShieldAlert,
    Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'model';
  text: string;
}

export const MedicalChatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Greetings. I am the CareXAI Neural Assistant. I can analyze medical data, explain complex clinical reports, and provide health optimizations. How shall we proceed today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatSessionRef = useRef<Chat | null>(null);

  useEffect(() => {
    try {
      const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || '';
      if (apiKey) {
        const ai = new GoogleGenAI({ apiKey });
        chatSessionRef.current = ai.chats.create({
          model: 'gemini-3-flash-preview',
          config: {
            systemInstruction: `You are CareXAI's advanced medical support neural engine. 
            Your role is to assist patients by answering health-related questions, explaining medical reports in high-fidelity clinical terms (yet understandable), and provide lifestyle optimizations based on telemetry.
            
            OPERATIONAL PROTOCOLS:
            1. Maintain a professional, highly intelligent, and empathetic clinical persona.
            2. Use structured formatting for clinical clarity.
            3. MANDATORY: Always conclude medical advice with a clinical disclaimer: "This output is for decision support only and does not constitute a formal diagnosis."
            4. Keep responses concise and focused.`,
          },
        });
      }
    } catch (e) {
      console.error("Neural Link Init Failed", e);
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      if (!chatSessionRef.current) {
        setMessages(prev => [
          ...prev,
          {
            role: 'model',
            text: "Neural Link Offline. Protocol execution suspended. Please verify your system credentials."
          },
        ]);
        return;
      }

      const response = await chatSessionRef.current.sendMessage({ message: userMsg });
      const text = response.text || "Transmission error. Unable to process clinical request.";

      setMessages(prev => [...prev, { role: 'model', text }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: "Neural Link Latency Error. Database connection unstable. Please retry." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 50, scale: 0.9, filter: 'blur(10px)' }}
            className="fixed bottom-24 right-6 w-[420px] max-w-[95vw] bg-[#060912]/95 rounded-[2.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.8)] border border-white/10 flex flex-col z-[200] overflow-hidden backdrop-blur-3xl ring-1 ring-white/5"
            style={{ height: '650px' }}
          >
            {/* Cinematic Header */}
            <div className="bg-gradient-to-r from-primary/20 via-primary/5 to-transparent p-8 flex justify-between items-center shrink-0 border-b border-white/5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary via-secondary to-transparent" />
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 shadow-glow-primary">
                  <Bot size={24} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-black text-lg uppercase tracking-tight text-white font-display">CareX<span className="text-primary">AI</span> Assistant</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80">Neural Stream Online</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)} 
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-muted-foreground hover:text-white transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Neural Stream Container */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-[#03050a]/40 custom-scrollbar relative">
              <div className="absolute inset-0 pointer-events-none opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
              
              {messages.map((msg, idx) => (
                <motion.div 
                  key={idx} 
                  initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={cn(
                    "relative max-w-[85%] px-6 py-4 rounded-[1.8rem] text-sm font-medium leading-relaxed shadow-2xl",
                    msg.role === 'user' 
                      ? 'bg-primary text-background rounded-br-sm font-black shadow-glow-primary/20' 
                      : 'bg-white/5 border border-white/10 text-slate-100 rounded-bl-sm backdrop-blur-xl'
                  )}>
                    {msg.text.split('\n').map((line, i) => (
                       <p key={i} className={i > 0 ? 'mt-3' : ''}>{line}</p>
                    ))}
                    
                    {msg.role === 'model' && (
                        <div className="absolute -left-12 bottom-0 w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-primary/40">
                            <Sparkles size={14} />
                        </div>
                    )}
                  </div>
                </motion.div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start w-full">
                   <div className="bg-white/5 border border-white/10 rounded-[1.8rem] rounded-bl-sm px-6 py-4 shadow-2xl flex items-center gap-4 backdrop-blur-xl">
                      <div className="flex gap-1.5">
                         {[0, 1, 2].map(i => (
                           <motion.div 
                             key={i}
                             className="w-1.5 h-1.5 bg-primary rounded-full shadow-glow-primary"
                             animate={{ y: [0, -6, 0], opacity: [0.3, 1, 0.3] }}
                             transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                           />
                         ))}
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60">Processing Neural Vectors</span>
                   </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Command Input Area */}
            <div className="p-6 bg-white/5 border-t border-white/10 backdrop-blur-3xl">
              <form onSubmit={handleSend} className="flex gap-4 items-center">
                <div className="flex-1 relative group">
                   <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Input clinical query..."
                      className="w-full pl-6 pr-12 py-4 bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/10 rounded-2xl text-sm outline-none transition-all placeholder:text-muted-foreground/40 text-white"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/20 group-focus-within:text-primary/40 transition-colors">
                        <Clock size={16} />
                    </div>
                </div>

                <button 
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="w-14 h-14 bg-primary text-background rounded-2xl flex items-center justify-center hover:scale-105 active:scale-95 disabled:opacity-30 disabled:grayscale transition-all shadow-glow-primary"
                >
                  <Send size={20} className="ml-1" />
                </button>
              </form>
              <p className="mt-4 text-[8px] font-black uppercase tracking-[0.4em] text-center text-muted-foreground/30"> CareXAI Encryption Protocol: RSA-4096-ECC Active </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.1, rotate: 5 }}
        whileTap={{ scale: 0.9 }}
        className={cn(
            "fixed bottom-6 right-6 h-20 w-20 rounded-[2.5rem] flex items-center justify-center text-background z-[300] transition-all shadow-glow-primary ring-4 ring-white/10 overflow-hidden group",
            isOpen ? "bg-white/10 text-white" : "bg-primary"
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        {isOpen ? <X size={32} /> : <MessageSquare size={32} />}
        {!isOpen && <div className="absolute -inset-2 bg-primary/20 rounded-full animate-ping opacity-20" />}
      </motion.button>
    </>
  );
};
