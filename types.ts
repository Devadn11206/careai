
export enum UserRole {
  PATIENT = 'PATIENT',
  DOCTOR = 'DOCTOR',
  ADMIN = 'ADMIN'
}

export enum DoctorStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  isBlocked?: boolean; // New field for admin control
}

export interface DaySchedule {
  day: string;
  available: boolean;
  startTime: string;
  endTime: string;
  breakStart?: string; // Optional break time
  breakEnd?: string;
}

export interface TimeSlot {
  id: string;
  doctorId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  maxPatients: number;
  bookedCount: number;
  isBlocked: boolean;
  isEmergency: boolean; // Override flag
}

export interface DoctorProfile extends User {
  specialization: string;
  experienceYears: number;
  qualification: string;
  registrationNumber: string;
  medicalCouncil?: string;
  verificationDocumentUrl?: string;
  adminRemarks?: string;
  verificationDate?: string;
  status: DoctorStatus;
  bio: string;
  schedule?: DaySchedule[];
  slotDuration?: number;
  defaultMaxPatients?: number; // Config for OPD vs Private
  rating?: number;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface PatientProfile extends User {
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  bloodGroup?: string; // New Field
  assignedDoctorId?: string;
  riskStatus?: 'STABLE' | 'WATCH' | 'CRITICAL';
  lastVisit?: string;
  preferredLanguage?: string;
  sharedWithDoctors?: string[]; // IDs of doctors who can view Health Passport
  emergencyContact?: EmergencyContact; // New Field

  // New Screening Data
  symptomRiskProfile?: {
    bpRisk: 'Low' | 'Moderate' | 'High';
    glucoseRisk: 'Low' | 'Prediabetic Risk' | 'High Risk';
    lastScreeningDate: string;
  };
}

export interface Medication {
  id: string;
  patientId: string;
  name: string;
  dosage: string;
  time: string;
  taken: boolean;
  prescribedByDoctorId?: string;
  prescribedAt?: string;
  instructions?: string;
  frequency?: MedicationFrequency;
  times?: string[];
  startDate?: string;
  endDate?: string;
  durationDays?: number;
  active?: boolean;
}

export type MedicationFrequency = 'ONCE_DAILY' | 'TWICE_DAILY' | 'THRICE_DAILY' | 'CUSTOM';

export type MedicationDoseStatus = 'PENDING' | 'TAKEN' | 'MISSED' | 'SKIPPED';

export interface MedicationDoseScheduleItem {
  doseId: string;
  patientId: string;
  medicationId: string;
  medicationName: string;
  dosage: string;
  scheduledDate: string;
  scheduledTime: string;
  scheduledAt: string;
  status: MedicationDoseStatus;
  takenAt?: string;
  updatedAt?: string;
}

export interface MedicationAdherenceRecord {
  doseId: string;
  patientId: string;
  medicationId: string;
  scheduledAt: string;
  status: MedicationDoseStatus;
  takenAt?: string;
  updatedAt: string;
  updatedBy: 'PATIENT' | 'SYSTEM';
}

export interface MedicationMissedDoseAlert {
  id: string;
  doctorId: string;
  patientId: string;
  patientName: string;
  doseId: string;
  medicationName: string;
  scheduledAt: string;
  createdAt: string;
  status: 'NEW' | 'ACKNOWLEDGED' | 'RESOLVED';
}

export interface PrescriptionMedicine {
  name: string;
  dosage: string;
  frequency: string;
  duration?: string;
  notes?: string;
}

export interface PrescriptionOcrResult {
  medicines: PrescriptionMedicine[];
  confidenceScore?: number;
  doctorName?: string;
  patientName?: string;
  date?: string;
  summary?: string;
}

export interface NutritionMealItem {
  name: string;
  portion: string;
  calories?: number;
  notes?: string;
  cuisineTag?: string;
}

export interface NutritionMealPlanDay {
  day: number;
  breakfast: NutritionMealItem[];
  lunch: NutritionMealItem[];
  snacks?: NutritionMealItem[];
  dinner: NutritionMealItem[];
  notes?: string;
}

export interface NutritionPlan {
  generatedAt: string;
  days: NutritionMealPlanDay[];
  guidance?: {
    focusAreas?: string[];
    foodsToInclude?: string[];
    foodsToLimit?: string[];
    lifestyleTips?: string[];
    hydrationTips?: string;
    activityGuidance?: string;
  };
  riskAlignmentSummary?: string;
  disclaimer?: string;
}

export interface SystemNotification {
  id: string;
  message: string;
  target: 'ALL' | 'PATIENTS' | 'DOCTORS';
  timestamp: string;
  readBy: string[]; // List of user IDs who have seen this
}

// --- DYNAMIC EXTRACTION TYPES ---
export interface ExtractedParameter {
  testName: string;
  value: string | number;
  unit: string;
  flag?: 'High' | 'Low' | 'Normal';
}

export interface HealthMetrics {
  systolicBP: number;
  diastolicBP: number;
  glucose: number;
  bmi: number;
  weight?: number;
  height?: number;
  cholesterol: number;
  smoking: boolean;
  activityLevel: 'Low' | 'Moderate' | 'High';
  // Optional cardiology features used by ML models
  maxHeartRate?: number; // thalach
  stDepression?: number; // oldpeak
  familyHistory?: boolean; // New Field
  serumCreatinine?: number;
  tshLevel?: number;
  weightChange?: number;
  hasFatigue?: boolean;
  diabetesHistory?: boolean;

