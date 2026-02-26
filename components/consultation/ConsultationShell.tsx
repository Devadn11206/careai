import React from 'react';

interface Props {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  headerRight?: React.ReactNode;
  onClose?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClassName?: string;
  zIndexClassName?: string;
}

export const ConsultationShell: React.FC<Props> = ({
  title,
  subtitle,
  headerRight,
  onClose,
  children,
  footer,
  maxWidthClassName = 'max-w-4xl',
  zIndexClassName = 'z-[130]',
}) => {
  return (
    <div className={`fixed inset-0 ${zIndexClassName} bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4`}>
      <div
        className={`bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full ${maxWidthClassName} h-[92vh] sm:h-[88vh] max-h-[92vh] flex flex-col border border-slate-100 dark:border-slate-800 overflow-hidden`}
        role="dialog"
        aria-modal="true"
      >
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="font-bold text-slate-900 dark:text-white tracking-tight truncate">{title}</h3>
            </div>
            {subtitle && <div className="text-[11px] text-slate-500 dark:text-slate-300 mt-0.5 truncate">{subtitle}</div>}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {headerRight}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close"
              >
                <span className="text-lg leading-none">✕</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0">{children}</div>

        {footer && (
          <div className="border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
