import { io, Socket } from 'socket.io-client';
import { AIAnalysisResult, Appointment, ChatMessage, DoctorStatus, HealthMetrics, TimeSlot, UserRole } from '../types';

const API_BASE = (import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:4000';
// Warn if a production build accidentally points to localhost
if (typeof window !== 'undefined' && (import.meta as any).env?.PROD && /localhost|127\.0\.0\.1/.test(API_BASE)) {
  console.warn('[CareXAI] VITE_API_BASE_URL is pointing to localhost in production. Set it to your deployed backend URL.');
}
const TOKEN_KEY = 'carexai_token';

let socket: Socket | null = null;
let currentToken: string | null = null;

const getStoredToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
};

export const setToken = (token: string | null) => {
  currentToken = token;
  if (typeof window !== 'undefined') {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }

  if (socket) {
    if (token) {
      socket.auth = { token };
      if (!socket.connected) socket.connect();
    } else {
      socket.disconnect();
    }
  }
};

export const getToken = (): string | null => {
  if (currentToken) return currentToken;
  currentToken = getStoredToken();
  return currentToken;
};

const ensureSocket = (): Socket | null => {
  const token = getToken();
  if (!token) return null;
  if (socket) return socket;

  socket = io(API_BASE, {
    auth: { token },
    autoConnect: true,
    transports: ['websocket'],
  });

  return socket;
};

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) (headers as any)['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data && (data as any).error) || `Request failed with status ${res.status}`);
  }
  return data as T;
}

export interface LoginResponseUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface LoginResponse {
  token: string;
  user: LoginResponseUser;
}

export interface QueueUpdate {
  appointmentId: string;
  doctorId: string;
  date: string;
  tokenNumber?: number | null;
  ahead: number;
  delayMinutes: number;
  status: Appointment['status'];
}

export interface BackendDoctor {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  specialization?: string;
  experienceYears?: number;
  qualification?: string;
  registrationNumber?: string;
  medicalCouncil?: string;
  rating?: number;
  status?: DoctorStatus;
  hasSchedule?: boolean;
  totalSlots?: number;
  openSlots?: number;
}

