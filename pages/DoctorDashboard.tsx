
import React, { useMemo, useState, useEffect } from 'react';
import { DoctorProfile, PatientProfile, DaySchedule, Appointment, UserRole, DoctorAnalytics, TimeSlot, HealthPassportData, Medication, MedicationFrequency, MedicationMissedDoseAlert, Document, HealthMetrics, PrescriptionOcrResult, PrescriptionMedicine, ChatEmergencyAlert } from '../types';
import { MockBackend } from '../services/mockBackend';
import { BackendAPI } from '../services/apiClient';
import type { QueueUpdate } from '../services/apiClient';
import { GeminiService } from '../services/geminiService';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { motion, AnimatePresence } from 'framer-motion';
import { HealthPassport } from '../components/HealthPassport';
import { BarChart, Bar, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Brush, ReferenceLine } from 'recharts';
import { ChatPanel } from '../components/telechat/ChatPanel';
import { VideoCall } from '../components/VideoCall';

interface Props {
    user: DoctorProfile;
}

type ViewMode = 'dashboard' | 'patients' | 'schedule' | 'settings' | 'analytics';
type PatientTab = 'OVERVIEW' | 'HISTORY' | 'MEDS' | 'DOCUMENTS' | 'NOTES';

const getDefaultSchedule = (): DaySchedule[] => [
    { day: 'Mon', available: true, startTime: '09:00', endTime: '17:00' },
    { day: 'Tue', available: true, startTime: '09:00', endTime: '17:00' },
    { day: 'Wed', available: true, startTime: '09:00', endTime: '17:00' },
    { day: 'Thu', available: true, startTime: '09:00', endTime: '17:00' },
    { day: 'Fri', available: true, startTime: '09:00', endTime: '17:00' },
    { day: 'Sat', available: false, startTime: '10:00', endTime: '14:00' },
    { day: 'Sun', available: false, startTime: '10:00', endTime: '14:00' },
];

