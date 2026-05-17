import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, 
  Send, 
  Sparkles, 
  Activity, 
  FileText, 
  Pill, 
  Calendar, 
  ChevronRight,
  Loader2,
  User,
  Brain,
  MessageSquare,
  History,
  Info,
  ShieldCheck,
  Stethoscope
} from 'lucide-react';
import { GlassCard } from '@/components/carex/GlassCard';
import { NeonButton } from '@/components/carex/NeonButton';
import { useHealth } from '@/services/HealthContext';
import { BackendAPI } from '@/services/apiClient';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const AiAssistantPage = () => {
  const { user, vitals, medications, latestAiInsight, appointments } = useHealth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Hello ${user?.name || 'there'}! I'm your CareXAI Clinical Assistant. I've analyzed your latest vitals and health records. How can I help you today?`,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async (text: string = input) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await BackendAPI.sendAiMessage(text);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to connect to Neural Link');
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm having trouble connecting to my clinical neural network. Please check your connection and try again.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions = [
    { label: "Summarize my health", icon: Activity, text: "Can you give me a summary of my current health status based on my latest vitals?" },
    { label: "Explain prescription", icon: Pill, text: "Can you explain my active medications and their purposes?" },
    { label: "Analyze latest vitals", icon: Brain, text: "How do my latest heart rate and blood pressure readings look?" },
    { label: "Upcoming sessions", icon: Calendar, text: "When is my next consultation scheduled and what should I prepare?" }
  ];

  return (
    <div className="h-[calc(100vh-140px)] flex gap-6 overflow-hidden">
      {/* Sidebar - Context & Quick Actions */}
      <div className="hidden lg:flex flex-col w-[320px] gap-4 h-full">
        <GlassCard className="p-6 border-primary/20 bg-primary/5">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Clinical Context</h3>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Neural Link Active</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="p-3 glass rounded-xl border border-border/40 space-y-1">
              <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Wellness Score</span>
              <div className="flex items-center gap-2">
                <p className="text-lg font-display font-bold text-primary">{latestAiInsight?.ai_wellness_score || 85}%</p>
                <div className="flex-1 h-1 bg-muted/20 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${latestAiInsight?.ai_wellness_score || 85}%` }} />
                </div>
              </div>
            </div>
            
            <div className="p-3 glass rounded-xl border border-border/40 space-y-2">
              <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Recent Activity</span>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[10px] text-foreground">
                  <Activity size={12} className="text-secondary" />
                  <span>Vitals updated 2h ago</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-foreground">
                  <Calendar size={12} className="text-primary" />
                  <span>Next session: {appointments[0]?.date || 'Not scheduled'}</span>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>

        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Quick Clinical Actions</h4>
          {quickActions.map((action, i) => (
            <motion.button
              key={i}
              whileHover={{ x: 4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSend(action.text)}
              className="w-full p-4 glass rounded-2xl border border-border/40 text-left group hover:border-primary/40 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-muted/20 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-all">
                  <action.icon size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground mb-1 group-hover:text-primary transition-colors">{action.label}</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">Ask about {action.label.toLowerCase()}...</p>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <GlassCard className="flex-1 flex flex-col p-0 overflow-hidden relative border-primary/10">
        {/* Chat Header */}
        <div className="p-4 border-b border-glass-border flex items-center justify-between bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center relative">
              <Bot className="text-primary" size={24} />
              <div className="absolute -top-1 -right-1 h-3 w-3 bg-success rounded-full border-2 border-[#0B1120] animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">CareXAI Assistant</h2>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-black uppercase tracking-widest text-primary">AI Neural Model 3.3-B</span>
                <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                <span className="text-[8px] font-black uppercase tracking-widest text-success">Clinical Context Loaded</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NeonButton variant="outline" size="sm" className="h-8 px-3 text-[10px] uppercase font-black tracking-widest opacity-60 hover:opacity-100">
              <History size={14} className="mr-1.5" /> History
            </NeonButton>
          </div>
        </div>

        {/* Messages */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar"
        >
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex gap-4 max-w-[85%]",
                msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
              )}
            >
              <div className={cn(
                "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border",
                msg.role === 'user' ? "bg-secondary/10 border-secondary/20 text-secondary" : "bg-primary/10 border-primary/20 text-primary"
              )}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={cn(
                "space-y-1",
                msg.role === 'user' ? "text-right" : "text-left"
              )}>
                <div className={cn(
                  "p-4 rounded-2xl text-sm leading-relaxed",
                  msg.role === 'user' 
                    ? "bg-secondary/10 text-foreground rounded-tr-none border border-secondary/20 shadow-glow-secondary/5" 
                    : "bg-muted/10 text-foreground rounded-tl-none border border-border/40"
                )}>
                  {msg.content.split('\n').map((line, i) => (
                    <React.Fragment key={i}>
                      {line}
                      <br />
                    </React.Fragment>
                  ))}
                </div>
                <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground px-1">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-4 max-w-[85%]"
            >
              <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Bot className="text-primary" size={16} />
              </div>
              <div className="bg-muted/10 text-foreground p-4 rounded-2xl rounded-tl-none border border-border/40 flex items-center gap-2">
                <div className="flex gap-1">
                  <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0 }} className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }} className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }} className="h-1.5 w-1.5 rounded-full bg-primary" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">Neural processing...</span>
              </div>
            </motion.div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-glass-border bg-bg-deep/50 backdrop-blur-md">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="relative flex items-center gap-3"
          >
            <div className="relative flex-1 group">
              <input
                type="text"
                placeholder="Ask about your vitals, prescriptions, or symptoms..."
                className="w-full bg-[#0B1120]/60 border border-border/40 rounded-xl h-12 pl-4 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 text-muted-foreground">
                <MessageSquare size={16} className="opacity-40 group-focus-within:opacity-100 transition-opacity" />
              </div>
            </div>
            <NeonButton
              type="submit"
              variant="primary"
              disabled={!input.trim() || isLoading}
              className="h-12 w-12 rounded-xl flex items-center justify-center p-0 shrink-0"
            >
              {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            </NeonButton>
          </form>
          <div className="mt-3 flex items-center justify-center gap-6 opacity-30">
            <div className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.2em]"><ShieldCheck size={10} /> Secure Clinical Node</div>
            <div className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.2em]"><Sparkles size={10} /> AI Enhanced Wisdom</div>
            <div className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.2em]"><Stethoscope size={10} /> Validated Health Context</div>
          </div>
        </div>

        {/* AI Branding Overlay */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-[0.03]">
          <Brain size={400} className="text-primary" />
        </div>
      </GlassCard>
    </div>
  );
};

export default AiAssistantPage;
