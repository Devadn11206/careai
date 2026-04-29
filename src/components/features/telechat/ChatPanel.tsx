import React, { useEffect, useRef, useState } from 'react';
import { Send, Paperclip, ShieldCheck, Globe, Loader2, Smile, X } from 'lucide-react';
import type { TeleUser, TeleChatMessage } from './telechatTypes';
import { translateTelechatMessage } from '../../../services/telechatTranslationService';
import { BackendAPI } from '../../../services/apiClient';
import type { ChatMessage, TypingEvent } from '../../../types';
import { ConsultationShell } from '../../consultation/ConsultationShell';

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

const QUICK_EMOJIS = ['😀', '😂', '😍', '🙏', '👍', '👏', '❤️', '🤒', '😷', '✅', '📄', '💊'];

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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

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
              name:
                msg.attachmentType === 'image'
                  ? 'Image'
                  : msg.attachmentType === 'video'
                    ? 'Video'
                    : msg.attachmentType === 'pdf'
                      ? 'PDF'
                      : 'File',
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
      let attachmentType: 'image' | 'pdf' | 'video' | 'file' | undefined;

      if (selectedFile) {
        attachmentUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(selectedFile);
        });
        if (selectedFile.type.startsWith('image/')) attachmentType = 'image';
        else if (selectedFile.type.startsWith('video/')) attachmentType = 'video';
        else if (selectedFile.type === 'application/pdf') attachmentType = 'pdf';
        else attachmentType = 'file';
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

  const appendEmoji = (emoji: string) => {
    setInputText((prev) => `${prev}${emoji}`);
  };

  const formatTs = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <ConsultationShell
      title="Secure Consultation Chat"
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
          <div
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
          </div>
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
        <div className="p-2 bg-[#f0f2f5] dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 relative">
          {showEmojiPicker && (
            <div className="absolute bottom-[64px] left-2 right-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 shadow-xl z-20">
              <div className="flex flex-wrap gap-1">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => appendEmoji(emoji)}
                    className="text-lg px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-end gap-2">
            <label className="shrink-0 w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer text-slate-500 hover:text-slate-700">
              <Paperclip size={16} />
              <input type="file" className="hidden" onChange={handleFileSelect} accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt" />
            </label>

            <button
              type="button"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              className="shrink-0 w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-700"
              aria-label="Emoji"
            >
              <Smile size={16} />
            </button>

            <div className="flex-1 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2">
              <textarea
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  notifyTyping(true);
                }}
                onBlur={() => notifyTyping(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Type a message..."
                className="w-full text-[13px] bg-transparent text-slate-800 dark:text-slate-100 outline-none resize-none min-h-[24px] max-h-24"
                rows={1}
              />
              {selectedFile && (
                <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                  <span className="truncate">Attached: {selectedFile.name}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700"
                    aria-label="Remove attachment"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleSend}
              disabled={connectionStatus === 'disconnected' || isUploading || (!inputText.trim() && !selectedFile)}
              className="shrink-0 w-10 h-10 rounded-full bg-[#2563eb] text-white flex items-center justify-center disabled:opacity-50"
              aria-label="Send message"
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      }
    >
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto p-4 space-y-3"
        style={{
          backgroundColor: '#efeae2',
          backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")',
          backgroundSize: '400px',
        }}
      >
        {accessError && (
          <div className="flex justify-center">
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2 max-w-[90%]">{accessError}</div>
          </div>
        )}

        {messages.map((msg) => {
          const isMine = msg.senderId === currentUser.id;
          const isSystem = msg.senderId === 'system';
          const bubbleClass = isMine
            ? 'bg-[#d9fdd3] text-slate-900 rounded-tr-sm'
            : 'bg-white text-slate-900 rounded-tl-sm';
          return (
            <div key={msg.id} className={`flex ${isSystem ? 'justify-center' : isMine ? 'justify-end' : 'justify-start'}`}>
              {isSystem ? (
                <div className="bg-[#fff5c4] text-slate-700 text-[11px] rounded-lg px-3 py-2 max-w-[85%] text-center shadow-sm">
                  {getDisplayText(msg)}
                </div>
              ) : (
                <div className={`max-w-[82%] rounded-xl px-3 py-2 shadow-sm ${bubbleClass}`}>
                  {!isMine && <div className="text-[10px] font-bold text-slate-500 mb-1">{msg.senderName}</div>}
                  <div className="whitespace-pre-wrap break-words text-[13px]">{getDisplayText(msg)}</div>

                  {msg.attachment && (
                    <div className="mt-2 rounded-lg overflow-hidden border border-black/10">
                      {msg.attachment.type === 'image' ? (
                        <img src={msg.attachment.url} alt={msg.attachment.name} className="max-h-56 w-full object-cover" />
                      ) : msg.attachment.type === 'video' ? (
                        <video src={msg.attachment.url} controls className="max-h-56 w-full bg-black" />
                      ) : (
                        <a
                          href={msg.attachment.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block p-2 text-[12px] font-semibold text-blue-700 underline"
                        >
                          Open {msg.attachment.name}
                        </a>
                      )}
                    </div>
                  )}

                  <div className="mt-1 text-[10px] text-slate-500 text-right">
                    {formatTs(msg.timestamp)} {isMine ? (msg.isRead ? '✓✓' : '✓') : ''}
                  </div>
                </div>
              )}
            </div>
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
