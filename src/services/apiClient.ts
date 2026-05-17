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
  User,
  UserRole,
  Hospital,
  HealthcareFacility,
  BackendDoctor,
} from '../types';
export type { BackendDoctor } from '../types';

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
    hospital?: string;
    consultationFee?: number;
    phone?: string;
    address?: string;
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

  async updateProfile(data: Partial<User>): Promise<User> {
    return api<User>('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async changePassword(data: any): Promise<{ message: string }> {
    return api<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getLatestAiInsights(): Promise<any> {
    return api<any>('/api/ai-insights/latest', { method: 'GET' });
  },

  async getAiInsightsHistory(): Promise<any[]> {
    return api<any[]>('/api/ai-insights/history', { method: 'GET' });
  },

  async getMedicationAdherence(range: string = '7days'): Promise<any[]> {
    return api<any[]>(`/api/medication/adherence?range=${range}`, { method: 'GET' });
  },

  async downloadReport(range: string = '7days'): Promise<Blob> {
    const token = getToken();
    const res = await fetch(`${API_BASE}/api/report/generate?range=${range}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to generate report');
    return res.blob();
  },

  async askAi(message: string, context: any): Promise<{ reply: string; timestamp: string }> {
    return api<{ reply: string; timestamp: string }>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, patient_context: context })
    });
  },

  async aiCommand(text?: string, audioBlob?: Blob, history?: any[]): Promise<any> {
    const token = getToken();
    const formData = new FormData();
    if (audioBlob) formData.append('audio', audioBlob, 'audio.webm');
    if (text) formData.append('text', text);
    if (history) formData.append('history', JSON.stringify(history));

    const res = await fetch(`${API_BASE}/ai/command`, {
      method: 'POST',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: formData
    });

    if (!res.ok) throw new Error('Failed to process AI command');
    return res.json();
  },

  async getDoctors(params: { search?: string, specialization?: string } = {}): Promise<BackendDoctor[]> {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.specialization && params.specialization !== 'All') query.append('specialization', params.specialization);
    const path = `/doctors${query.toString() ? `?${query.toString()}` : ''}`;
    return api<BackendDoctor[]>(path, { method: 'GET' });
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
  
  async getPatientAppointments(): Promise<any[]> {
    return api<any[]>('/api/appointments/patient', { method: 'GET' });
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

  async cancelAppointment(appointmentId: string): Promise<{ success: boolean; message: string }> {
    return api<{ success: boolean; message: string }>(`/api/appointments/cancel/${appointmentId}`, {
      method: 'POST',
    });
  },

  async getDoctorSlots(doctorId: string, date: string): Promise<any[]> {
    const path = doctorId ? `/api/doctors/${doctorId}/slots?date=${date}` : `/api/doctor/slots?date=${date}`;
    return api<any[]>(path, { method: 'GET' });
  },

  async updateDoctorSchedule(input: {
    scheduleJson: string;
    slotDuration: number;
    maxPatients: number;
  }): Promise<any> {
    return api('/api/doctor/schedule', {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  async blockDoctorSlot(slotId: string, isBlocked: boolean): Promise<any> {
    return api('/api/doctor/slots/block', {
      method: 'POST',
      body: JSON.stringify({ slotId, isBlocked }),
    });
  },

  async getDoctorActivePatients(): Promise<{ count: number }> {
    return api<{ count: number }>('/api/doctor/active-patients', { method: 'GET' });
  },

  async getDoctorCriticalAlerts(): Promise<{ count: number; alerts: any[] }> {
    return api<{ count: number; alerts: any[] }>('/api/doctor/critical-alerts', { method: 'GET' });
  },

  async getDoctorAppointmentsToday(): Promise<{ count: number; appointments: any[] }> {
    return api<{ count: number; appointments: any[] }>('/api/doctor/appointments/today', { method: 'GET' });
  },

  async getDoctorPendingConsults(): Promise<{ count: number }> {
    return api<{ count: number }>('/api/doctor/pending-consults', { method: 'GET' });
  },

  async getDoctorPatientRoster(): Promise<any[]> {
    return api<any[]>('/api/doctor/patients', { method: 'GET' });
  },

  async getDoctorUpcomingSessions(): Promise<any[]> {
    return api<any[]>('/api/doctor/upcoming-sessions', { method: 'GET' });
  },

  async sendPrescription(formData: FormData): Promise<any> {
    const token = getToken();
    const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:4000';
    
    const response = await fetch(`${API_BASE}/api/prescriptions/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error);
    }
    return response.json();
  },

  async getPatientPrescriptions(): Promise<any[]> {
    return api<any[]>('/api/prescriptions/patient', { method: 'GET' });
  },

  async getDoctorPrescriptions(): Promise<any[]> {
    return api<any[]>('/api/prescriptions/doctor', { method: 'GET' });
  },

  async getMedicalRecords(): Promise<any[]> {
    return api<any[]>('/api/records', { method: 'GET' });
  },

  async uploadMedicalRecord(formData: FormData): Promise<any> {
    const token = getToken();
    const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:4000';
    
    const response = await fetch(`${API_BASE}/api/records/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error);
    }
    return response.json();
  },

  async requestRecordAccess(patientId: string): Promise<any> {
    return api('/api/records/request-access', {
      method: 'POST',
      body: JSON.stringify({ patientId })
    });
  },

  async grantRecordAccess(input: { 
    doctorId: string; 
    status: 'GRANTED' | 'REVOKED'; 
    accessType?: string; 
    durationDays?: number 
  }): Promise<any> {
    return api('/api/records/grant-access', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },

  async getPatientRecordsByDoctor(patientId: string): Promise<any[]> {
    return api<any[]>(`/api/medical-records/${patientId}`, { method: 'GET' });
  },

  async getMedicalRecordPreview(id: string): Promise<Blob> {
    const token = getToken();
    const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:4000';
    const res = await fetch(`${API_BASE}/api/records/${id}/preview`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch preview');
    return res.blob();
  },

  async downloadMedicalRecord(id: string): Promise<Blob> {
    const token = getToken();
    const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:4000';
    const res = await fetch(`${API_BASE}/api/records/${id}/download`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to download record');
    return res.blob();
  },

  async createDoctorSlots(input: {
    date: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    maxPatientsPerSlot: number;
  }): Promise<any> {
    return api('/api/doctor/slots/create', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },

  async getChatRooms(): Promise<any[]> {
    return api<any[]>('/api/chat/rooms', { method: 'GET' });
  },

  async getChatMessages(appointmentId: string): Promise<any[]> {
    return api<any[]>(`/api/appointments/${appointmentId}/chat`, { method: 'GET' });
  },

  async sendChatMessage(input: {
    appointmentId: string;
    content: string;
    messageType?: string;
    attachmentUrl?: string;
    attachmentName?: string;
    attachmentType?: string;
  }): Promise<any> {
    const { appointmentId, ...body } = input;
    // Note: The socket usually handles sending messages for real-time, 
    // but this endpoint can be used for fallback or specific actions.
    return api(`/api/appointments/${appointmentId}/chat`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  async getActiveDoctors(): Promise<any[]> {
    return api<any[]>('/api/doctors/active', { method: 'GET' });
  },

  async bookAppointment(input: {
    doctorId: string;
    slotId: string;
    reason: string;
  }): Promise<any> {
    return api('/api/appointments/book', {
      method: 'POST',
      body: JSON.stringify(input)
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

  async getAdminStats(): Promise<any> {
    return api<any>('/api/admin/stats', { method: 'GET' });
  },

  async getAdminEmergency(): Promise<any> {
    return api<any>('/api/admin/emergency', { method: 'GET' });
  },

  async getAdminAnalytics(): Promise<any> {
    return api<any>('/api/admin/analytics', { method: 'GET' });
  },

  async getAdminDoctorsList(): Promise<any[]> {
    return api<any[]>('/api/admin/doctors', { method: 'GET' });
  },

  async performAdminDoctorAction(id: string, action: 'VERIFY' | 'REJECT' | 'SUSPEND', reason?: string): Promise<any> {
    return api(`/api/admin/doctors/${id}/action`, {
      method: 'POST',
      body: JSON.stringify({ action, reason })
    });
  },

  async getAdminHospitals(): Promise<any[]> {
    return api<any[]>('/api/admin/hospitals', { method: 'GET' });
  },

  async getAdminLogs(): Promise<any[]> {
    return api<any[]>('/api/admin/logs', { method: 'GET' });
  },

  async getAdminHealth(): Promise<any[]> {
    return api<any[]>('/api/admin/health', { method: 'GET' });
  },

  async sendAiMessage(message: string): Promise<{ response: string }> {
    return api<{ response: string }>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  async getNearbyHospitals(lat: number, lng: number, radius?: number): Promise<Hospital[]> {
    return api<Hospital[]>(`/api/hospitals/nearby?lat=${lat}&lng=${lng}&radius=${radius || 50}`, { method: 'GET' });
  },

  async getNearbyDoctors(lat: number, lng: number, radius?: number): Promise<BackendDoctor[]> {
    return api<BackendDoctor[]>(`/api/doctors/nearby?lat=${lat}&lng=${lng}&radius=${radius || 50}`, { method: 'GET' });
  },

  async getNearbyFacilities(lat: number, lng: number, radius?: number, type?: string): Promise<HealthcareFacility[]> {
    const typeQuery = type ? `&type=${type}` : '';
    return api<HealthcareFacility[]>(`/api/facilities/nearby?lat=${lat}&lng=${lng}&radius=${radius || 20}${typeQuery}`, { method: 'GET' });
  },

  async getAICareRecommendation(params: { symptoms: string, vitals?: any, lat: number, lng: number }): Promise<{
    recommendation: string;
    bestHospital: Hospital;
    department: string;
    urgency: 'HIGH' | 'NORMAL';
  }> {
    return api('/api/ai/recommend-care', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  },

  async addHospital(data: any): Promise<Hospital> {
    return api<Hospital>('/api/admin/hospitals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async verifyDoctor(id: string, input: { status: string; reason?: string }): Promise<any> {
    return api(`/api/admin/doctors/${id}/verify`, {
      method: 'PATCH',
      body: JSON.stringify(input)
    });
  },

  async uploadDoctorDocument(input: {
    type: string;
    title: string;
    fileUrl: string;
    fileName?: string;
    fileType?: string;
  }): Promise<any> {
    return api('/api/doctor/documents/upload', {
      method: 'POST',
      body: JSON.stringify(input)
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

  async getPresence(userId: string): Promise<{ userId: string; online: boolean }> {
    return api<{ userId: string; online: boolean }>(`/presence/${encodeURIComponent(userId)}`, { method: 'GET' });
  },

  async getAgoraToken(input: { channelName: string; uid: number; appointmentId: string }): Promise<{ token: string }> {
    return api<{ token: string }>('/agora-token', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async generateConsultationSummary(input: { appointmentId: string; transcript: string }): Promise<ConsultationSummary> {
    return api<ConsultationSummary>('/consultation/summarize', {
      method: 'POST',
      body: JSON.stringify(input),
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

  onAppointmentConfirmed(handler: (data: any) => void): () => void {
    const s = ensureSocket();
    if (!s) return () => { };
    s.on('appointment:confirmed', handler);
    return () => {
      s.off('appointment:confirmed', handler);
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

  onSlotCreated(handler: (data: any) => void): () => void {
    const s = ensureSocket();
    if (!s) return () => { };
    s.on('slot:created', handler);
    return () => {
      s.off('slot:created', handler);
    };
  },

  async endCall(appointmentId: string): Promise<{ success: boolean; appointment: Appointment }> {
    return api<{ success: boolean; appointment: Appointment }>(`/api/appointments/end-call/${appointmentId}`, {
      method: 'POST',
    });
  },

  async validateCall(appointmentId: string): Promise<{ allowed: boolean; message?: string; roomId?: string }> {
    const params = new URLSearchParams({ appointmentId });
    return api<{ allowed: boolean; message?: string; roomId?: string }>(`/api/appointments/validate-call?${params.toString()}`, {
      method: 'GET',
    });
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

  onAppointmentReminder(handler: (payload: { 
    appointmentId: string; 
    title: string; 
    message: string; 
    doctorName: string; 
    patientName: string; 
    startTime: string; 
    type: string 
  }) => void): () => void {
    const s = ensureSocket();
    if (!s) return () => { };
    s.on('appointment:reminder', handler);
    return () => {
      s.off('appointment:reminder', handler);
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
  async getPatientHistory(): Promise<any[]> {
    return api<any[]>('/api/appointments/patient/history');
  },

  async get(path: string): Promise<any> {
    return api<any>(path, { method: 'GET' });
  },

  async post(path: string, body: any): Promise<any> {
    return api<any>(path, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  onEmergencyAlert(handler: (data: { alert: RiskAlert }) => void): () => void {
    const s = ensureSocket();
    if (!s) return () => { };
    s.on('emergency:alert', handler);
    return () => {
      s.off('emergency:alert', handler);
    };
  }
};

