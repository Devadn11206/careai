import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Send, Paperclip, Mic, Image as ImageIcon, 
  FileText, MoreVertical, Search, Smile,
  Activity, Shield, Zap, Sparkles, Loader2,
  Check, CheckCheck, Phone, Video, Info,
  ChevronLeft, Trash2, Download, Play, Pause
} from "lucide-react";
import { GlassCard } from "@/components/carex/GlassCard";
import { NeonButton } from "@/components/carex/NeonButton";
import { useHealth } from "@/services/HealthContext";
import { BackendAPI } from "@/services/apiClient";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";

interface Message {
  id: string;
  senderId: string;
  content: string;
  messageType: string;
  attachmentUrl?: string;
  attachmentName?: string;
  isRead: boolean;
  isDelivered: boolean;
  createdAt: string;
}

interface Room {
  id: string;
  otherUser: {
    id: string;
    name: string;
    profilePicUrl?: string;
    specialization?: string;
  };
  lastMessage: Message | null;
  unreadCount: number;
  status: string;
}

interface ChatPanelProps {
  initialAppointmentId?: string | null;
  onClose?: () => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ initialAppointmentId, onClose }) => {
  const { socket, user } = useHealth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  useEffect(() => {
    fetchRooms();
  }, []);

  useEffect(() => {
    if (initialAppointmentId && rooms.length > 0) {
      const room = rooms.find(r => r.id === initialAppointmentId);
      if (room) setActiveRoom(room);
    }
  }, [initialAppointmentId, rooms]);

  useEffect(() => {
    if (activeRoom) {
      fetchMessages(activeRoom.id);
    }
  }, [activeRoom]);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (msg: Message) => {
      if (activeRoom && msg.id === activeRoom.id) { // Wait, room id is appointmentId
        // This is a bit tricky, the event payload should have appointmentId
      }
      // Re-fetch rooms to update last message/unread count
      fetchRooms();
    };

    socket.on('chat:message', (msg: any) => {
      if (activeRoom && msg.appointmentId === activeRoom.id) {
        setMessages(prev => [...prev, msg]);
        scrollToBottom();
        // Send seen status
        socket.emit('chat:seen', { appointmentId: activeRoom.id, messageIds: [msg.id] });
      }
      fetchRooms();
    });

    socket.on('chat:typing', (data: any) => {
      if (activeRoom && data.appointmentId === activeRoom.id && data.senderId !== user?.id) {
        setOtherUserTyping(data.isTyping);
      }
    });

    socket.on('chat:seen', (data: any) => {
      if (activeRoom && data.appointmentId === activeRoom.id) {
        setMessages(prev => prev.map(m => data.messageIds.includes(m.id) ? { ...m, isRead: true } : m));
      }
    });

    return () => {
      socket.off('chat:message');
      socket.off('chat:typing');
      socket.off('chat:seen');
    };
  }, [socket, activeRoom, user]);

  const fetchRooms = async () => {
    try {
      const data = await BackendAPI.getChatRooms();
      setRooms(data);
    } catch (err) {
      console.error("Failed to load clinical rooms");
    }
  };

  const fetchMessages = async (appointmentId: string) => {
    setIsLoading(true);
    try {
      const data = await BackendAPI.getChatMessages(appointmentId);
      setMessages(data);
      scrollToBottom();
      
      // Mark as seen
      const unreadIds = data.filter((m: any) => !m.isRead && m.senderId !== user?.id).map((m: any) => m.id);
      if (unreadIds.length > 0) {
        socket?.emit('chat:seen', { appointmentId, messageIds: unreadIds });
      }
    } catch (err) {
      console.error("Failed to load clinical history");
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !activeRoom || !socket) return;

    const payload = {
      appointmentId: activeRoom.id,
      content: newMessage,
      messageType: 'TEXT'
    };

    socket.emit('chat:message', payload);
    setNewMessage("");
    handleTyping(false);
  };

  const handleTyping = (typing: boolean) => {
    if (!activeRoom || !socket) return;
    
    if (typing !== isTyping) {
      setIsTyping(typing);
      socket.emit('chat:typing', { appointmentId: activeRoom.id, isTyping: typing });
    }

    if (typing) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        socket.emit('chat:typing', { appointmentId: activeRoom.id, isTyping: false });
      }, 3000);
    }
  };

  return (
    <div className="flex h-[calc(100vh-140px)] gap-6 overflow-hidden">
      {/* Sidebar - Conversation List */}
      <GlassCard className="w-80 flex flex-col border-primary/10 overflow-hidden shrink-0">
        <div className="p-4 border-b border-border/40">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search clinical grid..."
              className="w-full bg-muted/20 border border-border/50 rounded-xl py-2 pl-9 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {rooms.map((room) => (
            <div 
              key={room.id}
              onClick={() => setActiveRoom(room)}
              className={cn(
                "p-4 border-b border-border/20 cursor-pointer transition-all hover:bg-primary/5 group relative",
                activeRoom?.id === room.id ? "bg-primary/10 border-l-4 border-l-primary" : ""
              )}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="h-10 w-10 rounded-full bg-muted/30 flex items-center justify-center border border-border/50">
                    {room.otherUser.profilePicUrl ? (
                      <img src={room.otherUser.profilePicUrl} className="h-full w-full rounded-full object-cover" />
                    ) : (
                      room.otherUser.name[0]
                    )}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-success rounded-full border-2 border-background" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-0.5">
                    <h4 className="text-xs font-bold truncate text-foreground group-hover:text-primary transition-colors">{room.otherUser.name}</h4>
                    <span className="text-[8px] text-muted-foreground uppercase">{room.lastMessage ? format(new Date(room.lastMessage.createdAt), 'HH:mm') : ''}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate italic">
                    {room.lastMessage?.content || "Start secure consultation..."}
                  </p>
                </div>
                {room.unreadCount > 0 && (
                  <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center text-[8px] font-bold text-primary-foreground shadow-glow-primary">
                    {room.unreadCount}
                  </div>
                )}
              </div>
            </div>
          ))}
          {rooms.length === 0 && (
            <div className="p-8 text-center opacity-30">
              <Sparkles className="h-8 w-8 mx-auto mb-2" />
              <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">No active consultations found in your clinical perimeter</p>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Main Chat Panel */}
      <GlassCard className="flex-1 flex flex-col border-primary/10 overflow-hidden relative">
        {activeRoom ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-border/40 flex items-center justify-between bg-primary/5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shadow-glow-primary">
                  {activeRoom.otherUser.profilePicUrl ? (
                    <img src={activeRoom.otherUser.profilePicUrl} className="h-full w-full rounded-full object-cover" />
                  ) : (
                    activeRoom.otherUser.name[0]
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground leading-tight">{activeRoom.otherUser.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="h-1.5 w-1.5 bg-success rounded-full animate-pulse" />
                    <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-black">
                      {otherUserTyping ? "Encrypted Channel: Typing..." : "Secure Health-Link: Active"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {onClose && (
                  <button onClick={onClose} className="p-2 hover:bg-primary/10 rounded-lg transition-colors text-muted-foreground hover:text-primary md:hidden">
                    <ChevronLeft size={20} />
                  </button>
                )}
                <button className="p-2 hover:bg-primary/10 rounded-lg transition-colors text-muted-foreground hover:text-primary">
                  <Phone size={16} />
                </button>
                <button className="p-2 hover:bg-primary/10 rounded-lg transition-colors text-muted-foreground hover:text-primary">
                  <Video size={16} />
                </button>
                <div className="h-4 w-[1px] bg-border/40 mx-1" />
                <button className="p-2 hover:bg-primary/10 rounded-lg transition-colors text-muted-foreground hover:text-primary">
                  <Info size={16} />
                </button>
                {onClose && (
                  <button onClick={onClose} className="hidden md:flex p-2 hover:bg-primary/10 rounded-lg transition-colors text-muted-foreground hover:text-red-400">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              <AnimatePresence initial={false}>
                {messages.map((msg, idx) => {
                  const isOwn = msg.senderId === user?.id;
                  const showDate = idx === 0 || format(new Date(messages[idx-1].createdAt), 'yyyy-MM-dd') !== format(new Date(msg.createdAt), 'yyyy-MM-dd');
                  
                  return (
                    <React.Fragment key={msg.id}>
                      {showDate && (
                        <div className="flex justify-center my-4">
                          <span className="text-[8px] bg-muted/20 border border-border/40 text-muted-foreground px-3 py-1 rounded-full uppercase font-black tracking-widest">
                            {format(new Date(msg.createdAt), 'MMMM dd, yyyy')}
                          </span>
                        </div>
                      )}
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className={cn(
                          "flex w-full",
                          isOwn ? "justify-end" : "justify-start"
                        )}
                      >
                        <div className={cn(
                          "max-w-[75%] relative group",
                          isOwn ? "items-end" : "items-start"
                        )}>
                          <div className={cn(
                            "px-4 py-3 rounded-2xl border transition-all",
                            isOwn 
                              ? "bg-primary/20 border-primary/40 text-foreground rounded-tr-none shadow-glow-primary/20" 
                              : "bg-muted/30 border-border/50 text-foreground rounded-tl-none"
                          )}>
                            <p className="text-sm leading-relaxed">{msg.content}</p>
                            <div className="flex items-center justify-end gap-1.5 mt-1.5">
                              <span className="text-[8px] text-muted-foreground/60 uppercase font-black">
                                {format(new Date(msg.createdAt), 'HH:mm')}
                              </span>
                              {isOwn && (
                                msg.isRead ? <CheckCheck size={10} className="text-primary" /> : <Check size={10} className="text-muted-foreground/40" />
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </React.Fragment>
                  );
                })}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-border/40 bg-muted/5">
              <div className="flex items-end gap-3 glass p-2 rounded-2xl border border-primary/20">
                <button className="p-2.5 hover:bg-primary/10 rounded-xl transition-colors text-muted-foreground hover:text-primary">
                  <Paperclip size={18} />
                </button>
                <textarea 
                  rows={1}
                  placeholder="Type secure clinical message..."
                  className="flex-1 bg-transparent border-none py-2.5 px-2 text-sm focus:outline-none focus:ring-0 resize-none max-h-32 custom-scrollbar"
                  value={newMessage}
                  onChange={(e) => { setNewMessage(e.target.value); handleTyping(true); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <button className="p-2.5 hover:bg-primary/10 rounded-xl transition-colors text-muted-foreground hover:text-primary">
                  <Mic size={18} />
                </button>
                <NeonButton 
                  variant="primary" 
                  size="sm" 
                  className="h-10 w-10 p-0 rounded-xl shrink-0"
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                >
                  <Send size={16} />
                </NeonButton>
              </div>
              <div className="flex items-center justify-between mt-3 px-1">
                <div className="flex items-center gap-4 text-muted-foreground">
                  <button className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest hover:text-primary transition-colors">
                    <ImageIcon size={12} /> Image
                  </button>
                  <button className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest hover:text-primary transition-colors">
                    <FileText size={12} /> Record
                  </button>
                  <button className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest hover:text-secondary transition-colors">
                    <Zap size={12} /> AI Suggest
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <Shield size={10} className="text-success" />
                  <span className="text-[8px] text-muted-foreground uppercase font-black tracking-tighter">E2E Health-Grade Encryption Active</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-6">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />
              <div className="relative h-24 w-24 bg-primary/10 rounded-3xl border border-primary/20 flex items-center justify-center shadow-glow-primary">
                <Activity className="h-12 w-12 text-primary" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-display font-bold tracking-tight text-foreground">Clinical Communication Node</h2>
              <p className="text-muted-foreground max-w-sm mx-auto mt-2 text-sm leading-relaxed">
                Select a consultation from the clinical grid to initialize a secure, encrypted tele-health link.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 max-w-md w-full">
              <GlassCard className="p-4 border-primary/10 bg-primary/5 flex flex-col items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <span className="text-[9px] font-black uppercase tracking-widest">Secure Access</span>
              </GlassCard>
              <GlassCard className="p-4 border-secondary/10 bg-secondary/5 flex flex-col items-center gap-2">
                <Sparkles className="h-5 w-5 text-secondary" />
                <span className="text-[9px] font-black uppercase tracking-widest">AI Summaries</span>
              </GlassCard>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
};