  timestamp: string;
  diabetesRisk?: number;
  hypertensionRisk?: number;
  heartDiseaseRisk?: number;
  ckdRisk?: 'Low' | 'Medium' | 'High';
  strokeRiskScore?: number;
  thyroidStatus?: 'Hypo' | 'Hyper' | 'Normal';

  // Dynamic container for report data
  extractedData?: ExtractedParameter[];
}

// --- NEW XAI TYPES ---
export interface XAIFactor {
  factor: string;
  impact: 'High' | 'Medium' | 'Low';
  direction: 'Increase' | 'Decrease'; // Arrow direction
  description: string; // "Elevated glucose increases risk"
}

export interface DiseasePrediction {
  condition: 'Heart Disease' | 'Hypertension' | 'Diabetes';
  probability: number; // 0-100
  riskLevel: 'Low' | 'Moderate' | 'High';
  confidenceScore: number; // 0-100 (Model confidence)
  topFactors: XAIFactor[]; // SHAP-style explanation
  recommendation: string;
}

export interface AIAnalysisResult {
  // Structured Predictions
  predictions: DiseasePrediction[];

  // Legacy fields for backward compatibility
  diabetesRisk: number;
  hypertensionRisk: number;
  heartDiseaseRisk: number;
  ckdRiskLevel?: 'Low' | 'Medium' | 'High';
  strokeRiskScore?: number;
  thyroidAnalysis?: string;
  keyFactors: string[];
  explanation: string;
  lifestyleRecommendations: string[];
  confidenceLevel: 'High' | 'Medium' | 'Low';
  confidenceReason: string;
  confidenceImprovement: string;
  timestamp: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  age: number;
  condition?: string;
}

export interface Document {
  id: string;
  name: string;
  date: string;
  type: string;
  url: string;
  category?: string;
  size?: string;
}

export interface AdminDocument extends Document {
  patientId: string;
  patientName: string;
}

export interface DoctorNote {
  id: string;
  doctorId: string;
  doctorName: string;
  patientId: string;
  content: string;
  timestamp: string;
}

export interface LabRequest {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  testType: string;
  priority: 'ROUTINE' | 'URGENT';
  notes?: string;
  timestamp: string;
  status: 'PENDING' | 'COMPLETED';
}

export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum AlertStatus {
  NEW = 'NEW',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED'
}

export interface RiskAlert {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  riskScore: number;
  severity: AlertSeverity;
  message: string;
  keyFactors: string[];
  timestamp: string;
  status: AlertStatus;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  date: string;
  time: string; // Slot start time
  slotId?: string; // Link to TimeSlot
  tokenNumber?: number; // For OPD
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'PENDING' | 'REJECTED';
  type: string;
  consultationType: 'VIDEO' | 'IN_PERSON';
  symptoms?: string;
  notes?: string;
  rating?: number;
  feedback?: string;
}

export interface ChatMessage {
  id: string;
  appointmentId: string;
  senderId: string;
  senderRole: UserRole;
  content: string;
  timestamp: string;
  isRead: boolean;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'pdf' | 'video' | 'file';
}

export interface PresenceUpdate {
  userId: string;
  online: boolean;
}

export interface TypingEvent {
  appointmentId: string;
  senderId: string;
  isTyping: boolean;
}

export interface ChatEmergencyAlert {
  doctorId: string;
  messageId: string;
  keywords: string[];
}

export interface ConsultationSummary {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  transcript: string;
  symptoms: string;
  possibleCondition: string;
  keyDiscussionPoints: string[];
  recommendations: string;
  followUpInstructions: string;
  disclaimer?: string;
  createdAt: string;
}

export interface DoctorAnalytics {
  totalPatients: number;
  appointmentsToday: number;
  pendingRequests: number;
  averageRating: number;
  completionRate: number;
  patientTrends: { date: string; count: number }[];
  appointmentDistribution: { name: string; value: number }[];
  feedbackKeywords: { word: string; count: number }[];
}

export interface HealthPassportData {
  generatedDate: string;
  patientId: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  bloodGroup: string;

  // Clinical Summary
  clinicalSummary: string;

  // Current Vitals
  metrics: HealthMetrics;

  // Risk Analysis
  aiAnalysis: AIAnalysisResult;

  // History
  history: HealthMetrics[]; // Recent 5

  // Medications
  medications: Medication[];
}

export interface EmergencyGuidance {
  safetyMessage: string;
  supportOptions: string;
  nearbyHelp: string;
  checklist: {
    dos: string[];
    donts: string[];
  };
  reassurance: string;
}

// --- ADMIN TYPES ---

export interface AuditLog {
  id: string;
  adminId: string;
  action: string; // e.g., "VERIFY_DOCTOR", "BLOCK_USER"
  targetId: string;
  targetName: string;
  details: string;
  timestamp: string;
}

export interface SystemConfig {
  bpThreshold: number;
  glucoseThreshold: number;
  maintenanceMode: boolean;
  allowNewRegistrations: boolean;
}

export interface AdminStats {
  totalUsers: number;
  totalDoctors: number;
  totalPatients: number;
  pendingVerifications: number;
  totalAppointments: number;
  systemHealth: 'Healthy' | 'Degraded' | 'Maintenance';
  storageUsage: string; // "45%"
}
