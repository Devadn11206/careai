
import React, { useState, useEffect, useRef } from 'react';
import { UserRole, ChatMessage, PresenceUpdate, TypingEvent } from '@/types';
import { BackendAPI } from '@/services/apiClient';
import { GeminiService } from '@/services/geminiService';
import { motion } from 'framer-motion';

interface Props {
  currentUserId: string;
  currentUserRole: UserRole;
  appointmentId: string;
    otherUserId: string;
  otherUserName: string;
  onClose: () => void;
  onVideoCall?: () => void;
}

export const ChatSystem: React.FC<Props> = ({ currentUserId, currentUserRole, appointmentId, otherUserId, otherUserName, onClose, onVideoCall }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
    const [isOtherOnline, setIsOtherOnline] = useState<boolean>(false);
    const [isOtherTyping, setIsOtherTyping] = useState<boolean>(false);
    const [aiSuggestion, setAiSuggestion] = useState<string>('');
    const [aiLoading, setAiLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

    const dedupeMessages = (items: ChatMessage[]): ChatMessage[] => {
        const byKey = new Map<string, ChatMessage>();
        for (const item of items) {
            const fallbackKey = `${item.appointmentId}:${item.senderId}:${item.timestamp}:${item.content}:${item.attachmentUrl || ''}`;
            const key = item.id || fallbackKey;
            byKey.set(key, item);
        }
        return Array.from(byKey.values()).sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));
    };

  const fetchMessages = async () => {
        try {
            const msgs = await BackendAPI.getChatMessages(appointmentId);
                        setMessages(dedupeMessages(msgs));
            setLoading(false);
        } catch (err: any) {
            const msg = (err && err.message) || 'Chat access denied.';
            setAccessError(msg);
            setLoading(false);
        }
  };

  useEffect(() => {
        fetchMessages();
        BackendAPI.getPresence(otherUserId).then((p) => setIsOtherOnline(p.online)).catch(() => {});

        const unsubscribeChat = BackendAPI.onChatMessage((msg) => {
            if (msg.appointmentId !== appointmentId) return;
            setMessages((prev) => dedupeMessages([...prev, msg]));
        });
        const unsubscribePresence = BackendAPI.onPresenceUpdate((p: PresenceUpdate) => {
            if (p.userId === otherUserId) {
                setIsOtherOnline(p.online);
            }
        });
        const unsubscribeTyping = BackendAPI.onTyping((t: TypingEvent) => {
            if (t.appointmentId !== appointmentId) return;
            if (t.senderId === currentUserId) return;
            setIsOtherTyping(t.isTyping);
        });
        return () => {
            unsubscribeChat();
            unsubscribePresence();
            unsubscribeTyping();
        };
    }, [appointmentId, otherUserId, currentUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !attachment) || sending) return;

    setSending(true);
        setSendError(null);
    try {
                let attachmentUrl: string | undefined;
                let attachmentType: 'image' | 'pdf' | 'video' | 'file' | undefined;

                if (attachment) {
                    attachmentUrl = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(attachment);
                    });
                    if (attachment.type.startsWith('image/')) attachmentType = 'image';
                    else if (attachment.type.startsWith('video/')) attachmentType = 'video';
                    else if (attachment.type === 'application/pdf') attachmentType = 'pdf';
                    else attachmentType = 'file';
                }

                const sent = await BackendAPI.sendChatMessage({
                    appointmentId,
                    content: btoa(unescape(encodeURIComponent(newMessage))),
                    attachmentUrl,
                    attachmentType,
                });
                setMessages((prev) => dedupeMessages([...prev, sent]));

                setNewMessage('');
                setAttachment(null);
                notifyTyping(false);
    } catch (error) {
        console.error("Failed to send", error);
        setSendError(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
        setSending(false);
    }
  };

    const notifyTyping = (isTyping: boolean) => {
            const socket = BackendAPI.getSocket();
            if (!socket) return;
            socket.emit('chat:typing', { appointmentId, isTyping });
    };

  const decodeMessage = (encoded: string) => {
      try { return decodeURIComponent(escape(atob(encoded))); } catch (e) { return encoded; }
  };

  const formatTime = (isoString: string) => {
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const handleGetAISuggestion = async () => {
      if (currentUserRole !== UserRole.DOCTOR || aiLoading) return;
      setAiLoading(true);
      try {
          const summary = messages
              .slice(-10)
              .map(m => `${m.senderRole}: ${m.content}`)
              .join('\n');
          const suggestion = await GeminiService.suggestClinicalReply(summary);
          setAiSuggestion(suggestion);
      } catch (err) {
          console.error('Failed to get AI suggestion', err);
      } finally {
          setAiLoading(false);
      }
  };

  if (accessError) {
      return (
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm text-center">
                  <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">Access Restricted</h3>
                  <p className="text-slate-500 mb-6">{accessError}</p>
                  <button onClick={onClose} className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold">Close Chat</button>
              </div>
          </div>
      );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 md:p-6">
        <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-[#efeae2] w-full max-w-md h-full md:h-[800px] max-h-full rounded-[24px] shadow-2xl flex flex-col overflow-hidden relative font-sans"
            style={{ 
                backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', 
                backgroundBlendMode: 'soft-light',
                backgroundSize: '400px'
            }}
        >
            {/* Header */}
            <div className="bg-[#008069] px-2 py-3 flex justify-between items-center shadow-md z-10 shrink-0">
                <div className="flex items-center gap-1">
                    <button onClick={onClose} className="p-2 text-white rounded-full hover:bg-white/10 transition-colors">
                         <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    </button>
                    <div className="flex items-center gap-3 ml-1 cursor-pointer">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-[#008069] font-bold text-lg shadow-sm border border-white/20">
                            {otherUserName.charAt(0)}
                        </div>
                        <div className="text-white">
                            <h3 className="font-bold text-base leading-tight truncate max-w-[140px]">{otherUserName}</h3>
                            <p className="text-[11px] text-white/90">
                                {isOtherOnline ? 'Online' : 'Offline'}
                                {isOtherTyping && ' • typing…'}
                            </p>
                            <p className="text-[10px] text-emerald-100/90 font-semibold mt-0.5">
                                Clinical Chat Mode
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3 text-white pr-2">
                     <button onClick={onVideoCall} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Video Call">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
                     </button>
                     <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                     </button>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth custom-scrollbar">
                <div className="flex justify-center mb-6">
                    <span className="bg-[#fff5c4] text-slate-700 text-[10px] font-medium px-3 py-1.5 rounded-lg shadow-sm text-center max-w-[85%] leading-snug">
                        🔒 Clinical chat is encrypted and stored securely for medical records. Only you and your assigned clinician can access this conversation.
                    </span>
                </div>
                
                {/* Date Divider (Static for Demo) */}
                <div className="flex justify-center mb-4">
                    <span className="bg-white/80 backdrop-blur-sm text-slate-500 text-[10px] font-bold px-3 py-1 rounded-lg shadow-sm uppercase tracking-wide">
                        Today
                    </span>
                </div>

                {loading ? (
                    <div className="flex justify-center py-8"><div className="animate-spin w-8 h-8 border-4 border-[#008069] border-t-transparent rounded-full"></div></div>
                ) : messages.length === 0 ? (
                    <div className="text-center text-slate-500 mt-20 opacity-60">
                        <p className="text-sm">Say "Hello" to start the conversation.</p>
                    </div>
                ) : (
                    messages.map((msg, index) => {
                        const isMe = msg.senderId === currentUserId;
                        const renderKey = msg.id || `${msg.timestamp}-${msg.senderId}-${index}`;
                        return (
                            <div key={renderKey} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group mb-1`}>
                                <div className={`max-w-[80%] rounded-lg px-3 py-1.5 shadow-sm relative text-sm break-words ${
                                    isMe 
                                    ? 'bg-[#d9fdd3] text-slate-900 rounded-tr-none' 
                                    : 'bg-white text-slate-900 rounded-tl-none'
                                }`}>
                                    {/* Tail SVG */}
                                    <span className={`absolute top-0 w-[8px] h-[13px] overflow-hidden ${isMe ? '-right-[8px]' : '-left-[8px]'}`}>
                                        <svg viewBox="0 0 8 13" width="8" height="13" className={`w-full h-full fill-current ${isMe ? 'text-[#d9fdd3]' : 'text-white'}`}>
                                            <path d={isMe ? "M5.188 1H0v11.193l6.467-8.625C7.526 2.156 6.958 1 5.188 1z" : "M-2.292 1H2.896v11.193l-6.467-8.625C-4.63 2.156-4.062 1-2.292 1z"} transform={isMe ? "" : "scale(-1, 1) translate(-8, 0)"} />
                                        </svg>
                                    </span>

                                    {msg.attachmentUrl && (
                                        <div className="mb-2 mt-1 rounded-lg overflow-hidden border border-black/5">
                                             {msg.attachmentType === 'image' ? (
                                                 <img src={msg.attachmentUrl} alt="Attachment" className="max-w-full max-h-60 object-cover" />
                                             ) : msg.attachmentType === 'video' ? (
                                                 <video src={msg.attachmentUrl} controls className="max-w-full max-h-60 w-full bg-black" />
                                             ) : (
                                                 <a 
                                                    href={msg.attachmentUrl} 
                                                    download
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="bg-slate-100 p-3 flex items-center gap-3 cursor-pointer hover:bg-slate-200 transition-colors no-underline group/doc"
                                                 >
                                                     <div className="bg-red-100 p-2 rounded text-red-500 group-hover/doc:bg-red-200 transition-colors">
                                                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                                                     </div>
                                                     <div className="overflow-hidden">
                                                         <p className="font-bold text-xs truncate text-slate-800">Attachment</p>
                                                         <p className="text-[10px] text-slate-500">Click to open</p>
                                                     </div>
                                                 </a>
                                             )}
                                        </div>
                                    )}
                                    
                                    <div className="flex flex-wrap items-end gap-x-2 gap-y-0 relative pr-6 min-w-[60px]">
                                        <p className="whitespace-pre-wrap leading-relaxed text-[14.2px] pt-1">{decodeMessage(msg.content)}</p>
                                        <div className="ml-auto text-[10px] text-slate-500/80 flex items-center gap-0.5 h-full mb-0.5 select-none -mr-1">
                                            {formatTime(msg.timestamp)}
                                            {isMe && (
                                                <span className={`ml-0.5 ${msg.isRead ? 'text-[#53bdeb]' : 'text-slate-400'}`}>
                                                    <svg viewBox="0 0 16 15" width="16" height="15" className="w-3.5 h-3.5 fill-current">
                                                        <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-7.655a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-7.655a.365.365 0 0 0-.063-.512z"/>
                                                    </svg>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* AI Suggestion (Doctor only) */}
            {currentUserRole === UserRole.DOCTOR && (
                <div className="bg-white/80 backdrop-blur-sm border-t border-slate-200 px-3 py-2 text-xs text-slate-700 flex items-start gap-2">
                    <div className="mt-1 text-emerald-600">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 00-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 00-7-7zm0 9.5a2.5 2.5 0 112.5-2.5A2.5 2.5 0 0112 11.5z" /></svg>
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                            <span className="font-semibold">AI Clinical Suggestion</span>
                            <button
                                type="button"
                                onClick={handleGetAISuggestion}
                                disabled={aiLoading}
                                className="text-[11px] px-2 py-0.5 rounded-full border border-emerald-500 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                            >
                                {aiLoading ? 'Thinking…' : 'Suggest Reply'}
                            </button>
                        </div>
                        <p className="text-[11px] text-slate-500 mb-1">Suggestions are drafts only. Review carefully before sending.</p>
                        {aiSuggestion && (
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-[11px] whitespace-pre-wrap mb-1 max-h-24 overflow-y-auto">
                                {aiSuggestion}
                            </div>
                        )}
                        {aiSuggestion && (
                            <button
                                type="button"
                                className="text-[11px] text-emerald-700 font-semibold mt-1"
                                onClick={() => setNewMessage(prev => prev ? prev + '\n' + aiSuggestion : aiSuggestion)}
                            >
                                Insert into message
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Input Area */}
            <div className="bg-[#F0F2F5] px-2 py-2 flex items-center gap-2 shrink-0 border-t border-slate-200">
                <div className="flex-1 bg-white rounded-[24px] px-3 py-1.5 border border-white shadow-sm flex items-center gap-2">
                    <button 
                       onClick={() => fileInputRef.current?.click()}
                       className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <svg className="w-6 h-6 rotate-45" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 0 0 5 0V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={e => e.target.files && setAttachment(e.target.files[0])} />
                    
                    <textarea
                        value={newMessage}
                        onChange={e => { setNewMessage(e.target.value); notifyTyping(true); }}
                        onBlur={() => notifyTyping(false)}
                        onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); notifyTyping(false); }}}
                        placeholder={attachment ? `Medical report: ${attachment.name}` : "Type a clinical message"}
                        className="w-full max-h-24 bg-transparent outline-none text-base resize-none custom-scrollbar py-2 placeholder-slate-400 text-slate-800"
                        rows={1}
                        style={{ minHeight: '44px' }}
                    />
                    
                    {attachment && (
                        <button onClick={() => setAttachment(null)} className="text-red-400 hover:text-red-600 p-1">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    )}

                    <button className="p-1.5 text-slate-400 hover:text-slate-600">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3z"/><path d="M17 12c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-2.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
                    </button>
                </div>
                
                <button 
                    onClick={handleSend}
                    disabled={(!newMessage.trim() && !attachment) || sending}
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-md transition-all ${
                        (!newMessage.trim() && !attachment) ? 'bg-slate-300' : 'bg-[#008069] hover:bg-[#006c59] active:scale-95'
                    }`}
                >
                    {sending ? (
                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    ) : (
                        <svg className="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                    )}
                </button>
            </div>
            {sendError && (
                <div className="px-4 pb-3 text-[11px] text-red-600 bg-[#F0F2F5] border-t border-red-100">
                    {sendError}
                </div>
            )}
        </motion.div>
    </div>
  );
};