export const DoctorDashboard: React.FC<Props> = ({ user: initialUser }) => {
    const [user, setUser] = useState<DoctorProfile>(initialUser);
    const [patients, setPatients] = useState<PatientProfile[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [analytics, setAnalytics] = useState<DoctorAnalytics | null>(null);

    const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
    const [selectedPatient, setSelectedPatient] = useState<PatientProfile | null>(null);
    const [patientTab, setPatientTab] = useState<PatientTab>('OVERVIEW');

    // Patient Specific Data (Real-time)
    const [patientHistory, setPatientHistory] = useState<HealthMetrics[]>([]);
    const [patientMeds, setPatientMeds] = useState<Medication[]>([]);
    const [riskUpdateSummary, setRiskUpdateSummary] = useState<string | null>(null);
    const [medSafetyAlert, setMedSafetyAlert] = useState<{
        severity: 'LOW' | 'MEDIUM' | 'HIGH';
        summary: string;
        details: string;
        pairs?: { label: string; note: string }[];
        disclaimer?: string;
    } | null>(null);
    const [patientDocs, setPatientDocs] = useState<Document[]>([]);

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

    const [ocrFile, setOcrFile] = useState<File | null>(null);
    const [ocrPreviewUrl, setOcrPreviewUrl] = useState<string | null>(null);
    const [ocrLoading, setOcrLoading] = useState(false);
    const [ocrError, setOcrError] = useState<string | null>(null);
    const [ocrResult, setOcrResult] = useState<PrescriptionOcrResult | null>(null);
    const [ocrDraftMeds, setOcrDraftMeds] = useState<PrescriptionMedicine[]>([]);
    const [ocrApproved, setOcrApproved] = useState(false);

    const [emergencyAlerts, setEmergencyAlerts] = useState<ChatEmergencyAlert[]>([]);
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
            const validModes: ViewMode[] = ['dashboard', 'patients', 'schedule', 'analytics'];
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
                MockBackend.getAssignedPatients(effectiveUser.id),
                BackendAPI.getAppointments(),
                MockBackend.getDoctorAnalytics(effectiveUser.id)
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

            if (viewMode === 'schedule') {
                const slots = await BackendAPI.getDoctorSlots(effectiveUser.id, manageDate);
                setDailySlots(slots);
            }

            if (selectedPatient) {
                // Keep the selected patient in sync with the latest merged list
                const updatedProfile = mergedPatients.find(p => p.id === selectedPatient.id) || selectedPatient;
                if (updatedProfile) setSelectedPatient(updatedProfile);

                const [hist, meds, docs] = await Promise.all([
                    BackendAPI.getMyMetrics(selectedPatient.id),
                    BackendAPI.getMedicationOrders({ patientId: selectedPatient.id, active: 'true' }).catch(() => (
                        MockBackend.getMedications(selectedPatient.id)
                    )),
                    MockBackend.getPatientDocuments(selectedPatient.id)
                ]);
                setPatientHistory(hist);
                setPatientMeds(meds);
                setPatientDocs(docs);
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

        const unsubscribeAppt = BackendAPI.onAppointmentCreated(upsertAppointment);

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

        const unsubscribeApptUpdated = BackendAPI.onAppointmentUpdated(upsertAppointment);

        return () => {
            unsubscribeMock();
            unsubscribeAppt();
            unsubscribeQueue();
            unsubscribeSlot();
            unsubscribeEmergency();
            unsubscribeApptUpdated();
        };
    }, [user.id, user.status, viewMode, manageDate, selectedPatient?.id]);

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

    const renderDashboard = () => {
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

        return (
            <>
            <div className="space-y-8">
                {/* Header Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { icon: '📅', label: "Today's Appts", value: todaysAppts.length, color: 'rose' },
                        { icon: '👥', label: "Total Patients", value: analytics?.totalPatients || 0, color: 'blue' },
                        { icon: '⏳', label: "Pending", value: appointments.filter(a => a.status === 'PENDING').length, color: 'orange' },
                    ].map((stat, i) => (
                        <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl bg-${stat.color}-50 dark:bg-${stat.color}-900/30 text-${stat.color}-600 dark:text-${stat.color}-400`}>
                                {stat.icon}
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{stat.label}</p>
                                <p className="text-3xl font-black text-slate-800 dark:text-white">{stat.value}</p>
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
                            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[32px] p-10 text-white shadow-2xl relative overflow-hidden ring-1 ring-white/10">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                                <div className="relative z-10">
                                    <div className="flex justify-between items-start mb-8">
                                        <div>
                                            <p className="text-indigo-200 text-xs font-bold uppercase tracking-wider mb-2">Up Next • {nextAppt.time}</p>
                                            <h2 className="text-5xl font-extrabold mb-3 tracking-tight">{nextAppt.patientName}</h2>
                                            <p className="text-indigo-100 text-sm flex items-center gap-2 font-medium">
                                                {nextAppt.consultationType === 'VIDEO' ? '🎥 Video Consultation' : '🏥 In-Person Visit'}
                                                <span className="w-1 h-1 bg-white/50 rounded-full"></span>
                                                {nextAppt.symptoms || 'Routine Checkup'}
                                            </p>
                                            <p className="text-indigo-100/90 text-xs mt-2 font-semibold">
                                                Queue: {getAhead(nextAppt.id)} ahead • ~{getDelayMinutes(nextAppt.id)} min delay
                                            </p>
                                        </div>
                                        <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl text-center border border-white/20 shadow-lg">
                                            <p className="text-xs font-bold uppercase opacity-80">Token</p>
                                            <p className="text-4xl font-black">#{nextAppt.tokenNumber || 1}</p>
                                        </div>
                                    </div>

                                        <div className="flex flex-wrap gap-4">
                                        {nextAppt.status !== 'IN_PROGRESS' && nextAppt.status !== 'COMPLETED' && (
                                            <Button
                                                variant="outline"
                                                className="text-white border-white/30 hover:bg-white/10 rounded-xl"
                                                onClick={() => BackendAPI.updateAppointmentStatus({ appointmentId: nextAppt.id, status: 'IN_PROGRESS' })}
                                            >
                                                Mark as Started
                                            </Button>
                                        )}
                                        {nextAppt.status === 'IN_PROGRESS' && (
                                            <>
                                                <Button
                                                    variant="outline"
                                                    className="text-emerald-100 border-emerald-200/60 hover:bg-emerald-500/20 rounded-xl"
                                                    onClick={() => BackendAPI.updateAppointmentStatus({ appointmentId: nextAppt.id, status: 'COMPLETED' })}
                                                >
                                                    Mark as Completed
                                                </Button>
                                                {nextAppt.consultationType === 'VIDEO' && (
                                                    <Button
                                                        variant="outline"
                                                        className="w-full justify-center"
                                                        onClick={() => {
                                                            setTelechatAppointmentId(nextAppt.id);
                                                            setShowTelechat(true);
                                                        }}
                                                    >
                                                        Secure Chat
                                                    </Button>
                                                )}
                                                {nextAppt.consultationType === 'VIDEO' && (
                                                    <Button
                                                        variant="outline"
                                                        className="w-full justify-center"
                                                        onClick={() => {
                                                            setVideoAppointment(nextAppt);
                                                            setShowVideoCall(true);
                                                        }}
                                                    >
                                                        Join Video Call
                                                    </Button>
                                                )}
                                            </>
                                        )}
                                        <Button variant="outline" className="text-white border-white/30 hover:bg-white/10 rounded-xl" onClick={() => {
                                            const p = patients.find(pat => pat.id === nextAppt.patientId);
                                            if (p) { setSelectedPatient(p); setViewMode('patients'); }
                                        }}>
                                            View Patient File
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-[32px] p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-700">
                                <div className="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl shadow-inner">☕</div>
                                <h3 className="text-lg font-bold text-slate-600 dark:text-slate-300">All Caught Up</h3>
                                <p className="text-slate-400 text-sm mt-1">No pending appointments for the immediate slot.</p>
                            </div>
                        )}

                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                            <div className="p-5 border-b border-slate-100 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-200 text-sm uppercase tracking-wide bg-slate-50/50 dark:bg-slate-800/50">
                                Today's Timeline
                            </div>
                            <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                {todaysAppts.length === 0 && <p className="p-8 text-center text-slate-400 italic">No appointments today.</p>}
                                {todaysAppts.map((appt, idx) => (
                                    <div key={appt.id} className="p-4 flex items-center hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-50 dark:border-slate-800 last:border-0">
                                        <div className="w-20 text-sm font-bold text-slate-500 dark:text-slate-400 font-mono">{appt.time}</div>
                                        <div className="flex-1">
                                            <p className="font-bold text-slate-800 dark:text-white">{appt.patientName}</p>
                                            <p className="text-xs text-slate-500 flex items-center gap-2">
                                                <span>{appt.type}</span>
                                                <span className="text-slate-300">•</span>
                                                <span className="font-mono">#{appt.tokenNumber || (idx + 1)}</span>
                                                {appt.notes && (
                                                    <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100" title="Clinical notes saved">
                                                        📝 Notes
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        <div className="flex gap-2 items-center">
                                            {appt.status === 'COMPLETED' ? (
                                                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Done</span>
                                            ) : (
                                                <>
                                                    <span className="hidden sm:inline-flex text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/40 px-2 py-1 rounded border border-slate-200/60 dark:border-slate-700">
                                                        Ahead {getAhead(appt.id)} • {getDelayMinutes(appt.id)}m
                                                    </span>
                                                    {appt.status !== 'IN_PROGRESS' && (
                                                        <button
                                                            onClick={() => BackendAPI.updateAppointmentStatus({ appointmentId: appt.id, status: 'IN_PROGRESS' })}
                                                            className="px-2 py-1 text-[10px] font-bold rounded bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-100"
                                                        >
                                                            Start
                                                        </button>
                                                    )}
                                                    {appt.status === 'IN_PROGRESS' && (
                                                        <>
                                                            <button
                                                                onClick={() => BackendAPI.updateAppointmentStatus({ appointmentId: appt.id, status: 'COMPLETED' })}
                                                                className="px-2 py-1 text-[10px] font-bold rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100"
                                                            >
                                                                Complete
                                                            </button>
                                                            {appt.consultationType === 'VIDEO' && (
                                                                <button
                                                                    onClick={() => {
                                                                        setTelechatAppointmentId(appt.id);
                                                                        setShowTelechat(true);
                                                                    }}
                                                                    className="px-2 py-1 text-[10px] font-bold rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100"
                                                                >
                                                                    Chat
                                                                </button>
                                                            )}
                                                            {appt.consultationType === 'VIDEO' && (
                                                                <button
                                                                    onClick={() => {
                                                                        setVideoAppointment(appt);
                                                                        setShowVideoCall(true);
                                                                    }}
                                                                    className="px-2 py-1 text-[10px] font-bold rounded bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-100"
                                                                >
                                                                    Video
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                    <Button size="sm" variant="ghost" className="h-8 text-xs px-3" onClick={() => {
                                                        const p = patients.find(pat => pat.id === appt.patientId);
                                                        if (p) { setSelectedPatient(p); setViewMode('patients'); }
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
                        <Card title="Clinical Alerts" className="border-slate-200 dark:border-slate-700">
                            {analytics && analytics.pendingRequests > 0 && (
                                <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-xl mb-4 shadow-sm">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-sm text-orange-800 font-bold">{analytics.pendingRequests} New Requests</p>
                                            <p className="text-xs text-orange-600 mt-1">Review pending appointments.</p>
                                        </div>
                                        <span className="text-xl">🔔</span>
                                    </div>
                                </div>
                            )}
                            <div className="space-y-3">
                                <Button variant="outline" className="w-full justify-start text-sm h-12 rounded-xl border-slate-200 hover:border-slate-300" onClick={() => window.location.hash = 'patients'}>
                                    <span className="mr-2 text-lg">📂</span> Patient Directory
                                </Button>
                                <Button variant="outline" className="w-full justify-start text-sm h-12 rounded-xl border-slate-200 hover:border-slate-300" onClick={() => window.location.hash = 'schedule'}>
                                    <span className="mr-2 text-lg">📅</span> Manage Schedule
                                </Button>
                                <Button variant="outline" className="w-full justify-start text-sm h-12 rounded-xl border-slate-200 hover:border-slate-300" onClick={() => window.location.hash = 'analytics'}>
                                    <span className="mr-2 text-lg">📈</span> Practice Analytics
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
                <VideoCall
                    appointmentId={videoAppointment.id}
                    otherUserName={videoAppointment.patientName}
                    onClose={() => {
                        setShowVideoCall(false);
                        setVideoAppointment(null);
                    }}
                />
            )}
            </>
        );
    };

    // --- ANALYTICS VIEW ---
    const renderAnalytics = () => {
        if (!analytics) return <div className="p-8 text-center text-slate-400">Loading analytics...</div>;

        const COLORS = ['#e11d48', '#8b5cf6', '#10b981', '#f59e0b'];

        return (
            <div className="space-y-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Practice Insights</h2>
                        <p className="text-sm text-slate-500">Performance metrics and patient engagement stats.</p>
                    </div>
                    <div className="flex bg-white dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700 shadow-sm">
                        <button className="px-4 py-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 shadow-sm">Last 30 Days</button>
                        <button className="px-4 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400">YTD</button>
                    </div>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden">
                        <div className="relative z-10">
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Total Patients</p>
                            <h3 className="text-3xl font-black text-slate-800 dark:text-white">{analytics.totalPatients}</h3>
                            <p className="text-xs text-emerald-500 font-bold mt-1 flex items-center gap-1">
                                <span>↑ 12%</span> <span className="text-slate-400 font-normal">vs last month</span>
                            </p>
                        </div>
                        <div className="absolute -bottom-4 -right-4 text-slate-50 dark:text-slate-800/50">
                            <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden">
                        <div className="relative z-10">
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Completion Rate</p>
                            <h3 className="text-3xl font-black text-slate-800 dark:text-white">{analytics.completionRate}%</h3>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
                                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${analytics.completionRate}%` }}></div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden">
                        <div className="relative z-10">
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Appointments Today</p>
                            <h3 className="text-3xl font-black text-slate-800 dark:text-white">{analytics.appointmentsToday}</h3>
                            <p className="text-xs text-slate-400 mt-1 font-medium">{analytics.pendingRequests} pending requests</p>
                        </div>
                    </div>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Patient Growth Trend */}
                    <Card title="Patient Growth Trend">
                        <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={analytics.patientTrends}>
                                    <defs>
                                        <linearGradient id="colorPatients" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#e11d48" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#e11d48" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.5} />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                        cursor={{ stroke: '#e11d48', strokeWidth: 1, strokeDasharray: '4 4' }}
                                    />
                                    <Area type="monotone" dataKey="count" stroke="#e11d48" strokeWidth={3} fillOpacity={1} fill="url(#colorPatients)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    {/* Appointment Distribution */}
                    <Card title="Consultation Types">
                        <div className="h-72 w-full flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={analytics.appointmentDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {analytics.appointmentDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>

                {/* Feedback Keywords */}
                <Card title="Patient Feedback Highlights">
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={analytics.feedbackKeywords}
                                layout="vertical"
                                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="word" tick={{ fill: '#64748b', fontWeight: 'bold' }} width={100} axisLine={false} tickLine={false} />
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>
        );
    };

    const renderSchedule = () => (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Schedule Management</h2>
                    <p className="text-sm text-slate-500">Manage your availability and appointments.</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-300">View Date:</span>
                    <input
                        type="date"
                        className="p-2 border rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                        value={manageDate}
                        onChange={e => setManageDate(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Daily Slots Grid */}
                <Card className="lg:col-span-2" title={`Slots for ${new Date(manageDate).toLocaleDateString()}`}>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[400px] overflow-y-auto custom-scrollbar p-1">
                        {dailySlots.length === 0 && <p className="col-span-full text-center text-slate-400 py-8">No slots generated for this day. Check configuration.</p>}
                        {dailySlots.map(slot => {
                            const isFull = slot.bookedCount >= slot.maxPatients;
                            return (
                                <button
                                    key={slot.id}
                                    onClick={() => handleSlotClick(slot)}
                                    className={`p-2 rounded-xl text-xs font-bold border transition-all relative ${slot.isBlocked
                                            ? 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:border-slate-700'
                                            : isFull
                                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:shadow-md hover:-translate-y-0.5'
                                        }`}
                                >
                                    {slot.startTime}
                                    {slot.bookedCount > 0 && (
                                        <span className="absolute -top-2 -right-1 w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-[10px] shadow-sm border-2 border-white dark:border-slate-900">
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
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="mt-6 border-t border-slate-100 dark:border-slate-700 pt-4"
                            >
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="font-bold text-slate-800 dark:text-white">
                                        {slotDetails.slot.startTime} - Details
                                    </h4>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant={slotDetails.slot.isBlocked ? "primary" : "danger"} onClick={() => handleToggleBlock(slotDetails.slot)}>
                                            {slotDetails.slot.isBlocked ? "Unblock Slot" : "Block Slot"}
                                        </Button>
                                        <button onClick={() => setSlotDetails(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                                    </div>
                                </div>
                                {slotDetails.appts.length === 0 ? (
                                    <p className="text-sm text-slate-500 italic">No bookings for this slot.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {slotDetails.appts.map(a => (
                                            <div key={a.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm border border-slate-100 dark:border-slate-700">
                                                <div>
                                                    <span className="font-bold text-slate-700 dark:text-slate-200">{a.patientName}</span>
                                                    <span className="text-slate-400 mx-2">•</span>
                                                    <span className="text-slate-500">{a.type}</span>
                                                </div>
                                                <div className="flex gap-2 text-xs text-slate-500">
                                                    {/* Communication (chat/video) disabled for this slot view */}
                                                    <span>{a.consultationType}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Card>

                {/* Settings Panel */}
                <div className="space-y-6">
                    <Card title="Configuration">
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Slot Duration (mins)</label>
                                <select
                                    className="w-full p-2 border rounded-lg mt-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                                    value={slotDuration}
                                    onChange={e => setSlotDuration(parseInt(e.target.value))}
                                >
                                    <option value={15}>15 Minutes</option>
                                    <option value={30}>30 Minutes</option>
                                    <option value={45}>45 Minutes</option>
                                    <option value={60}>1 Hour</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Max Patients / Slot</label>
                                <input
                                    type="number"
                                    className="w-full p-2 border rounded-lg mt-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                                    value={maxPatients}
                                    onChange={e => setMaxPatients(parseInt(e.target.value))}
                                    min={1}
                                    max={10}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Weekly Availability</label>
                                <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar p-1">
                                    {schedule.map((day, idx) => (
                                        <div key={day.day} className="flex items-center justify-between text-sm bg-slate-50 dark:bg-slate-800 p-2 rounded">
                                            <span className="w-8 font-bold text-slate-600 dark:text-slate-300">{day.day}</span>
                                            <input
                                                type="checkbox"
                                                checked={day.available}
                                                onChange={e => {
                                                    const newSched = [...schedule];
                                                    newSched[idx].available = e.target.checked;
                                                    setSchedule(newSched);
                                                }}
                                            />
                                            {day.available && (
                                                <div className="flex gap-1">
                                                    <input
                                                        type="time"
                                                        className="w-20 p-1 text-xs border rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-white"
                                                        value={day.startTime}
                                                        onChange={e => {
                                                            const newSched = [...schedule];
                                                            newSched[idx].startTime = e.target.value;
                                                            setSchedule(newSched);
                                                        }}
                                                    />
                                                    <span className="text-slate-400">-</span>
                                                    <input
                                                        type="time"
                                                        className="w-20 p-1 text-xs border rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-white"
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
                            <Button className="w-full" onClick={handleSaveConfig} isLoading={savingConfig}>Update Schedule</Button>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );

    const renderPatientDetails = () => {
        if (!selectedPatient) return null;
        const patientAppts = appointments.filter(a => a.patientId === selectedPatient.id);
        const latestAppt = patientAppts.length > 0 ? patientAppts[patientAppts.length - 1] : null;
        return (
            <div className="space-y-6 p-2 md:p-8">
                <button onClick={() => setSelectedPatient(null)} className="text-sm font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-2 group">
                    <span className="group-hover:-translate-x-1 transition-transform">←</span> Back to Directory
                </button>

                {/* Patient Header */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center text-2xl font-bold text-slate-600 dark:text-slate-300 shadow-inner">
                            {selectedPatient.name.charAt(0)}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{selectedPatient.name}</h2>
                            <p className="text-slate-500 dark:text-slate-400 font-medium">
                                {selectedPatient.age > 0 ? `${selectedPatient.age} yrs` : 'Age N/A'} • {selectedPatient.gender} • {selectedPatient.bloodGroup || 'N/A'}
                            </p>
                            <div className="flex gap-2 mt-2">
                                <span className={`px-2 py-0.5 rounded-md text-xs font-bold uppercase border ${selectedPatient.riskStatus === 'CRITICAL' ? 'bg-red-50 text-red-700 border-red-200' :
                                        selectedPatient.riskStatus === 'WATCH' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                            'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    }`}>
                                    {selectedPatient.riskStatus} Risk
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={() => handleViewPassport(selectedPatient.id)}>
                            View Health Passport
                        </Button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
                    {(['OVERVIEW', 'HISTORY', 'MEDS', 'DOCUMENTS', 'NOTES'] as PatientTab[]).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setPatientTab(tab)}
                            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${patientTab === tab
                                    ? 'border-rose-600 text-rose-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
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
                            <Card title="Latest Vitals">
                                {patientHistory.length > 0 ? (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                                                <p className="text-xs text-slate-400 font-bold uppercase mb-1">Blood Pressure</p>
                                                <p className="text-2xl font-black text-slate-800 dark:text-white">
                                                    {patientHistory[patientHistory.length - 1].systolicBP}/{patientHistory[patientHistory.length - 1].diastolicBP}
                                                </p>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                                                <p className="text-xs text-slate-400 font-bold uppercase mb-1">Glucose</p>
                                                <p className="text-2xl font-black text-slate-800 dark:text-white">
                                                    {patientHistory[patientHistory.length - 1].glucose} <span className="text-xs font-normal text-slate-400">mg/dL</span>
                                                </p>
                                            </div>
                                        </div>
                                        {/* Symptom Risk Profile display if available */}
                                        {selectedPatient.symptomRiskProfile && (
                                            <div className="mt-4 border-t border-slate-100 dark:border-slate-700 pt-4">
                                                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Symptom Screening</h4>
                                                <div className="flex gap-4">
                                                    <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded font-medium text-slate-600 dark:text-slate-300">BP Risk: <b>{selectedPatient.symptomRiskProfile.bpRisk}</b></span>
                                                    <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded font-medium text-slate-600 dark:text-slate-300">Glucose Risk: <b>{selectedPatient.symptomRiskProfile.glucoseRisk}</b></span>
                                                </div>
                                                <p className="text-[10px] text-slate-400 mt-1">Last Screen: {new Date(selectedPatient.symptomRiskProfile.lastScreeningDate).toLocaleDateString()}</p>
                                            </div>
                                        )}
                                        {riskUpdateSummary && (
                                            <div className="mt-4 border-t border-slate-100 dark:border-slate-700 pt-4">
                                                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Clinical Risk Update</h4>
                                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug">
                                                    {riskUpdateSummary}
                                                </p>
                                                <p className="text-[10px] text-slate-400 mt-1">
                                                    Generated from latest recorded vitals and stored risk scores. Always interpret in full clinical context.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ) : <p className="text-slate-400 italic">No vitals history recorded.</p>}
                            </Card>

                            <Card title="Active Medications">
                                {patientMeds.length === 0 && <p className="text-slate-400 italic">No active medications.</p>}
                                {medSafetyAlert && (
                                    <div className={`mb-3 rounded-xl border px-3 py-2 text-[11px] leading-snug ${
                                        medSafetyAlert.severity === 'HIGH'
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
                                <div className="space-y-2">
                                    {patientMeds.map(m => (
                                        <div key={m.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-700">
                                            <div>
                                                <p className="font-bold text-sm text-slate-800 dark:text-white">{m.name}</p>
                                                <p className="text-xs text-slate-500">{m.dosage} • {m.time}</p>
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
                                        <div className={`mb-3 rounded-xl border px-3 py-2 text-[11px] leading-snug ${
                                            medSafetyAlert.severity === 'HIGH'
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
                                <Card title="Add Medication">
                                    <div className="space-y-3">
                                        <Input label="Drug Name" value={newMedName} onChange={e => setNewMedName(e.target.value)} placeholder="e.g. Metformin" />
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <Input label="Dosage" value={newMedDosage} onChange={e => setNewMedDosage(e.target.value)} placeholder="e.g. 500mg" />
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">Frequency</label>
                                                <select
                                                    className="w-full p-2.5 border rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                                                    value={newMedFrequency}
                                                    onChange={e => {
                                                        const next = e.target.value as MedicationFrequency;
                                                        setNewMedFrequency(next);
                                                        // Keep schedule times aligned with the selected frequency.
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

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">Start Date</label>
                                                <input
                                                    type="date"
                                                    className="w-full p-2.5 border rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                                                    value={newMedStartDate}
                                                    onChange={e => setNewMedStartDate(e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">Duration (days)</label>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={365}
                                                    className="w-full p-2.5 border rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                                                    value={newMedDurationDays}
                                                    onChange={e => setNewMedDurationDays(parseInt(e.target.value || '7', 10))}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">Dose Times</label>
                                            <div className="space-y-2">
                                                {(newMedTimes && newMedTimes.length > 0 ? newMedTimes : defaultTimesForFrequency(newMedFrequency)).map((t, idx) => (
                                                    <div key={idx} className="flex items-center gap-2">
                                                        <input
                                                            type="time"
                                                            className="flex-1 p-2.5 border rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
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
                                                                className="px-2.5 py-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                                                                onClick={() => setNewMedTimes(prev => (prev || []).filter((_, i) => i !== idx))}
                                                                disabled={(newMedTimes || []).length <= 1}
                                                                title="Remove time"
                                                            >
                                                                −
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                                {newMedFrequency === 'CUSTOM' && (
                                                    <button
                                                        type="button"
                                                        className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                                                        onClick={() => setNewMedTimes(prev => ([...(prev && prev.length > 0 ? prev : ['08:00']), '12:00']))}
                                                    >
                                                        + Add another time
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">Instructions (optional)</label>
                                            <textarea
                                                className="w-full min-h-[80px] p-2.5 border rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white border-slate-200 dark:border-slate-700"
                                                value={newMedInstructions}
                                                onChange={e => setNewMedInstructions(e.target.value)}
                                                placeholder="e.g. After meals. Avoid grapefruit."
                                            />
                                        </div>
                                        <Button onClick={handleAddMedication} disabled={!newMedName || !newMedDosage} className="w-full">Prescribe</Button>
                                    </div>
                                </Card>
                            </div>

                            <Card title="Missed Dose Alerts">
                                {(!selectedPatient || medAlerts.filter(a => a.patientId === selectedPatient.id && a.status === 'NEW').length === 0) ? (
                                    <p className="text-sm text-slate-500">No missed-dose alerts for this patient.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {medAlerts
                                            .filter(a => a.patientId === selectedPatient.id && a.status === 'NEW')
                                            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                                            .map(a => (
                                                <div
                                                    key={a.id}
                                                    className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50/60"
                                                >
                                                    <div>
                                                        <p className="text-sm font-bold text-amber-900">{a.medicationName}</p>
                                                        <p className="text-xs text-amber-800">
                                                            Missed dose scheduled for {new Date(a.scheduledAt).toLocaleString()}
                                                        </p>
                                                        <p className="text-[11px] text-amber-700 mt-1">Alert created {new Date(a.createdAt).toLocaleString()}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button size="sm" variant="outline" onClick={() => handleAcknowledgeMedAlert(a.id)}>
                                                            Acknowledge
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </Card>

                            <Card title="Prescription OCR">
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                                        <div className="lg:col-span-1 space-y-2">
                                            <p className="text-xs font-bold text-slate-500 uppercase">OCR Recognition</p>
                                            <input type="file" accept="image/*" onChange={handleOcrFileChange} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100" />
                                            {ocrPreviewUrl && (
                                                <div className="mt-2 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 max-h-40 flex items-center justify-center">
                                                    <img src={ocrPreviewUrl} alt="Prescription preview" className="max-h-40 object-contain" />
                                                </div>
                                            )}
                                            <Button onClick={handleRunPrescriptionOcr} isLoading={ocrLoading} disabled={!ocrFile || ocrLoading} className="w-full mt-2">
                                                Run Medicine Extraction
                                            </Button>
                                        </div>

                                        <div className="lg:col-span-2 space-y-3">
                                            <p className="text-xs font-bold text-slate-500 uppercase">Medicine Extraction & Correction Panel</p>
                                            {ocrResult && ocrDraftMeds.length > 0 ? (
                                                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                                                    <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800 flex justify-between items-center text-xs text-slate-600 dark:text-slate-300">
                                                        <span>Confidence: {ocrResult.confidenceScore}%</span>
                                                        <span>{ocrResult.doctorName || 'Doctor N/A'} • {ocrResult.patientName || selectedPatient?.name}</span>
                                                    </div>
                                                    <div className="overflow-x-auto">
                                                        <table className="min-w-full text-left text-xs">
                                                            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                                                <tr>
                                                                    <th className="px-3 py-2">Medicine</th>
                                                                    <th className="px-3 py-2">Dosage</th>
                                                                    <th className="px-3 py-2">Frequency</th>
                                                                    <th className="px-3 py-2">Duration</th>
                                                                    <th className="px-3 py-2">Notes</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                                                {ocrDraftMeds.map((med, idx) => (
                                                                    <tr key={idx}>
                                                                        <td className="px-3 py-1.5">
                                                                            <input value={med.name} onChange={e => handleUpdateOcrMedField(idx, 'name', e.target.value)} className="w-full px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs" />
                                                                        </td>
                                                                        <td className="px-3 py-1.5">
                                                                            <input value={med.dosage} onChange={e => handleUpdateOcrMedField(idx, 'dosage', e.target.value)} className="w-full px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs" />
                                                                        </td>
                                                                        <td className="px-3 py-1.5">
                                                                            <input value={med.frequency} onChange={e => handleUpdateOcrMedField(idx, 'frequency', e.target.value)} className="w-full px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs" />
                                                                        </td>
                                                                        <td className="px-3 py-1.5">
                                                                            <input value={med.duration} onChange={e => handleUpdateOcrMedField(idx, 'duration', e.target.value)} className="w-full px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs" />
                                                                        </td>
                                                                        <td className="px-3 py-1.5">
                                                                            <input value={med.notes || ''} onChange={e => handleUpdateOcrMedField(idx, 'notes', e.target.value)} className="w-full px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs" />
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-500">Run extraction to populate medicines for review and correction.</p>
                                            )}

                                            {ocrResult && ocrDraftMeds.length > 0 && (
                                                <div className="flex justify-end mt-2">
                                                    <Button onClick={handleApproveOcrMedicines} disabled={ocrLoading}>
                                                        Final Approval & Add to Meds
                                                    </Button>
                                                </div>
                                            )}

                                            {ocrApproved && (
                                                <p className="text-xs text-emerald-600 font-semibold mt-2">Final approval completed and medicines added to this patient's list.</p>
                                            )}
                                        </div>
                                    </div>

                                    {ocrError && (
                                        <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                                            {ocrError}
                                        </div>
                                    )}
                                </div>
                            </Card>
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
                                            <a href={doc.url} target="_blank" rel="noreferrer" className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded font-bold hover:bg-blue-100">View</a>
                                        </div>
                                        <p className="font-bold text-sm text-slate-800 dark:text-white truncate" title={doc.name}>{doc.name}</p>
                                        <p className="text-xs text-slate-500 mt-1">{doc.date} • {doc.category || 'General'}</p>
                                    </div>
                                ))}
                            </div>
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

    // --- MAIN RENDER ---

    const effectiveStatus = user.status;
    const isVerifiedUser = effectiveStatus ? effectiveStatus === 'VERIFIED' : true; // Backend-only doctors have no status field

    if (!isVerifiedUser) {
        return (
            <div className="h-screen flex items-center justify-center p-6 text-center">
                <Card className="max-w-md w-full">
                    <h2 className="text-2xl font-bold mb-2">Account Pending</h2>
                    <p className="text-slate-500">Your doctor account is currently under verification.</p>
                </Card>
            </div>
        );
    }

    return (
        <div className="h-full relative p-4 md:p-8">
            {emergencyAlerts.length > 0 && (
                <div className="fixed top-4 right-4 z-[130] space-y-3 w-80">
                    {emergencyAlerts.map((a) => (
                        <div
                            key={a.messageId}
                            className="bg-red-50 border border-red-200 text-red-800 rounded-xl shadow-lg p-3 text-xs flex flex-col gap-1"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                    <span className="font-bold text-[11px] uppercase tracking-wide">Emergency message</span>
                                </div>
                                <button
                                    className="text-[10px] text-red-500 hover:text-red-700"
                                    onClick={() => setEmergencyAlerts(prev => prev.filter(x => x.messageId !== a.messageId))}
                                >
                                    Dismiss
                                </button>
                            </div>
                            <p className="text-[11px] text-red-900/90">
                                A patient in an active chat reported possible emergency symptoms.
                            </p>
                            <p className="text-[10px] text-red-700 font-semibold">
                                Keywords: {a.keywords.join(', ')}
                            </p>
                            {/* Chat navigation disabled; show info only */}
                        </div>
                    ))}
                </div>
            )}
            <AnimatePresence mode="wait">
                <motion.div
                    key={viewMode}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full"
                >
                    {viewMode === 'dashboard' && renderDashboard()}
                    {viewMode === 'schedule' && renderSchedule()}
                    {viewMode === 'analytics' && renderAnalytics()}
                    {viewMode === 'patients' && (selectedPatient ? renderPatientDetails() : (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Patient Directory</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {patients.length === 0 && <p className="text-slate-400 italic col-span-full">No patients assigned yet.</p>}
                                {patients.map(p => (
                                    <div key={p.id} onClick={() => setSelectedPatient(p)} className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-lg hover:-translate-y-1 cursor-pointer transition-all flex items-center justify-between group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-lg font-bold text-slate-600 dark:text-slate-300">
                                                {p.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-bold text-lg text-slate-800 dark:text-white group-hover:text-rose-600 transition-colors">{p.name}</div>
                                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                                    {p.age > 0 ? `${p.age} yrs` : 'Age N/A'} • {p.gender}
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`px-2 py-1 rounded text-xs font-bold uppercase ${p.riskStatus === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                                                p.riskStatus === 'WATCH' ? 'bg-orange-100 text-orange-700' :
                                                    'bg-emerald-100 text-emerald-700'
                                            }`}>
                                            {p.riskStatus}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </motion.div>
            </AnimatePresence>

            {/* Overlays (communication overlays removed; only passport remains) */}
            {passportToView && (
                <div className="fixed inset-0 z-[120] bg-white dark:bg-slate-900 overflow-y-auto">
                    <HealthPassport data={passportToView} onClose={() => setPassportToView(null)} isDoctorView={true} />
                </div>
            )}
        </div>
    );
};
