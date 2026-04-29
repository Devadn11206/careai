import React from 'react';

export interface ConsultationAttachment {
  name: string;
  url: string;
}

interface Props {
  align: 'left' | 'right' | 'center';
  variant?: 'mine' | 'theirs' | 'system';
  senderName?: string;
  text: string;
  timestampLabel?: string;
  statusLabel?: string;
  attachment?: ConsultationAttachment;
}

export const ConsultationMessageBubble: React.FC<Props> = ({
  align,
  variant = 'theirs',
  senderName,
  text,
  timestampLabel,
  statusLabel,
  attachment,
}) => {
  if (variant === 'system' || align === 'center') {
    return (
      <div className="flex justify-center">
        <div className="max-w-[92%] sm:max-w-[75%] rounded-2xl px-3 py-2 text-[12px] border bg-secondary-50/70 dark:bg-secondary-900/10 border-secondary-200/60 dark:border-secondary-800/30 text-slate-800 dark:text-slate-100 shadow-sm">
          <p className="whitespace-pre-wrap break-words leading-relaxed">{text}</p>
        </div>
      </div>
    );
  }

  const isMine = variant === 'mine';

  return (
    <div className={`flex ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[92%] sm:max-w-[80%] rounded-2xl px-3 py-2 text-[12px] shadow-sm border ${
          isMine
            ? 'bg-primary-600 text-white border-primary-500'
            : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700'
        }`}
      >
        {senderName && !isMine && (
          <div className={`text-[10px] font-bold tracking-wide mb-1 ${isMine ? 'text-white/80' : 'text-slate-500 dark:text-slate-300'}`}>
            {senderName}
          </div>
        )}

        <p className="whitespace-pre-wrap break-words leading-relaxed">{text}</p>

        {attachment && (
          <a
            href={attachment.url}
            target="_blank"
            rel="noreferrer"
            className={`mt-2 inline-flex items-center gap-2 text-[11px] font-semibold underline underline-offset-2 ${
              isMine ? 'text-white/90' : 'text-primary-700 dark:text-primary-300'
            }`}
          >
            Attachment: {attachment.name}
          </a>
        )}

        {(timestampLabel || statusLabel) && (
          <div className={`mt-2 flex justify-between items-center text-[10px] ${isMine ? 'text-white/75' : 'text-slate-500 dark:text-slate-300'}`}>
            <span>{timestampLabel}</span>
            <span className="font-semibold">{statusLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
};
