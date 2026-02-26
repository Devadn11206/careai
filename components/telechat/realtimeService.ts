import type { TeleChatMessage } from './telechatTypes';

type EventHandler = (data: any) => void;

class TeleRealtimeService {
  private listeners: Map<string, EventHandler[]> = new Map();
  private isConnected = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    if (!this.isConnected) {
      this.connect();
    }
  }

  connect() {
    setTimeout(() => {
      this.isConnected = true;
      this.emit('status_change', 'connected');
    }, 800);
  }

  disconnect() {
    this.isConnected = false;
    this.emit('status_change', 'disconnected');
  }

  on(event: string, handler: EventHandler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }

  off(event: string, handler: EventHandler) {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    this.listeners.set(event, handlers.filter((h) => h !== handler));
  }

  private emit(event: string, data: any) {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    handlers.forEach((h) => h(data));
  }

  sendMessage(_message: TeleChatMessage) {
    // Simulated doctor response for now
    setTimeout(() => {
      this.emit('read_receipt', { timestamp: Date.now() });
    }, 1000);

    setTimeout(() => {
      this.emit('typing', { senderId: 'doctor', isTyping: true });
    }, 1500);

    setTimeout(() => {
      this.emit('typing', { senderId: 'doctor', isTyping: false });
      const response: TeleChatMessage = {
        id: Date.now().toString(),
        senderId: 'doctor',
        senderName: 'Doctor',
        text: "I've received your message. We will discuss this in detail during the consultation.",
        timestamp: Date.now(),
        isRead: false,
      };
      this.emit('message', response);
    }, 3500);
  }

  sendTyping(_isTyping: boolean) {
    // No-op in simulation; in real app this would inform backend
  }

  async sendFile(file: File): Promise<string> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const url = URL.createObjectURL(file);
        resolve(url);
      }, 1200);
    });
  }
}

export const teleRealtimeService = new TeleRealtimeService();
