import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIOrbProps {
  size?: number;
  className?: string;
  onClick?: () => void;
  floating?: boolean;
}

export const AIOrb = ({ size = 64, className, onClick, floating = false }: AIOrbProps) => {
  return (
    <motion.button
      onClick={onClick}
      className={cn(
        "relative flex items-center justify-center rounded-full",
        floating && "fixed bottom-8 right-8 z-50",
        className
      )}
      style={{ width: size, height: size }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      animate={floating ? { y: [0, -8, 0] } : undefined}
      transition={floating ? { duration: 4, repeat: Infinity, ease: "easeInOut" } : undefined}
      aria-label="Open AI Assistant"
    >
      {/* Pulse rings */}
      <span className="absolute inset-0 rounded-full bg-primary/30 animate-pulse-ring" />
      <span className="absolute inset-0 rounded-full bg-secondary/30 animate-pulse-ring" style={{ animationDelay: "0.8s" }} />
      {/* Orb */}
      <span
        className="relative flex items-center justify-center rounded-full bg-gradient-aurora shadow-glow"
        style={{ width: size, height: size }}
      >
        <Sparkles className="text-primary-foreground" style={{ width: size * 0.4, height: size * 0.4 }} />
      </span>
    </motion.button>
  );
};
