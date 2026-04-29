import { io, Socket } from 'socket.io-client';
import {
  AIAnalysisResult,
  Appointment,
  ChatMessage,
  ConsultationSummary,
  DoctorStatus,
  HealthMetrics,
  Medication,
  MedicationMissedDoseAlert,
  PresenceUpdate,
  TimeSlot,
  TypingEvent,
  UserRole,
} from '../types';

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
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    timeout: 10000,
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
  profilePicUrl?: string | null;
  status?: DoctorStatus | null;
}

interface LoginResponse {
  token?: string | null;
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
  verificationDocumentUrl?: string;
  verificationDocumentName?: string;
  rating?: number;
  status?: DoctorStatus;
  hasSchedule?: boolean;
  totalSlots?: number;
  openSlots?: number;
}

export interface AppointmentAutoSharePayload {
  currentVitals?: {
    systolicBP?: number;
    diastolicBP?: number;
    glucose?: number;
    bmi?: number;
    cholesterol?: number;
    timestamp?: string;
  };
  vitalsTrend?: Array<{
    timestamp?: string;
    systolicBP?: number;
    diastolicBP?: number;
    glucose?: number;
    bmi?: number;
    cholesterol?: number;
  }>;
  history?: Array<{
    timestamp?: string;
    systolicBP?: number;
    diastolicBP?: number;
    glucose?: number;
    bmi?: number;
    cholesterol?: number;
    diabetesRisk?: number;
    hypertensionRisk?: number;
    heartDiseaseRisk?: number;
  }>;
  healthPassport?: {
    generatedDate?: string;
    bloodGroup?: string;
    clinicalSummary?: string;
  };
  riskSummary?: {
    diabetesRisk?: number;
    hypertensionRisk?: number;
    heartDiseaseRisk?: number;
  };
  aiAnalysis?: {
    diabetesRisk?: number;
    hypertensionRisk?: number;
    heartDiseaseRisk?: number;
    explanation?: string;
    confidenceLevel?: string;
    keyFactors?: string[];
    lifestyleRecommendations?: string[];
    predictions?: Array<{
      condition?: string;
      probability?: number;
      riskLevel?: string;
    }>;
  };
  medications?: Array<{
    id?: string;
    name?: string;
    dosage?: string;
    time?: string;
    instructions?: string;
    frequency?: string;
    times?: string[];
    startDate?: string;
    endDate?: string;
    durationDays?: number;
    active?: boolean;
  }>;
  patientProfile?: {
    patientId?: string;
    name?: string;
    age?: number;
    gender?: string;
    bloodGroup?: string;
    preferredLanguage?: string;
    emergencyContact?: {
      name?: string;
      relationship?: string;
      phone?: string;
    };
  };
  documents?: Array<{
    name?: string;
    type?: string;
    date?: string;
    url?: string;
    category?: string;
  }>;
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
    verificationDocumentUrl?: string;
    verificationDocumentName?: string;
  }): Promise<LoginResponse> {
    const result = await api<LoginResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (result.token) {
      setToken(result.token);
      ensureSocket();
    } else {
      setToken(null);
    }
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

  async updateProfilePic(profilePicUrl: string): Promise<LoginResponseUser> {
    return api<LoginResponseUser>('/auth/profile-pic', {
      method: 'PATCH',
      body: JSON.stringify({ profilePicUrl }),
    });
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
    autoShare?: AppointmentAutoSharePayload;
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
    attachmentType?: 'image' | 'pdf' | 'video' | 'file';
  }): Promise<ChatMessage> {
    const { appointmentId, ...body } = input;
    return api<ChatMessage>(`/appointments/${appointmentId}/chat`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async getPresence(userId: string): Promise<{ userId: string; online: boolean }> {
    return api<{ userId: string; online: boolean }>(`/presence/${encodeURIComponent(userId)}`, { method: 'GET' });
  },

  async getAgoraToken(input: { channelName: string; uid: number }): Promise<{ token: string }> {
    return api<{ token: string }>('/agora-token', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async generateConsultationSummary(input: { appointmentId: string; transcript: string }): Promise<ConsultationSummary> {
    const { appointmentId, transcript } = input;
    return api<ConsultationSummary>(`/appointments/${appointmentId}/ai-summary`, {
      method: 'POST',
      body: JSON.stringify({ transcript }),
    });
  },

  async getAppointmentConsultationSummaries(appointmentId: string): Promise<ConsultationSummary[]> {
    return api<ConsultationSummary[]>(`/appointments/${appointmentId}/ai-summaries`, { method: 'GET' });
  },

  async getPatientConsultationSummaries(patientId: string, limit = 10): Promise<ConsultationSummary[]> {
    return api<ConsultationSummary[]>(`/patients/${encodeURIComponent(patientId)}/ai-summaries?limit=${encodeURIComponent(String(limit))}`, {
      method: 'GET',
    });
  },

  async getMedicationOrders(input: { patientId?: string; active?: 'true' | 'false' }): Promise<Medication[]> {
    const params = new URLSearchParams();
    if (input.patientId) params.set('patientId', input.patientId);
    if (input.active) params.set('active', input.active);
    const query = params.toString();
    return api<Medication[]>(`/medications${query ? `?${query}` : ''}`, { method: 'GET' });
  },

  async createMedicationOrder(input: {
    patientId: string;
    name: string;
    dosage: string;
    frequency?: 'ONCE_DAILY' | 'TWICE_DAILY' | 'THRICE_DAILY' | 'CUSTOM';
    times?: string[];
    startDate?: string;
    durationDays?: number;
    instructions?: string;
  }): Promise<Medication> {
    return api<Medication>('/medications', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async deleteMedicationOrder(medicationId: string): Promise<void> {
    await api<void>(`/medications/${encodeURIComponent(medicationId)}`, {
      method: 'DELETE',
    });
  },

  async getDoctorMedicationAlerts(): Promise<MedicationMissedDoseAlert[]> {
    return api<MedicationMissedDoseAlert[]>('/doctor/medication-alerts', { method: 'GET' });
  },

  async acknowledgeDoctorMedicationAlert(alertId: string): Promise<void> {
    await api<void>(`/doctor/medication-alerts/${encodeURIComponent(alertId)}/ack`, {
      method: 'PATCH',
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

  onPresenceUpdate(handler: (event: PresenceUpdate) => void): () => void {
    const s = ensureSocket();
    if (!s) return () => { };
    s.on('presence:update', handler);
    return () => {
      s.off('presence:update', handler);
    };
  },

  onTyping(handler: (event: TypingEvent) => void): () => void {
    const s = ensureSocket();
    if (!s) return () => { };
    s.on('chat:typing', handler);
    return () => {
      s.off('chat:typing', handler);
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

  onChatEmergency(handler: (alert: { doctorId: string; messageId: string; keywords: string[] }) => void): () => void {
    const s = ensureSocket();
    if (!s) return () => { };
    s.on('chat:emergency', handler as any);
    return () => {
      s.off('chat:emergency', handler as any);
    };
  },
};
