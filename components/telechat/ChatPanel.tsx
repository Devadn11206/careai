import React, { useEffect, useRef, useState } from 'react';
import { Send, Paperclip, ShieldCheck, Globe, Loader2 } from 'lucide-react';
import type { TeleUser, TeleChatMessage } from './telechatTypes';
import { translateTelechatMessage } from '../../services/telechatTranslationService';
import { BackendAPI } from '../../services/apiClient';
import type { ChatMessage, TypingEvent } from '../../types';
import { ConsultationShell } from '../consultation/ConsultationShell';
import { ConsultationIconButton } from '../consultation/ConsultationIconButton';
import { ConsultationMessageBubble } from '../consultation/ConsultationMessageBubble';

interface ChatPanelProps {
  currentUser: TeleUser;
  appointmentId: string;
  onClose: () => void;
}

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
];

export const ChatPanel: React.FC<ChatPanelProps> = ({ currentUser, appointmentId, onClose }) => {
  const [messages, setMessages] = useState<TeleChatMessage[]>(() => {
    return [
      {
        id: 'welcome',
        senderId: 'system',
        senderName: 'CareXAI',
        text: 'Hello, this is your secure CareXAI chat. You can share symptoms or questions here before or during the consultation.',
        timestamp: Date.now() - 60_000,
        isRead: true,
      },
    ];
  });
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [isUploading, setIsUploading] = useState(false);
  const [currentLang, setCurrentLang] = useState('en');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());

  const [accessError, setAccessError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const triggerTranslation = async (msgs: TeleChatMessage[], targetLang: string) => {
    if (targetLang === 'en') return;

    const msgsToTranslate = msgs.filter(
      (m) => !m.translations?.[targetLang] && !translatingIds.has(m.id + targetLang),
    );
    if (msgsToTranslate.length === 0) return;

    setTranslatingIds((prev) => {
      const next = new Set(prev);
      msgsToTranslate.forEach((m) => next.add(m.id + targetLang));
      return next;
    });

    for (const msg of msgsToTranslate) {
      const translatedText = await translateTelechatMessage(msg.text, targetLang);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id
            ? { ...m, translations: { ...(m.translations || {}), [targetLang]: translatedText } }
            : m,
        ),
      );
      setTranslatingIds((prev) => {
        const next = new Set(prev);
        next.delete(msg.id + targetLang);
        return next;
      });
    }
  };

  const handleLanguageChange = (code: string) => {
    setCurrentLang(code);
    setShowLangMenu(false);
    triggerTranslation(messages, code);
  };

  useEffect(() => {
    let unsubChat: (() => void) | null = null;
    let unsubTyping: (() => void) | null = null;
    let cancelled = false;

    const mapBackendMessage = (msg: ChatMessage): TeleChatMessage => {
      const isMine = msg.senderId === currentUser.id;
      return {
        id: msg.id,
        senderId: msg.senderId,
        senderName: isMine ? currentUser.name : 'Clinician',
        text: msg.content,
        timestamp: new Date(msg.timestamp).getTime(),
        isRead: msg.isRead,
        attachment: msg.attachmentUrl
          ? {
              name: msg.attachmentType === 'image' ? 'Image' : 'Document',
              type: msg.attachmentType || 'file',
              url: msg.attachmentUrl,
            }
          : undefined,
      };
    };

    const init = async () => {
      try {
        setAccessError(null);
        setConnectionStatus('connected');
        const history = await BackendAPI.getChatMessages(appointmentId);
        if (cancelled) return;
        const mapped = history.map(mapBackendMessage);
        setMessages((prev) => {
          const hasWelcome = prev.find((m) => m.id === 'welcome');
          const base = hasWelcome ? prev.filter((m) => m.id === 'welcome') : [];
          return [...base, ...mapped];
        });
        if (currentLang !== 'en' && mapped.length > 0) {
          triggerTranslation(mapped, currentLang);
        }
      } catch (err: any) {
        console.error('[Telechat] Failed to load messages', err);
        if (!cancelled) {
          setAccessError(err?.message || 'Unable to access secure chat for this appointment.');
          setConnectionStatus('disconnected');
        }
      }

      unsubChat = BackendAPI.onChatMessage((msg: ChatMessage) => {
        if (msg.appointmentId !== appointmentId) return;
        const mapped = mapBackendMessage(msg);
        setMessages((prev) => {
          if (prev.find((m) => m.id === mapped.id)) return prev;
          return [...prev, mapped];
        });
        if (currentLang !== 'en') {
          triggerTranslation([mapped], currentLang);
        }
      });

      unsubTyping = BackendAPI.onTyping((t: TypingEvent) => {
        if (t.appointmentId !== appointmentId) return;
        if (t.senderId === currentUser.id) return;
        setIsTyping(t.isTyping);
      });
    };

    init();

    return () => {
      cancelled = true;
      if (unsubChat) unsubChat();
      if (unsubTyping) unsubTyping();
    };
  }, [appointmentId, currentUser.id, currentUser.name, currentLang]);

  const notifyTyping = (isTypingFlag: boolean) => {
    const socket = BackendAPI.getSocket();
    if (!socket) return;
    socket.emit('chat:typing', { appointmentId, isTyping: isTypingFlag });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    notifyTyping(true);
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => notifyTyping(false), 1000);
  };

  const handleSend = async () => {
    if ((!inputText.trim() && !selectedFile) || connectionStatus === 'disconnected' || isUploading) return;

    setIsUploading(true);
    try {
      let attachmentUrl: string | undefined;
      let attachmentType: 'image' | 'pdf' | undefined;

      if (selectedFile) {
        attachmentUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(selectedFile);
        });
        attachmentType = selectedFile.type.startsWith('image/') ? 'image' : 'pdf';
      }

      await BackendAPI.sendChatMessage({
        appointmentId,
        content: inputText,
        attachmentUrl,
        attachmentType,
      });

      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
      notifyTyping(false);
      setInputText('');
      setSelectedFile(null);
    } catch (err) {
      console.error('[Telechat] Failed to send message', err);
    } finally {
      setIsUploading(false);
    }
  };

  const getDisplayText = (msg: TeleChatMessage) => {
    if (currentLang === 'en') return msg.text;
    return msg.translations?.[currentLang] || msg.text;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setSelectedFile(e.target.files[0]);
  };

  return (
    <ConsultationShell
      title={
        <span className="inline-flex items-center gap-2">
          Secure Consultation Chat
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
              connectionStatus === 'connected'
                ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-200 dark:border-rose-800/40'
                : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-rose-500 animate-pulse' : 'bg-rose-300'
              }`}
            />
            {connectionStatus === 'connected' ? 'Connected' : 'Offline'}
          </span>
        </span>
      }
      subtitle={
        <span className="inline-flex items-center gap-1">
          <ShieldCheck size={12} className="text-rose-600" />
          Encrypted • For clinical use
        </span>
      }
      onClose={onClose}
      maxWidthClassName="max-w-3xl"
      headerRight={
        <div className="relative text-xs">
          <button
            type="button"
            onClick={() => setShowLangMenu((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Globe size={14} />
            {SUPPORTED_LANGUAGES.find((l) => l.code === currentLang)?.name}
          </button>
          {showLangMenu && (
            <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 py-1 z-10">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleLanguageChange(lang.code)}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 ${
                    currentLang === lang.code
                      ? 'text-rose-600 font-semibold bg-rose-50 dark:bg-rose-900/20'
                      : 'text-slate-600 dark:text-slate-200'
                  }`}
                >
                  <span>{lang.flag}</span>
                  <span>{lang.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      }
      footer={
        <div className="p-3">
          <div className="flex items-end gap-2">
            <label className="shrink-0">
              <ConsultationIconButton variant="outline" className="cursor-pointer" aria-label="Attach file">
                <Paperclip size={16} />
              </ConsultationIconButton>
              <input type="file" className="hidden" onChange={handleFileSelect} />
            </label>

            <div className="flex-1">
              <input
                type="text"
                value={inputText}
                onChange={handleInputChange}
                placeholder="Type a message about symptoms, reports, or questions…"
                className="w-full text-[12px] px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-rose-500"
              />
              {selectedFile && (
                <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-300 font-semibold truncate">
                  Attached: {selectedFile.name}
                </div>
              )}
            </div>

            <ConsultationIconButton
              variant="primary"
              onClick={handleSend}
              disabled={connectionStatus === 'disconnected' || isUploading}
              aria-label="Send message"
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send size={16} />}
            </ConsultationIconButton>
          </div>
        </div>
      }
    >
      <div ref={scrollRef} className="h-full overflow-y-auto p-4 space-y-3 bg-slate-50 dark:bg-slate-950/40">
        {accessError && (
          <ConsultationMessageBubble align="center" variant="system" text={accessError} />
        )}

        {messages.map((msg) => {
          const isMine = msg.senderId === currentUser.id;
          const isSystem = msg.senderId === 'system';
          return (
            <ConsultationMessageBubble
              key={msg.id}
              align={isSystem ? 'center' : isMine ? 'right' : 'left'}
              variant={isSystem ? 'system' : isMine ? 'mine' : 'theirs'}
              senderName={!isMine && !isSystem ? msg.senderName : undefined}
              text={getDisplayText(msg)}
              attachment={msg.attachment ? { name: msg.attachment.name, url: msg.attachment.url } : undefined}
              timestampLabel={new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              statusLabel={isMine ? (msg.isRead ? 'Read' : 'Sent') : undefined}
            />
          );
        })}

        {isTyping && (
          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-300 mt-2">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" /> Clinician is typing…
          </div>
        )}
      </div>
    </ConsultationShell>
  );
};
