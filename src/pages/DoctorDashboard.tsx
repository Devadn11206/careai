
import React, { Suspense, lazy, useMemo, useState, useEffect } from 'react';
import { DoctorProfile, PatientProfile, DaySchedule, Appointment, UserRole, DoctorAnalytics, TimeSlot, HealthPassportData, Medication, MedicationFrequency, MedicationMissedDoseAlert, Document, HealthMetrics, PrescriptionOcrResult, PrescriptionMedicine, ChatEmergencyAlert, ConsultationSummary } from '../types';
import { MockBackend } from '../services/mockBackend';
import { BackendAPI } from '../services/apiClient';
import type { QueueUpdate } from '../services/apiClient';
import { GeminiService } from '../services/geminiService';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { motion, AnimatePresence } from 'framer-motion';
import { HealthPassport } from '../components/features/HealthPassport';
import { BarChart, Bar, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Brush, ReferenceLine } from 'recharts';
import { ChatPanel } from '../components/features/telechat/ChatPanel';
import { AutomationAssistant } from '../components/features/AutomationAssistant';


const LazyVideoCall = lazy(() => import('../components/features/VideoCall').then((module) => ({ default: module.VideoCall })));
const prefetchVideoCall = () => { void import('../components/features/VideoCall'); };

interface Props {
    user: DoctorProfile;
    onProfileUpdate?: (user: DoctorProfile) => void;
}

type ViewMode = 'dashboard' | 'patients' | 'schedule' | 'settings' | 'analytics';
type PatientTab = 'OVERVIEW' | 'HISTORY' | 'MEDS' | 'DOCUMENTS' | 'SUMMARIES' | 'NOTES';

const parseSharedDocumentMeta = (content: string): { name: string; type: string; category?: string; date?: string } | null => {
    if (!content || !content.startsWith('DOCUMENT SHARED:')) return null;
    const raw = content.replace('DOCUMENT SHARED:', '').trim();
    const parts = raw.split('|').map((p) => p.trim());
    const name = parts[0] || 'Shared document';

    const getValue = (prefix: string) => {
        const found = parts.find((p) => p.startsWith(prefix));
        return found ? found.replace(prefix, '').trim() : undefined;
    };

    return {
        name,
        type: getValue('Type:') || 'application/octet-stream',
        category: getValue('Category:'),
        date: getValue('Date:'),
    };
};

const parseAutoSharedSnapshot = (content: string, fallbackIso: string): HealthMetrics | null => {
    if (!content || !content.includes('AUTO-SHARED PATIENT SNAPSHOT')) return null;

    const readNum = (label: string, fallback = 0): number => {
        const line = content.split('\n').find((l) => l.includes(label));
        if (!line) return fallback;
        const m = line.match(/(-?\d+(?:\.\d+)?)/);
        return m ? Number(m[1]) : fallback;
    };

    const bpLine = content.split('\n').find((l) => l.includes('- BP:')) || '';
    const bpMatch = bpLine.match(/(\d+)\/(\d+)/);
    const systolicBP = bpMatch ? Number(bpMatch[1]) : 0;
    const diastolicBP = bpMatch ? Number(bpMatch[2]) : 0;

    const diabetesRisk = readNum('Diabetes Risk:', 0);
    const hypertensionRisk = readNum('Hypertension Risk:', 0);
    const heartDiseaseRisk = readNum('Heart Disease Risk:', 0);

    return {
        systolicBP,
        diastolicBP,
        glucose: readNum('- Glucose:', 0),
        bmi: readNum('- BMI:', 0),
        cholesterol: readNum('- Cholesterol:', 0),
        smoking: false,
        activityLevel: 'Moderate',
        timestamp: fallbackIso,
        diabetesRisk,
        hypertensionRisk,
        heartDiseaseRisk,
    };
};

type AutoSharedDashboardPayload = {
    currentVitals?: Partial<HealthMetrics> & { timestamp?: string };
    vitalsTrend?: Array<Partial<HealthMetrics> & { timestamp?: string }>;
    history?: Array<Partial<HealthMetrics> & { timestamp?: string }>;
    medications?: Array<Partial<Medication>>;
    documents?: Array<Partial<Document>>;
};

