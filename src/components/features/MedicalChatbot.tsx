
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Chat } from '@google/genai';
import { NeonButton as Button } from '@/components/carex/NeonButton';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
  role: 'user' | 'model';
  text: string;
}

export const MedicalChatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Hello! I am your CareXAI assistant. I can answer medical questions. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Ref to hold the chat session instance so it persists across renders
  const chatSessionRef = useRef<Chat | null>(null);

  useEffect(() => {
    // Initialize Gemini Chat Session
    try {
      const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || '';
      if (apiKey) {
        const ai = new GoogleGenAI({ apiKey });
        chatSessionRef.current = ai.chats.create({
          model: 'gemini-3-flash-preview',
          config: {
            systemInstruction: `You are CareXAI's advanced medical support chatbot. 
            Your role is to assist patients by answering health-related questions, explaining medical reports in simple terms, and provide lifestyle advice.
            
            RULES:
            1. Be empathetic, professional, and clear.
            2. Use formatting (bullet points) for lists.
            3. CRITICAL: Always end responses regarding symptoms or specific medical advice with a brief disclaimer that you are an AI and this is not a professional diagnosis.
            4. Keep responses concise (under 150 words) unless asked for details.`,
          },
        });
      }
    } catch (e) {
      console.error("Failed to init chat", e);
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
        // Graceful fallback if key missing or init failed
        console.warn("MedicalChatbot: chat session not initialized; using offline fallback reply.");
        setMessages(prev => [
          ...prev,
          {
            role: 'model',
            text:
              "I'm currently offline and can't access the medical AI model. " +
              "Please check your configuration or try again later."
          },
        ]);
        return;
      }

      const response = await chatSessionRef.current.sendMessage({ message: userMsg });
      const text = response.text || "I apologize, I couldn't process that. Please try again.";

      setMessages(prev => [...prev, { role: 'model', text }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: "I'm having trouble connecting to the medical database right now. Please check your connection or try again later." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-24 right-6 w-96 max-w-[90vw] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-50 overflow-hidden font-sans ring-1 ring-slate-900/5"
            style={{ height: '550px' }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex justify-between items-center text-white shrink-0 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/20 shadow-inner">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-wide">CareXAI Support</h3>
                  <p className="text-[10px] text-blue-100 flex items-center gap-1.5 opacity-90">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span> 
                    Active Now
                  </p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50 scroll-smooth custom-scrollbar">
              {messages.map((msg, idx) => (
                <motion.div 
                  key={idx} 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'model' && (
                     <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mr-2 mt-auto shrink-0 shadow-sm">
                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                     </div>
                  )}
                  <div className={`
                    max-w-[80%] px-5 py-3 text-sm shadow-sm relative leading-relaxed
                    ${msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-2xl rounded-br-sm' 
                      : 'bg-white text-slate-700 border border-slate-100 rounded-2xl rounded-bl-sm'}
                  `}>
                    {msg.text.split('\n').map((line, i) => (
                       <p key={i} className={i > 0 ? 'mt-2' : ''}>{line}</p>
                    ))}
                  </div>
                </motion.div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start w-full">
                   <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mr-2 mt-auto shrink-0">
                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                   </div>
                   <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-2">
                     <div className="flex space-x-1.5 items-center h-4">
                       <motion.div 
                         className="w-1.5 h-1.5 bg-indigo-400 rounded-full" 
                         animate={{ y: [0, -4, 0] }} 
                         transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0 }}
                       />
                       <motion.div 
                         className="w-1.5 h-1.5 bg-indigo-400 rounded-full" 
                         animate={{ y: [0, -4, 0] }} 
                         transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.15 }}
                       />
                       <motion.div 
                         className="w-1.5 h-1.5 bg-indigo-400 rounded-full" 
                         animate={{ y: [0, -4, 0] }} 
                         transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                       />
                     </div>
                     <span className="text-xs text-slate-400 font-medium ml-1">Thinking...</span>
                   </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 bg-white border-t border-slate-100">
              <form onSubmit={handleSend} className="flex gap-2 items-end">
                <div className="flex-1 relative">
                   <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask a health question..."
                      className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 border rounded-2xl text-sm outline-none transition-all placeholder-slate-400"
                    />
                </div>

                <button 
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all transform active:scale-95 flex-shrink-0"
                >
                  <svg className="w-5 h-5 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-white z-50 transition-colors ring-4 ring-white/20 ${isOpen ? 'bg-slate-800' : 'bg-blue-600 hover:bg-blue-500'}`}
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        ) : (
          <div className="relative">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
          </div>
        )}
      </motion.button>
    </>
  );
};
