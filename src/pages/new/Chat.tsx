import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Paperclip, Sparkles, Mic, Bot } from "lucide-react";
import { AppLayout } from "@/components/carex/AppLayout";
import { GlassCard } from "@/components/carex/GlassCard";
import { NeonButton } from "@/components/carex/NeonButton";
import { useHealth } from "@/services/HealthContext";
import { GeminiService } from "@/services/geminiService";
import { toast } from "sonner";

interface Msg { role: "user" | "ai"; text: string; }

const suggestions = [
  "Summarize my last week",
  "Explain my latest blood test",
  "Am I at risk for hypertension?",
  "Schedule a follow-up",
];

const Chat = () => {
  const { user, vitals, alerts } = useHealth();
  const [messages, setMessages] = useState<Msg[]>([
    { role: "ai", text: `Hi ${user?.name || 'there'} 👋 I'm CareXAI. I can summarize your vitals, explain reports, or help you prep for appointments. What would you like to do?` }
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const send = async (text?: string) => {
    const msg = text ?? input;
    if (!msg.trim()) return;
    
    setMessages((m) => [...m, { role: "user", text: msg }]);
    setInput("");
    setTyping(true);

    try {
      // Build context for AI
      const latestVitals = vitals[vitals.length - 1];
      const context = `
        Current Patient: ${user?.name}
        Latest Vitals: HR: ${latestVitals?.heartRate}bpm, BP: ${latestVitals?.systolicBP}/${latestVitals?.diastolicBP}mmHg, Glucose: ${latestVitals?.glucose}mg/dL
        Recent Alerts: ${alerts.slice(0, 3).map(a => a.message).join('; ')}
      `;

      const response = await GeminiService.chat(msg, context);
      setMessages((m) => [...m, { role: "ai", text: response }]);
    } catch (err) {
      toast.error("AI Assistant is currently unavailable");
      setMessages((m) => [...m, { role: "ai", text: "I'm sorry, I'm having trouble connecting right now. Please try again in a moment." }]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <AppLayout title="AI Assistant" subtitle="Your personal clinical co-pilot">
      <GlassCard variant="strong" hover={false} className="p-0 overflow-hidden flex flex-col h-[calc(100vh-12rem)]">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "ai" && (
                  <div className="h-9 w-9 rounded-xl bg-gradient-aurora flex items-center justify-center shrink-0 shadow-glow">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-gradient-primary text-primary-foreground rounded-tr-sm shadow-glow"
                      : "glass rounded-tl-sm"
                  }`}
                >
                  {m.text}
                </div>
                {m.role === "user" && (
                  <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0 text-xs font-semibold">
                    SA
                  </div>
                )}
              </motion.div>
            ))}
            {typing && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3"
              >
                <div className="h-9 w-9 rounded-xl bg-gradient-aurora flex items-center justify-center shrink-0 shadow-glow">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="glass rounded-2xl rounded-tl-sm px-5 py-4 flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="h-2 w-2 rounded-full bg-primary"
                      animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={endRef} />
        </div>

        {/* Suggestions */}
        {messages.length <= 2 && (
          <div className="px-6 pb-3 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="glass rounded-full px-3 py-1.5 text-xs hover:border-primary/40 hover:text-primary transition-all flex items-center gap-1.5"
              >
                <Sparkles className="h-3 w-3 text-primary" /> {s}
              </button>
            ))}
          </div>
        )}

        {/* Composer */}
        <div className="border-t border-border/50 p-4">
          <div className="glass rounded-2xl flex items-center gap-2 p-2 focus-within:border-primary/50 focus-within:shadow-glow transition-all">
            <button className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-primary transition-colors">
              <Paperclip className="h-4 w-4" />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask anything about your health..."
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            />
            <button className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-primary transition-colors">
              <Mic className="h-4 w-4" />
            </button>
            <NeonButton size="sm" onClick={() => send()} className="h-9 w-9 p-0">
              <Send className="h-4 w-4" />
            </NeonButton>
          </div>
        </div>
      </GlassCard>
    </AppLayout>
  );
};

export default Chat;
