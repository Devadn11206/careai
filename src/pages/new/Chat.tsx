import React from "react";
import { AppLayout } from "@/components/carex/AppLayout";
import { ChatPanel } from "@/components/features/telechat/ChatPanel";
import { MessageSquare, Shield, Zap } from "lucide-react";
import { motion } from "framer-motion";

const ChatPage = () => {
  return (
    <AppLayout 
      title="Clinical Communication" 
      subtitle="Secure real-time consultation network · End-to-end encrypted"
    >
      <div className="flex flex-col h-full space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest">
                <Shield size={12} /> HIPAA Secure
             </div>
             <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 border border-secondary/20 text-secondary text-[10px] font-black uppercase tracking-widest">
                <Zap size={12} /> AI Assisted
             </div>
          </div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-bold">
            Live Clinical Perimeter · {new Date().toLocaleDateString()}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1"
        >
          <ChatPanel />
        </motion.div>
      </div>
    </AppLayout>
  );
};

export default ChatPage;
