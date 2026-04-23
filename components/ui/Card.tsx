
import React from 'react';
import { motion } from 'framer-motion';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  delay?: number;
  onClick?: () => void;
  variant?: 'default' | 'glass' | 'neon' | 'elevated';
}

export const Card: React.FC<CardProps> = ({ children, className = '', title, delay = 0, onClick, variant = 'default' }) => {

  const variantStyles = {
    default: `
      bg-white dark:bg-slate-900/80
      border border-slate-100/80 dark:border-slate-800
      shadow-sm
      ${onClick ? 'hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-neon-400/5 hover:-translate-y-1 hover:border-primary-200 dark:hover:border-neon-400/30' : 'hover:border-slate-200 dark:hover:border-slate-700'}
    `,
    glass: `
      glass-card
      ${onClick ? 'hover:shadow-xl hover:shadow-neon-400/10 hover:-translate-y-1 dark:hover:border-neon-400/30' : ''}
    `,
    neon: `
      dark:bg-space-950/80 bg-white/90
      border dark:border-neon-400/20 border-primary-200/60
      dark:shadow-neon-400/10 shadow-primary-500/10 shadow-lg
      ${onClick ? 'hover:-translate-y-2 dark:hover:shadow-neon-400/20 hover:shadow-primary-500/20 dark:hover:border-neon-400/40' : ''}
    `,
    elevated: `
      bg-white dark:bg-slate-900
      border border-slate-200/70 dark:border-slate-700/50
      shadow-xl dark:shadow-none
      ${onClick ? 'hover:-translate-y-2 hover:shadow-2xl dark:hover:bg-slate-800/80' : ''}
    `,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      onClick={onClick}
      className={`
        p-6 md:p-7
        rounded-2xl
        ${onClick ? 'cursor-pointer' : ''}
        transition-all duration-300
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {title && (
        <div className="mb-5 pb-3 border-b border-slate-100 dark:border-slate-800/50">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {title}
          </h3>
        </div>
      )}
      {children}
    </motion.div>
  );
};