export const BackendAPI = {
  async register(input: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    specialization?: string;
    qualification?: string;
    registrationNumber?: string;
    medicalCouncil?: string;
    experienceYears?: number;
  }): Promise<LoginResponse> {
    const result = await api<LoginResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    setToken(result.token);
    ensureSocket();
    return result;
  },

  async login(email: string, password: string): Promise<LoginResponse> {
    const result = await api<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(result.token);
    ensureSocket();
    return result;
  },

  async getCurrentUser(): Promise<LoginResponseUser> {
    return api<LoginResponseUser>('/auth/me', { method: 'GET' });
  },

  async getDoctors(): Promise<BackendDoctor[]> {
    return api<BackendDoctor[]>('/doctors', { method: 'GET' });
  },

  async updateDoctorStatus(input: { doctorId: string; status: DoctorStatus }): Promise<BackendDoctor> {
    const { doctorId, status } = input;
    return api<BackendDoctor>(`/admin/doctors/${doctorId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  async updateDoctorProfile(input: {
    specialization?: string;
    qualification?: string;
    registrationNumber?: string;
    medicalCouncil?: string;
    experienceYears?: number;
  }): Promise<BackendDoctor> {
    return api<BackendDoctor>('/doctors/me', {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  async getAppointments(): Promise<Appointment[]> {
    return api<Appointment[]>('/appointments', { method: 'GET' });
  },

  async createAppointment(input: {
    doctorId: string;
    date: string;
    time: string;
    type: string;
    consultationType: 'VIDEO' | 'IN_PERSON';
    slotId?: string;
    symptoms?: string;
  }): Promise<Appointment> {
    return api<Appointment>('/appointments', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async updateAppointmentNotes(input: { appointmentId: string; notes: string }): Promise<Appointment> {
    const { appointmentId, notes } = input;
    return api<Appointment>(`/appointments/${appointmentId}/notes`, {
      method: 'PATCH',
      body: JSON.stringify({ notes }),
    });
  },

  async updateAppointmentStatus(input: { appointmentId: string; status: Appointment['status'] }): Promise<Appointment> {
    const { appointmentId, status } = input;
    return api<Appointment>(`/appointments/${appointmentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  async getDoctorSlots(doctorId: string, date: string): Promise<TimeSlot[]> {
    const params = new URLSearchParams({ date });
    return api<TimeSlot[]>(`/doctors/${doctorId}/slots?${params.toString()}`, { method: 'GET' });
  },

  async updateDoctorSchedule(input: {
    schedule: any[];
    slotDuration: number;
    maxPatients: number;
  }): Promise<{ doctorId: string; schedule: any[]; slotDuration: number; maxPatients: number }> {
    return api('/doctor/schedule', {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  async toggleSlotBlock(slotId: string, blocked: boolean) {
    return api(`/slots/${slotId}/block`, {
      method: 'PATCH',
      body: JSON.stringify({ blocked }),
    });
  },

  async getMyMetrics(patientId?: string): Promise<HealthMetrics[]> {
    const query = patientId ? `?patientId=${encodeURIComponent(patientId)}` : '';
    return api<HealthMetrics[]>(`/metrics${query}`, { method: 'GET' });
  },

  async saveMyMetrics(metrics: HealthMetrics & { [key: string]: any }): Promise<void> {
    await api('/metrics', {
      method: 'POST',
      body: JSON.stringify(metrics),
    });
  },

  async analyzeHealthRisk(input: {
    metrics: HealthMetrics;
    age: number;
    gender: string;
  }): Promise<AIAnalysisResult> {
    return api<AIAnalysisResult>('/ai/health-risk', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async getChatMessages(appointmentId: string): Promise<ChatMessage[]> {
    return api<ChatMessage[]>(`/appointments/${appointmentId}/chat`, { method: 'GET' });
  },

  async sendChatMessage(input: {
    appointmentId: string;
    content: string;
    attachmentUrl?: string;
    attachmentType?: 'image' | 'pdf';
  }): Promise<ChatMessage> {
    const { appointmentId, ...body } = input;
    return api<ChatMessage>(`/appointments/${appointmentId}/chat`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  getSocket(): Socket | null {
    return ensureSocket();
  },

  onAppointmentCreated(handler: (appt: Appointment) => void): () => void {
    const s = ensureSocket();
    if (!s) return () => { };
    s.on('appointment:created', handler);
    return () => {
      s.off('appointment:created', handler);
    };
  },

  onAppointmentUpdated(handler: (appt: Appointment) => void): () => void {
    const s = ensureSocket();
    if (!s) return () => { };
    s.on('appointment:updated', handler);
    return () => {
      s.off('appointment:updated', handler);
    };
  },

  onSlotUpdated(handler: (slot: TimeSlot) => void): () => void {
    const s = ensureSocket();
    if (!s) return () => { };
    s.on('slot:updated', handler);
    return () => {
      s.off('slot:updated', handler);
    };
  },

  onChatMessage(handler: (msg: ChatMessage) => void): () => void {
    const s = ensureSocket();
    if (!s) return () => { };
    s.on('chat:message', handler);
    return () => {
      s.off('chat:message', handler);
    };
  },

  onDoctorUpdated(handler: (doctor: BackendDoctor) => void): () => void {
    const s = ensureSocket();
    if (!s) return () => { };
    s.on('doctor:updated', handler);
    return () => {
      s.off('doctor:updated', handler);
    };
  },

  onQueueUpdate(handler: (payload: QueueUpdate) => void): () => void {
    const s = ensureSocket();
    if (!s) return () => { };
    s.on('queue:update', handler);
    return () => {
      s.off('queue:update', handler);
    };
  },
};
