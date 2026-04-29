
import { User, UserRole, DoctorProfile, DoctorStatus, HealthMetrics, AIAnalysisResult, PatientProfile, Document, AdminDocument, DoctorNote, DaySchedule, LabRequest, RiskAlert, AlertSeverity, AlertStatus, Appointment, DoctorAnalytics, FamilyMember, ChatMessage, AuditLog, SystemConfig, AdminStats, Medication, MedicationAdherenceRecord, MedicationDoseScheduleItem, MedicationDoseStatus, MedicationFrequency, MedicationMissedDoseAlert, SystemNotification, TimeSlot, HealthPassportData } from '../types';

// --- INITIAL SEED DATA ---
const getDefaultSchedule = (): DaySchedule[] => [
  { day: 'Mon', available: true, startTime: '09:00', endTime: '17:00' },
  { day: 'Tue', available: true, startTime: '09:00', endTime: '17:00' },
  { day: 'Wed', available: true, startTime: '09:00', endTime: '17:00' },
  { day: 'Thu', available: true, startTime: '09:00', endTime: '17:00' },
  { day: 'Fri', available: true, startTime: '09:00', endTime: '17:00' },
  { day: 'Sat', available: false, startTime: '10:00', endTime: '14:00' },
  { day: 'Sun', available: false, startTime: '10:00', endTime: '14:00' },
];

const SEED_CREDENTIALS: Record<string, string> = {
  'ddnandu3@gmail.com': '123456' // Owner Admin Credentials
};

const SEED_PATIENTS: PatientProfile[] = [];

const SEED_DOCTORS: DoctorProfile[] = [];

const SEED_FAMILY: Record<string, FamilyMember[]> = {};

const SEED_MEDICATIONS: Medication[] = [];

const MOCK_ADMIN: User = { id: 'a1', name: 'Super Admin', email: 'ddnandu3@gmail.com', role: UserRole.ADMIN };

const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
    bpThreshold: 140,
    glucoseThreshold: 180,
    maintenanceMode: false,
    allowNewRegistrations: true
};

// --- LOCAL STORAGE HELPERS ---
const KEYS = {
  CREDENTIALS: 'carexai_credentials',
  PATIENTS: 'carexai_patients',
  DOCTORS: 'carexai_doctors',
  HISTORY: 'carexai_history',
  DOCUMENTS: 'carexai_documents',
  NOTES: 'carexai_notes',
  LAB_REQUESTS: 'carexai_lab_requests',
  ALERTS: 'carexai_alerts',
  APPOINTMENTS: 'carexai_appointments',
  SLOTS: 'carexai_slots', // Stores persistence for slot counts/blocks
  ANALYTICS_TRENDS: 'carexai_analytics_trends',
  CHAT_MESSAGES: 'carexai_chat_messages',
  AUDIT_LOGS: 'carexai_audit_logs', 
  SYSTEM_CONFIG: 'carexai_system_config',
  MEDICATIONS: 'carexai_medications',
  MED_ADHERENCE: 'carexai_med_adherence',
  MED_ALERTS: 'carexai_med_alerts',
  SYSTEM_NOTIFICATIONS: 'carexai_system_notifications',
  HEALTH_PASSPORTS: 'carexai_health_passports',
  EMERGENCY_ALERTS: 'carexai_emergency_alerts',
  SMS_LOG: 'carexai_sms_log'
};

const toIsoLocal = (date: string, time: string): string => {
  // date: YYYY-MM-DD, time: HH:MM (local)
  const d = new Date(`${date}T${time}:00`);
  return d.toISOString();
};

const addDays = (date: string, days: number): string => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const isDateInRange = (date: string, start?: string, end?: string): boolean => {
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
};

const defaultTimesForFrequency = (freq: MedicationFrequency): string[] => {
  switch (freq) {
    case 'ONCE_DAILY':
      return ['08:00'];
    case 'TWICE_DAILY':
      return ['08:00', '20:00'];
    case 'THRICE_DAILY':
      return ['08:00', '14:00', '20:00'];
    case 'CUSTOM':
    default:
      return ['08:00'];
  }
};

const normalizeMedicationTimes = (med: Medication): string[] => {
  const times = (med.times || []).filter(Boolean);
  if (times.length > 0) return times;

  // Legacy time-of-day mapping
  const legacy = (med.time || '').toLowerCase();
  if (legacy.includes('morning')) return ['08:00'];
  if (legacy.includes('afternoon')) return ['14:00'];
  if (legacy.includes('evening')) return ['18:00'];
  if (legacy.includes('night')) return ['20:00'];

  return defaultTimesForFrequency(med.frequency || 'ONCE_DAILY');
};

const buildDoseId = (medId: string, date: string, time: string) => `${medId}_${date}_${time}`;

const getAdherenceMap = (patientId: string): Record<string, MedicationAdherenceRecord> => {
  const all = getStored<Record<string, MedicationAdherenceRecord[]>>(KEYS.MED_ADHERENCE, {});
  const records = all[patientId] || [];
  const map: Record<string, MedicationAdherenceRecord> = {};
  for (const r of records) map[r.doseId] = r;
  return map;
};

const upsertAdherenceRecord = (record: MedicationAdherenceRecord) => {
  const all = getStored<Record<string, MedicationAdherenceRecord[]>>(KEYS.MED_ADHERENCE, {});
  const list = all[record.patientId] || [];
  const idx = list.findIndex(r => r.doseId === record.doseId);
  if (idx >= 0) list[idx] = record;
  else list.push(record);
  all[record.patientId] = list;
  setStored(KEYS.MED_ADHERENCE, all);
};

const pushMissedDoseAlert = (alert: MedicationMissedDoseAlert) => {
  const alertsByDoctor = getStored<Record<string, MedicationMissedDoseAlert[]>>(KEYS.MED_ALERTS, {});
  const list = alertsByDoctor[alert.doctorId] || [];
  // de-dupe by doseId
  const exists = list.some(a => a.doseId === alert.doseId);
  if (!exists) {
    list.unshift(alert);
    alertsByDoctor[alert.doctorId] = list;
    setStored(KEYS.MED_ALERTS, alertsByDoctor);
  }
};

const getStored = <T>(key: string, seed: T): T => {
  try {
    const item = localStorage.getItem(key);
    if (item) return JSON.parse(item);
    localStorage.setItem(key, JSON.stringify(seed));
    return seed;
  } catch (e) {
    return seed;
  }
};

