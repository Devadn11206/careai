
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost' | 'neon' | 'cyber';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyle = "relative overflow-hidden rounded-xl font-semibold transition-all duration-300 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed tracking-wide active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-offset-2";

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-8 py-3.5 text-base"
  };

  const variants = {
    primary: "bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 text-white shadow-lg shadow-primary-500/25 hover:shadow-primary-500/35 border border-transparent focus:ring-primary-500",

    secondary: "bg-slate-800 text-white hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 shadow-md hover:shadow-lg border border-transparent focus:ring-slate-500",

    danger: "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg shadow-red-500/30 border border-transparent focus:ring-red-500",

    outline: "bg-white dark:bg-transparent border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary-500 dark:hover:border-neon-400 hover:text-primary-700 dark:hover:text-neon-400 hover:bg-primary-50 dark:hover:bg-neon-400/5 focus:ring-slate-200",

    ghost: "bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 focus:ring-slate-200",

    // Neon variant — electric cyan gradient with glow
    neon: "bg-gradient-to-r from-neon-400 to-bio-400 text-space-950 font-bold shadow-lg shadow-neon-400/30 hover:shadow-neon-400/50 border border-transparent focus:ring-neon-400 shimmer-btn",

    // Cyber variant — transparent with animated neon border
    cyber: "bg-transparent border border-neon-400/50 text-neon-400 hover:bg-neon-400/10 hover:border-neon-400 hover:shadow-neon-400/20 hover:shadow-lg focus:ring-neon-400",
  };

  return (
    <button
      className={`${baseStyle} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      <span className="relative z-10 flex items-center gap-2">
        {children}
      </span>
    </button>
  );
};
