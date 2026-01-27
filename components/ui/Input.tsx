
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  validationStatus?: 'normal' | 'success' | 'warning' | 'error' | 'invalid';
  helperText?: string;
  tooltip?: string;
}

export const Input: React.FC<InputProps> = ({ 
  label, 
  validationStatus = 'normal', 
  helperText, 
  tooltip,
  className = '', 
  ...props 
}) => {
  
  const getBorderColor = () => {
    switch (validationStatus) {
      case 'invalid':
      case 'error': return 'border-red-500 focus:border-red-500 focus:ring-red-200 bg-red-50/10 dark:bg-red-900/10';
      case 'warning': return 'border-orange-500 focus:border-orange-500 focus:ring-orange-200 bg-orange-50/10 dark:bg-orange-900/10';
      case 'success': return 'border-emerald-500 focus:border-emerald-500 focus:ring-emerald-200 bg-emerald-50/10 dark:bg-emerald-900/10';
      default: return 'border-slate-300 dark:border-slate-700 focus:ring-rose-500 focus:border-rose-500';
    }
  };

  const getStatusIcon = () => {
    switch (validationStatus) {
      case 'invalid':
      case 'error': return <span className="text-red-500">⚠️</span>;
      case 'warning': return <span className="text-orange-500">⚡</span>;
      case 'success': return <span className="text-emerald-500">✓</span>;
      default: return null;
    }
  };

  const getTextColor = () => {
    switch (validationStatus) {
      case 'invalid':
      case 'error': return 'text-red-600 dark:text-red-400';
      case 'warning': return 'text-orange-600 dark:text-orange-400';
      case 'success': return 'text-emerald-600 dark:text-emerald-400';
      default: return 'text-slate-500 dark:text-slate-400';
    }
  };

  return (
    <div className="flex flex-col space-y-1.5 group relative">
      <div className="flex justify-between items-center">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
          {label}
          {tooltip && (
            <div className="relative group/tooltip ml-1 cursor-help">
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-10 text-center">
                {tooltip}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
              </div>
            </div>
          )}
        </label>
        {validationStatus !== 'normal' && (
           <span className={`text-xs font-bold ${getTextColor()}`}>{helperText}</span>
        )}
      </div>
      
      <div className="relative">
        <input 
          className={`w-full px-4 py-2.5 bg-white dark:bg-slate-900 border rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 transition-all duration-200 shadow-sm ${getBorderColor()} ${className}`}
          {...props}
        />
        <div className="absolute right-3 top-2.5 pointer-events-none">
          {getStatusIcon()}
        </div>
      </div>
    </div>
  );
};
