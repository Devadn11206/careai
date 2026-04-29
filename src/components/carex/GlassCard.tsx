import * as React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassCardProps extends HTMLMotionProps<"div"> {
  glow?: boolean;
  hover?: boolean;
  variant?: "default" | "strong";
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, glow, hover = true, variant = "default", children, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        whileHover={hover ? { y: -4, transition: { duration: 0.25 } } : undefined}
        className={cn(
          variant === "strong" ? "glass-strong" : "glass",
          "rounded-2xl p-6 transition-all duration-300",
          hover && "hover:border-primary/30 hover:shadow-glow",
          glow && "shadow-glow",
          className
        )}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
GlassCard.displayName = "GlassCard";
