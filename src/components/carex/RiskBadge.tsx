import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface RiskBadgeProps {
  level: "low" | "medium" | "high";
  label?: string;
  className?: string;
  pulse?: boolean;
}

const config = {
  low: {
    color: "bg-success/15 text-success border-success/30",
    dot: "bg-success shadow-[0_0_12px_hsl(var(--success))]",
    text: "Low Risk",
  },
  medium: {
    color: "bg-warning/15 text-warning border-warning/30",
    dot: "bg-warning shadow-[0_0_12px_hsl(var(--warning))]",
    text: "Medium Risk",
  },
  high: {
    color: "bg-destructive/15 text-destructive border-destructive/40",
    dot: "bg-destructive shadow-[0_0_12px_hsl(var(--destructive))]",
    text: "High Risk",
  },
};

export const RiskBadge = ({ level, label, className, pulse = true }: RiskBadgeProps) => {
  const normalizedLevel = ((level?.toLowerCase() === 'moderate' ? 'medium' : level?.toLowerCase()) || 'low') as keyof typeof config;
  const c = config[normalizedLevel] || config.low;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
        c?.color || "bg-muted text-muted-foreground",
        className
      )}
    >
      <span className="relative flex h-2 w-2">
        {pulse && (
          <motion.span
            className={cn("absolute inline-flex h-full w-full rounded-full opacity-75", c.dot)}
            animate={{ scale: [1, 1.8], opacity: [0.7, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", c.dot)} />
      </span>
      {label || c.text}
    </span>
  );
};
