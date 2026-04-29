import React from 'react';

type Variant = 'ghost' | 'outline' | 'primary' | 'danger';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  active?: boolean;
};

export const ConsultationIconButton: React.FC<Props> = ({
  variant = 'ghost',
  active,
  className = '',
  disabled,
  children,
  ...props
}) => {
  const base = 'w-10 h-10 rounded-xl inline-flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 disabled:opacity-60 disabled:cursor-not-allowed';

  const variants: Record<Variant, string> = {
    ghost: 'bg-transparent text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800',
    outline: 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-100 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50/60 dark:hover:bg-primary-900/10',
    primary: 'bg-primary-600 text-white hover:bg-primary-700',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };

  const activeRing = active ? 'ring-2 ring-primary-500/30' : '';

  return (
    <button
      type="button"
      className={`${base} ${variants[variant]} ${activeRing} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
