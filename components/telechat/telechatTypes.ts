export interface TeleUser {
  id: string;
  name: string;
}

export interface TeleChatAttachment {
  name: string;
  type: string;
  url: string;
}

export interface TeleChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  attachment?: TeleChatAttachment;
  isRead: boolean;
  translations?: Record<string, string>;
}
