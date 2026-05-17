import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

interface NeonButtonProps extends HTMLMotionProps<"button"> {
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'neon';
  glow?: boolean;
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children?: React.ReactNode;
}

export const NeonButton: React.FC<NeonButtonProps> = ({ 
  children, 
  className, 
  variant = 'primary', 
  glow = true,
  size = 'md',
  isLoading = false,
  ...props 
}) => {
  const variants = {
    primary: "border-primary/40 bg-primary/10 text-primary hover:bg-primary hover:text-black hover:shadow-glow-primary",
    secondary: "border-secondary/40 bg-secondary/10 text-secondary hover:bg-secondary hover:text-white hover:shadow-glow-secondary",
    accent: "border-accent/40 bg-accent/10 text-accent hover:bg-accent hover:text-white hover:shadow-glow-success",
    ghost: "border-white/5 bg-white/5 text-muted hover:bg-white/10 hover:text-white",
    neon: "border-primary/50 bg-primary/20 text-primary shadow-glow-primary hover:bg-primary hover:text-black"
  };

  const sizes = {
    sm: "px-4 py-2 text-[10px]",
    md: "px-6 py-3 text-xs",
    lg: "px-8 py-4 text-sm"
  };

  return (
    <motion.button
      whileHover={isLoading ? {} : { scale: 1.05 }}
      whileTap={isLoading ? {} : { scale: 0.95 }}
      disabled={isLoading || props.disabled}
      className={cn(
        "relative rounded-xl border font-black uppercase tracking-[0.2em] transition-all duration-300 flex items-center justify-center gap-2 overflow-hidden",
        variants[variant],
        sizes[size],
        className,
        isLoading && "opacity-70 cursor-not-allowed"
      )}
      {...props}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
      {isLoading ? (
        <div className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Processing...</span>
        </div>
      ) : (
        <span className="relative z-10">{children}</span>
      )}
    </motion.button>
  );
};
