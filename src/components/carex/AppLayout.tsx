import { ReactNode, useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { ParticleField } from "./ParticleField";
import { AIOrb } from "./AIOrb";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AutomationAssistant } from "@/components/features/AutomationAssistant";

export const AppLayout = ({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
}) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  return (
    <div className="min-h-screen flex w-full bg-background overflow-hidden">
      <ParticleField count={20} />
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <TopBar title={title} subtitle={subtitle} />
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      
      <AutomationAssistant 
        isOpen={isAssistantOpen} 
        onClose={() => setIsAssistantOpen(false)} 
      />

      <AIOrb 
        floating 
        size={64} 
        onClick={() => setIsAssistantOpen(!isAssistantOpen)} 
        className={isAssistantOpen ? "ring-4 ring-primary ring-offset-4 ring-offset-background" : ""}
      />
    </div>
  );
};