const setStored = (key: string, value: any) => {
  localStorage.setItem(key, JSON.stringify(value));
  notifyListeners(); // Trigger real-time updates
};

// --- EVENT BUS FOR REAL-TIME UPDATES ---
type Listener = () => void;
const listeners: Listener[] = [];

const notifyListeners = () => {
  listeners.forEach(l => l());
};

// Enable cross-tab synchronization
if (typeof window !== 'undefined') {
    window.addEventListener('storage', () => {
        // When local storage changes in another tab, trigger updates in this tab
        notifyListeners();
    });
}

// --- INTERNAL HELPERS ---
const generateSlotId = (doctorId: string, date: string, time: string) => `${doctorId}_${date}_${time}`;

const calculateRiskScore = (metrics: HealthMetrics) => {
  // (Existing logic kept for brevity, works as is)
  let score = 0;
  const factors = [];
  let ckdRisk: 'Low'|'Medium'|'High' = 'Low';
  let thyroidStatus: 'Hypo'|'Hyper'|'Normal' = 'Normal';
  let strokeRiskScore = 10;

  if (metrics.systolicBP > 180) { score += 50; factors.push('Hypertensive Crisis'); }
  else if (metrics.systolicBP > 140) { score += 20; factors.push('Hypertension Stage 2'); }
  
  if (metrics.glucose > 250) { score += 40; factors.push('Severe Hyperglycemia'); }
  else if (metrics.glucose > 180) { score += 20; factors.push('Elevated Glucose'); }

  if (metrics.bmi > 35) { score += 15; factors.push('Obesity Class II'); }

  if (metrics.serumCreatinine && metrics.serumCreatinine > 1.4) ckdRisk = 'High';
  else if (metrics.serumCreatinine && metrics.serumCreatinine > 1.2) ckdRisk = 'Medium';

  if (metrics.tshLevel) {
      if (metrics.tshLevel > 4.5) thyroidStatus = 'Hypo';
      else if (metrics.tshLevel < 0.4) thyroidStatus = 'Hyper';
  }

  score = Math.min(score, 100);
  return { score, factors, ckdRisk, thyroidStatus, strokeRiskScore };
};

const evaluateHealthRisk = (patient: PatientProfile, metrics: HealthMetrics, alerts: RiskAlert[]) => {
    const { score, factors, ckdRisk, thyroidStatus, strokeRiskScore } = calculateRiskScore(metrics);
    // Explicitly type severity to allow checking against all Enum values without TS error
    let severity: AlertSeverity = AlertSeverity.LOW;
    let riskStatus: 'STABLE' | 'WATCH' | 'CRITICAL' = 'STABLE';
    
    if (score >= 80) { severity = AlertSeverity.CRITICAL; riskStatus = 'CRITICAL'; }
    else if (score >= 60) { severity = AlertSeverity.HIGH; riskStatus = 'WATCH'; }
    else if (score >= 40) { severity = AlertSeverity.MEDIUM; riskStatus = 'WATCH'; }
    
    let patientUpdated = false;
    if (patient.riskStatus !== riskStatus) {
        patient.riskStatus = riskStatus;
        patientUpdated = true;
    }

    let alertGenerated = false;
    if (severity === AlertSeverity.CRITICAL || severity === AlertSeverity.HIGH) {
        const hasRecentAlert = alerts.some(a => 
            a.patientId === patient.id && 
            a.status !== AlertStatus.RESOLVED && 
            new Date(a.timestamp).getTime() > Date.now() - 60000
        );
        if (!hasRecentAlert && patient.assignedDoctorId) {
            alerts.unshift({
                id: Math.random().toString(36).substring(7),
                patientId: patient.id,
                patientName: patient.name,
                doctorId: patient.assignedDoctorId,
                riskScore: score,
                severity,
                message: `Patient ${patient.name} detected with high risk vitals.`,
                keyFactors: factors,
                timestamp: new Date().toISOString(),
                status: AlertStatus.NEW
            });
            alertGenerated = true;
        }
    }
    
    return { patientUpdated, alertGenerated, riskData: { diabetesRisk: score * 0.8, hypertensionRisk: score * 0.9, heartDiseaseRisk: score, ckdRisk, strokeRiskScore, thyroidStatus } };
};