const parseAutoSharedDashboardPayload = (content: string): AutoSharedDashboardPayload | null => {
    const prefix = 'AUTO-SHARED PATIENT DASHBOARD JSON:';
    if (!content || !content.startsWith(prefix)) return null;
    try {
        const raw = content.slice(prefix.length).trim();
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
};

const parseHealthLBrief = (
    content: string,
    createdAt: string,
    appointmentId: string,
    patientId: string,
    doctorId: string,
): ConsultationSummary | null => {
    if (!content || !content.startsWith('HEALTH_L BRIEF:')) return null;

    const lines = content.split('\n').map((line) => line.trim());
    const readLine = (prefix: string): string => {
        const raw = lines.find((line) => line.startsWith(prefix));
        return raw ? raw.slice(prefix.length).trim() : '';
    };

    const symptoms = readLine('Symptoms:') || 'Symptoms shared via Health_L';
    const notes = readLine('Notes:') || 'No additional notes';
    const riskFlag = readLine('Risk Flag:') || 'UNKNOWN';
    const aiSummary = readLine('AI Summary:');
    const payloadLine = lines.find((line) => line.startsWith('HEALTH_L JSON:')) || '';

    let reminderCount = 0;
    if (payloadLine) {
        try {
            const parsed = JSON.parse(payloadLine.replace('HEALTH_L JSON:', '').trim());
            reminderCount = Number(parsed?.reminderCount) || 0;
        } catch {
            reminderCount = 0;
        }
    }

    return {
        id: `health-l-${appointmentId}-${new Date(createdAt).getTime()}`,
        appointmentId,
        patientId,
        doctorId,
        transcript: content,
        symptoms,
        possibleCondition: `Health_L brief (${riskFlag})`,
        keyDiscussionPoints: [
            `Risk flag: ${riskFlag}`,
            `Medication reminders: ${reminderCount}`,
            notes ? `Notes: ${notes}` : 'Notes: none',
        ],
        recommendations: aiSummary || 'Review this patient brief in chat and validate with clinical findings.',
        followUpInstructions: 'Confirm symptoms, verify vitals, and document treatment plan during consultation.',
        disclaimer: 'Patient-submitted Health_L brief. Requires clinician validation.',
        createdAt,
    };
};

const toHealthMetric = (entry: Partial<HealthMetrics> & { timestamp?: string }, fallbackIso: string): HealthMetrics => ({
    systolicBP: Number(entry?.systolicBP) || 0,
    diastolicBP: Number(entry?.diastolicBP) || 0,
    glucose: Number(entry?.glucose) || 0,
    bmi: Number(entry?.bmi) || 0,
    cholesterol: Number(entry?.cholesterol) || 0,
    smoking: Boolean(entry?.smoking),
    activityLevel: entry?.activityLevel === 'Low' || entry?.activityLevel === 'High' ? entry.activityLevel : 'Moderate',
    timestamp: entry?.timestamp || fallbackIso,
    diabetesRisk: typeof entry?.diabetesRisk === 'number' ? entry.diabetesRisk : undefined,
    hypertensionRisk: typeof entry?.hypertensionRisk === 'number' ? entry.hypertensionRisk : undefined,
    heartDiseaseRisk: typeof entry?.heartDiseaseRisk === 'number' ? entry.heartDiseaseRisk : undefined,
});

const getDefaultSchedule = (): DaySchedule[] => [
    { day: 'Mon', available: true, startTime: '09:00', endTime: '17:00' },
    { day: 'Tue', available: true, startTime: '09:00', endTime: '17:00' },
    { day: 'Wed', available: true, startTime: '09:00', endTime: '17:00' },
    { day: 'Thu', available: true, startTime: '09:00', endTime: '17:00' },
    { day: 'Fri', available: true, startTime: '09:00', endTime: '17:00' },
    { day: 'Sat', available: false, startTime: '10:00', endTime: '14:00' },
    { day: 'Sun', available: false, startTime: '10:00', endTime: '14:00' },
];

export const DoctorDashboard: React.FC<Props> = ({ user: initialUser, onProfileUpdate }) => {
    const emptyAnalytics: DoctorAnalytics = {
        totalPatients: 0,
        appointmentsToday: 0,
        pendingRequests: 0,
        averageRating: 0,
        completionRate: 0,
        patientTrends: [],
        appointmentDistribution: [],
        feedbackKeywords: [],
    };

    const [user, setUser] = useState<DoctorProfile>(initialUser);
    const [patients, setPatients] = useState<PatientProfile[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [analytics, setAnalytics] = useState<DoctorAnalytics | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
    const [selectedPatient, setSelectedPatient] = useState<PatientProfile | null>(null);
    const [patientTab, setPatientTab] = useState<PatientTab>('OVERVIEW');

    // Patient Specific Data (Real-time)
    const [patientHistory, setPatientHistory] = useState<HealthMetrics[]>([]);
    const [patientMeds, setPatientMeds] = useState<Medication[]>([]);
    const [riskUpdateSummary, setRiskUpdateSummary] = useState<string | null>(null);

    const [isProfilePicUploading, setIsProfilePicUploading] = useState(false);
    const profilePicInputRef = React.useRef<HTMLInputElement>(null);

    const handleProfilePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Please select an image file.');
            return;
        }

        setIsProfilePicUploading(true);
        try {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = reader.result as string;
                const updatedUser = await BackendAPI.updateProfilePic(base64);
                setUser(updatedUser as DoctorProfile);
                if (onProfileUpdate) onProfileUpdate(updatedUser as DoctorProfile);
            };
            reader.readAsDataURL(file);
        } catch (err) {
            console.error('Failed to upload profile pic', err);
            alert('Failed to update profile picture. Please try a smaller image.');
        } finally {
            setIsProfilePicUploading(false);
            if (profilePicInputRef.current) profilePicInputRef.current.value = '';
        }
    };
    const [medSafetyAlert, setMedSafetyAlert] = useState<{
        severity: 'LOW' | 'MEDIUM' | 'HIGH';
        summary: string;
        details: string;
        pairs?: { label: string; note: string }[];
        disclaimer?: string;
    } | null>(null);
    const [patientDocs, setPatientDocs] = useState<Document[]>([]);
    const [consultationSummariesByPatientId, setConsultationSummariesByPatientId] = useState<Record<string, ConsultationSummary[]>>({});

    const [manageDate, setManageDate] = useState(new Date().toISOString().split('T')[0]);
    const [dailySlots, setDailySlots] = useState<TimeSlot[]>([]);
    const [slotDetails, setSlotDetails] = useState<{ slot: TimeSlot, appts: Appointment[] } | null>(null);
    const [passportToView, setPassportToView] = useState<HealthPassportData | null>(null);

    const [newMedName, setNewMedName] = useState('');
    const [newMedDosage, setNewMedDosage] = useState('');
    const [newMedFrequency, setNewMedFrequency] = useState<MedicationFrequency>('ONCE_DAILY');
    const [newMedTimes, setNewMedTimes] = useState<string[]>(['08:00']);
    const [newMedStartDate, setNewMedStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
    const [newMedDurationDays, setNewMedDurationDays] = useState<number>(7);
    const [newMedInstructions, setNewMedInstructions] = useState<string>('');
    const [clinicalNote, setClinicalNote] = useState('');

    const [medAlerts, setMedAlerts] = useState<MedicationMissedDoseAlert[]>([]);

    const [schedule, setSchedule] = useState<DaySchedule[]>(user.schedule || getDefaultSchedule());
    const [slotDuration, setSlotDuration] = useState<number>(user.slotDuration || 30);
    const [maxPatients, setMaxPatients] = useState<number>(user.defaultMaxPatients || 1);
    const [savingConfig, setSavingConfig] = useState(false);

    const openDocument = (url: string) => {
        if (!url) return;

        if (url.startsWith('data:')) {
            try {
                const [meta, base64] = url.split(',');
                if (!base64) return;
                const mimeMatch = meta.match(/^data:(.*?);base64$/i);
                const mime = mimeMatch?.[1] || 'application/octet-stream';
                const binary = atob(base64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
                const blob = new Blob([bytes], { type: mime });
                const blobUrl = URL.createObjectURL(blob);
                window.open(blobUrl, '_blank', 'noopener,noreferrer');
                setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
                return;
            } catch (err) {
                console.error('Failed to open data URL document', err);
                return;
            }
        }

        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const [ocrFile, setOcrFile] = useState<File | null>(null);
    const [ocrPreviewUrl, setOcrPreviewUrl] = useState<string | null>(null);
    const [ocrLoading, setOcrLoading] = useState(false);
    const [ocrError, setOcrError] = useState<string | null>(null);
    const [ocrResult, setOcrResult] = useState<PrescriptionOcrResult | null>(null);
    const [ocrDraftMeds, setOcrDraftMeds] = useState<PrescriptionMedicine[]>([]);
    const [ocrApproved, setOcrApproved] = useState(false);

    const [emergencyAlerts, setEmergencyAlerts] = useState<ChatEmergencyAlert[]>([]);
    const [isAssistantOpen, setIsAssistantOpen] = useState(false);
    const [queueByAppointmentId, setQueueByAppointmentId] = useState<Record<string, QueueUpdate>>({});
    const [showTelechat, setShowTelechat] = useState(false);
    const [telechatAppointmentId, setTelechatAppointmentId] = useState<string | null>(null);

    const [showVideoCall, setShowVideoCall] = useState(false);
    const [videoAppointment, setVideoAppointment] = useState<Appointment | null>(null);

    type PatientTrendMetric = 'BP' | 'GLUCOSE' | 'BMI' | 'CHOLESTEROL';
    const [patientTrendMetric, setPatientTrendMetric] = useState<PatientTrendMetric>('BP');
    const [patientTrendRangeDays, setPatientTrendRangeDays] = useState<0 | 7 | 30 | 90>(30);
    const [patientTrendShowAvg, setPatientTrendShowAvg] = useState(false);

    const frequencyLabel = useMemo(() => {
        return (f: MedicationFrequency) => {
            switch (f) {
                case 'ONCE_DAILY':
                    return 'Once daily';
                case 'TWICE_DAILY':
                    return 'Twice daily';
                case 'THRICE_DAILY':
                    return 'Thrice daily';
                case 'CUSTOM':
                default:
                    return 'Custom';
            }
        };
    }, []);

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
                return newMedTimes.length > 0 ? newMedTimes : ['08:00'];
        }
    };

    useEffect(() => {
        // Reset chart controls when switching patients
        setPatientTrendMetric('BP');
        setPatientTrendRangeDays(30);
        setPatientTrendShowAvg(false);
    }, [selectedPatient?.id]);

    const parseMetricTimestamp = (ts: string): number | null => {
        if (!ts) return null;
        const d = new Date(ts);
        const ms = d.getTime();
        return Number.isFinite(ms) ? ms : null;
    };

    const formatMetricTimestamp = (ms: number): string => {
        try {
            return new Date(ms).toLocaleString(undefined, {
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return String(ms);
        }
    };

    const clampRange = (min: number, value: number, max: number) => Math.max(min, Math.min(max, value));

    const getTrendUnits = (metric: PatientTrendMetric): string => {
        switch (metric) {
            case 'BP':
                return 'mmHg';
            case 'GLUCOSE':
                return 'mg/dL';
            case 'BMI':
                return 'kg/m²';
            case 'CHOLESTEROL':
                return 'mg/dL';
            default:
                return '';
        }
    };

    const buildPatientTrendData = (): Array<HealthMetrics & { t: number; label: string; ma_systolicBP?: number; ma_diastolicBP?: number; ma_glucose?: number; ma_bmi?: number; ma_cholesterol?: number }> => {
        const sorted = patientHistory
            .slice()
            .map((h, idx) => {
                const ms = parseMetricTimestamp(h.timestamp);
                const t = ms ?? idx;
                return { ...h, t, label: ms ? formatMetricTimestamp(ms) : String(h.timestamp || idx) };
            })
            .sort((a, b) => a.t - b.t);

        if (sorted.length === 0) return [];

        const filtered = (() => {
            if (patientTrendRangeDays === 0) return sorted;
            const end = sorted[sorted.length - 1].t;
            const startCutoff = end - patientTrendRangeDays * 24 * 60 * 60 * 1000;
            const inRange = sorted.filter(r => r.t >= startCutoff);
            return inRange.length >= 3 ? inRange : sorted.slice(-Math.min(10, sorted.length));
        })();

        if (!patientTrendShowAvg || filtered.length < 3) return filtered;

        const windowSize = clampRange(3, Math.round(filtered.length / 5), 7);
        const avg = (values: number[]) => values.reduce((s, v) => s + v, 0) / values.length;
        const ma = (arr: number[], idx: number) => {
            const start = Math.max(0, idx - windowSize + 1);
            const slice = arr.slice(start, idx + 1).filter(v => Number.isFinite(v));
            if (slice.length === 0) return undefined;
            return Number(avg(slice).toFixed(1));
        };

        const sys = filtered.map(r => r.systolicBP);
        const dia = filtered.map(r => r.diastolicBP);
        const glu = filtered.map(r => r.glucose);
        const bmi = filtered.map(r => r.bmi);
        const chol = filtered.map(r => r.cholesterol);

        return filtered.map((row, idx) => ({
            ...row,
            ma_systolicBP: ma(sys, idx),
            ma_diastolicBP: ma(dia, idx),
            ma_glucose: ma(glu, idx),
            ma_bmi: ma(bmi, idx),
            ma_cholesterol: ma(chol, idx),
        }));
    };

    // --- HASH NAVIGATION SYNC ---
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.replace('#', '');
            const validModes: ViewMode[] = ['dashboard', 'patients', 'schedule', 'analytics', 'settings'];
            if (hash && validModes.includes(hash as ViewMode)) {
                setViewMode(hash as ViewMode);
                if (hash !== 'patients') setSelectedPatient(null);
            } else {
                setViewMode('dashboard');
            }
        };

        handleHashChange();
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    // --- REAL-TIME DATA SYNC ---
    useEffect(() => {
        const refreshData = async () => {
            // Hydrate from mock backend when available (for richer profile/analytics),
            // but fall back to the current user for backend-only doctors.
            const freshUser = await MockBackend.getUser(user.id);
            const effectiveUser = (freshUser as DoctorProfile | null) || user;

            if (freshUser) setUser(freshUser as DoctorProfile);

            const status = (effectiveUser as DoctorProfile | null)?.status;
            const isVerified = status ? status === 'VERIFIED' : true; // Treat missing status as verified for backend-only doctors

            if (!isVerified) {
                setPatients([]);
                setAppointments([]);
                setAnalytics(null);
                return;
            }

            try {
                const alerts = await BackendAPI.getDoctorMedicationAlerts().catch(() => (
                    MockBackend.getDoctorMedicationAlerts(effectiveUser.id)
                ));
                setMedAlerts(alerts);
            } catch {
                // ignore
            }

            const [assignedPatients, appts, stats] = await Promise.all([
                MockBackend.getAssignedPatients(effectiveUser.id).catch(() => []),
                BackendAPI.getAppointments().catch(() => []),
                MockBackend.getDoctorAnalytics(effectiveUser.id).catch(() => emptyAnalytics)
            ]);

            // Ensure any patient who has an appointment with this doctor
            // appears in the "My Patients" list, even if they were created
            // only in the real backend and not in the local mock store.
            const mergedPatients: PatientProfile[] = [...assignedPatients];
            const existingIds = new Set(assignedPatients.map(p => p.id));

            appts.forEach(appt => {
                if (!existingIds.has(appt.patientId)) {
                    mergedPatients.push({
                        id: appt.patientId,
                        name: appt.patientName,
                        email: `${appt.patientId}@carexai.local`,
                        role: UserRole.PATIENT,
                        age: 0,
                        gender: 'Other',
                        riskStatus: 'STABLE',
                        lastVisit: appt.date,
                        assignedDoctorId: effectiveUser.id,
                        sharedWithDoctors: [effectiveUser.id]
                    });
                    existingIds.add(appt.patientId);
                }
            });

            setPatients(mergedPatients);
            setAppointments(appts);
            setAnalytics(stats);

            const uniquePatientIds = Array.from(new Set(appts.map(a => a.patientId).filter(Boolean)));
            if (uniquePatientIds.length > 0) {
                const summaryPairs = await Promise.all(
                    uniquePatientIds.map(async (patientId) => {
                        const list = await BackendAPI.getPatientConsultationSummaries(patientId, 3).catch(() => []);
                        return [patientId, list] as const;
                    })
                );
                setConsultationSummariesByPatientId(prev => {
                    const next = { ...prev };
                    summaryPairs.forEach(([patientId, list]) => {
                        next[patientId] = list;
                    });
                    return next;
                });
            }

            if (viewMode === 'schedule') {
                const slots = await BackendAPI.getDoctorSlots(effectiveUser.id, manageDate).catch(() => []);
                setDailySlots(slots);
            }

            if (selectedPatient) {
                // Keep the selected patient in sync with the latest merged list
                const updatedProfile = mergedPatients.find(p => p.id === selectedPatient.id);
                if (updatedProfile) setSelectedPatient(updatedProfile);
                await loadSelectedPatientFile(selectedPatient.id, appts);
            }
        };

        refreshData();
        const unsubscribeMock = MockBackend.subscribe(refreshData);

        const upsertAppointment = (appt: Appointment) => {
            setAppointments((prev) => {
                const idx = prev.findIndex(a => a.id === appt.id);
                if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = appt;
                    return next;
                }
                return [...prev, appt];
            });
        };

        const hydrateSummaryPreview = (patientId: string) => {
            BackendAPI.getPatientConsultationSummaries(patientId, 3)
                .then((list) => {
                    setConsultationSummariesByPatientId(prev => ({ ...prev, [patientId]: list }));
                })
                .catch(() => { });
        };


        const handleAssistantAction = (action: any) => {
            handleDoctorAssistantAction(action);
        };

        const actionListener = (e: any) => handleAssistantAction(e.detail);
        const refreshListener = () => setRefreshTrigger(prev => prev + 1);

        window.addEventListener('carexai-action', actionListener);
        window.addEventListener('refresh-dashboard', refreshListener);

        const unsubscribeAppt = BackendAPI.onAppointmentCreated((appt) => {
            upsertAppointment(appt);
            hydrateSummaryPreview(appt.patientId);
        });

        const unsubscribeQueue = BackendAPI.onQueueUpdate((payload) => {
            if (payload.doctorId !== user.id) return;
            setQueueByAppointmentId((prev) => ({ ...prev, [payload.appointmentId]: payload }));
        });

        const unsubscribeEmergency = BackendAPI.onChatEmergency((alert) => {
            if (alert.doctorId !== user.id) return;
            setEmergencyAlerts((prev) => [alert, ...prev].slice(0, 5));
        });

        const unsubscribeSlot = BackendAPI.onSlotUpdated((slot) => {
            if (slot.date !== manageDate) return;
            setDailySlots((prev) => {
                const idx = prev.findIndex(s => s.id === slot.id);
                if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = slot as any;
                    return next;
                }
                return [...prev, slot as any];
            });
        });

        const unsubscribeApptUpdated = BackendAPI.onAppointmentUpdated((appt) => {
            upsertAppointment(appt);
            hydrateSummaryPreview(appt.patientId);
        });

        return () => {
            unsubscribeMock();
            unsubscribeAppt();
            unsubscribeQueue();
            unsubscribeSlot();
            unsubscribeEmergency();
            unsubscribeApptUpdated();
            window.removeEventListener('carexai-action', actionListener);
            window.removeEventListener('refresh-dashboard', refreshListener);
        };
    }, [user.id, user.status, viewMode, manageDate, selectedPatient?.id, refreshTrigger]);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            if (!selectedPatient) {
                setPatientHistory([]);
                setPatientMeds([]);
                setPatientDocs([]);
                return;
            }

            try {
                await loadSelectedPatientFile(selectedPatient.id, appointments);
            } catch {
                if (!cancelled) {
                    setPatientHistory([]);
                    setPatientMeds([]);
                    setPatientDocs([]);
                }
            }
        };

        run();
        return () => { cancelled = true; };
    }, [selectedPatient?.id, appointments]);

    // --- DERIVED CLINICAL SUMMARIES ---

    const buildDoctorRiskUpdate = (history: HealthMetrics[]): string | null => {
        if (!history || history.length === 0) return null;
        const latest = history[history.length - 1];
        const prev = history.length > 1 ? history[history.length - 2] : null;

        const bpStr = (latest.systolicBP && latest.diastolicBP)
            ? `${latest.systolicBP}/${latest.diastolicBP} mmHg`
            : null;
        const glucoseStr = latest.glucose ? `${latest.glucose} mg/dL` : null;
        const cholStr = latest.cholesterol ? `${latest.cholesterol} mg/dL` : null;
        const bmiStr = latest.bmi ? `${latest.bmi}` : null;

        const vitalsParts: string[] = [];
        if (bpStr) vitalsParts.push(`BP ${bpStr}`);
        if (glucoseStr) vitalsParts.push(`glucose ${glucoseStr}`);
        if (cholStr) vitalsParts.push(`cholesterol ${cholStr}`);
        if (bmiStr) vitalsParts.push(`BMI ${bmiStr}`);

        const vitalsSentence = vitalsParts.length
            ? `Latest vitals: ${vitalsParts.join(', ')}.`
            : '';

        let trendSentence = '';
        if (prev && latest.systolicBP && prev.systolicBP) {
            const diff = latest.systolicBP - prev.systolicBP;
            if (Math.abs(diff) >= 5) {
                trendSentence = diff > 0
                    ? 'Systolic BP is slightly higher than the previous reading.'
                    : 'Systolic BP is slightly lower than the previous reading.';
            } else {
                trendSentence = 'Blood pressure is broadly similar to the previous reading.';
            }
        }

        const categorize = (score?: number): string | null => {
            if (score === undefined || score === null) return null;
            if (score < 30) return 'Low';
            if (score < 70) return 'Moderate';
            return 'High';
        };

        const riskBits: string[] = [];
        const dmCat = categorize(latest.diabetesRisk);
        const htCat = categorize(latest.hypertensionRisk);
        const hdCat = categorize(latest.heartDiseaseRisk);
        if (dmCat && typeof latest.diabetesRisk === 'number') {
            riskBits.push(`Diabetes – ${dmCat} (${Math.round(latest.diabetesRisk)}%)`);
        }
        if (htCat && typeof latest.hypertensionRisk === 'number') {
            riskBits.push(`Hypertension – ${htCat} (${Math.round(latest.hypertensionRisk)}%)`);
        }
        if (hdCat && typeof latest.heartDiseaseRisk === 'number') {
            riskBits.push(`Heart disease – ${hdCat} (${Math.round(latest.heartDiseaseRisk)}%)`);
        }

        const riskSentence = riskBits.length
            ? `Current risk scores: ${riskBits.join('; ')}.`
            : '';

        const pieces = [vitalsSentence, trendSentence, riskSentence].filter(Boolean);
        if (!pieces.length) return null;
        return pieces.join(' ');
    };

    const buildMedicationSafetyAlert = (meds: Medication[]) => {
        if (!meds || meds.length === 0) return null;

        // Base polypharmacy signal
        let severity: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
        if (meds.length >= 4 && meds.length <= 5) severity = 'MEDIUM';
        if (meds.length > 5) severity = 'HIGH';

        const summary = meds.length <= 1
            ? 'Only one active medicine recorded; major drug–drug interactions from this list alone are less likely.'
            : `This patient currently has ${meds.length} active medicines.`;
        const details = 'Multiple concurrent medicines can increase the chance of drug–drug interactions and side effects. Please cross-check this regimen using your usual interaction checker or institutional guidelines before adding new prescriptions or changing doses.';

        return { severity, summary, details };
    };

    const loadSelectedPatientFile = async (patientId: string, apptsSource: Appointment[]) => {
        const latestAppt = apptsSource.find(a => a.patientId === patientId);
        const relatedAppts = apptsSource.filter((a) => a.patientId === patientId);
        const relatedApptsRecent = relatedAppts.slice(-10);
        const chatLists = await Promise.all(
            relatedApptsRecent.map((a) => BackendAPI.getChatMessages(a.id).catch(() => []))
        );
        const sharedMessages = chatLists.flat();
        const sharedDashboardPayloads = sharedMessages
            .map((m) => parseAutoSharedDashboardPayload(m.content || ''))
            .filter((p): p is AutoSharedDashboardPayload => !!p);

        const sharedHealthLBriefs = sharedMessages
            .map((m) => parseHealthLBrief(m.content || '', m.timestamp, m.appointmentId, patientId, user.id))
            .filter((s): s is ConsultationSummary => !!s);

        const sharedDocs: Document[] = sharedMessages
            .filter((m) => m.senderRole === UserRole.PATIENT && !!m.attachmentUrl)
            .map((m) => {
                const meta = parseSharedDocumentMeta(m.content || '');
                return {
                    id: `shared-${m.id}`,
                    name: meta?.name || 'Shared Document',
                    date: meta?.date || new Date(m.timestamp).toISOString().split('T')[0],
                    type: meta?.type || 'application/octet-stream',
                    url: m.attachmentUrl || '',
                    category: meta?.category || 'Shared at booking',
                };
            });

        const sharedDocsFromPayload: Document[] = sharedDashboardPayloads
            .flatMap((payload) => Array.isArray(payload.documents) ? payload.documents : [])
            .map((doc, idx) => ({
                id: `payload-doc-${idx}-${doc?.name || 'unknown'}`,
                name: doc?.name || 'Shared Document',
                date: doc?.date || new Date().toISOString().split('T')[0],
                type: doc?.type || 'application/octet-stream',
                url: doc?.url || '',
                category: doc?.category || 'Shared at booking',
            }));

        const sharedSnapshots: HealthMetrics[] = sharedMessages
            .map((m) => parseAutoSharedSnapshot(m.content || '', m.timestamp))
            .filter((m): m is HealthMetrics => !!m);

        const sharedHistoryFromPayload: HealthMetrics[] = sharedDashboardPayloads.flatMap((payload) => {
            const collection = [
                ...(Array.isArray(payload.history) ? payload.history : []),
                ...(Array.isArray(payload.vitalsTrend) ? payload.vitalsTrend : []),
                ...(payload.currentVitals ? [payload.currentVitals] : []),
            ];
            return collection.map((entry) => toHealthMetric(entry, new Date().toISOString()));
        });

        const sharedMedsFromPayload: Medication[] = sharedDashboardPayloads
            .flatMap((payload) => Array.isArray(payload.medications) ? payload.medications : [])
            .map((med, idx) => ({
                id: med?.id || `payload-med-${idx}`,
                patientId,
                name: med?.name || 'Shared Medication',
                dosage: med?.dosage || 'Not specified',
                time: med?.time || 'Custom',
                taken: Boolean(med?.taken),
                instructions: med?.instructions,
                frequency: med?.frequency as MedicationFrequency | undefined,
                times: Array.isArray(med?.times) ? med.times.filter(Boolean) as string[] : undefined,
                startDate: med?.startDate,
                endDate: med?.endDate,
                durationDays: typeof med?.durationDays === 'number' ? med.durationDays : undefined,
                active: typeof med?.active === 'boolean' ? med.active : undefined,
            }));

        const [hist, meds, docs, summaries] = await Promise.all([
            BackendAPI.getMyMetrics(patientId).catch(() => []),
            BackendAPI.getMedicationOrders({ patientId, active: 'true' }).catch(() => (
                MockBackend.getMedications(patientId)
            )),
            MockBackend.getPatientDocuments(patientId).catch(() => []),
            BackendAPI.getPatientConsultationSummaries(patientId, 25).catch(() => []),
        ]);

        const mergedHistory = [...hist, ...sharedSnapshots, ...sharedHistoryFromPayload].sort((a, b) => {
            const at = new Date(a.timestamp || '').getTime();
            const bt = new Date(b.timestamp || '').getTime();
            return at - bt;
        });

        const dedupHistory: HealthMetrics[] = [];
        const seenHistory = new Set<string>();
        mergedHistory.forEach((h) => {
            const key = `${h.timestamp}|${h.systolicBP}|${h.diastolicBP}|${h.glucose}|${h.bmi}|${h.cholesterol}`;
            if (!seenHistory.has(key)) {
                seenHistory.add(key);
                dedupHistory.push(h);
            }
        });

        const mergedDocs = [...docs, ...sharedDocs, ...sharedDocsFromPayload];
        const dedupDocs: Document[] = [];
        const seenDocs = new Set<string>();
        mergedDocs.forEach((d) => {
            const key = `${d.url}|${d.name}|${d.date}`;
            if (!seenDocs.has(key)) {
                seenDocs.add(key);
                dedupDocs.push(d);
            }
        });

        const mergedMeds = [...meds, ...sharedMedsFromPayload];
        const dedupMeds: Medication[] = [];
        const seenMeds = new Set<string>();
        mergedMeds.forEach((m) => {
            const key = `${m.name}|${m.dosage}|${(m.times || []).join(',')}|${m.startDate || ''}|${m.endDate || ''}`;
            if (!seenMeds.has(key)) {
                seenMeds.add(key);
                dedupMeds.push(m);
            }
        });

        setPatientHistory(dedupHistory);
        setPatientMeds(dedupMeds);
        setPatientDocs(dedupDocs);
        const mergedSummaries = [...summaries, ...sharedHealthLBriefs].sort((a, b) => {
            const at = new Date(a.createdAt || '').getTime();
            const bt = new Date(b.createdAt || '').getTime();
            return bt - at;
        });

        const dedupSummaries: ConsultationSummary[] = [];
        const seenSummary = new Set<string>();
        mergedSummaries.forEach((entry) => {
            const key = `${entry.id}|${entry.appointmentId}|${entry.createdAt}`;
            if (!seenSummary.has(key)) {
                seenSummary.add(key);
                dedupSummaries.push(entry);
            }
        });

        setConsultationSummariesByPatientId(prev => ({ ...prev, [patientId]: dedupSummaries }));
    };

    useEffect(() => {
        if (patientHistory && patientHistory.length > 0 && selectedPatient) {
            setRiskUpdateSummary(buildDoctorRiskUpdate(patientHistory));
        } else {
            setRiskUpdateSummary(null);
        }
    }, [patientHistory, selectedPatient?.id]);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            if (!patientMeds || patientMeds.length === 0 || !selectedPatient) {
                setMedSafetyAlert(null);
                return;
            }

            // Start from a deterministic polypharmacy summary
            const base = buildMedicationSafetyAlert(patientMeds);
            setMedSafetyAlert(base);

            try {
                const ai = await GeminiService.analyzeDrugInteractions(patientMeds);
                if (cancelled) return;

                const mappedSeverity: 'LOW' | 'MEDIUM' | 'HIGH' = ai.severity === 'HIGH'
                    ? 'HIGH'
                    : ai.severity === 'MODERATE'
                        ? 'MEDIUM'
                        : 'LOW';

                const pairs = (ai.pairs || []).map(p => ({
                    label: `${p.drugA} + ${p.drugB} (${p.severity} risk)`,
                    note: p.note || p.risk,
                }));

                setMedSafetyAlert({
                    severity: mappedSeverity,
                    summary: ai.summary || base?.summary || '',
                    details: base?.details || '',
                    pairs,
                    disclaimer: ai.disclaimer,
                });
            } catch {
                // On any AI error, keep the base alert only
                if (!cancelled) setMedSafetyAlert(base);
            }
        };

        run();
        return () => { cancelled = true; };
    }, [patientMeds, selectedPatient?.id]);

    // --- AUTOMATION ASSISTANT ACTION HANDLER ---

    const handleDoctorAssistantAction = (action: { type: string; target?: string }) => {
        switch (action.type) {
            case 'NAVIGATE':
                if (action.target === 'dashboard') setViewMode('dashboard');
                if (action.target === 'patients') setViewMode('patients');
                if (action.target === 'schedule') setViewMode('schedule');
                if (action.target === 'analytics') setViewMode('analytics');
                if (action.target === 'settings') setViewMode('settings');
                break;
            case 'OPEN_PATIENTS':
                setViewMode('patients');
                setSelectedPatient(null);
                break;
            case 'OPEN_SCHEDULE':
                setViewMode('schedule');
                break;
            case 'OPEN_APPOINTMENT':
            case 'OPEN_BOOKING':
                // For doctors, "booking" refers to the schedule/appointments view
                setViewMode('schedule');
                break;
            case 'OPEN_ANALYTICS':
                setViewMode('analytics');
                break;
            case 'OPEN_SETTINGS':
                setViewMode('settings');
                break;
            case 'OPEN_DASHBOARD':
                setViewMode('dashboard');
                break;
            case 'SELECT_PATIENT': {
                // Try to find patient by name or id
                const query = (action.target || '').toLowerCase();
                const found = patients.find(
                    p => p.name.toLowerCase().includes(query) || p.id === action.target
                );
                if (found) {
                    setViewMode('patients');
                    setSelectedPatient(found);
                } else {
                    setViewMode('patients');
                }
                break;
            }
            case 'START_VIDEO_CALL': {
                const appt = appointments.find(a => a.status === 'SCHEDULED' && a.consultationType === 'VIDEO');
                if (appt) {
                    setVideoAppointment(appt);
                    setShowVideoCall(true);
                }
                break;
            }
            case 'OPEN_TELECHAT': {
                const appt = appointments.find(a => a.status === 'SCHEDULED');
                if (appt) {
                    setTelechatAppointmentId(appt.id);
                    setShowTelechat(true);
                }
                break;
            }
            case 'SCROLL_TO':
                if (action.target) {
                    const el = document.getElementById(action.target.replace('#', ''));
                    el?.scrollIntoView({ behavior: 'smooth' });
                }
                break;
            case 'REFRESH_DATA':
                setRefreshTrigger(prev => prev + 1);
                break;
            default:
                // Ignore unknown actions to avoid recursive event loops.
                console.warn('Unhandled doctor assistant action:', action);
                break;
        }
    };

    // --- ACTIONS ---

    const handleSaveConfig = async () => {
        setSavingConfig(true);
        try {
            await BackendAPI.updateDoctorSchedule({
                schedule,
                slotDuration,
                maxPatients,
            });
            const slots = await BackendAPI.getDoctorSlots(user.id, manageDate);
            setDailySlots(slots);
            alert("Schedule updated successfully.");
        } catch (e) { console.error(e); } finally { setSavingConfig(false); }
    };

    const handleToggleBlock = async (slot: TimeSlot) => {
        await BackendAPI.toggleSlotBlock(slot.id, !slot.isBlocked);
        const slots = await BackendAPI.getDoctorSlots(user.id, manageDate);
        setDailySlots(slots);
        if (slotDetails?.slot.id === slot.id) setSlotDetails(null);
    };

    const handleSlotClick = (slot: TimeSlot) => {
        if (slot.bookedCount > 0) {
            const slotAppts = appointments.filter(a =>
                (a.slotId === slot.id) ||
                (a.date === slot.date && a.time === slot.startTime && a.status !== 'CANCELLED' && a.status !== 'REJECTED')
            );
            setSlotDetails({ slot, appts: slotAppts });
        } else {
            handleToggleBlock(slot);
        }
    };

    const handleViewPassport = async (patientId: string) => {
        const passport = await MockBackend.getHealthPassport(patientId, user.id, UserRole.DOCTOR);
        if (passport) setPassportToView(passport);
        else alert("Health Passport not available or not shared by patient.");
    };

    const handleAddMedication = async () => {
        if (!selectedPatient || !newMedName || !newMedDosage) return;
        const safeDuration = Number.isFinite(newMedDurationDays) ? Math.max(1, Math.round(newMedDurationDays)) : 7;
        await BackendAPI.createMedicationOrder({
            patientId: selectedPatient.id,
            name: newMedName,
            dosage: newMedDosage,
            frequency: newMedFrequency,
            times: (newMedTimes && newMedTimes.length > 0) ? newMedTimes : defaultTimesForFrequency(newMedFrequency),
            startDate: newMedStartDate,
            durationDays: safeDuration,
            instructions: newMedInstructions.trim() || undefined,
        }).catch(() => (
            MockBackend.assignMedicationOrder({
                patientId: selectedPatient.id,
                doctorId: user.id,
                name: newMedName,
                dosage: newMedDosage,
                frequency: newMedFrequency,
                times: (newMedTimes && newMedTimes.length > 0) ? newMedTimes : defaultTimesForFrequency(newMedFrequency),
                startDate: newMedStartDate,
                durationDays: safeDuration,
                instructions: newMedInstructions.trim() || undefined,
            })
        ));

        const updatedMeds = await BackendAPI.getMedicationOrders({ patientId: selectedPatient.id, active: 'true' }).catch(() => (
            MockBackend.getMedications(selectedPatient.id)
        ));
        setPatientMeds(updatedMeds);

        const alerts = await BackendAPI.getDoctorMedicationAlerts().catch(() => (
            MockBackend.getDoctorMedicationAlerts(user.id)
        ));
        setMedAlerts(alerts);

        setNewMedName('');
        setNewMedDosage('');
        setNewMedFrequency('ONCE_DAILY');
        setNewMedTimes(['08:00']);
        setNewMedStartDate(new Date().toISOString().slice(0, 10));
        setNewMedDurationDays(7);
        setNewMedInstructions('');
    };

    const handleAcknowledgeMedAlert = async (alertId: string) => {
        await BackendAPI.acknowledgeDoctorMedicationAlert(alertId).catch(() => (
            MockBackend.acknowledgeDoctorMedicationAlert(user.id, alertId)
        ));
        const alerts = await BackendAPI.getDoctorMedicationAlerts().catch(() => (
            MockBackend.getDoctorMedicationAlerts(user.id)
        ));
        setMedAlerts(alerts);
    };

    const handleDeleteMedication = async (medId: string) => {
        if (!confirm("Remove this medication?")) return;

        await BackendAPI.deleteMedicationOrder(medId).catch(() => (
            MockBackend.deleteMedication(medId)
        ));

        if (selectedPatient) {
            const updatedMeds = await BackendAPI.getMedicationOrders({ patientId: selectedPatient.id, active: 'true' }).catch(() => (
                MockBackend.getMedications(selectedPatient.id)
            ));
            setPatientMeds(updatedMeds);
        }
    };

    const handleSaveNote = async () => {
        if (!selectedPatient) {
            alert('Select a patient first to save notes.');
            return;
        }

        const trimmed = clinicalNote.trim();
        if (!trimmed) return;

        const patientAppts = appointments.filter(a => a.patientId === selectedPatient.id);
        if (patientAppts.length === 0) {
            alert('No appointments found to attach this note to.');
            return;
        }

        const latestAppt = patientAppts[patientAppts.length - 1];
        try {
            const updated = await BackendAPI.updateAppointmentNotes({ appointmentId: latestAppt.id, notes: trimmed });
            setClinicalNote(updated.notes || '');
            setAppointments(prev => {
                const idx = prev.findIndex(a => a.id === updated.id);
                if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = updated;
                    return next;
                }
                return [...prev, updated];
            });
            alert('Clinical note saved to appointment.');
        } catch (e) {
            console.error(e);
            alert('Failed to save note. Please try again.');
        }
    };

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                const base64 = result.split(',')[1] || '';
                resolve(base64);
            };
            reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    };

    const handleOcrFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        if (!file.type.startsWith('image/')) {
            setOcrError('Please upload an image file (JPG, PNG).');
            return;
        }
        setOcrError(null);
        setOcrFile(file);
        if (ocrPreviewUrl) URL.revokeObjectURL(ocrPreviewUrl);
        setOcrPreviewUrl(URL.createObjectURL(file));
        setOcrResult(null);
        setOcrDraftMeds([]);
        setOcrApproved(false);
    };

    const handleRunPrescriptionOcr = async () => {
        if (!selectedPatient) {
            setOcrError('Select a patient before running OCR.');
            return;
        }
        if (!ocrFile) {
            setOcrError('Please choose a prescription image first.');
            return;
        }
        try {
            setOcrLoading(true);
            setOcrError(null);
            const base64 = await fileToBase64(ocrFile);
            const result = await GeminiService.analyzePrescriptionFromBase64(base64, ocrFile.type);
            setOcrResult(result);
            setOcrDraftMeds(result.medicines || []);
            setOcrApproved(false);
        } catch (err) {
            console.error(err);
            setOcrError('Failed to analyze prescription. Check your AI configuration and try again.');
        } finally {
            setOcrLoading(false);
        }
    };

    const handleUpdateOcrMedField = (index: number, field: keyof PrescriptionMedicine, value: string) => {
        setOcrDraftMeds(prev => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
    };

    const handleApproveOcrMedicines = async () => {
        if (!selectedPatient || ocrDraftMeds.length === 0) return;
        try {
            setOcrLoading(true);
            for (const med of ocrDraftMeds) {
                if (!med.name) continue;
                const rawFreq = (med.frequency || '').toLowerCase();
                const inferredTime = rawFreq.includes('night') || rawFreq.includes('evening')
                    ? '20:00'
                    : rawFreq.includes('noon') || rawFreq.includes('afternoon')
                        ? '14:00'
                        : '08:00';

                await BackendAPI.createMedicationOrder({
                    patientId: selectedPatient.id,
                    name: med.name,
                    dosage: med.dosage || med.frequency || '',
                    frequency: 'CUSTOM',
                    times: [inferredTime],
                    startDate: new Date().toISOString().slice(0, 10),
                    durationDays: 14,
                    instructions: med.notes || undefined,
                }).catch(() => (
                    MockBackend.addMedication(selectedPatient.id, med.name, med.dosage || med.frequency || '', med.frequency || 'Morning')
                ));
            }
            const updatedMeds = await BackendAPI.getMedicationOrders({ patientId: selectedPatient.id, active: 'true' }).catch(() => (
                MockBackend.getMedications(selectedPatient.id)
            ));
            setPatientMeds(updatedMeds);
            setOcrApproved(true);
        } catch (err) {
            console.error(err);
            setOcrError('Failed to approve extracted medicines.');
        } finally {
            setOcrLoading(false);
        }
    };

    // --- RENDERERS ---

    const renderMainDashboard = () => {
        const todayStr = new Date().toLocaleDateString('en-CA');
        const todaysAppts = appointments
            .filter(a => a.date === todayStr && a.status !== 'CANCELLED' && a.status !== 'REJECTED' && a.status !== 'COMPLETED')
            .slice()
            .sort((a, b) => {
                const t = a.time.localeCompare(b.time);
                if (t !== 0) return t;
                return (a.tokenNumber || 0) - (b.tokenNumber || 0);
            });

        const activeQueue = todaysAppts;

        const activeQueueIndexById = new Map(activeQueue.map((a, idx) => [a.id, idx] as const));
        const getAhead = (appointmentId: string): number => {
            return queueByAppointmentId[appointmentId]?.ahead ?? activeQueueIndexById.get(appointmentId) ?? 0;
        };
        const getDelayMinutes = (appointmentId: string): number => {
            return queueByAppointmentId[appointmentId]?.delayMinutes ?? (getAhead(appointmentId) * (slotDuration || 30));
        };

        // Determine next patient
        const nextAppt = activeQueue.find(a => a.status === 'IN_PROGRESS') || activeQueue[0];
        const summaryCandidates = nextAppt ? (consultationSummariesByPatientId[nextAppt.patientId] || []) : [];
        const quickSummary = nextAppt
            ? (summaryCandidates.find(s => s.appointmentId !== nextAppt.id) || summaryCandidates[0] || null)
            : null;

        return (
            <>
                <div className="space-y-8">
                    {/* Header Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            { icon: '📅', label: "Protocol Count", value: todaysAppts.length, color: 'neon-400' },
                            { icon: '👥', label: "Subject Database", value: analytics?.totalPatients || 0, color: 'bio-400' },
                            { icon: '⏳', label: "Pending Syncs", value: appointments.filter(a => a.status === 'PENDING').length, color: 'pulse-400' },
                        ].map((stat, i) => (
                            <div key={i} className="group bg-white/5 border border-white/10 p-6 rounded-[24px] shadow-sm flex items-center gap-4 hover:shadow-neon-500/10 transition-all hover:bg-white/10 glass-card">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl bg-space-900 border border-${stat.color}/20 text-${stat.color} group-hover:scale-110 transition-transform shadow-inner`}>
                                    {stat.icon}
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">{stat.label}</p>
                                    <p className="text-4xl font-bold text-white font-['Space_Grotesk'] tracking-tight group-hover:text-neon-400 transition-colors">{stat.value}</p>
                                </div>
                            </div>
                        ))}
                    </div>


                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* LEFT: Live Queue / Next Patient */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Live Queue</h3>
                                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold animate-pulse">● Live</span>
                            </div>

                            {nextAppt ? (
                                <div className="bg-space-900/80 rounded-[40px] p-10 text-white shadow-2xl relative overflow-hidden border border-neon-500/20 glass-card group">
                                    <div className="absolute top-0 right-0 w-80 h-80 bg-neon-600/10 rounded-full blur-[100px] -mr-20 -mt-20 pointer-events-none group-hover:bg-neon-600/20 transition-all duration-700"></div>
                                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-bio-600/10 rounded-full blur-[80px] -ml-16 -mb-16 pointer-events-none"></div>

                                    <div className="relative z-10">
                                        <div className="flex flex-col lg:flex-row justify-between lg:items-start mb-10 gap-6">
                                            <div>
                                                <div className="flex items-center gap-2 mb-4">
                                                    <span className="px-3 py-1 rounded-full bg-neon-500/10 border border-neon-500/30 text-[10px] font-bold uppercase tracking-[0.2em] text-neon-400 backdrop-blur-md">
                                                        Up Next • {nextAppt.time}
                                                    </span>
                                                    <span className="px-3 py-1 rounded-full bg-bio-500/10 border border-bio-500/30 text-[10px] font-bold uppercase tracking-[0.2em] text-bio-400 backdrop-blur-md">
                                                        Connection Ready
                                                    </span>
                                                </div>
                                                <h2 className="text-4xl md:text-6xl font-bold mb-4 tracking-tight font-['Space_Grotesk'] text-transparent bg-clip-text bg-gradient-to-r from-neon-400 via-bio-300 to-white">{nextAppt.patientName}</h2>
                                                <div className="flex flex-wrap items-center gap-4 text-slate-400 text-sm font-light">
                                                    <span className="flex items-center gap-2">
                                                        {nextAppt.consultationType === 'VIDEO' ? <span className="text-xl">🎥</span> : <span className="text-xl">🏥</span>}
                                                        {nextAppt.consultationType === 'VIDEO' ? 'Virtual Comms' : 'Physical Arrival'}
                                                    </span>
                                                    <span className="w-1.5 h-1.5 bg-slate-700 rounded-full hidden md:block"></span>
                                                    <span className="text-slate-300 font-medium">{nextAppt.symptoms || 'General Sync'}</span>
                                                </div>
                                                <div className="mt-6 flex items-center gap-4 p-3 bg-white/5 rounded-2xl border border-white/5 w-fit">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-2 h-2 rounded-full bg-bio-400 animate-pulse" />
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                                                            Protocol Delay: <span className="text-bio-400">~{getDelayMinutes(nextAppt.id)}m</span>
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="bg-space-950/60 backdrop-blur-xl px-8 py-6 rounded-[24px] text-center border border-white/10 shadow-2xl relative group/token overflow-hidden">
                                                <div className="absolute inset-0 bg-neon-500/5 opacity-0 group-hover/token:opacity-100 transition-opacity"></div>
                                                <p className="text-[10px] font-bold uppercase opacity-50 tracking-[0.3em] mb-2 relative z-10">Subject ID</p>
                                                <p className="text-5xl font-bold text-neon-400 font-['Space_Grotesk'] relative z-10 drop-shadow-[0_0_10px_rgba(0,212,255,0.5)]">#{nextAppt.tokenNumber || 1}</p>
                                            </div>
                                        </div>

                                        {quickSummary && (
                                            <div className="mb-10 rounded-[28px] bg-white/5 border border-white/10 p-6 max-w-4xl backdrop-blur-md relative overflow-hidden group/summary">
                                                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-neon-500 to-bio-500"></div>
                                                <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-neon-400 mb-4 flex items-center gap-2">
                                                    <span className="text-xl">🤖</span> AI Biometric Recap
                                                </p>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                                                    <div>
                                                        <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-1.5">Previous Condition</p>
                                                        <p className="text-white font-medium leading-relaxed">{quickSummary.possibleCondition}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-1.5">Recommendations</p>
                                                        <p className="text-white font-medium leading-relaxed">{quickSummary.recommendations}</p>
                                                    </div>
                                                </div>
                                                <p className="text-[9px] text-slate-600 mt-5 uppercase font-black tracking-widest border-t border-white/5 pt-4">Heuristic AI Analysis • Critical Review Required</p>
                                            </div>
                                        )}

                                        <div className="flex flex-wrap gap-4">
                                            {nextAppt.status !== 'IN_PROGRESS' && (
                                                <Button
                                                    variant="neon"
                                                    className="rounded-2xl px-8 h-14 text-[11px] font-bold uppercase tracking-widest shadow-neon-500/20"
                                                    onClick={() => BackendAPI.updateAppointmentStatus({ appointmentId: nextAppt.id, status: 'IN_PROGRESS' })}
                                                >
                                                    Initialize Protocol
                                                </Button>
                                            )}
                                            {nextAppt.status === 'IN_PROGRESS' && (
                                                <>
                                                    <Button
                                                        variant="neon"
                                                        className="bg-bio-500 hover:bg-bio-600 border-bio-400/50 rounded-2xl px-8 h-14 text-[11px] font-bold uppercase tracking-widest shadow-bio-500/20"
                                                        onClick={() => BackendAPI.updateAppointmentStatus({ appointmentId: nextAppt.id, status: 'COMPLETED' })}
                                                    >
                                                        Complete Cycle
                                                    </Button>
                                                    {nextAppt.consultationType === 'VIDEO' && (
                                                        <Button
                                                            variant="cyber"
                                                            className="rounded-2xl px-8 h-14 text-[11px] font-bold uppercase tracking-widest"
                                                            onClick={() => {
                                                                setTelechatAppointmentId(nextAppt.id);
                                                                setShowTelechat(true);
                                                            }}
                                                        >
                                                            Link Comms
                                                        </Button>
                                                    )}
                                                    {nextAppt.consultationType === 'VIDEO' && (
                                                        <Button
                                                            variant="neon"
                                                            className="rounded-2xl px-8 h-14 text-[11px] font-bold uppercase tracking-widest"
                                                            onMouseEnter={prefetchVideoCall}
                                                            onFocus={prefetchVideoCall}
                                                            onClick={() => {
                                                                prefetchVideoCall();
                                                                setVideoAppointment(nextAppt);
                                                                setShowVideoCall(true);
                                                            }}
                                                        >
                                                            Visual Uplink
                                                        </Button>
                                                    )}
                                                </>
                                            )}
                                            <Button
                                                variant="cyber"
                                                className="rounded-2xl px-8 h-14 text-[11px] font-bold uppercase tracking-widest border-white/10"
                                                onClick={() => {
                                                    const p = patients.find(pat => pat.id === nextAppt.patientId);
                                                    const fallbackPatient: PatientProfile = {
                                                        id: nextAppt.patientId,
                                                        name: nextAppt.patientName,
                                                        email: `${nextAppt.patientId}@carexai.local`,
                                                        role: UserRole.PATIENT,
                                                        age: 0,
                                                        gender: 'Other',
                                                        riskStatus: 'STABLE',
                                                        lastVisit: nextAppt.date,
                                                        assignedDoctorId: user.id,
                                                        sharedWithDoctors: [user.id],
                                                    };
                                                    setSelectedPatient(p || fallbackPatient);
                                                    setViewMode('patients');
                                                }}
                                            >
                                                Access Data Vault
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-space-950/20 rounded-[40px] p-20 text-center border-2 border-dashed border-white/5 group">
                                    <div className="w-20 h-20 bg-space-900 rounded-[24px] flex items-center justify-center mx-auto mb-6 text-4xl shadow-inner border border-white/5 opacity-50 group-hover:scale-110 group-hover:opacity-100 transition-all">☕</div>
                                    <h3 className="text-xl font-bold text-slate-400 uppercase tracking-widest font-['Space_Grotesk']">Nominal Status</h3>
                                    <p className="text-slate-600 text-[10px] mt-2 uppercase tracking-widest">No active queue items detected.</p>
                                </div>
                            )}


                            <div className="bg-space-900 border border-white/5 rounded-[28px] shadow-2xl overflow-hidden glass-card">
                                <div className="p-6 border-b border-white/10 font-bold text-slate-500 text-[10px] uppercase tracking-[0.3em] bg-white/5">
                                    Current Timeline
                                </div>
                                <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                                    {todaysAppts.length === 0 && <div className="p-12 text-center text-slate-600 text-xs italic tracking-widest uppercase">No Active Protocols.</div>}
                                    {todaysAppts.map((appt, idx) => (
                                        <div key={appt.id} className="p-5 flex items-center hover:bg-white/5 transition-all border-b border-white/5 last:border-0 group">
                                            <div className="w-24 text-xs font-bold text-neon-400 font-mono tracking-tighter group-hover:text-neon-300 transition-colors">{appt.time}</div>
                                            <div className="flex-1">
                                                <p className="font-bold text-white font-['Space_Grotesk'] tracking-tight text-base group-hover:translate-x-1 transition-transform">{appt.patientName}</p>
                                                <div className="flex items-center gap-3 mt-1.5">
                                                    <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">{appt.type}</span>
                                                    <span className="w-1 h-1 bg-slate-800 rounded-full"></span>
                                                    <span className="font-mono text-[10px] text-slate-500">#{appt.tokenNumber || (idx + 1)}</span>
                                                    {appt.notes && (
                                                        <span className="inline-flex items-center text-[9px] font-black px-2 py-0.5 rounded bg-bio-500/10 text-bio-400 border border-bio-500/30 uppercase tracking-tighter">
                                                            Data Cached
                                                        </span>
                                                    )}
                                                </div>
                                                {appt.symptoms && (
                                                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                                                        Symptoms: {appt.symptoms}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex gap-3 items-center">
                                                {appt.status === 'COMPLETED' ? (
                                                    <span className="text-[9px] font-black text-bio-400 bg-bio-500/10 px-3 py-1.5 rounded-lg border border-bio-500/20 uppercase tracking-widest">Nominal</span>
                                                ) : (
                                                    <>
                                                        <div className="hidden lg:flex flex-col items-end mr-2">
                                                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Queue Status</span>
                                                            <span className="text-[10px] font-black text-neon-400 shadow-neon-400/20">Ahead {getAhead(appt.id)}</span>
                                                        </div>
                                                        {appt.status !== 'IN_PROGRESS' && (
                                                            <button
                                                                onClick={() => BackendAPI.updateAppointmentStatus({ appointmentId: appt.id, status: 'IN_PROGRESS' })}
                                                                className="px-4 py-2 text-[10px] font-bold rounded-xl bg-neon-400/10 text-neon-400 hover:bg-neon-400 hover:text-white border border-neon-400/30 transition-all uppercase tracking-widest shadow-lg"
                                                            >
                                                                Link
                                                            </button>
                                                        )}
                                                        {appt.status === 'IN_PROGRESS' && (
                                                            <button
                                                                onClick={() => BackendAPI.updateAppointmentStatus({ appointmentId: appt.id, status: 'COMPLETED' })}
                                                                className="px-4 py-2 text-[10px] font-bold rounded-xl bg-bio-400/10 text-bio-400 hover:bg-bio-400 hover:text-white border border-bio-400/30 transition-all uppercase tracking-widest shadow-lg"
                                                            >
                                                                Finalize
                                                            </button>
                                                        )}
                                                        <Button size="sm" variant="cyber" className="h-9 text-[10px] px-4 font-bold uppercase tracking-widest" onClick={() => {
                                                            const p = patients.find(pat => pat.id === appt.patientId);
                                                            const fallbackPatient: PatientProfile = {
                                                                id: appt.patientId,
                                                                name: appt.patientName,
                                                                email: `${appt.patientId}@carexai.local`,
                                                                role: UserRole.PATIENT,
                                                                age: 0,
                                                                gender: 'Other',
                                                                riskStatus: 'STABLE',
                                                                lastVisit: appt.date,
                                                                assignedDoctorId: user.id,
                                                                sharedWithDoctors: [user.id],
                                                            };
                                                            setSelectedPatient(p || fallbackPatient);
                                                            setViewMode('patients');
                                                        }}>View File</Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>

                        {/* RIGHT: Quick Actions & Alerts */}
                        <div className="space-y-6">
                            <Card title="Operational Alerts" className="border-neon-500/10 glass-card-dark">
                                {analytics && analytics.pendingRequests > 0 && (
                                    <div className="bg-pulse-500/10 border-l-4 border-pulse-500 p-5 rounded-r-2xl mb-6 shadow-[0_0_20px_rgba(255,0,110,0.1)] relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-20 h-20 bg-pulse-500/5 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500"></div>
                                        <div className="flex justify-between items-start relative z-10">
                                            <div>
                                                <p className="text-sm text-pulse-400 font-bold uppercase tracking-wider">{analytics.pendingRequests} Sync Requests</p>
                                                <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-widest">Protocol validation required</p>
                                            </div>
                                            <span className="text-2xl drop-shadow-[0_0_8px_rgba(255,0,110,0.6)]">🔔</span>
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-3">
                                    <Button variant="outline" className="w-full justify-start text-[10px] font-black uppercase tracking-[0.25em] h-14 rounded-2xl border-white/5 bg-white/5 hover:border-neon-400 hover:bg-neon-400/5 group transition-all" onClick={() => { setViewMode('patients'); setSelectedPatient(null); }}>
                                        <span className="mr-3 text-2xl group-hover:scale-110 transition-transform">📂</span> Patient Directory
                                    </Button>
                                    <Button variant="outline" className="w-full justify-start text-[10px] font-black uppercase tracking-[0.25em] h-14 rounded-2xl border-white/5 bg-white/5 hover:border-bio-400 hover:bg-bio-400/5 group transition-all" onClick={() => setViewMode('schedule')}>
                                        <span className="mr-3 text-2xl group-hover:scale-110 transition-transform">📅</span> Manage Shifts
                                    </Button>
                                    <Button variant="outline" className="w-full justify-start text-[10px] font-black uppercase tracking-[0.25em] h-14 rounded-2xl border-white/5 bg-white/5 hover:border-neon-400 hover:bg-neon-400/5 group transition-all" onClick={() => setViewMode('analytics')}>
                                        <span className="mr-3 text-2xl group-hover:scale-110 transition-transform">📊</span> Insights Panel
                                    </Button>
                                </div>
                            </Card>
                        </div>

                    </div>
                </div>
                {showTelechat && telechatAppointmentId && (
                    <ChatPanel
                        currentUser={{ id: user.id, name: user.name }}
                        appointmentId={telechatAppointmentId}
                        onClose={() => setShowTelechat(false)}
                    />
                )}

                {showVideoCall && videoAppointment && (
                    <Suspense fallback={<div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm" />}>
                        <LazyVideoCall
                            appointmentId={videoAppointment.id}
                            otherUserName={videoAppointment.patientName}
                            currentUserRole={UserRole.DOCTOR}
                            onClose={() => {
                                setShowVideoCall(false);
                                setVideoAppointment(null);
                            }}
                        />
                    </Suspense>
                )}
            </>
        );
    };

    // --- ANALYTICS VIEW ---
    const renderAnalyticsView = () => {
        if (!analytics) return <div className="p-12 text-center text-slate-500 font-bold uppercase tracking-[0.3em] animate-pulse">Synchronizing Data...</div>;

        const COLORS = ['#00d4ff', '#00ff9f', '#ff006e', '#8b5cf6'];

        return (
            <div className="space-y-10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h2 className="text-3xl md:text-5xl font-black text-[var(--text-main)] font-display tracking-tight">Practice Intelligence</h2>
                        <p className="text-[10px] text-[var(--text-muted)] uppercase font-black tracking-[0.3em] mt-2">Biometric distribution and protocol efficacy metrics.</p>
                    </div>
                    <div className="flex glass-card p-1 border-[var(--glass-border)] shadow-2xl">
                        <button className="px-6 py-2 text-[10px] font-black uppercase tracking-widest bg-[var(--accent-primary)] text-white rounded-xl shadow-lg transition-all">Cycle: 30D</button>
                        <button className="px-6 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors">YTD</button>
                    </div>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div className="glass-card p-8 rounded-[32px] relative overflow-hidden group border-[var(--glass-border)]">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent-primary)] opacity-5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700"></div>
                        <div className="relative z-10">
                            <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.3em] mb-4">Subject Total</p>
                            <h3 className="text-5xl font-black text-[var(--text-main)] font-display tracking-tighter mb-2">{analytics.totalPatients}</h3>
                            <p className="text-[10px] text-[var(--accent-secondary)] font-black uppercase tracking-widest flex items-center gap-2">
                                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--accent-secondary)]/10">↑</span>
                                <span>+12.4% Δ</span>
                            </p>
                        </div>
                    </div>

                    <div className="glass-card p-8 rounded-[32px] relative overflow-hidden group border-[var(--glass-border)]">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent-secondary)] opacity-5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700"></div>
                        <div className="relative z-10">
                            <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.3em] mb-4">Protocol Efficacy</p>
                            <h3 className="text-5xl font-black text-[var(--text-main)] font-display tracking-tighter mb-2">{analytics.completionRate}%</h3>
                            <div className="w-full bg-black/20 h-2 rounded-full mt-4 overflow-hidden border border-[var(--glass-border)] shadow-inner">
                                <div className="bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] h-full rounded-full shadow-[var(--neon-glow)]" style={{ width: `${analytics.completionRate}%` }}></div>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card p-8 rounded-[32px] relative overflow-hidden group border-[var(--glass-border)]">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent-pulse)] opacity-5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700"></div>
                        <div className="relative z-10">
                            <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.3em] mb-4">Daily Cycles</p>
                            <h3 className="text-5xl font-black text-[var(--text-main)] font-display tracking-tighter mb-2">{analytics.appointmentsToday}</h3>
                            <p className="text-[10px] text-[var(--text-muted)] mt-2 uppercase font-black tracking-widest">{analytics.pendingRequests} Syncs Queued</p>
                        </div>
                    </div>
                </div>


                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <Card title="Subject Growth Index" className="border-white/5 glass-card-dark">
                        <div className="h-80 w-full pt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={analytics.patientTrends}>
                                    <defs>
                                        <linearGradient id="colorPatients" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff" strokeOpacity={0.05} />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0a0b14', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', color: '#fff' }}
                                        itemStyle={{ color: '#00d4ff', fontSize: '12px', fontWeight: 'bold' }}
                                        cursor={{ stroke: '#00d4ff', strokeWidth: 1, strokeDasharray: '4 4' }}
                                    />
                                    <Area type="monotone" dataKey="count" stroke="#00d4ff" strokeWidth={4} fillOpacity={1} fill="url(#colorPatients)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    <Card title="Module Utilization" className="border-white/5 glass-card-dark">
                        <div className="h-80 w-full flex items-center justify-center pt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={analytics.appointmentDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={70}
                                        outerRadius={100}
                                        fill="#8884d8"
                                        paddingAngle={8}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {analytics.appointmentDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: '#0a0b14', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 'bold' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>

                {/* Feedback Keywords */}
                <Card title="Biometric Sentiment Pulse" className="border-white/5 glass-card-dark">
                    <div className="h-72 w-full pt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={analytics.feedbackKeywords}
                                layout="vertical"
                                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#ffffff" strokeOpacity={0.05} />
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="word" tick={{ fill: '#94a3b8', fontWeight: 'bold', fontSize: 10, style: { textTransform: 'uppercase' } }} width={120} axisLine={false} tickLine={false} />
                                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} contentStyle={{ backgroundColor: '#0a0b14', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                                <Bar dataKey="count" fill="url(#barGradient)" radius={[0, 8, 8, 0]} barSize={24}>
                                    <defs>
                                        <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="#00ff9f" stopOpacity={0.8} />
                                            <stop offset="100%" stopColor="#00ff9f" stopOpacity={0.2} />
                                        </linearGradient>
                                    </defs>
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>
        );
    };


    const renderScheduleView = () => (
        <div className="space-y-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h2 className="text-3xl md:text-4xl font-bold text-white font-['Space_Grotesk'] tracking-tight">Shift Matrix</h2>
                    <p className="text-xs text-slate-500 uppercase tracking-widest mt-2">Temporal availability and resource allocation.</p>
                </div>
                <div className="flex items-center gap-4 bg-space-900 px-6 py-3 rounded-2xl border border-white/10 glass-card shadow-2xl">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Target Date:</span>
                    <input
                        type="date"
                        className="bg-transparent border-none focus:ring-0 text-white font-bold text-sm selection:bg-neon-500/30"
                        value={manageDate}
                        onChange={e => setManageDate(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Daily Slots Grid */}
                <Card className="lg:col-span-2 border-white/5 glass-card-dark" title={`Operational Grid: ${new Date(manageDate).toLocaleDateString()}`}>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 max-h-[500px] overflow-y-auto custom-scrollbar p-2">
                        {dailySlots.length === 0 && <div className="col-span-full py-20 text-center text-slate-600 uppercase tracking-[0.3em] font-black text-xs border border-dashed border-white/5 rounded-[32px]">No Active Vectors Detected</div>}
                        {dailySlots.map(slot => {
                            const isFull = slot.bookedCount >= slot.maxPatients;
                            return (
                                <button
                                    key={slot.id}
                                    onClick={() => handleSlotClick(slot)}
                                    className={`group p-4 rounded-[20px] text-xs font-black border transition-all relative overflow-hidden ${slot.isBlocked
                                        ? 'bg-space-950/50 text-slate-700 border-white/5 cursor-not-allowed opacity-50'
                                        : isFull
                                            ? 'bg-pulse-500/10 text-pulse-400 border-pulse-500/30'
                                            : 'bg-white/5 text-white border-white/10 hover:border-neon-400 hover:bg-neon-400/5 hover:scale-105 active:scale-95'
                                        }`}
                                >
                                    <span className="relative z-10 tracking-widest">{slot.startTime}</span>
                                    {!slot.isBlocked && !isFull && (
                                        <div className="absolute inset-0 bg-neon-400 opacity-0 group-hover:opacity-5 transition-opacity" />
                                    )}
                                    {slot.bookedCount > 0 && (
                                        <span className="absolute -top-1 -right-1 w-6 h-6 bg-neon-500 text-white rounded-lg flex items-center justify-center text-[10px] font-black shadow-[0_0_10px_rgba(0,212,255,0.4)] border border-white/20 transform rotate-12 group-hover:rotate-0 transition-transform">
                                            {slot.bookedCount}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Slot Details Panel */}
                    <AnimatePresence>
                        {slotDetails && (
                            <motion.div
                                initial={{ height: 0, opacity: 0, scale: 0.95 }}
                                animate={{ height: 'auto', opacity: 1, scale: 1 }}
                                exit={{ height: 0, opacity: 0, scale: 0.95 }}
                                className="mt-10 border-t border-white/10 pt-8"
                            >
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-neon-400 animate-pulse"></div>
                                        <h4 className="font-bold text-white font-['Space_Grotesk'] text-xl uppercase tracking-tight">
                                            Vector Details: {slotDetails.slot.startTime}
                                        </h4>
                                    </div>
                                    <div className="flex gap-4">
                                        <Button size="sm" variant={slotDetails.slot.isBlocked ? "neon" : "cyber"} className={slotDetails.slot.isBlocked ? "bg-neon-400" : "text-pulse-400 border-pulse-400/30"} onClick={() => handleToggleBlock(slotDetails.slot)}>
                                            {slotDetails.slot.isBlocked ? "Unlock Vector" : "Secure Vector"}
                                        </Button>
                                        <button onClick={() => setSlotDetails(null)} className="text-slate-500 hover:text-white transition-colors bg-white/5 p-2 rounded-lg">✕</button>
                                    </div>
                                </div>
                                {slotDetails.appts.length === 0 ? (
                                    <div className="p-8 rounded-[24px] bg-white/5 border border-white/5 text-center text-slate-600 text-[10px] font-black uppercase tracking-widest">Zero Registered Syncs</div>
                                ) : (
                                    <div className="space-y-4">
                                        {slotDetails.appts.map(a => (
                                            <div key={a.id} className="flex justify-between items-center p-5 bg-white/5 rounded-[20px] text-sm border border-white/5 hover:border-white/10 transition-colors group">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-space-950 border border-white/10 flex items-center justify-center font-black text-neon-400 text-xs">
                                                        {a.patientName.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-white block uppercase tracking-wide">{a.patientName}</span>
                                                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{a.type} • {a.consultationType}</span>
                                                    </div>
                                                </div>
                                                <div className="group-hover:translate-x-1 transition-transform">
                                                    <span className="text-neon-400 text-xs font-black uppercase tracking-widest">Active</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Card>

                {/* Configuration Panel */}
                <div className="space-y-8">
                    <Card title="Matrix Configuration" className="border-white/5 glass-card-dark">
                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] block mb-3 pl-1">Vector Resolution (mins)</label>
                                <select
                                    className="w-full h-14 px-5 rounded-[20px] bg-space-950 border border-white/10 text-white font-bold text-sm focus:ring-2 focus:ring-neon-400/30 focus:border-neon-400 transition-all appearance-none cursor-pointer"
                                    value={slotDuration}
                                    onChange={e => setSlotDuration(parseInt(e.target.value))}
                                >
                                    <option value={15}>15 Units</option>
                                    <option value={30}>30 Units</option>
                                    <option value={45}>45 Units</option>
                                    <option value={60}>60 Units</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] block mb-3 pl-1">Subject Limit / Vector</label>
                                <input
                                    type="number"
                                    className="w-full h-14 px-5 rounded-[20px] bg-space-950 border border-white/10 text-white font-bold text-sm focus:ring-2 focus:ring-neon-400/30 focus:border-neon-400 transition-all"
                                    value={maxPatients}
                                    onChange={e => setMaxPatients(parseInt(e.target.value))}
                                    min={1}
                                    max={10}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] block mb-4 pl-1">Weekly Cycles</label>
                                <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                                    {schedule.map((day, idx) => (
                                        <div key={day.day} className="flex items-center justify-between p-4 bg-white/5 rounded-[20px] border border-white/5 group hover:border-white/10 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    className="w-5 h-5 rounded-lg bg-space-950 border-white/10 text-neon-400 focus:ring-neon-400 focus:ring-offset-space-950 transition-all cursor-pointer"
                                                    checked={day.available}
                                                    onChange={e => {
                                                        const newSched = [...schedule];
                                                        newSched[idx].available = e.target.checked;
                                                        setSchedule(newSched);
                                                    }}
                                                />
                                                <span className="font-black text-white text-xs uppercase tracking-widest">{day.day}</span>
                                            </div>
                                            {day.available && (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="time"
                                                        className="bg-transparent border-none p-0 text-[10px] font-black text-neon-400 focus:ring-0 uppercase tracking-tighter"
                                                        value={day.startTime}
                                                        onChange={e => {
                                                            const newSched = [...schedule];
                                                            newSched[idx].startTime = e.target.value;
                                                            setSchedule(newSched);
                                                        }}
                                                    />
                                                    <span className="text-slate-700 font-bold">|</span>
                                                    <input
                                                        type="time"
                                                        className="bg-transparent border-none p-0 text-[10px] font-black text-neon-400 focus:ring-0 uppercase tracking-tighter"
                                                        value={day.endTime}
                                                        onChange={e => {
                                                            const newSched = [...schedule];
                                                            newSched[idx].endTime = e.target.value;
                                                            setSchedule(newSched);
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <Button className="w-full h-14 rounded-[24px] text-[11px] font-black uppercase tracking-[0.3em] bg-neon-400 hover:bg-neon-500 shadow-neon-400/20" onClick={handleSaveConfig} isLoading={savingConfig}>Synchronize Matrix</Button>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );


    const renderPatientsView = () => {
        return (
            <div className="space-y-6">
                <div className="mb-8">
                    <h2 className="text-3xl md:text-4xl font-bold text-white font-['Space_Grotesk'] tracking-tight">Subject Directory</h2>
                    <p className="text-xs text-slate-500 uppercase tracking-widest mt-2">Access master database records.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {patients.length === 0 && (
                        <p className="text-slate-400 italic col-span-full border border-dashed border-white/5 rounded-2xl p-10 text-center uppercase tracking-[0.3em] font-black text-xs">
                            No active subjects located.
                        </p>
                    )}
                    {patients.map(p => (
                        <div key={p.id} onClick={() => setSelectedPatient(p)} className="bg-space-900 p-6 rounded-[24px] shadow-sm border border-white/10 hover:border-neon-400 hover:shadow-[0_0_20px_rgba(0,212,255,0.1)] hover:-translate-y-1 cursor-pointer transition-all flex items-center justify-between group glass-card">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-space-950 border border-white/10 flex items-center justify-center text-lg font-black text-neon-400 shadow-inner group-hover:scale-110 transition-transform">
                                    {p.name.charAt(0)}
                                </div>
                                <div>
                                    <div className="font-bold text-lg text-white font-['Space_Grotesk'] tracking-tight group-hover:text-neon-400 transition-colors">{p.name}</div>
                                    <div className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mt-1">
                                        {p.age > 0 ? `${p.age} yrs` : 'Age N/A'} • {p.gender}
                                    </div>
                                </div>
                            </div>
                            <div className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${p.riskStatus === 'CRITICAL' ? 'bg-pulse-500/10 text-pulse-400 border-pulse-500/30 shadow-[0_0_10px_rgba(255,0,110,0.2)]' :
                                    p.riskStatus === 'WATCH' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                                        'bg-bio-500/10 text-bio-400 border-bio-500/30'
                                }`}>
                                {p.riskStatus}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderPatientDetails = () => {
        if (!selectedPatient) return null;

        const patientAppts = appointments.filter(a => a.patientId === selectedPatient.id);
        const latestAppt = patientAppts.length > 0 ? patientAppts[patientAppts.length - 1] : null;

        return (
            <div className="space-y-10 animate-in fade-in duration-500 pb-24">
                {/* Header / Info */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex items-center gap-6">
                        <button onClick={() => setSelectedPatient(null)} className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-neon-400 transition-all group">
                            <span className="text-2xl group-hover:-translate-x-1 transition-transform">←</span>
                        </button>
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-3xl md:text-5xl font-bold text-white font-['Space_Grotesk'] tracking-tight">{selectedPatient.name}</h2>
                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                    selectedPatient.riskStatus === 'CRITICAL' ? 'bg-pulse-500/10 text-pulse-400 border-pulse-500/30 shadow-[0_0_10px_rgba(255,0,110,0.2)]' :
                                    selectedPatient.riskStatus === 'WATCH' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                                    'bg-bio-500/10 text-bio-400 border-bio-500/30'
                                }`}>
                                    {selectedPatient.riskStatus}
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-2">
                                {selectedPatient.age > 0 ? `${selectedPatient.age} yrs` : 'Age N/A'} • {selectedPatient.gender} • {selectedPatient.bloodGroup || 'Blood Group N/A'}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3 relative z-10 w-full md:w-auto">
                        <Button variant="cyber" className="w-full md:w-auto h-12 px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest border-white/10" onClick={() => handleViewPassport(selectedPatient.id)}>
                            Access Health Passport
                        </Button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/10 overflow-x-auto custom-scrollbar pt-4">
                    {(['OVERVIEW', 'HISTORY', 'MEDS', 'DOCUMENTS', 'SUMMARIES', 'NOTES'] as PatientTab[]).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setPatientTab(tab)}
                            className={`px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] border-b-2 transition-all whitespace-nowrap ${patientTab === tab
                                ? 'border-neon-400 text-neon-400 bg-neon-400/5'
                                : 'border-transparent text-slate-500 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="min-h-[400px]">
                    {patientTab === 'OVERVIEW' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                            <Card title="Latest Vitals" className="border-white/5 glass-card-dark">
                                {patientHistory.length > 0 ? (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-space-950 p-4 rounded-[20px] border border-white/5 relative overflow-hidden group">
                                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1">Blood Pressure</p>
                                                <p className="text-2xl font-black text-white font-['Space_Grotesk'] tracking-tight group-hover:text-neon-400 transition-colors">
                                                    {patientHistory[patientHistory.length - 1].systolicBP}/{patientHistory[patientHistory.length - 1].diastolicBP}
                                                </p>
                                            </div>
                                            <div className="bg-space-950 p-4 rounded-[20px] border border-white/5 relative overflow-hidden group">
                                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1">Glucose</p>
                                                <p className="text-2xl font-black text-white font-['Space_Grotesk'] tracking-tight group-hover:text-bio-400 transition-colors">
                                                    {patientHistory[patientHistory.length - 1].glucose} <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">mg/dL</span>
                                                </p>
                                            </div>
                                        </div>
                                        {/* Symptom Risk Profile display if available */}
                                        {selectedPatient.symptomRiskProfile && (
                                            <div className="mt-4 border-t border-white/10 pt-4">
                                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-neon-400 mb-3">Symptom Screening</h4>
                                                <div className="flex gap-4">
                                                    <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">BP Risk: <b className="text-white">{selectedPatient.symptomRiskProfile.bpRisk}</b></span>
                                                    <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">Glucose Risk: <b className="text-white">{selectedPatient.symptomRiskProfile.glucoseRisk}</b></span>
                                                </div>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mt-3">Last Screen: {new Date(selectedPatient.symptomRiskProfile.lastScreeningDate).toLocaleDateString()}</p>
                                            </div>
                                        )}
                                        {riskUpdateSummary && (
                                            <div className="mt-4 border-t border-white/10 pt-4 group/risk">
                                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-pulse-400 mb-2 flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-pulse-500 animate-pulse"></span>
                                                    Clinical Risk Update
                                                </h4>
                                                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                                                    {riskUpdateSummary}
                                                </p>
                                                <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mt-3 opacity-50 group-hover/risk:opacity-100 transition-opacity">
                                                    Generated from latest recorded vitals and stored risk scores. Always interpret in full clinical context.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ) : <p className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-600 p-8 text-center border border-dashed border-white/5 rounded-[20px]">No vitals history recorded.</p>}
                            </Card>

                            <Card title="Active Medications" className="border-white/5 glass-card-dark">
                                {patientMeds.length === 0 && <p className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-600 p-8 text-center border border-dashed border-white/5 rounded-[20px]">No active medications.</p>}
                                {medSafetyAlert && (
                                    <div className={`mb-4 rounded-[20px] border p-4 text-xs font-medium leading-relaxed relative overflow-hidden group/alert ${medSafetyAlert.severity === 'HIGH'
                                            ? 'bg-pulse-500/10 border-pulse-500/30 text-pulse-100 shadow-[0_0_20px_rgba(255,0,110,0.15)]'
                                            : medSafetyAlert.severity === 'MEDIUM'
                                                ? 'bg-neon-500/10 border-neon-500/30 text-neon-100'
                                                : 'bg-bio-500/10 border-bio-500/30 text-bio-100'
                                        }`}>
                                        <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl -mr-12 -mt-12 pointer-events-none group-hover/alert:scale-150 transition-transform"></div>
                                        <div className="flex items-center justify-between mb-3 relative z-10">
                                            <span className={`font-black uppercase tracking-[0.2em] text-[10px] flex items-center gap-2 ${medSafetyAlert.severity === 'HIGH' ? 'text-pulse-400' :
                                                    medSafetyAlert.severity === 'MEDIUM' ? 'text-neon-400' : 'text-bio-400'
                                                }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${medSafetyAlert.severity === 'HIGH' ? 'bg-pulse-400' :
                                                        medSafetyAlert.severity === 'MEDIUM' ? 'bg-neon-400' : 'bg-bio-400'
                                                    }`}></span>
                                                Medication Safety Alert
                                            </span>
                                            <span className="text-[9px] font-black uppercase tracking-widest text-white/50">{medSafetyAlert.severity} PRIORITY</span>
                                        </div>
                                        <p className="relative z-10">{medSafetyAlert.summary}</p>
                                        <p className="mt-2 opacity-80 relative z-10">{medSafetyAlert.details}</p>
                                        {medSafetyAlert.pairs && medSafetyAlert.pairs.length > 0 && (
                                            <ul className="mt-3 space-y-2 relative z-10">
                                                {medSafetyAlert.pairs.map((p, idx) => (
                                                    <li key={idx} className="bg-space-950/50 p-2 rounded-lg border border-white/5">
                                                        <span className={`font-bold block text-[10px] uppercase tracking-wider mb-0.5 ${medSafetyAlert.severity === 'HIGH' ? 'text-pulse-300' :
                                                                medSafetyAlert.severity === 'MEDIUM' ? 'text-neon-300' : 'text-bio-300'
                                                            }`}>{p.label}</span>
                                                        <span className="text-white/80">{p.note}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                        {medSafetyAlert.disclaimer && (
                                            <p className="mt-3 text-[9px] font-bold uppercase tracking-widest opacity-50 relative z-10 border-t border-white/10 pt-2">{medSafetyAlert.disclaimer}</p>
                                        )}
                                    </div>
                                )}
                                <div className="space-y-3">
                                    {patientMeds.map(m => (
                                        <div key={m.id} className="flex justify-between items-center p-4 bg-space-950 rounded-[20px] border border-white/5 hover:border-white/10 transition-colors group">
                                            <div>
                                                <p className="font-bold text-sm text-white font-['Space_Grotesk'] tracking-wide group-hover:text-neon-400 transition-colors">{m.name}</p>
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">{m.dosage} <span className="text-slate-700 mx-1">•</span> {m.time}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        </div>
                    )}

                    {patientTab === 'HISTORY' && (
                        <Card title="Vitals Trends" className="mt-6 border-slate-100 dark:border-slate-800 shadow-sm">
                            {(() => {
                                const trendData = buildPatientTrendData();
                                if (trendData.length <= 1) {
                                    return <p className="text-slate-400 italic">Not enough history to show trends.</p>;
                                }

                                const units = getTrendUnits(patientTrendMetric);
                                const metricValues = (key: keyof HealthMetrics) => trendData
                                    .map(d => d[key])
                                    .filter(v => typeof v === 'number' && Number.isFinite(v as any)) as number[];
                                const minMax = (values: number[]) => {
                                    if (!values.length) return null;
                                    return { min: Math.min(...values), max: Math.max(...values) };
                                };
                                const primaryKey: keyof HealthMetrics = patientTrendMetric === 'GLUCOSE'
                                    ? 'glucose'
                                    : patientTrendMetric === 'BMI'
                                        ? 'bmi'
                                        : patientTrendMetric === 'CHOLESTEROL'
                                            ? 'cholesterol'
                                            : 'systolicBP';

                                const latest = trendData[trendData.length - 1];
                                const stats = minMax(metricValues(primaryKey));

                                const chip = (label: string, value: string) => (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-200">
                                        <span className="text-slate-400">{label}</span>
                                        <span className="text-slate-700 dark:text-slate-100">{value}</span>
                                    </span>
                                );

                                const ToggleBtn: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
                                    <button
                                        type="button"
                                        onClick={onClick}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${active
                                            ? 'bg-rose-600 text-white border-rose-600'
                                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-rose-400'}`}
                                    >
                                        {children}
                                    </button>
                                );

                                return (
                                    <div className="space-y-4">
                                        <div className="flex flex-col gap-3">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <ToggleBtn active={patientTrendMetric === 'BP'} onClick={() => setPatientTrendMetric('BP')}>BP</ToggleBtn>
                                                    <ToggleBtn active={patientTrendMetric === 'GLUCOSE'} onClick={() => setPatientTrendMetric('GLUCOSE')}>Glucose</ToggleBtn>
                                                    <ToggleBtn active={patientTrendMetric === 'BMI'} onClick={() => setPatientTrendMetric('BMI')}>BMI</ToggleBtn>
                                                    <ToggleBtn active={patientTrendMetric === 'CHOLESTEROL'} onClick={() => setPatientTrendMetric('CHOLESTEROL')}>Cholesterol</ToggleBtn>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-2">
                                                    {[7, 30, 90, 0].map((d) => (
                                                        <ToggleBtn
                                                            key={d}
                                                            active={patientTrendRangeDays === (d as any)}
                                                            onClick={() => setPatientTrendRangeDays(d as any)}
                                                        >
                                                            {d === 0 ? 'All' : `${d}d`}
                                                        </ToggleBtn>
                                                    ))}

                                                    <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200 select-none">
                                                        <input
                                                            type="checkbox"
                                                            checked={patientTrendShowAvg}
                                                            onChange={(e) => setPatientTrendShowAvg(e.target.checked)}
                                                        />
                                                        Avg
                                                    </label>
                                                </div>
                                            </div>

                                            {latest && (
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {chip('Latest', patientTrendMetric === 'BP'
                                                        ? `${latest.systolicBP}/${latest.diastolicBP} ${units}`
                                                        : `${(latest as any)[primaryKey]} ${units}`)}
                                                    {stats && chip('Min', `${stats.min} ${units}`)}
                                                    {stats && chip('Max', `${stats.max} ${units}`)}
                                                </div>
                                            )}
                                        </div>

                                        <div className="h-80 w-full mt-3">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={trendData} margin={{ top: 10, right: 14, left: -10, bottom: 10 }}>
                                                    <defs>
                                                        <linearGradient id="colorBP" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
                                                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                                        </linearGradient>
                                                        <linearGradient id="colorGl" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                        </linearGradient>
                                                        <linearGradient id="colorBmi" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                                        </linearGradient>
                                                        <linearGradient id="colorChol" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                                                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>

                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.5} />
                                                    <XAxis
                                                        dataKey="t"
                                                        type="number"
                                                        domain={['dataMin', 'dataMax']}
                                                        tickFormatter={(v) => {
                                                            if (!Number.isFinite(v)) return '';
                                                            return new Date(v).toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
                                                        }}
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                                                        minTickGap={24}
                                                    />
                                                    <YAxis
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tick={{ fontSize: 12, fill: '#94a3b8' }}
                                                        width={45}
                                                    />
                                                    <Tooltip
                                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', background: 'rgba(255, 255, 255, 0.95)' }}
                                                        itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                                                        labelFormatter={(label) => (typeof label === 'number' ? formatMetricTimestamp(label) : String(label))}
                                                    />
                                                    <Legend wrapperStyle={{ paddingTop: '12px' }} />

                                                    {patientTrendMetric === 'BP' && (
                                                        <>
                                                            <ReferenceLine y={120} stroke="#94a3b8" strokeDasharray="6 6" ifOverflow="extendDomain" />
                                                            <ReferenceLine y={80} stroke="#cbd5e1" strokeDasharray="6 6" ifOverflow="extendDomain" />
                                                            <Area type="monotone" name="Systolic" dataKey="systolicBP" stroke="#f43f5e" strokeWidth={3} fill="url(#colorBP)" activeDot={{ r: 6, strokeWidth: 0 }} />
                                                            <Area type="monotone" name="Diastolic" dataKey="diastolicBP" stroke="#fb7185" strokeWidth={2} fillOpacity={0} activeDot={{ r: 5, strokeWidth: 0 }} />
                                                            {patientTrendShowAvg && (
                                                                <>
                                                                    <Line type="monotone" name="Systolic avg" dataKey="ma_systolicBP" stroke="#be123c" strokeWidth={2} dot={false} strokeDasharray="4 4" />
                                                                    <Line type="monotone" name="Diastolic avg" dataKey="ma_diastolicBP" stroke="#e11d48" strokeWidth={2} dot={false} strokeDasharray="4 4" />
                                                                </>
                                                            )}
                                                        </>
                                                    )}

                                                    {patientTrendMetric === 'GLUCOSE' && (
                                                        <>
                                                            <ReferenceLine y={100} stroke="#94a3b8" strokeDasharray="6 6" ifOverflow="extendDomain" />
                                                            <ReferenceLine y={140} stroke="#cbd5e1" strokeDasharray="6 6" ifOverflow="extendDomain" />
                                                            <Area type="monotone" name="Glucose" dataKey="glucose" stroke="#10b981" strokeWidth={3} fill="url(#colorGl)" activeDot={{ r: 6, strokeWidth: 0 }} />
                                                            {patientTrendShowAvg && <Line type="monotone" name="Glucose avg" dataKey="ma_glucose" stroke="#047857" strokeWidth={2} dot={false} strokeDasharray="4 4" />}
                                                        </>
                                                    )}

                                                    {patientTrendMetric === 'BMI' && (
                                                        <>
                                                            <ReferenceLine y={25} stroke="#94a3b8" strokeDasharray="6 6" ifOverflow="extendDomain" />
                                                            <ReferenceLine y={30} stroke="#cbd5e1" strokeDasharray="6 6" ifOverflow="extendDomain" />
                                                            <Area type="monotone" name="BMI" dataKey="bmi" stroke="#6366f1" strokeWidth={3} fill="url(#colorBmi)" activeDot={{ r: 6, strokeWidth: 0 }} />
                                                            {patientTrendShowAvg && <Line type="monotone" name="BMI avg" dataKey="ma_bmi" stroke="#4338ca" strokeWidth={2} dot={false} strokeDasharray="4 4" />}
                                                        </>
                                                    )}

                                                    {patientTrendMetric === 'CHOLESTEROL' && (
                                                        <>
                                                            <ReferenceLine y={200} stroke="#94a3b8" strokeDasharray="6 6" ifOverflow="extendDomain" />
                                                            <ReferenceLine y={240} stroke="#cbd5e1" strokeDasharray="6 6" ifOverflow="extendDomain" />
                                                            <Area type="monotone" name="Cholesterol" dataKey="cholesterol" stroke="#f59e0b" strokeWidth={3} fill="url(#colorChol)" activeDot={{ r: 6, strokeWidth: 0 }} />
                                                            {patientTrendShowAvg && <Line type="monotone" name="Chol avg" dataKey="ma_cholesterol" stroke="#b45309" strokeWidth={2} dot={false} strokeDasharray="4 4" />}
                                                        </>
                                                    )}

                                                    <Brush
                                                        dataKey="label"
                                                        height={18}
                                                        stroke="#e11d48"
                                                        travellerWidth={10}
                                                    />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                );
                            })()}
                        </Card>
                    )}

                    {patientTab === 'MEDS' && (
                        <div className="space-y-6 pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card title="Prescriptions">
                                    {medSafetyAlert && (
                                        <div className={`mb-3 rounded-xl border px-3 py-2 text-[11px] leading-snug ${medSafetyAlert.severity === 'HIGH'
                                                ? 'bg-red-50 border-red-200 text-red-800'
                                                : medSafetyAlert.severity === 'MEDIUM'
                                                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                                                    : 'bg-blue-50 border-blue-200 text-blue-800'
                                            }`}>
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-bold uppercase tracking-wide">Medication Safety Alert</span>
                                                <span className="text-[9px] font-semibold opacity-80">{medSafetyAlert.severity} PRIORITY</span>
                                            </div>
                                            <p>{medSafetyAlert.summary}</p>
                                            <p className="mt-1 opacity-90">{medSafetyAlert.details}</p>
                                            {medSafetyAlert.pairs && medSafetyAlert.pairs.length > 0 && (
                                                <ul className="mt-2 space-y-1 list-disc list-inside">
                                                    {medSafetyAlert.pairs.map((p, idx) => (
                                                        <li key={idx}>
                                                            <span className="font-semibold">{p.label}:</span> {p.note}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                            {medSafetyAlert.disclaimer && (
                                                <p className="mt-2 text-[10px] opacity-80">{medSafetyAlert.disclaimer}</p>
                                            )}
                                        </div>
                                    )}
                                    <div className="space-y-3">
                                        {patientMeds.map(m => (
                                            <div key={m.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-700">
                                                <div>
                                                    <p className="font-bold text-sm text-slate-800 dark:text-white">{m.name}</p>
                                                    <p className="text-xs text-slate-500">{m.dosage} • {m.time}</p>
                                                </div>
                                                <button onClick={() => handleDeleteMedication(m.id)} className="text-red-500 hover:text-red-700 text-xs font-bold">Remove</button>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                                <Card title="Add Medication" className="border-white/5 glass-card-dark">
                                    <div className="space-y-4">
                                        <Input label="Drug Name" value={newMedName} onChange={e => setNewMedName(e.target.value)} placeholder="e.g. Metformin" />
                                        <div className="flex gap-4">
                                            <div className="flex-1">
                                                <Input label="Dosage" value={newMedDosage} onChange={e => setNewMedDosage(e.target.value)} placeholder="e.g. 500mg" />
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 block mb-2 pl-1">Frequency</label>
                                                <select
                                                    className="w-full h-[46px] px-4 border rounded-xl bg-space-950 text-white border-white/10 focus:border-neon-400 focus:ring-1 focus:ring-neon-400/50 transition-all font-bold text-xs uppercase tracking-widest appearance-none outline-none"
                                                    value={newMedFrequency}
                                                    onChange={e => {
                                                        const next = e.target.value as MedicationFrequency;
                                                        setNewMedFrequency(next);
                                                        setNewMedTimes(() => defaultTimesForFrequency(next));
                                                    }}
                                                >
                                                    <option value="ONCE_DAILY">{frequencyLabel('ONCE_DAILY')}</option>
                                                    <option value="TWICE_DAILY">{frequencyLabel('TWICE_DAILY')}</option>
                                                    <option value="THRICE_DAILY">{frequencyLabel('THRICE_DAILY')}</option>
                                                    <option value="CUSTOM">{frequencyLabel('CUSTOM')}</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 block mb-2 pl-1">Start Date</label>
                                                <input
                                                    type="date"
                                                    className="w-full h-[46px] px-4 border rounded-xl bg-space-950 text-white border-white/10 focus:border-neon-400 focus:ring-1 focus:ring-neon-400/50 transition-all font-bold text-xs uppercase tracking-widest outline-none"
                                                    value={newMedStartDate}
                                                    onChange={e => setNewMedStartDate(e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 block mb-2 pl-1">Duration (days)</label>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={365}
                                                    className="w-full h-[46px] px-4 border rounded-xl bg-space-950 text-white border-white/10 focus:border-neon-400 focus:ring-1 focus:ring-neon-400/50 transition-all font-bold text-xs uppercase tracking-widest outline-none"
                                                    value={newMedDurationDays}
                                                    onChange={e => setNewMedDurationDays(parseInt(e.target.value || '7', 10))}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 block mb-2 pl-1">Dose Times</label>
                                            <div className="space-y-3">
                                                {(newMedTimes && newMedTimes.length > 0 ? newMedTimes : defaultTimesForFrequency(newMedFrequency)).map((t, idx) => (
                                                    <div key={idx} className="flex items-center gap-3">
                                                        <input
                                                            type="time"
                                                            className="flex-1 h-[46px] px-4 border rounded-xl bg-space-950 text-white border-white/10 focus:border-neon-400 focus:ring-1 focus:ring-neon-400/50 transition-all font-bold text-xs uppercase tracking-widest outline-none"
                                                            value={t}
                                                            onChange={e => {
                                                                const v = e.target.value;
                                                                setNewMedTimes(prev => {
                                                                    const current = (prev && prev.length > 0) ? [...prev] : [...defaultTimesForFrequency(newMedFrequency)];
                                                                    current[idx] = v;
                                                                    return current;
                                                                });
                                                            }}
                                                        />
                                                        {newMedFrequency === 'CUSTOM' && (
                                                            <button
                                                                type="button"
                                                                className="px-4 h-[46px] text-[10px] font-black uppercase tracking-widest rounded-xl border border-pulse-500/30 text-pulse-400 hover:bg-pulse-500 hover:text-white transition-all"
                                                                onClick={() => setNewMedTimes(prev => (prev || []).filter((_, i) => i !== idx))}
                                                                disabled={(newMedTimes || []).length <= 1}
                                                                title="Remove time"
                                                            >
                                                                Remove
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                                {newMedFrequency === 'CUSTOM' && (
                                                    <button
                                                        type="button"
                                                        className="w-full h-[46px] px-4 text-[10px] font-black uppercase tracking-widest rounded-xl border border-dashed border-neon-400/30 text-neon-400 hover:bg-neon-400/10 transition-all"
                                                        onClick={() => setNewMedTimes(prev => ([...(prev && prev.length > 0 ? prev : ['08:00']), '12:00']))}
                                                    >
                                                        + Inject Time Slot
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 block mb-2 pl-1">Instructions (optional)</label>
                                            <textarea
                                                className="w-full min-h-[100px] p-4 border rounded-xl bg-space-950 text-white border-white/10 focus:border-neon-400 focus:ring-1 focus:ring-neon-400/50 transition-all font-bold text-xs tracking-widest resize-none outline-none custom-scrollbar"
                                                value={newMedInstructions}
                                                onChange={e => setNewMedInstructions(e.target.value)}
                                                placeholder="e.g. After meals. Avoid grapefruit."
                                            />
                                        </div>
                                        <Button variant="neon" onClick={handleAddMedication} disabled={!newMedName || !newMedDosage} className="w-full h-14 rounded-[20px] text-[11px] font-black uppercase tracking-widest shadow-neon-500/20">Finalize Prescription</Button>
                                    </div>
                                </Card>
                            </div>

                            <Card title="Missed Dose Alerts" className="border-white/5 glass-card-dark mt-6">
                                {(!selectedPatient || medAlerts.filter(a => a.patientId === selectedPatient.id && a.status === 'NEW').length === 0) ? (
                                    <p className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-600 p-8 text-center border border-dashed border-white/5 rounded-[20px]">No missed-dose alerts for this patient.</p>
                                ) : (
                                    <div className="space-y-4">
                                        {medAlerts
                                            .filter(a => a.patientId === selectedPatient.id && a.status === 'NEW')
                                            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                                            .map(a => (
                                                <div
                                                    key={a.id}
                                                    className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 rounded-[20px] border border-amber-500/30 bg-amber-500/10 group/alert"
                                                >
                                                    <div>
                                                        <p className="text-sm font-bold text-amber-400 font-['Space_Grotesk'] tracking-wide">{a.medicationName}</p>
                                                        <p className="text-[10px] text-amber-500/80 uppercase font-bold tracking-widest mt-1">
                                                            Missed dose scheduled for {new Date(a.scheduledAt).toLocaleString()}
                                                        </p>
                                                        <p className="text-[9px] text-amber-500/50 uppercase tracking-widest mt-1 group-hover/alert:text-amber-500/80 transition-colors">Alert created {new Date(a.createdAt).toLocaleString()}</p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <Button variant="cyber" className="h-10 px-4 rounded-[12px] text-[9px] font-black uppercase tracking-widest border-amber-500/30 text-amber-400 hover:bg-amber-500/20" onClick={() => handleAcknowledgeMedAlert(a.id)}>
                                                            Acknowledge
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </Card>

                            <div className="bg-space-900 border border-neon-500/20 shadow-[0_0_30px_rgba(0,212,255,0.1)] p-8 rounded-[32px] glass-card relative overflow-hidden group/ocr mt-6">
                                <div className="absolute top-0 right-0 w-80 h-80 bg-neon-500/10 rounded-full blur-[80px] -mr-20 -mt-20 pointer-events-none group-hover/ocr:bg-neon-500/20 transition-colors duration-700"></div>
                                <h3 className="text-2xl font-bold text-white font-['Space_Grotesk'] tracking-widest uppercase mb-6 flex items-center gap-3 relative z-10">
                                    <span className="text-3xl drop-shadow-[0_0_10px_rgba(0,212,255,0.8)]">👁️</span> Holographic OCR Matrix
                                </h3>
                                <div className="space-y-6 relative z-10">
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                                        <div className="lg:col-span-1 space-y-4">
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Image Intake Feed</p>
                                            <div className="relative group/upload">
                                                <input type="file" accept="image/*" onChange={handleOcrFileChange} className="block w-full text-xs text-transparent file:mr-4 file:py-3 file:px-6 file:rounded-[16px] file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-[0.2em] file:bg-white/5 file:text-white hover:file:bg-white/10 file:cursor-pointer file:transition-all cursor-pointer absolute inset-0 z-10 opacity-0" />
                                                <div className="bg-space-950 border border-dashed border-white/20 rounded-[20px] p-8 text-center flex flex-col items-center justify-center gap-3 group-hover/upload:border-neon-400/50 transition-colors h-[120px]">
                                                    <span className="text-2xl opacity-50 group-hover/upload:opacity-100 transition-opacity">📸</span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest group-hover/upload:text-neon-400 transition-colors">Select Visual Data</span>
                                                </div>
                                            </div>

                                            {ocrPreviewUrl && (
                                                <div className="mt-4 rounded-[20px] overflow-hidden border border-white/10 bg-space-950 max-h-40 flex items-center justify-center p-2 relative group/img">
                                                    <div className="absolute inset-0 bg-neon-500/10 opacity-0 group-hover/img:opacity-100 transition-opacity pointer-events-none mix-blend-overlay"></div>
                                                    <img src={ocrPreviewUrl} alt="Prescription preview" className="max-h-[140px] object-contain rounded-xl" />
                                                </div>
                                            )}
                                            <Button variant="neon" onClick={handleRunPrescriptionOcr} isLoading={ocrLoading} disabled={!ocrFile || ocrLoading} className="w-full h-12 rounded-[16px] text-[10px] font-black uppercase tracking-widest shadow-neon-500/20 mt-4">
                                                {ocrLoading ? 'Analyzing...' : 'Execute Scan'}
                                            </Button>
                                        </div>

                                        <div className="lg:col-span-2 space-y-4">
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Extraction Logic & Override</p>
                                            {ocrResult && ocrDraftMeds.length > 0 ? (
                                                <div className="border border-white/10 rounded-[24px] overflow-hidden bg-space-950/50 glass-card-dark">
                                                    <div className="px-6 py-4 bg-white/5 flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-white/10">
                                                        <span className="flex items-center gap-2">
                                                            <span className="text-neon-400 drop-shadow-[0_0_5px_rgba(0,212,255,0.5)]">Confidence: {ocrResult.confidenceScore}%</span>
                                                        </span>
                                                        <span className="opacity-50">{ocrResult.doctorName || 'Doctor N/A'} • {ocrResult.patientName || selectedPatient?.name}</span>
                                                    </div>
                                                    <div className="overflow-x-auto custom-scrollbar">
                                                        <table className="min-w-full text-left text-xs">
                                                            <thead className="bg-white/5 border-b border-white/10 text-[9px] text-slate-500 uppercase tracking-widest pb-2">
                                                                <tr>
                                                                    <th className="px-4 py-3">Compound</th>
                                                                    <th className="px-4 py-3">Volume</th>
                                                                    <th className="px-4 py-3">Rate</th>
                                                                    <th className="px-4 py-3">Span</th>
                                                                    <th className="px-4 py-3">Directives</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-white/5">
                                                                {ocrDraftMeds.map((med, idx) => (
                                                                    <tr key={idx} className="group/row hover:bg-white/5 transition-colors">
                                                                        <td className="px-3 py-2">
                                                                            <input value={med.name} onChange={e => handleUpdateOcrMedField(idx, 'name', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-transparent focus:border-neon-400/50 hover:border-white/10 bg-transparent text-white text-xs font-bold font-['Space_Grotesk'] focus:bg-space-900 transition-all outline-none" />
                                                                        </td>
                                                                        <td className="px-3 py-2">
                                                                            <input value={med.dosage} onChange={e => handleUpdateOcrMedField(idx, 'dosage', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-transparent focus:border-neon-400/50 hover:border-white/10 bg-transparent text-slate-300 text-xs font-bold uppercase tracking-wider focus:bg-space-900 transition-all outline-none" />
                                                                        </td>
                                                                        <td className="px-3 py-2">
                                                                            <input value={med.frequency} onChange={e => handleUpdateOcrMedField(idx, 'frequency', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-transparent focus:border-neon-400/50 hover:border-white/10 bg-transparent text-slate-300 text-xs font-bold uppercase tracking-wider focus:bg-space-900 transition-all outline-none" />
                                                                        </td>
                                                                        <td className="px-3 py-2">
                                                                            <input value={med.duration} onChange={e => handleUpdateOcrMedField(idx, 'duration', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-transparent focus:border-neon-400/50 hover:border-white/10 bg-transparent text-slate-300 text-xs font-bold uppercase tracking-wider focus:bg-space-900 transition-all outline-none" />
                                                                        </td>
                                                                        <td className="px-3 py-2">
                                                                            <input value={med.notes || ''} onChange={e => handleUpdateOcrMedField(idx, 'notes', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-transparent focus:border-neon-400/50 hover:border-white/10 bg-transparent text-slate-400 text-xs tracking-wide focus:bg-space-900 transition-all outline-none" />
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="h-[200px] flex items-center justify-center border border-dashed border-white/5 rounded-[24px] text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">
                                                    Ready for intake scan
                                                </div>
                                            )}

                                            {ocrResult && ocrDraftMeds.length > 0 && (
                                                <div className="flex justify-end mt-4">
                                                    <Button variant="cyber" className="h-12 px-6 rounded-[16px] text-[10px] font-black uppercase tracking-widest border-white/10" onClick={handleApproveOcrMedicines} disabled={ocrLoading}>
                                                        Verify & Inject Records
                                                    </Button>
                                                </div>
                                            )}

                                            {ocrApproved && (
                                                <div className="mt-4 p-4 rounded-[16px] bg-bio-500/10 border border-bio-500/30 text-bio-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-3">
                                                    <span className="w-2 h-2 rounded-full bg-bio-400 animate-pulse"></span>
                                                    Records Successfully Injected
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {ocrError && (
                                        <div className="mt-4 p-4 rounded-[16px] bg-pulse-500/10 border border-pulse-500/30 text-pulse-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-3">
                                            <span className="w-2 h-2 rounded-full bg-pulse-400 animate-ping"></span>
                                            Error: {ocrError}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {patientTab === 'DOCUMENTS' && (
                        <Card title="Patient Documents" className="mt-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {patientDocs.length === 0 && <p className="text-slate-400 italic col-span-full">No documents found.</p>}
                                {patientDocs.map(doc => (
                                    <div key={doc.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-md transition-shadow bg-white dark:bg-slate-800">
                                        <div className="flex items-start justify-between mb-2">
                                            <span className="text-2xl">{doc.type.includes('pdf') ? '📄' : '🖼️'}</span>
                                            {doc.url ? (
                                                <button type="button" onClick={() => openDocument(doc.url)} className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded font-bold hover:bg-blue-100">View</button>
                                            ) : (
                                                <span className="text-[11px] bg-amber-50 text-amber-700 px-2 py-1 rounded font-bold">Re-upload</span>
                                            )}
                                        </div>
                                        <p className="font-bold text-sm text-slate-800 dark:text-white truncate" title={doc.name}>{doc.name}</p>
                                        <p className="text-xs text-slate-500 mt-1">{doc.date} • {doc.category || 'General'}</p>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}

                    {patientTab === 'SUMMARIES' && (
                        <Card title="Consultation Summary History" className="mt-6">
                            {(() => {
                                const history = consultationSummariesByPatientId[selectedPatient.id] || [];
                                if (history.length === 0) {
                                    return <p className="text-slate-400 italic">No AI consultation summaries available yet.</p>;
                                }

                                return (
                                    <div className="space-y-3">
                                        {history.map((summary) => (
                                            <details key={summary.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4">
                                                <summary className="cursor-pointer list-none">
                                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{new Date(summary.createdAt).toLocaleString()}</p>
                                                        <p className="text-xs text-slate-500">Appointment: {summary.appointmentId}</p>
                                                    </div>
                                                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-2"><span className="font-semibold">Preview:</span> {summary.symptoms}</p>
                                                </summary>
                                                <div className="mt-3 space-y-2 text-xs text-slate-700 dark:text-slate-200">
                                                    <p><span className="font-semibold">Symptoms:</span> {summary.symptoms}</p>
                                                    <p><span className="font-semibold">Possible condition:</span> {summary.possibleCondition}</p>
                                                    <p><span className="font-semibold">Key discussion points:</span> {(summary.keyDiscussionPoints || []).join('; ') || 'N/A'}</p>
                                                    <p><span className="font-semibold">Doctor recommendations:</span> {summary.recommendations}</p>
                                                    <p><span className="font-semibold">Follow-up instructions:</span> {summary.followUpInstructions}</p>
                                                    <p className="text-[10px] text-amber-600">AI-generated assistive summary only. Not a medical diagnosis.</p>
                                                </div>
                                            </details>
                                        ))}
                                    </div>
                                );
                            })()}
                        </Card>
                    )}

                    {patientTab === 'NOTES' && (
                        <Card title="Clinical Notes" className="mt-6">
                            <textarea
                                className="w-full h-32 p-3 border rounded-xl resize-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-rose-500 outline-none"
                                placeholder="Enter clinical observations..."
                                value={clinicalNote}
                                onChange={e => setClinicalNote(e.target.value)}
                            />
                            <div className="flex justify-end mt-2">
                                <Button onClick={handleSaveNote} disabled={!clinicalNote.trim()}>Save Note</Button>
                            </div>
                            <div className="mt-6 space-y-4">
                                <h4 className="font-bold text-slate-700 dark:text-slate-300">Latest Saved Note</h4>
                                {latestAppt && latestAppt.notes ? (
                                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line">
                                        <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-1 font-bold">
                                            {latestAppt.date} • {latestAppt.time}
                                        </p>
                                        {latestAppt.notes}
                                    </div>
                                ) : (
                                    <p className="text-slate-400 italic text-sm">No notes have been saved for this patient yet.</p>
                                )}
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        );
    };

    const renderSettingsView = () => {
        return (
            <div className="space-y-8 max-w-4xl mx-auto pb-24">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                    <h2 className="text-4xl md:text-5xl font-bold text-white font-['Space_Grotesk'] tracking-tight">Profile Settings</h2>
                    <p className="text-xs text-slate-500 uppercase tracking-widest mt-2">Manage your clinical profile and digital identity.</p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <Card className="glass-card border-white/5 overflow-hidden rounded-[40px] bg-space-900/60 backdrop-blur-xl">
                        <div className="p-8 md:p-12 space-y-12">
                            <div className="flex flex-col md:flex-row items-center gap-10 pb-12 border-b border-white/5">
                                <div className="relative group cursor-pointer" onClick={() => profilePicInputRef.current?.click()}>
                                    <div className="w-32 h-32 md:w-48 md:h-48 rounded-[48px] overflow-hidden border-2 border-neon-500/50 shadow-[0_0_50px_rgba(0,212,255,0.2)] bg-space-950 flex items-center justify-center transition-all duration-500 group-hover:scale-105 group-hover:border-neon-400 group-hover:shadow-[0_0_60px_rgba(0,212,255,0.3)]">
                                        {isProfilePicUploading ? (
                                            <div className="w-12 h-12 border-4 border-neon-400 border-t-transparent rounded-full animate-spin" />
                                        ) : user.profilePicUrl ? (
                                            <img src={user.profilePicUrl} alt={user.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                        ) : (
                                            <span className="text-6xl md:text-8xl font-bold text-neon-400 drop-shadow-[0_0_15px_rgba(0,212,255,0.5)]">{user.name.charAt(0)}</span>
                                        )}
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all duration-300 rounded-[48px] backdrop-blur-[2px]">
                                            <span className="text-2xl mb-1">📸</span>
                                            <span className="text-white text-[10px] font-black uppercase tracking-[0.2em]">Update Matrix</span>
                                        </div>
                                    </div>
                                    <input type="file" ref={profilePicInputRef} className="hidden" accept="image/*" onChange={handleProfilePicUpload} />
                                </div>
                                <div className="flex-1 text-center md:text-left space-y-4">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-neon-400 uppercase tracking-[0.4em] drop-shadow-[0_0_5px_rgba(0,212,255,0.5)]">{user.specialization || 'Clinical Specialist'}</p>
                                        <h3 className="text-4xl md:text-6xl font-bold text-white font-['Space_Grotesk'] tracking-tight">{user.name}</h3>
                                    </div>
                                    <div className="flex flex-wrap justify-center md:justify-start gap-6 text-slate-400 text-sm font-light">
                                        <span className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/5 hover:border-white/10 transition-colors">📧 {user.email}</span>
                                        <span className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/5 hover:border-white/10 transition-colors">🎓 {user.qualification || 'Verified Practitioner'}</span>
                                        <span className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/5 hover:border-white/10 transition-colors">🪪 {user.registrationNumber || 'Pending Sync'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 pl-1">Identification Name</label>
                                    <div className="h-14 px-6 rounded-2xl bg-space-950/80 border border-white/10 text-white flex items-center font-bold text-sm tracking-wide">
                                        {user.name}
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 pl-1">Primary Specialization</label>
                                    <div className="h-14 px-6 rounded-2xl bg-space-950/80 border border-white/10 text-neon-400 flex items-center font-bold text-sm tracking-wide">
                                        {user.specialization || 'General Practice'}
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 pl-1">Medical Council</label>
                                    <div className="h-14 px-6 rounded-2xl bg-space-950/80 border border-white/10 text-slate-300 flex items-center font-bold text-sm tracking-wide">
                                        {user.medicalCouncil || 'National Registry'}
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 pl-1">System Role</label>
                                    <div className="h-14 px-6 rounded-2xl bg-space-950/80 border border-white/10 text-bio-400 flex items-center font-bold text-sm tracking-widest uppercase">
                                        {user.role}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-8 flex justify-center md:justify-end">
                                <Button variant="neon" disabled className="px-10 h-14 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] opacity-50 cursor-not-allowed">
                                    Update Extended Profile
                                </Button>
                            </div>
                        </div>
                    </Card>
                </motion.div>
            </div>
        );
    };

    // --- MAIN RENDER ---

    const effectiveStatus = user.status || 'PENDING';
    const isVerifiedUser = effectiveStatus === 'VERIFIED';

    if (!isVerifiedUser) {
        return (
            <div className="h-screen flex items-center justify-center p-6 text-center">
                <Card className="max-w-md w-full">
                    <h2 className="text-2xl font-bold mb-2">
                        {effectiveStatus === 'REJECTED' ? 'Account Not Approved' : 'Account Pending'}
                    </h2>
                    <p className="text-slate-500">
                        {effectiveStatus === 'REJECTED'
                            ? 'Your doctor account was not approved yet. Please contact admin support.'
                            : 'Your doctor account is pending admin verification. You will gain full access once approved.'}
                    </p>
                    <div className="mt-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-bold bg-amber-100 text-amber-800">
                        Status: {effectiveStatus}
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden p-6 md:p-10 bg-black/20">
            {/* Header / Stats Bar */}
            <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative">
                <div className="relative z-10">
                    <motion.h2 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-4xl font-black text-white font-orbitron tracking-tighter"
                    >
                        Medical <span className="premium-gradient-text">Command</span>
                    </motion.h2>
                    <p className="text-[10px] text-slate-500 uppercase tracking-[0.4em] mt-3 font-black">Neural Node Identity: {user.name} · {user.specialization}</p>
                </div>

                <div className="flex flex-wrap gap-4 relative z-10">
                    <Card className="py-4 px-6 min-w-[140px] border-white/5 bg-white/[0.02]">
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Queue Load</div>
                        <div className="text-2xl font-black text-white font-orbitron">{analytics?.appointmentsToday || 0}</div>
                    </Card>
                    <Card className="py-4 px-6 min-w-[140px] border-[var(--accent-primary)]/20 bg-[var(--accent-primary)]/5">
                        <div className="text-[9px] font-black text-[var(--accent-primary)] uppercase tracking-widest mb-1">Total Patients</div>
                        <div className="text-2xl font-black text-white font-orbitron">{analytics?.totalPatients || 0}</div>
                    </Card>
                    {emergencyAlerts.length > 0 && (
                        <motion.div 
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                        >
                            <Card className="py-4 px-6 min-w-[140px] border-rose-500/30 bg-rose-500/10 shadow-[0_0_20px_rgba(244,63,94,0.2)]">
                                <div className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">Neural Alerts</div>
                                <div className="text-2xl font-black text-rose-500 font-orbitron">{emergencyAlerts.length}</div>
                            </Card>
                        </motion.div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                <AnimatePresence mode='wait'>
                    <motion.div
                        key={viewMode}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.3 }}
                        className="h-full"
                    >
                        {viewMode === 'dashboard' && renderMainDashboard()}
                        {viewMode === 'patients' && (selectedPatient ? renderPatientDetails() : renderPatientsView())}
                        {viewMode === 'schedule' && renderScheduleView()}
                        {viewMode === 'analytics' && renderAnalyticsView()}
                        {viewMode === 'settings' && renderSettingsView()}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Overlays */}
            {passportToView && (
                <div className="fixed inset-0 z-[120] bg-space-950 overflow-y-auto">
                    <HealthPassport data={passportToView} onClose={() => setPassportToView(null)} isDoctorView={true} />
                </div>
            )}

            {/* Automation AI Assistant */}
            <AutomationAssistant 
                isOpen={isAssistantOpen} 
                onClose={() => setIsAssistantOpen(false)} 
                onAction={handleDoctorAssistantAction} 
            />

            {/* AI Toggle Orb */}
            <div className="fixed bottom-8 right-8 z-[110]">
                <button 
                    onClick={() => setIsAssistantOpen(!isAssistantOpen)}
                    className="w-14 h-14 rounded-full bg-gradient-to-br from-neon-400 to-bio-400 shadow-[0_0_20px_rgba(0,212,255,0.4)] flex items-center justify-center text-2xl hover:scale-110 transition-transform active:scale-95"
                >
                    ✨
                </button>
            </div>
        </div>
    );
};
