
import React from 'react';
import { motion } from 'framer-motion';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  delay?: number;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', title, delay = 0, onClick }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      onClick={onClick}
      className={`
        bg-white dark:bg-slate-900 
        p-6 md:p-7 
        rounded-2xl 
        shadow-sm border border-slate-100/80 dark:border-slate-800 
        ${onClick 
          ? 'cursor-pointer hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-black/30 hover:-translate-y-1 hover:border-rose-200 dark:hover:border-rose-900/50' 
          : 'hover:border-slate-200 dark:hover:border-slate-700'
        } 
        transition-all duration-300
        ${className}
      `}
    >
      {title && (
        <div className="mb-5 pb-3 border-b border-slate-50 dark:border-slate-800/50">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
            {title}
          </h3>
        </div>
      )}
      {children}
    </motion.div>
  );
};