// --- BACKEND SERVICE ---
export const MockBackend = {
  subscribe: (callback: Listener) => {
    listeners.push(callback);
    return () => {
      const idx = listeners.indexOf(callback);
      if (idx > -1) listeners.splice(idx, 1);
    };
  },

  login: async (email: string, password: string): Promise<User | DoctorProfile | PatientProfile | null> => {
    await new Promise(r => setTimeout(r, 100));
    const credentials = getStored(KEYS.CREDENTIALS, SEED_CREDENTIALS);
    if (!credentials[email] || credentials[email] !== password) return null;
    if (email === 'ddnandu3@gmail.com') return MOCK_ADMIN;
    
    const doctors = getStored(KEYS.DOCTORS, SEED_DOCTORS);
    const doc = doctors.find(d => d.email === email);
    if (doc && !doc.isBlocked) return doc;

    const patients = getStored(KEYS.PATIENTS, SEED_PATIENTS);
    const pat = patients.find(p => p.email === email);
    if (pat && !pat.isBlocked) return pat;
    return null;
  },

  getUser: async (id: string): Promise<DoctorProfile | PatientProfile | null> => {
      const doctors = getStored<DoctorProfile[]>(KEYS.DOCTORS, SEED_DOCTORS);
      const doc = doctors.find(d => d.id === id);
      if (doc) return doc;

      const patients = getStored<PatientProfile[]>(KEYS.PATIENTS, SEED_PATIENTS);
      const pat = patients.find(p => p.id === id);
      if (pat) return pat;

      return null;
  },

  registerPatient: async (name: string, email: string, password: string, age: number, gender: 'Male' | 'Female' | 'Other', bloodGroup?: string): Promise<PatientProfile> => {
    const credentials = getStored(KEYS.CREDENTIALS, SEED_CREDENTIALS);
    if (credentials[email]) throw new Error("Email already registered.");
    const newPatient: PatientProfile = { id: `p${Date.now()}`, name, email, role: UserRole.PATIENT, age, gender, bloodGroup, riskStatus: 'STABLE', lastVisit: 'Just now', isBlocked: false, sharedWithDoctors: [] };
    const patients = getStored(KEYS.PATIENTS, SEED_PATIENTS);
    patients.push(newPatient);
    setStored(KEYS.PATIENTS, patients);
    credentials[email] = password;
    setStored(KEYS.CREDENTIALS, credentials);
    return newPatient;
  },

  registerDoctor: async (name: string, email: string, password: string, specialization: string, qualification: string, registrationNumber: string, experienceYears: number, medicalCouncil: string, documentFile?: File): Promise<DoctorProfile> => {
    const credentials = getStored(KEYS.CREDENTIALS, SEED_CREDENTIALS);
    if (credentials[email]) throw new Error("Email already registered.");
    let docUrl = documentFile ? URL.createObjectURL(documentFile) : '';
    const newDoctor: DoctorProfile = {
      id: `d${Date.now()}`, name, email, role: UserRole.DOCTOR, specialization, qualification, registrationNumber, experienceYears, medicalCouncil, verificationDocumentUrl: docUrl,
      status: DoctorStatus.PENDING, bio: '', schedule: getDefaultSchedule(), slotDuration: 30, defaultMaxPatients: 1, isBlocked: false
    };
    const doctors = getStored(KEYS.DOCTORS, SEED_DOCTORS);
    doctors.push(newDoctor);
    setStored(KEYS.DOCTORS, doctors);
    credentials[email] = password;
    setStored(KEYS.CREDENTIALS, credentials);
    return newDoctor;
  },

  // --- NEW SYMPTOM SCREENING LOGIC ---
  saveSymptomScreening: async (patientId: string, answers: Record<string, number>): Promise<PatientProfile> => {
    const patients = getStored<PatientProfile[]>(KEYS.PATIENTS, SEED_PATIENTS);
    let index = patients.findIndex(p => p.id === patientId);
    
    if (index === -1) {
        // Auto-create to support demo mode for users registered on real backend
        const newP: PatientProfile = {
            id: patientId,
            name: "CareXAI Patient",
            email: "demo@carex.ai",
            role: UserRole.PATIENT,
            age: 0,
            gender: 'Other',
        };
        patients.push(newP);
        index = patients.length - 1;
    }

    const patient = patients[index];

    // Weights & Logic
    let bpScore = 0;
    bpScore += (answers['bp_headaches'] || 0) * 1.0;
    bpScore += (answers['bp_dizziness'] || 0) * 1.2;
    bpScore += (answers['bp_chest'] || 0) * 2.0;
    bpScore += (answers['bp_history'] || 0) * 2.5;

    let glucoseScore = 0;
    glucoseScore += (answers['gl_thirst'] || 0) * 1.5;
    glucoseScore += (answers['gl_urine'] || 0) * 1.5;
    glucoseScore += (answers['gl_fatigue'] || 0) * 0.8;
    glucoseScore += (answers['gl_history'] || 0) * 2.0;
    glucoseScore += (answers['gl_weight'] || 0) * 1.2;

    const bpRisk = bpScore > 4 ? 'High' : bpScore >= 2 ? 'Moderate' : 'Low';
    const glucoseRisk = glucoseScore > 4 ? 'High Risk' : glucoseScore >= 2 ? 'Prediabetic Risk' : 'Low';

    patients[index].symptomRiskProfile = {
      bpRisk,
      glucoseRisk,
      lastScreeningDate: new Date().toISOString()
    };

    setStored(KEYS.PATIENTS, patients);
    return patients[index];
  },

  updatePatientProfile: async (patientId: string, updates: Partial<PatientProfile>): Promise<PatientProfile> => {
      const patients = getStored<PatientProfile[]>(KEYS.PATIENTS, SEED_PATIENTS);
      let index = patients.findIndex(p => p.id === patientId);
      
      if (index === -1) {
          // Auto-create patient if not found (supports demo mode)
          const newPatient: PatientProfile = {
              id: patientId,
              name: updates.name || "CareXAI Patient",
              email: updates.email || "demo@carex.ai",
              role: UserRole.PATIENT,
              age: 0,
              gender: 'Other',
              ...updates
          };
          patients.push(newPatient);
          index = patients.length - 1;
      } else {
          patients[index] = { ...patients[index], ...updates };
      }
      
      setStored(KEYS.PATIENTS, patients);
      return patients[index];
  },

  getDoctors: async (): Promise<DoctorProfile[]> => getStored(KEYS.DOCTORS, SEED_DOCTORS),
  
  getRecommendedDoctors: async (patientId: string): Promise<DoctorProfile[]> => {
      return getStored(KEYS.DOCTORS, SEED_DOCTORS).filter(d => d.status === DoctorStatus.VERIFIED && !d.isBlocked).slice(0, 4);
  },

  getDoctorSlotsForDate: async (doctorId: string, dateStr: string): Promise<TimeSlot[]> => {
    const doctors = getStored(KEYS.DOCTORS, SEED_DOCTORS);
    const doctor = doctors.find(d => d.id === doctorId);
    if (!doctor || !doctor.schedule) return [];

    const date = new Date(dateStr);
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' }); 
    const daySchedule = doctor.schedule.find(s => s.day === dayOfWeek);

    if (!daySchedule || !daySchedule.available) return [];

    // 1. Generate Theoretical Slots
    const generatedSlots: TimeSlot[] = [];
    const [startH, startM] = daySchedule.startTime.split(':').map(Number);
    const [endH, endM] = daySchedule.endTime.split(':').map(Number);
    const duration = doctor.slotDuration || 30; 
    const maxPatients = doctor.defaultMaxPatients || 1;

    let current = new Date(date);
    current.setHours(startH, startM, 0, 0);
    const end = new Date(date);
    end.setHours(endH, endM, 0, 0);

    while (current < end) {
      const startTime = current.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
      const nextTime = new Date(current.getTime() + duration * 60000);
      const endTime = nextTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
      
      generatedSlots.push({
          id: generateSlotId(doctorId, dateStr, startTime),
          doctorId,
          date: dateStr,
          startTime,
          endTime,
          maxPatients,
          bookedCount: 0,
          isBlocked: false,
          isEmergency: false
      });
      current = nextTime;
    }

    // 2. Merge with Persisted Data (Booked counts / Blocks)
    const storedSlots = getStored<Record<string, TimeSlot>>(KEYS.SLOTS, {});
    
    return generatedSlots.map(slot => {
        const stored = storedSlots[slot.id];
        if (stored) {
            return { ...slot, bookedCount: stored.bookedCount, isBlocked: stored.isBlocked, isEmergency: stored.isEmergency };
        }
        return slot;
    });
  },

  bookSlot: async (slotId: string, patientId: string, type: string, symptoms: string): Promise<void> => {
      await new Promise(r => setTimeout(r, 200)); // Simulate Transaction
      
      const storedSlots = getStored<Record<string, TimeSlot>>(KEYS.SLOTS, {});
      const doctors = getStored(KEYS.DOCTORS, SEED_DOCTORS);
      const patients = getStored(KEYS.PATIENTS, SEED_PATIENTS);
      
      // Parse slot ID: doctorId_date_time
      const parts = slotId.split('_');
      const doctorId = parts[0];
      const date = parts[1];
      const time = parts[2];

      const doctor = doctors.find(d => d.id === doctorId);
      if (!doctor) throw new Error("Doctor not found");

      // Initialize slot in DB if first booking
      if (!storedSlots[slotId]) {
          storedSlots[slotId] = {
              id: slotId,
              doctorId,
              date,
              startTime: time,
              endTime: "00:00", // Not critical for logic
              maxPatients: doctor.defaultMaxPatients || 1,
              bookedCount: 0,
              isBlocked: false,
              isEmergency: false
          };
      }

      const slot = storedSlots[slotId];

      if (slot.isBlocked) throw new Error("Slot is blocked by doctor.");
      if (slot.bookedCount >= slot.maxPatients) throw new Error("Slot is fully booked.");

      // Double booking check for patient
      const appointments = getStored<Appointment[]>(KEYS.APPOINTMENTS, []);
      const existing = appointments.find(a => a.patientId === patientId && a.date === date && a.time === time && a.status !== 'CANCELLED' && a.status !== 'REJECTED');
      if (existing) throw new Error("You already have an appointment at this time.");

      // ATOMIC UPDATE
      slot.bookedCount += 1;
      setStored(KEYS.SLOTS, storedSlots); 

      // Create Appointment Record
      const newAppt: Appointment = {
          id: Math.random().toString(36).substring(7),
          patientId,
          patientName: patients.find(p => p.id === patientId)?.name || 'Unknown',
          doctorId,
          doctorName: doctor.name,
          date,
          time,
          slotId,
          tokenNumber: slot.bookedCount, // Token logic for OPD
          status: 'SCHEDULED', // Auto-confirm if slot available
          type,
          consultationType: type.includes('Video') ? 'VIDEO' : 'IN_PERSON',
          symptoms
      };

      appointments.push(newAppt);
      setStored(KEYS.APPOINTMENTS, appointments);

      // --- AUTO-SHARE HEALTH PASSPORT ---
      // Automatically add doctor to patient's shared list
      const pIndex = patients.findIndex(p => p.id === patientId);
      if (pIndex !== -1) {
          const p = patients[pIndex];
          if (!p.sharedWithDoctors) p.sharedWithDoctors = [];
          if (!p.sharedWithDoctors.includes(doctorId)) {
              p.sharedWithDoctors.push(doctorId);
              setStored(KEYS.PATIENTS, patients);
          }
      }
  },

  toggleSlotBlock: async (slotId: string, blocked: boolean): Promise<void> => {
      const storedSlots = getStored<Record<string, TimeSlot>>(KEYS.SLOTS, {});
      
      if (!storedSlots[slotId]) {
          const parts = slotId.split('_');
          const doctors = getStored(KEYS.DOCTORS, SEED_DOCTORS);
          const doctor = doctors.find(d => d.id === parts[0]);
          storedSlots[slotId] = {
              id: slotId,
              doctorId: parts[0],
              date: parts[1],
              startTime: parts[2],
              endTime: "00:00",
              maxPatients: doctor?.defaultMaxPatients || 1,
              bookedCount: 0,
              isBlocked: blocked,
              isEmergency: false
          };
      } else {
          storedSlots[slotId].isBlocked = blocked;
      }
      setStored(KEYS.SLOTS, storedSlots);
  },

  updateDoctorSchedule: async (doctorId: string, schedule: DaySchedule[], slotDuration: number, maxPatients: number): Promise<void> => {
    const doctors = getStored(KEYS.DOCTORS, SEED_DOCTORS);
    const index = doctors.findIndex(d => d.id === doctorId);
    if (index !== -1) {
      doctors[index].schedule = schedule;
      doctors[index].slotDuration = slotDuration;
      doctors[index].defaultMaxPatients = maxPatients; // Update capacity
      setStored(KEYS.DOCTORS, doctors);
    }
  },

  updateDoctorStatus: async (doctorId: string, status: DoctorStatus, remarks?: string): Promise<void> => {
    await new Promise(r => setTimeout(r, 100)); 
    const doctors = getStored(KEYS.DOCTORS, SEED_DOCTORS);
    const index = doctors.findIndex(d => d.id === doctorId);
    if (index !== -1) {
      doctors[index].status = status;
      if (remarks) doctors[index].adminRemarks = remarks;
      setStored(KEYS.DOCTORS, doctors);
    }
  },
  
  getPatientHistory: async (patientId: string): Promise<HealthMetrics[]> => getStored(KEYS.HISTORY, {})[patientId] || [],
  saveHealthMetrics: async (patientId: string, metrics: HealthMetrics): Promise<void> => {
    const history = getStored(KEYS.HISTORY, {});
    if (!history[patientId]) history[patientId] = [];
    const patients = getStored(KEYS.PATIENTS, SEED_PATIENTS);
    const alerts = getStored(KEYS.ALERTS, []);
    const patient = patients.find(p => p.id === patientId);
    if (patient) {
       const { patientUpdated, alertGenerated, riskData } = evaluateHealthRisk(patient, metrics, alerts);
       const enrichedMetrics = { ...metrics, ...riskData };
       history[patientId].push(enrichedMetrics);
       setStored(KEYS.HISTORY, history);
       if (patientUpdated) setStored(KEYS.PATIENTS, patients);
       if (alertGenerated) setStored(KEYS.ALERTS, alerts);
       if (patientUpdated || alertGenerated) notifyListeners();
    }
  },
  
  getPatientDocuments: async (patientId: string): Promise<Document[]> => {
    const docsStore = getStored(KEYS.DOCUMENTS, {});
    const docs: Document[] = docsStore[patientId] || [];

    // Blob URLs are session-scoped and break after reload; clear legacy values.
    let mutated = false;
    const normalized = docs.map((d) => {
      if (typeof d.url === 'string' && d.url.startsWith('blob:')) {
        mutated = true;
        return { ...d, url: '' };
      }
      return d;
    });

    if (mutated) {
      docsStore[patientId] = normalized;
      setStored(KEYS.DOCUMENTS, docsStore);
    }

    return normalized;
  },
  uploadDocument: async (patientId: string, file: File, category: string = 'General'): Promise<Document> => {
    await new Promise(r => setTimeout(r, 500)); 
    const docsStore = getStored(KEYS.DOCUMENTS, {});
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read uploaded document'));
      reader.readAsDataURL(file);
    });
    const newDoc: Document = {
      id: Math.random().toString(36).substring(7),
      name: file.name,
      date: new Date().toISOString().split('T')[0],
      type: file.type,
      url: dataUrl,
      category,
      size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
    };
    if (!docsStore[patientId]) docsStore[patientId] = [];
    docsStore[patientId].unshift(newDoc);
    setStored(KEYS.DOCUMENTS, docsStore);
    return newDoc;
  },
  deleteDocument: async (patientId: string, docId: string): Promise<void> => {
    const docsStore = getStored(KEYS.DOCUMENTS, {});
    if (docsStore[patientId]) { docsStore[patientId] = docsStore[patientId].filter((d: Document) => d.id !== docId); setStored(KEYS.DOCUMENTS, docsStore); }
  },
  
  // --- PASSPORT LOGIC ---
  saveHealthPassport: async (patientId: string, passport: HealthPassportData) => {
      const passports = getStored(KEYS.HEALTH_PASSPORTS, {});
      passports[patientId] = passport;
      setStored(KEYS.HEALTH_PASSPORTS, passports);
  },
  
    getHealthPassport: async (patientId: string, requesterId: string, requesterRole: UserRole): Promise<HealthPassportData | null> => {
      const passports = getStored(KEYS.HEALTH_PASSPORTS, {});
      const passport: HealthPassportData | undefined = passports[patientId];
      if (!passport) return null;

      // Patients can only view their own passport
      if (requesterRole === UserRole.PATIENT) {
        return patientId === requesterId ? passport : null;
      }

      if (requesterRole === UserRole.DOCTOR) {
        const patients = getStored(KEYS.PATIENTS, SEED_PATIENTS);
        const patient = patients.find(p => p.id === patientId);

        // For backend-only patients (not present in local mock store),
        // allow access as long as a passport exists.
        if (!patient) return passport;

        const isShared = patient.sharedWithDoctors?.includes(requesterId) || patient.assignedDoctorId === requesterId;

        // In this demo, if a passport exists we allow viewing even if the
        // explicit sharing flags are missing, to keep doctor views in sync.
        if (!isShared && !passport) return null;
        return passport;
      }

      return null;
    },
  
  sharePassportWithDoctor: async (patientId: string, doctorId: string): Promise<void> => {
      const patients = getStored(KEYS.PATIENTS, SEED_PATIENTS);
      const index = patients.findIndex(p => p.id === patientId);
      if (index !== -1) {
          if (!patients[index].sharedWithDoctors) patients[index].sharedWithDoctors = [];
          if (!patients[index].sharedWithDoctors.includes(doctorId)) {
              patients[index].sharedWithDoctors.push(doctorId);
              setStored(KEYS.PATIENTS, patients);
          }
      }
  },

  getAlerts: async (doctorId: string): Promise<RiskAlert[]> => getStored(KEYS.ALERTS, []).filter((a: RiskAlert) => a.doctorId === doctorId && a.status !== AlertStatus.RESOLVED),
  getPatientAlerts: async (patientId: string): Promise<RiskAlert[]> => getStored(KEYS.ALERTS, []).filter((a: RiskAlert) => a.patientId === patientId),
  updateAlertStatus: async (alertId: string, status: AlertStatus): Promise<void> => { const alerts = getStored(KEYS.ALERTS, []); const index = alerts.findIndex((a: RiskAlert) => a.id === alertId); if (index !== -1) { alerts[index].status = status; setStored(KEYS.ALERTS, alerts); } },
  getAppointments: async (userId: string, role: UserRole): Promise<Appointment[]> => { const all = getStored<Appointment[]>(KEYS.APPOINTMENTS, []); return role === UserRole.ADMIN ? all : role === UserRole.DOCTOR ? all.filter(a => a.doctorId === userId) : all.filter(a => a.patientId === userId); },
  updateAppointmentStatus: async (id: string, status: any): Promise<void> => { const appointments = getStored<Appointment[]>(KEYS.APPOINTMENTS, []); const index = appointments.findIndex(a => a.id === id); if (index !== -1) { appointments[index].status = status; setStored(KEYS.APPOINTMENTS, appointments); } },
  checkChatAccess: async (appointmentId: string): Promise<any> => { return { allowed: true }; },
  getChatMessages: async (appointmentId: string): Promise<ChatMessage[]> => getStored(KEYS.CHAT_MESSAGES, {})[appointmentId] || [],
  
  sendChatMessage: async (appointmentId: string, senderId: string, senderRole: UserRole, content: string, attachmentFile?: File): Promise<void> => { 
      const all = getStored(KEYS.CHAT_MESSAGES, {}); 
      if (!all[appointmentId]) all[appointmentId] = []; 
      
      let attachmentUrl = undefined;
      let attachmentType = undefined;
      
      if (attachmentFile) {
        // Create a Data URL to persist image in localStorage (for demo purposes)
        attachmentUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(attachmentFile);
        });
        attachmentType = attachmentFile.type.startsWith('image/') ? 'image' : 'pdf';
      }

      all[appointmentId].push({ 
          id: Math.random().toString(), 
          appointmentId, 
          senderId, 
          senderRole, 
          content: btoa(content), 
          timestamp: new Date().toISOString(), 
          isRead: false,
          attachmentUrl,
          attachmentType
      }); 
      setStored(KEYS.CHAT_MESSAGES, all); 
      notifyListeners();
  },
  
  getAssignedPatients: async (doctorId: string): Promise<PatientProfile[]> => getStored(KEYS.PATIENTS, SEED_PATIENTS).filter(p => (p.assignedDoctorId === doctorId || p.sharedWithDoctors?.includes(doctorId)) && !p.isBlocked),
  
  simulatePatientVitals: async () => {
    const patients = getStored<PatientProfile[]>(KEYS.PATIENTS, SEED_PATIENTS);
    if (patients.length === 0) return;

    // Pick a random patient
    const patient = patients[Math.floor(Math.random() * patients.length)];
    
    const newMetrics: HealthMetrics = {
      systolicBP: 110 + Math.floor(Math.random() * 30),
      diastolicBP: 70 + Math.floor(Math.random() * 20),
      glucose: 80 + Math.floor(Math.random() * 40),
      heartRate: 65 + Math.floor(Math.random() * 20),
      bloodOxygen: 95 + Math.floor(Math.random() * 5),
      temperature: 36.5 + (Math.random() * 0.8),
      bmi: 22 + Math.random() * 5,
      cholesterol: 180 + Math.floor(Math.random() * 40),
      smoking: false,
      activityLevel: 'Moderate',
      timestamp: new Date().toISOString()
    };

    const history = getStored<Record<string, HealthMetrics[]>>(KEYS.HISTORY, {});
    if (!history[patient.id]) history[patient.id] = [];
    
    // Keep only last 50 records
    history[patient.id].push(newMetrics);
    if (history[patient.id].length > 50) history[patient.id].shift();
    
    setStored(KEYS.HISTORY, history);
  },
  
  getAdminStats: async (): Promise<AdminStats> => ({ totalUsers: 10, totalDoctors: 3, totalPatients: 6, pendingVerifications: 0, totalAppointments: 5, systemHealth: 'Healthy', storageUsage: '45%' }),
  getAllUsers: async (): Promise<(PatientProfile|DoctorProfile)[]> => [...getStored(KEYS.DOCTORS, SEED_DOCTORS), ...getStored(KEYS.PATIENTS, SEED_PATIENTS)],
  
  toggleUserBlock: async (id: string, blocked: boolean): Promise<void> => {
      const doctors = getStored(KEYS.DOCTORS, SEED_DOCTORS);
      const dIndex = doctors.findIndex(d => d.id === id);
      if (dIndex !== -1) {
          doctors[dIndex].isBlocked = blocked;
          setStored(KEYS.DOCTORS, doctors);
          return;
      }
      const patients = getStored(KEYS.PATIENTS, SEED_PATIENTS);
      const pIndex = patients.findIndex(p => p.id === id);
      if (pIndex !== -1) {
          patients[pIndex].isBlocked = blocked;
          setStored(KEYS.PATIENTS, patients);
      }
  },
  
  getAuditLogs: async (): Promise<AuditLog[]> => getStored(KEYS.AUDIT_LOGS, []),
  getSystemConfig: async (): Promise<SystemConfig> => getStored(KEYS.SYSTEM_CONFIG, DEFAULT_SYSTEM_CONFIG),
  updateSystemConfig: async (config: SystemConfig): Promise<void> => { setStored(KEYS.SYSTEM_CONFIG, config); },
  deleteAppointment: async (id: string) => { const a = getStored<Appointment[]>(KEYS.APPOINTMENTS, []); setStored(KEYS.APPOINTMENTS, a.filter(x => x.id !== id)); },
  getAllAdminDocuments: async (): Promise<AdminDocument[]> => {
      const allDocs: AdminDocument[] = [];
      const docsMap = getStored(KEYS.DOCUMENTS, {});
      const patients = getStored(KEYS.PATIENTS, SEED_PATIENTS);
      Object.keys(docsMap).forEach(pid => {
          const pname = patients.find(p => p.id === pid)?.name || 'Unknown';
          docsMap[pid].forEach((d: Document) => {
              allDocs.push({ ...d, patientId: pid, patientName: pname });
          });
      });
      return allDocs;
  },
  getGlobalAlerts: async (): Promise<RiskAlert[]> => getStored(KEYS.ALERTS, []),
  getMedications: async (id: string) => getStored(KEYS.MEDICATIONS, SEED_MEDICATIONS).filter(m => m.patientId === id),
  
  // --- Medication Orders + Reminders ---

  assignMedicationOrder: async (input: {
    patientId: string;
    doctorId?: string;
    name: string;
    dosage: string;
    frequency?: MedicationFrequency;
    times?: string[];
    startDate?: string; // YYYY-MM-DD
    durationDays?: number;
    instructions?: string;
  }): Promise<Medication> => {
    const {
      patientId,
      doctorId,
      name,
      dosage,
      frequency = 'ONCE_DAILY',
      times,
      startDate = new Date().toISOString().slice(0, 10),
      durationDays = 7,
      instructions,
    } = input;

    const allMeds = getStored<Medication[]>(KEYS.MEDICATIONS, SEED_MEDICATIONS);
    const endDate = addDays(startDate, Math.max(1, durationDays) - 1);

    const newMed: Medication = {
      id: Math.random().toString(36).substr(2, 9),
      patientId,
      name,
      dosage,
      // Keep legacy display fields for existing UI components
      time: frequency === 'ONCE_DAILY' ? 'Morning' : frequency === 'TWICE_DAILY' ? 'Morning + Night' : frequency === 'THRICE_DAILY' ? 'Morning + Afternoon + Night' : 'Custom',
      taken: false,
      prescribedByDoctorId: doctorId,
      prescribedAt: new Date().toISOString(),
      instructions,
      frequency,
      times: (times && times.length > 0) ? times : defaultTimesForFrequency(frequency),
      startDate,
      endDate,
      durationDays,
      active: true,
    };
    allMeds.push(newMed);
    setStored(KEYS.MEDICATIONS, allMeds);
    return newMed;
  },

  // Backward compatible helper used in older UI flows
  addMedication: async (patientId: string, name: string, dosage: string, time: string): Promise<Medication> => {
    return MockBackend.assignMedicationOrder({
      patientId,
      name,
      dosage,
      // Map legacy time-of-day to a single scheduled time
      frequency: 'CUSTOM',
      times: normalizeMedicationTimes({ id: 'x', patientId, name, dosage, time, taken: false }),
      durationDays: 14,
      startDate: new Date().toISOString().slice(0, 10),
    });
  },

  deleteMedication: async (medId: string): Promise<void> => {
      let allMeds = getStored<Medication[]>(KEYS.MEDICATIONS, SEED_MEDICATIONS);
      allMeds = allMeds.filter(m => m.id !== medId);
      setStored(KEYS.MEDICATIONS, allMeds);
  },

  toggleMedicationTaken: async (medId: string, taken: boolean): Promise<void> => {
      const allMeds = getStored<Medication[]>(KEYS.MEDICATIONS, SEED_MEDICATIONS);
      const index = allMeds.findIndex(m => m.id === medId);
      if (index !== -1) {
          allMeds[index].taken = taken;
          setStored(KEYS.MEDICATIONS, allMeds);
      }
  },

  getMedicationSchedule: async (patientId: string, date: string): Promise<MedicationDoseScheduleItem[]> => {
    const meds = getStored<Medication[]>(KEYS.MEDICATIONS, SEED_MEDICATIONS).filter(m => m.patientId === patientId);
    const adherence = getAdherenceMap(patientId);

    const schedule: MedicationDoseScheduleItem[] = [];
    for (const med of meds) {
      if (med.active === false) continue;

      const start = med.startDate;
      const end = med.endDate;
      if (!isDateInRange(date, start, end)) continue;

      const times = normalizeMedicationTimes(med);
      for (const t of times) {
        const doseId = buildDoseId(med.id, date, t);
        const scheduledAt = toIsoLocal(date, t);
        const record = adherence[doseId];

        schedule.push({
          doseId,
          patientId,
          medicationId: med.id,
          medicationName: med.name,
          dosage: med.dosage,
          scheduledDate: date,
          scheduledTime: t,
          scheduledAt,
          status: record?.status || 'PENDING',
          takenAt: record?.takenAt,
          updatedAt: record?.updatedAt,
        });
      }
    }

    schedule.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    return schedule;
  },

  markMedicationDoseStatus: async (input: {
    patientId: string;
    doseId: string;
    status: MedicationDoseStatus;
    updatedBy: 'PATIENT' | 'SYSTEM';
  }): Promise<void> => {
    const { patientId, doseId, status, updatedBy } = input;

    const meds = getStored<Medication[]>(KEYS.MEDICATIONS, SEED_MEDICATIONS);
    const medId = doseId.split('_')[0];
    const med = meds.find(m => m.id === medId);
    if (!med) return;

    // doseId format: <medId>_<YYYY-MM-DD>_<HH:MM>
    const parts = doseId.split('_');
    const date = parts[1];
    const time = parts.slice(2).join('_');
    const scheduledAt = toIsoLocal(date, time);
    const nowIso = new Date().toISOString();

    const record: MedicationAdherenceRecord = {
      doseId,
      patientId,
      medicationId: med.id,
      scheduledAt,
      status,
      takenAt: status === 'TAKEN' ? nowIso : undefined,
      updatedAt: nowIso,
      updatedBy,
    };

    upsertAdherenceRecord(record);

    if (status === 'MISSED') {
      const patients = getStored<PatientProfile[]>(KEYS.PATIENTS, SEED_PATIENTS);
      const patient = patients.find(p => p.id === patientId);
      const doctorId = patient?.assignedDoctorId;
      if (doctorId) {
        pushMissedDoseAlert({
          id: Math.random().toString(36).substring(7),
          doctorId,
          patientId,
          patientName: patient?.name || 'Patient',
          doseId,
          medicationName: med.name,
          scheduledAt,
          createdAt: nowIso,
          status: 'NEW',
        });
      }
    }
  },

  sweepMissedDoses: async (patientId: string, nowMs?: number): Promise<{ newlyMissed: number }> => {
    const now = typeof nowMs === 'number' ? nowMs : Date.now();
    const today = new Date().toISOString().slice(0, 10);
    const schedule = await MockBackend.getMedicationSchedule(patientId, today);
    const graceMs = 30 * 60 * 1000;

    let newlyMissed = 0;
    for (const item of schedule) {
      if (item.status !== 'PENDING') continue;
      const scheduledMs = new Date(item.scheduledAt).getTime();
      if (Number.isFinite(scheduledMs) && now > scheduledMs + graceMs) {
        await MockBackend.markMedicationDoseStatus({
          patientId,
          doseId: item.doseId,
          status: 'MISSED',
          updatedBy: 'SYSTEM',
        });
        newlyMissed += 1;
      }
    }

    return { newlyMissed };
  },

  getMedicationAdherenceHistory: async (patientId: string, days = 14): Promise<MedicationAdherenceRecord[]> => {
    const all = getStored<Record<string, MedicationAdherenceRecord[]>>(KEYS.MED_ADHERENCE, {});
    const list = (all[patientId] || []).slice();
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return list
      .filter(r => new Date(r.scheduledAt).getTime() >= cutoff)
      .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  },

  getDoctorMedicationAlerts: async (doctorId: string): Promise<MedicationMissedDoseAlert[]> => {
    const alerts = getStored<Record<string, MedicationMissedDoseAlert[]>>(KEYS.MED_ALERTS, {});
    return (alerts[doctorId] || []).slice();
  },

  acknowledgeDoctorMedicationAlert: async (doctorId: string, alertId: string): Promise<void> => {
    const alerts = getStored<Record<string, MedicationMissedDoseAlert[]>>(KEYS.MED_ALERTS, {});
    const list = (alerts[doctorId] || []).slice();
    const idx = list.findIndex(a => a.id === alertId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], status: 'ACKNOWLEDGED' };
      alerts[doctorId] = list;
      setStored(KEYS.MED_ALERTS, alerts);
    }
  },

  getSystemNotifications: async (uid: string, role: UserRole): Promise<SystemNotification[]> => {
      const notifs = getStored<SystemNotification[]>(KEYS.SYSTEM_NOTIFICATIONS, []);
      return notifs.filter(n => {
          if (n.readBy.includes(uid)) return false;
          if (n.target === 'ALL') return true;
          if (n.target === 'PATIENTS' && role === UserRole.PATIENT) return true;
          if (n.target === 'DOCTORS' && role === UserRole.DOCTOR) return true;
          return false;
      });
  },
  markNotificationRead: async (notificationId: string, userId: string): Promise<void> => {
      const notifs = getStored<SystemNotification[]>(KEYS.SYSTEM_NOTIFICATIONS, []);
      const index = notifs.findIndex(n => n.id === notificationId);
      if (index !== -1) {
          if (!notifs[index].readBy.includes(userId)) {
              notifs[index].readBy.push(userId);
              setStored(KEYS.SYSTEM_NOTIFICATIONS, notifs);
          }
      }
  },
  broadcastNotification: async (message: string, target: 'ALL' | 'PATIENTS' | 'DOCTORS'): Promise<void> => {
      const notifs = getStored<SystemNotification[]>(KEYS.SYSTEM_NOTIFICATIONS, []);
      const newNotif: SystemNotification = {
          id: Math.random().toString(36).substring(7),
          message,
          target,
          timestamp: new Date().toISOString(),
          readBy: []
      };
      notifs.unshift(newNotif);
      setStored(KEYS.SYSTEM_NOTIFICATIONS, notifs);
  },
  getDoctorAnalytics: async (doctorId: string): Promise<DoctorAnalytics> => {
      const appointments = getStored<Appointment[]>(KEYS.APPOINTMENTS, []).filter(a => a.doctorId === doctorId);
      const doctors = getStored<DoctorProfile[]>(KEYS.DOCTORS, SEED_DOCTORS);
      const doctor = doctors.find(d => d.id === doctorId);
      const patients = getStored<PatientProfile[]>(KEYS.PATIENTS, SEED_PATIENTS).filter(p => p.assignedDoctorId === doctorId);
      
      // Dynamic Dates
      const today = new Date();
      const months = [];
      for (let i = 5; i >= 0; i--) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
          months.push(d.toLocaleString('default', { month: 'short' }));
      }

      // Simulate trends based on current patient count
      const totalPats = patients.length;
      const patientTrends = months.map((m, i) => ({
          date: m,
          // logarithmic-ish growth simulation ending at totalPats
          count: Math.max(0, Math.round(totalPats * (Math.log(i + 2) / Math.log(7))))
      }));

      // Calculate localized today string (YYYY-MM-DD)
      const localToday = new Date().toLocaleDateString('en-CA');

      const appointmentsToday = appointments.filter(a => a.date === localToday).length;
      const pendingRequests = appointments.filter(a => a.status === 'PENDING').length;
      
      const completed = appointments.filter(a => a.status === 'COMPLETED').length;
      const totalResolved = appointments.filter(a => ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(a.status)).length;
      const completionRate = totalResolved > 0 ? Math.round((completed / totalResolved) * 100) : 100;

      const appointmentDistribution = [
          { name: 'Video', value: appointments.filter(a => a.consultationType === 'VIDEO').length },
          { name: 'In-Person', value: appointments.filter(a => a.consultationType === 'IN_PERSON').length }
      ];
      
      // Ensure at least some data for pie chart if empty
      if (appointmentDistribution.every(d => d.value === 0)) {
          appointmentDistribution[0].value = 1; // Placeholder
          appointmentDistribution[1].value = 0;
      }

      const feedbackKeywords = [
          { word: 'Professional', count: 10 + Math.floor(Math.random() * 5) },
          { word: 'Kind', count: 8 + Math.floor(Math.random() * 3) },
          { word: 'Helpful', count: 6 + Math.floor(Math.random() * 3) },
          { word: 'Thorough', count: 4 + Math.floor(Math.random() * 2) },
      ];

      return {
          totalPatients: totalPats,
          appointmentsToday,
          pendingRequests,
          averageRating: doctor?.rating || 4.8,
          completionRate,
          patientTrends,
          appointmentDistribution,
          feedbackKeywords
      };
  },

  // --- EMERGENCY ALERT SYSTEM ---
  triggerEmergencyAlert: async (patientId: string): Promise<{ success: boolean; message: string; contactNotified?: boolean; smsSent?: boolean }> => {
      const patients = getStored<PatientProfile[]>(KEYS.PATIENTS, SEED_PATIENTS);
      const patient = patients.find(p => p.id === patientId);
      
      if (!patient) {
          return { success: false, message: "Patient not found" };
      }

      if (!patient.emergencyContact || !patient.emergencyContact.name) {
          return { success: false, message: "No emergency contact saved. Please add one first." };
      }

      // Create emergency alert record
      const emergencyAlerts = getStored<any[]>(KEYS.EMERGENCY_ALERTS, []);
      const alert = {
          id: Math.random().toString(36).substring(7),
          patientId,
          patientName: patient.name,
          contactName: patient.emergencyContact.name,
          contactPhone: patient.emergencyContact.phone,
          contactRelationship: patient.emergencyContact.relationship,
          timestamp: new Date().toISOString(),
          location: "Unknown",
          vitals: {}
      };
      
      emergencyAlerts.unshift(alert);
      setStored(KEYS.EMERGENCY_ALERTS, emergencyAlerts);

      // Simulate SMS sending
      const smsMessage = `🚨 EMERGENCY ALERT from CareXAI\n\n${patient.name} has triggered an emergency alert!\n\nYou are listed as their emergency contact: ${patient.emergencyContact.relationship}\n\nTime: ${new Date().toLocaleString()}\nLocation: Unknown\nStatus: ACTIVE\n\nPlease check on them immediately or contact emergency services at 112.`;
      
      const smsLog = getStored<any[]>(KEYS.SMS_LOG, []);
      const smsRecord = {
          id: Math.random().toString(36).substring(7),
          to: patient.emergencyContact.phone,
          contactName: patient.emergencyContact.name,
          message: smsMessage,
          patientId,
          patientName: patient.name,
          timestamp: new Date().toISOString(),
          status: 'SENT',
          type: 'EMERGENCY'
      };
      
      smsLog.unshift(smsRecord);
      setStored(KEYS.SMS_LOG, smsLog);

      console.log(`🚨 EMERGENCY ALERT: ${patient.name} has triggered emergency!`);
      console.log(`📱 SMS Sent to ${patient.emergencyContact.name} (${patient.emergencyContact.phone})`);
      console.log(`Message: ${smsMessage}`);

      return {
          success: true,
          message: `Emergency alert sent to ${patient.emergencyContact.name}`,
          contactNotified: true,
          smsSent: true
      };
  },

  getEmergencyAlerts: async (patientId?: string): Promise<any[]> => {
      const alerts = getStored<any[]>(KEYS.EMERGENCY_ALERTS, []);
      if (patientId) {
          return alerts.filter(a => a.patientId === patientId);
      }
      return alerts;
  },

  getSMSLog: async (): Promise<any[]> => {
      return getStored<any[]>(KEYS.SMS_LOG, []);
  },

  getSMSByPatient: async (patientId: string): Promise<any[]> => {
      const log = getStored<any[]>(KEYS.SMS_LOG, []);
      return log.filter(sms => sms.patientId === patientId);
  }
};
