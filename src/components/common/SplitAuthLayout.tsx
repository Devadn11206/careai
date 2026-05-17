import React from "react";
import { motion } from "framer-motion";
import { ParticleField } from "@/components/carex/ParticleField";
import { LoginCharacter, CharacterState } from "@/components/visuals/LoginCharacter";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { NeonButton } from "@/components/carex/NeonButton";
import { cn } from "@/lib/utils";

interface SplitAuthLayoutProps {
  children: React.ReactNode;
  role: "Patient" | "Doctor" | "Admin";
  characterState: CharacterState;
  title: string;
  subtitle: string;
  themeColor: string;
}

export const SplitAuthLayout: React.FC<SplitAuthLayoutProps> = ({
  children,
  role,
  characterState,
  title,
  subtitle,
  themeColor
}) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background overflow-hidden relative">
      <ParticleField count={20} />
      
      {/* Back Button */}
      <div className="absolute top-6 left-6 z-50">
        <NeonButton variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </NeonButton>
      </div>

      {/* LEFT SIDE: Visuals & Branding */}
      <div className={cn(
        "flex-1 relative flex flex-col items-center justify-center p-12 overflow-hidden border-b md:border-b-0 md:border-r border-border/50",
        themeColor
      )}>
        {/* Background glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] opacity-50" />

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 flex flex-col items-center"
        >
          <div className="mb-8 scale-110 md:scale-125">
            <LoginCharacter state={characterState} />
          </div>
          
          <div className="text-center mt-12 max-w-sm">
            <h1 className="font-display text-3xl font-bold mb-3">CareXAI {role}</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {role === "Patient" && "Your personal AI health companion. Access your vitals, trends, and risk analysis in one secure place."}
              {role === "Doctor" && "Advanced clinical intelligence. Manage panels, review AI-scored alerts, and conduct smart consults."}
              {role === "Admin" && "System-wide command and control. Oversee verification, security protocols, and platform growth."}
            </p>
          </div>
        </motion.div>

        {/* Footer info */}
        <div className="absolute bottom-8 left-0 right-0 text-center opacity-40 text-[10px] font-mono tracking-widest uppercase">
          Neural Link Secure • AES-256 Encrypted • HIPAA Compliant
        </div>
      </div>

      {/* RIGHT SIDE: Auth Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 bg-background/50 backdrop-blur-sm relative">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-md"
        >
          <div className="mb-10">
            <h2 className="font-display text-4xl font-bold mb-3">{title}</h2>
            <p className="text-muted-foreground">{subtitle}</p>
          </div>
          
          {children}

          <div className="mt-12 pt-8 border-t border-border/50 text-center">
            <p className="text-xs text-muted-foreground">
              © 2026 CareXAI Healthcare. <br />
              Secure authentication powered by NeuralLink technology.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
