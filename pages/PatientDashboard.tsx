
import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import { PatientProfile, HealthMetrics, AIAnalysisResult, DoctorProfile, DoctorStatus, EmergencyGuidance, Appointment, UserRole, HealthPassportData, Document, Medication, TimeSlot, ExtractedParameter } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { MockBackend } from '../services/mockBackend';
import { BackendAPI, BackendDoctor, QueueUpdate } from '../services/apiClient';
import { GeminiService } from '../services/geminiService';
import { ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';

import { ChatSystem } from '../components/ChatSystem';

import { HealthRiskPredictionModule } from '../components/HealthRiskPredictionModule';
import { HealthPassport } from '../components/HealthPassport';
import { HealthLinkBridge } from '../components/HealthLinkBridge';
import { AutomationAssistant } from '../components/AutomationAssistant';

const LazyVideoCall = lazy(() => import('../components/VideoCall').then((module) => ({ default: module.VideoCall })));
const prefetchVideoCall = () => { void import('../components/VideoCall'); };

interface Props {
    user: PatientProfile;
    onProfileUpdate?: (user: PatientProfile) => void;
}

// Demo mode: enabled in local development only. In production builds we must
// never surface hardcoded/demo doctors; only real backend doctors are shown.
const IS_DEMO_MODE = false; // Demo mode disabled: only real registered accounts and backend data are permitted.

// Animation Variants
const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } }
};

export const PatientDashboard: React.FC<Props> = ({ user, onProfileUpdate }) => {
    // --- STATE MANAGEMENT ---
    const [metrics, setMetrics] = useState<HealthMetrics>({
        systolicBP: 0,
        diastolicBP: 0,
        glucose: 0,
        bmi: 24,
        cholesterol: 0,
        smoking: false,
        activityLevel: 'Moderate',
        maxHeartRate: 0,
        stDepression: 0,
        timestamp: '',
        weight: 74,
        height: 175,
        familyHistory: false,
    });
    const [history, setHistory] = useState<HealthMetrics[]>([]);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [recommendedDoctors, setRecommendedDoctors] = useState<DoctorProfile[]>([]);
    const [medications, setMedications] = useState<Medication[]>([]);
    const [doctors, setDoctors] = useState<DoctorProfile[]>([]);

    // AI & Modules
    const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
    const [passportData, setPassportData] = useState<HealthPassportData | null>(null);

    // UI States
    const [loading, setLoading] = useState(false);
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [showPassportModal, setShowPassportModal] = useState(false);
    const [showEmergencyModal, setShowEmergencyModal] = useState(false);

    // Emergency Contact State
    const [showContactModal, setShowContactModal] = useState(false);
    const [contactForm, setContactForm] = useState({ name: '', relationship: '', phone: '' });
    const [savingContact, setSavingContact] = useState(false);

    // Upload State
    const [isUploading, setIsUploading] = useState(false);
    const fileUploadRef = useRef<HTMLInputElement>(null);

    // Booking
    const [selectedDoctorId, setSelectedDoctorId] = useState('');
    const [bookingDate, setBookingDate] = useState('');
    const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
    const [selectedSlotId, setSelectedSlotId] = useState('');
    const [bookingType, setBookingType] = useState('Video Consultation');
    const [bookingSymptoms, setBookingSymptoms] = useState('');
    const [bookingLoading, setBookingLoading] = useState(false);
    const [cancelingAppointmentId, setCancelingAppointmentId] = useState<string | null>(null);
    const [, setLastBookingMessage] = useState<string | null>(null);

    // Comm
    const [activeChatAppt, setActiveChatAppt] = useState<Appointment | null>(null);
    const [activeVideoCall, setActiveVideoCall] = useState<Appointment | null>(null);
    const [queueInfo, setQueueInfo] = useState<Record<string, { ahead: number; delayMinutes: number; status: Appointment['status'] }>>({});
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const [isProfilePicUploading, setIsProfilePicUploading] = useState(false);
    const profilePicInputRef = useRef<HTMLInputElement>(null);

    const handleProfilePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Basic validation
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
                if (onProfileUpdate) onProfileUpdate(updatedUser as PatientProfile);
                setRefreshTrigger(prev => prev + 1);
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

    const handleAssistantAction = (action: { type: string; target?: string }) => {
        switch (action.type) {
            case 'OPEN_MODAL':
                if (action.target === 'booking_modal') setShowBookingModal(true);
                if (action.target === 'passport_modal') setShowPassportModal(true);
                if (action.target === 'emergency_modal') setShowEmergencyModal(true);
                break;
            case 'SCROLL_TO':
                if (action.target === '#history') document.getElementById('history-section')?.scrollIntoView({ behavior: 'smooth' });
                if (action.target === '#documents') document.getElementById('documents-section')?.scrollIntoView({ behavior: 'smooth' });
                if (action.target === '#risk-module') document.getElementById('risk-module')?.scrollIntoView({ behavior: 'smooth' });
                break;
            case 'ANALYZE_HEALTH':
                handleAnalyze();
                break;
            case 'GENERATE_PASSPORT':
                handleGeneratePassport();
                break;
            case 'START_VIDEO_CALL':
                const videoAppt = appointments.find(a => a.status === 'SCHEDULED' && a.consultationType === 'VIDEO');
                if (videoAppt) setActiveVideoCall(videoAppt);
                else alert("No scheduled video consultations found.");
                break;
            case 'OPEN_CHAT':
                const chatAppt = appointments.find(a => a.status === 'SCHEDULED');
                if (chatAppt) setActiveChatAppt(chatAppt);
                else alert("No active appointments found for communication.");
                break;
            case 'REFRESH_DATA':
                setRefreshTrigger(prev => prev + 1);
                break;
        }
    };

    const trendData = history.map((h, idx) => ({
        timestamp: h.timestamp || `reading-${idx + 1}`,
        systolicBP: Number.isFinite(h.systolicBP) ? h.systolicBP : 0,
        glucose: Number.isFinite(h.glucose) ? h.glucose : 0,
    }));

    const mapBackendDoctorToProfile = (d: BackendDoctor): DoctorProfile => ({
        id: d.id,
        name: d.name,
        email: d.email,
        role: UserRole.DOCTOR,
        specialization: d.specialization || 'General Physician',
        experienceYears: d.experienceYears ?? 0,
        qualification: d.qualification || '',
        registrationNumber: d.registrationNumber || '',
        medicalCouncil: d.medicalCouncil,
        status: d.status || DoctorStatus.VERIFIED,
        rating: d.rating,
        bio: '',
        schedule: undefined,
        slotDuration: 30,
        defaultMaxPatients: 1,
    });

    // --- INITIAL DATA LOAD ---
    useEffect(() => {
        const actionHandler = (e: any) => handleAssistantAction(e.detail);
        const refreshHandler = () => setRefreshTrigger(prev => prev + 1);
        
        window.addEventListener('carexai-action', actionHandler);
        window.addEventListener('refresh-dashboard', refreshHandler);

        return () => {
            window.removeEventListener('carexai-action', actionHandler);
            window.removeEventListener('refresh-dashboard', refreshHandler);
        };
    }, []);

    useEffect(() => {
        const loadData = async () => {
            const [hist, docs, appts, backendDoctors, recDocs, meds] = await Promise.all([
                BackendAPI.getMyMetrics(),
                MockBackend.getPatientDocuments(user.id),
                BackendAPI.getAppointments(),
                BackendAPI.getDoctors(),
                MockBackend.getRecommendedDoctors(user.id),
                MockBackend.getMedications(user.id),
            ]);

            setHistory(hist);
            if (hist.length > 0) {
                const latest = hist[hist.length - 1];
                setMetrics({ ...latest, weight: latest.weight || 74, height: latest.height || 175 });
            }
            setDocuments(docs);
            setAppointments(appts);

            // Map backend doctors into DoctorProfile shape for booking UI,
            // preferring live backend data over any local/demo defaults.
            const mappedDoctors: DoctorProfile[] = backendDoctors.map(mapBackendDoctorToProfile);

            setDoctors(mappedDoctors);

            // In demo mode we can use mock recommended doctors; in production
            // we derive recommendations from live backend doctors only.
            if (IS_DEMO_MODE) {
                setRecommendedDoctors(recDocs);
            } else {
                setRecommendedDoctors(mappedDoctors.slice(0, 4));
            }
            setMedications(meds);
        };

        loadData();
        // Keep non-appointment data in sync via mock backend for now
        const unsubscribe = MockBackend.subscribe(loadData);
        return () => unsubscribe();
    }, [user.id, refreshTrigger]);

    // Realtime appointment updates from backend
    useEffect(() => {
        const unsubscribeAppt = BackendAPI.onAppointmentCreated((appt) => {
            if (appt.patientId !== user.id) return;
            setAppointments((prev) => {
                const idx = prev.findIndex(a => a.id === appt.id);
                if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = appt;
                    return next;
                }
                return [...prev, appt];
            });

            setLastBookingMessage(
                `Your booking is confirmed with ${appt.doctorName} on ${appt.date} at ${appt.time}.`
            );
        });

        const unsubscribeSlot = BackendAPI.onSlotUpdated((slot) => {
            if (!selectedDoctorId || !bookingDate) return;
            if (slot.doctorId !== selectedDoctorId || slot.date !== bookingDate) return;
            setAvailableSlots((prev) => {
                const idx = prev.findIndex(s => s.id === slot.id);
                if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = slot as any;
                    return next;
                }
                return [...prev, slot as any];
            });
        });

        const unsubscribeDoctor = BackendAPI.onDoctorUpdated((doctor) => {
            const profile = mapBackendDoctorToProfile(doctor);
            setDoctors((prev) => {
                const idx = prev.findIndex(d => d.id === profile.id);
                if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = profile;
                    return next;
                }
                return [...prev, profile];
            });

            if (!IS_DEMO_MODE) {
                setRecommendedDoctors((prev) => {
                    const others = prev.filter(d => d.id !== profile.id);
                    const next = [profile, ...others];
                    return next.slice(0, 4);
                });
            }
        });

        const unsubscribeQueue = BackendAPI.onQueueUpdate((payload: QueueUpdate) => {
            setQueueInfo((prev) => ({
                ...prev,
                [payload.appointmentId]: {
                    ahead: payload.ahead,
                    delayMinutes: payload.delayMinutes,
                    status: payload.status,
                },
            }));
        });
        const unsubscribeApptUpdated = BackendAPI.onAppointmentUpdated((appt) => {
            if (appt.patientId !== user.id) return;
            setAppointments((prev) => {
                const idx = prev.findIndex(a => a.id === appt.id);
                if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = appt;
                    return next;
                }
                return [...prev, appt];
            });
        });
        return () => {
            unsubscribeAppt();
            unsubscribeSlot();
            unsubscribeDoctor();
            unsubscribeQueue();
            unsubscribeApptUpdated();
        };
    }, [user.id]);

    useEffect(() => {
        if (user.emergencyContact) {
            setContactForm(user.emergencyContact);
        }
    }, [user]);

    // --- HANDLERS ---
    const handleAnalyze = async (dynamicData?: ExtractedParameter[]) => {
        setLoading(true);
        try {
            const currentMetrics = { ...metrics };
            const parsedAge = Number(user.age);
            const safeAge = Number.isFinite(parsedAge) && parsedAge > 0 ? parsedAge : 40;

            const result = await BackendAPI.analyzeHealthRisk({
                metrics: currentMetrics,
                age: Number(user.age) || 0,
                gender: user.gender,
            });

            setAiResult(result);

            const capturedAt = new Date().toISOString();
            const snapshot = {
                ...currentMetrics,
                timestamp: capturedAt,
                ...result,
            } as HealthMetrics;

            // Save full combined data via real backend
            await BackendAPI.saveMyMetrics(snapshot as HealthMetrics & { [key: string]: any });

            // Keep local trend state in sync so charts update immediately.
            setHistory((prev) => [...prev, snapshot]);
            setMetrics((prev) => ({ ...prev, timestamp: capturedAt }));

            if (result.predictions?.some(p => p.riskLevel === 'High')) {
                setShowEmergencyModal(true);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleGeneratePassport = async () => {
        const passport: HealthPassportData = {
            generatedDate: new Date().toISOString(), patientId: user.id, patientName: user.name, patientAge: user.age, patientGender: user.gender, bloodGroup: user.bloodGroup || 'N/A', clinicalSummary: "Generated via CareXAI", metrics, aiAnalysis: aiResult || { predictions: [], diabetesRisk: 0, hypertensionRisk: 0, heartDiseaseRisk: 0, keyFactors: [], explanation: '', lifestyleRecommendations: [], confidenceLevel: 'Medium', confidenceReason: '', confidenceImprovement: '', timestamp: '' }, history: history.slice(-5), medications
        };
        setPassportData(passport);
        await MockBackend.saveHealthPassport(user.id, passport);
        setShowPassportModal(true);
    };

    const handleBookAppointment = async () => {
        if (!selectedDoctorId || !bookingDate || !selectedSlotId) return;
        setBookingLoading(true);
        try {
            const slot = availableSlots.find(s => s.id === selectedSlotId);
            if (!slot) throw new Error('Selected slot not available.');

            const consultationType = bookingType.toLowerCase().includes('video') ? 'VIDEO' : 'IN_PERSON';
            const latestVitals = history.length > 0 ? history[history.length - 1] : metrics;
            const trendSource = history.length > 0 ? history : [metrics];
            const autoShare = {
                currentVitals: {
                    systolicBP: latestVitals?.systolicBP,
                    diastolicBP: latestVitals?.diastolicBP,
                    glucose: latestVitals?.glucose,
                    bmi: latestVitals?.bmi,
                    cholesterol: latestVitals?.cholesterol,
                    timestamp: latestVitals?.timestamp,
                },
                vitalsTrend: trendSource.map(h => ({
                    timestamp: h.timestamp,
                    systolicBP: h.systolicBP,
                    diastolicBP: h.diastolicBP,
                    glucose: h.glucose,
                    bmi: h.bmi,
                    cholesterol: h.cholesterol,
                })),
                history: trendSource.map(h => ({
                    timestamp: h.timestamp,
                    systolicBP: h.systolicBP,
                    diastolicBP: h.diastolicBP,
                    glucose: h.glucose,
                    bmi: h.bmi,
                    cholesterol: h.cholesterol,
                    diabetesRisk: h.diabetesRisk,
                    hypertensionRisk: h.hypertensionRisk,
                    heartDiseaseRisk: h.heartDiseaseRisk,
                })),
                healthPassport: {
                    generatedDate: passportData?.generatedDate,
                    bloodGroup: passportData?.bloodGroup || user.bloodGroup || 'N/A',
                    clinicalSummary: passportData?.clinicalSummary || 'Auto-shared at booking from patient dashboard.',
                },
                riskSummary: aiResult ? {
                    diabetesRisk: aiResult.diabetesRisk,
                    hypertensionRisk: aiResult.hypertensionRisk,
                    heartDiseaseRisk: aiResult.heartDiseaseRisk,
                } : undefined,
                aiAnalysis: aiResult ? {
                    diabetesRisk: aiResult.diabetesRisk,
                    hypertensionRisk: aiResult.hypertensionRisk,
                    heartDiseaseRisk: aiResult.heartDiseaseRisk,
                    explanation: aiResult.explanation,
                    confidenceLevel: aiResult.confidenceLevel,
                    keyFactors: aiResult.keyFactors,
                    lifestyleRecommendations: aiResult.lifestyleRecommendations,
                    predictions: aiResult.predictions,
                } : undefined,
                medications: medications.map((med) => ({
                    id: med.id,
                    name: med.name,
                    dosage: med.dosage,
                    time: med.time,
                    instructions: med.instructions,
                    frequency: med.frequency,
                    times: med.times,
                    startDate: med.startDate,
                    endDate: med.endDate,
                    durationDays: med.durationDays,
                    active: med.active,
                })),
                patientProfile: {
                    patientId: user.id,
                    name: user.name,
                    age: user.age,
                    gender: user.gender,
                    bloodGroup: user.bloodGroup,
                    preferredLanguage: user.preferredLanguage,
                    emergencyContact: user.emergencyContact,
                },
                documents: documents.slice(-50).map(doc => ({
                    name: doc.name,
                    type: doc.type,
                    date: doc.date,
                    url: doc.url,
                    category: doc.category,
                })),
            };

            const appt = await BackendAPI.createAppointment({
                doctorId: selectedDoctorId,
                date: bookingDate,
                time: slot.startTime,
                type: bookingType,
                consultationType,
                slotId: slot.id,
                symptoms: bookingSymptoms,
                autoShare,
            });

            // Optimistically update list; realtime will also broadcast
            setAppointments(prev => [...prev, appt]);
            setLastBookingMessage(
                `Your booking is confirmed with ${appt.doctorName} on ${appt.date} at ${appt.time}.`
            );
            setShowBookingModal(false);
        } catch (e: any) { alert(e.message); } finally { setBookingLoading(false); }
    };

    const handleSaveContact = async () => {
        setSavingContact(true);
        try {
            await MockBackend.updatePatientProfile(user.id, { emergencyContact: contactForm });
            setShowContactModal(false);
            alert("Emergency contact saved successfully.");
        } catch (e) { console.error(e); } finally { setSavingContact(false); }
    };

    const handleCancelAppointment = async (appointmentId: string) => {
        setCancelingAppointmentId(appointmentId);
        try {
            const updated = await BackendAPI.updateAppointmentStatus({ appointmentId, status: 'CANCELLED' });
            setAppointments((prev) => prev.map((appt) => (appt.id === updated.id ? updated : appt)));
        } catch (e: any) {
            alert(e?.message || 'Failed to cancel appointment.');
        } finally {
            setCancelingAppointmentId(null);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setIsUploading(true);
            const files = Array.from(e.target.files) as File[];
            try {
                // Upload files in parallel
                await Promise.all(files.map(file => MockBackend.uploadDocument(user.id, file, 'Patient Upload')));

                // Refresh list
                const updatedDocs = await MockBackend.getPatientDocuments(user.id);
                setDocuments(updatedDocs);
            } catch (err) {
                console.error("Upload failed", err);
                alert("Failed to upload one or more files.");
            } finally {
                setIsUploading(false);
                if (fileUploadRef.current) fileUploadRef.current.value = '';
            }
        }
    };

    useEffect(() => {
        if (selectedDoctorId && bookingDate) {
            BackendAPI.getDoctorSlots(selectedDoctorId, bookingDate).then(setAvailableSlots).catch(() => setAvailableSlots([]));
        } else {
            setAvailableSlots([]);
        }
    }, [selectedDoctorId, bookingDate]);

    // --- UI COMPONENTS ---

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6"
        >

            {/* 1. HERO SECTION: Health Status & Actions */}
            <motion.div variants={itemVariants} className="relative rounded-[32px] overflow-hidden glass-card">
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[var(--accent-primary)] opacity-10 rounded-full blur-[140px] -mr-32 -mt-32 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[var(--accent-secondary)] opacity-10 rounded-full blur-[120px] -ml-20 -mb-20 pointer-events-none" />

                <div className="relative z-10 p-8 md:p-12">
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-8 mb-10">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <span className="px-3 py-1 rounded-full bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-primary)] backdrop-blur-md">
                                    Systems Operational
                                </span>
                                <span className={`px-3 py-1 rounded-full border backdrop-blur-md text-[10px] font-black uppercase tracking-[0.2em] ${user.riskStatus === 'STABLE' ? 'bg-[var(--accent-secondary)]/20 border-[var(--accent-secondary)]/40 text-[var(--accent-secondary)]' :
                                    user.riskStatus === 'WATCH' ? 'bg-amber-500/20 border-amber-500/40 text-amber-500' :
                                        'bg-[var(--accent-pulse)]/20 border-[var(--accent-pulse)]/40 text-[var(--accent-pulse)]'
                                    }`}>
                                    {user.riskStatus}
                                </span>
                            </div>
                            <h1 className="text-4xl md:text-7xl font-black font-display tracking-tight mb-4 flex items-center gap-6">
                                <div className="relative group cursor-pointer" onClick={() => profilePicInputRef.current?.click()}>
                                    <div className="w-16 h-16 md:w-24 md:h-24 rounded-[24px] overflow-hidden border-2 border-[var(--accent-primary)]/50 shadow-[var(--neon-glow)] bg-[var(--bg-surface)] flex items-center justify-center transition-all group-hover:scale-105 group-hover:border-[var(--accent-primary)]">
                                        {isProfilePicUploading ? (
                                            <div className="w-8 h-8 border-4 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
                                        ) : user.profilePicUrl ? (
                                            <img src={user.profilePicUrl} alt={user.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-3xl md:text-5xl font-bold text-[var(--accent-primary)]">{user.name.charAt(0)}</span>
                                        )}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-[24px]">
                                            <span className="text-white text-[10px] font-bold uppercase tracking-widest">Update</span>
                                        </div>
                                    </div>
                                    <input type="file" ref={profilePicInputRef} className="hidden" accept="image/*" onChange={handleProfilePicUpload} />
                                </div>
                                <div className="text-[var(--text-main)]">
                                    Welcome, <span className="premium-gradient-text">{user.name}</span>
                                </div>
                            </h1>
                            <p className="text-[var(--text-muted)] text-lg max-w-xl font-medium leading-relaxed">
                                Biometric monitoring initialized. You have <span className="text-[var(--text-main)] font-black">{appointments.filter(a => a.status === 'SCHEDULED').length}</span> upcoming sessions. All systems report nominal.
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Button
                                onClick={() => document.getElementById('risk-module')?.scrollIntoView({ behavior: 'smooth' })}
                                className="px-8 py-6 rounded-2xl flex items-center gap-3 font-black text-base transition-all hover:scale-105 shadow-lg bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90"
                            >
                                <span className="text-2xl">🧬</span> Sync Vitals
                            </Button>
                            <Button
                                onClick={() => setShowBookingModal(true)}
                                className="px-8 py-6 rounded-2xl flex items-center gap-3 font-black text-base transition-all hover:scale-105 glass-card border-[var(--accent-primary)]/30 text-[var(--text-main)]"
                            >
                                <span className="text-2xl">⚡</span> Schedule
                            </Button>
                        </div>
                    </div>

                    {/* Stats Ribbon */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 border-t border-[var(--glass-border)]">
                        {[
                            { label: 'Blood Pressure', value: metrics.systolicBP ? `${metrics.systolicBP}/${metrics.diastolicBP}` : '--/--', unit: 'mmHg', icon: '❤️' },
                            { label: 'Glucose Level', value: metrics.glucose || '--', unit: 'mg/dL', icon: '🍬' },
                            { label: 'Body Mass Index', value: metrics.bmi || '--', unit: 'kg/m²', icon: '⚖️' },
                            { label: 'Health Alerts', value: aiResult?.predictions?.filter(p => p.riskLevel !== 'Low').length || 0, unit: 'Active', icon: '⚠️', highlight: true }
                        ].map((stat, i) => (
                            <div key={i} className={`relative group overflow-hidden glass-card p-5 hover:bg-[var(--accent-primary)]/5 transition-all duration-300 ${stat.highlight && typeof stat.value === 'number' && stat.value > 0 ? 'neon-pulse' : ''}`}>
                                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-30 transition-opacity">
                                    <span className="text-4xl">{stat.icon}</span>
                                </div>
                                <div className="relative z-10">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-slate-500 text-[10px] uppercase font-bold tracking-[0.2em]">{stat.label}</span>
                                        <div className={`w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] ${stat.highlight ? 'animate-pulse shadow-[0_0_8px_var(--accent-primary)]' : ''}`} />
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className={`text-3xl font-bold tracking-tight font-['Space_Grotesk'] ${stat.highlight && typeof stat.value === 'number' && stat.value > 0 ? 'text-pulse-400' : 'text-white'}`}>
                                            {stat.value}
                                        </span>
                                        <span className="text-[10px] text-slate-600 font-bold uppercase">{stat.unit}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </motion.div>


            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* 2. LEFT: AI RISK MODULE (Core Workflow) */}
                <div className="lg:col-span-2 space-y-8">
                    <motion.div variants={itemVariants} id="risk-module">
                        <HealthRiskPredictionModule
                            metrics={metrics}
                            history={history}
                            aiResult={aiResult}
                            onUpdateMetrics={setMetrics}
                            onAnalyze={handleAnalyze}
                            loading={loading}
                            symptomProfile={user.symptomRiskProfile}
                        />
                    </motion.div>

                    {/* Trends Chart */}
                    <motion.div variants={itemVariants}>
                        {history.length > 1 && (
                            <Card title="Vitals Trends" className="border-slate-100 dark:border-slate-800 shadow-sm">
                                <div className="h-80 w-full mt-2">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorBP" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
                                                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorGl" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.5} />
                                            <XAxis dataKey="timestamp" hide />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', background: 'rgba(255, 255, 255, 0.95)' }}
                                                itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                                            />
                                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                            <Area type="monotone" name="Systolic BP" dataKey="systolicBP" stroke="#f43f5e" strokeWidth={3} fill="url(#colorBP)" activeDot={{ r: 6, strokeWidth: 0 }} />
                                            <Area type="monotone" name="Glucose" dataKey="glucose" stroke="#10b981" strokeWidth={3} fill="url(#colorGl)" activeDot={{ r: 6, strokeWidth: 0 }} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>
                        )}
                    </motion.div>

                    <motion.div variants={itemVariants}>
                        <HealthLinkBridge
                            patient={user}
                            appointments={appointments}
                            metrics={metrics}
                            medications={medications}
                        />
                    </motion.div>

                </div>

                {/* 3. RIGHT: SIDEBAR (Workflow Items) */}
                <div className="space-y-6">
                    {/* Action Center */}
                    <motion.div variants={itemVariants}>
                        <Card title="Quick Terminal" className="border-neon-500/10 glass-card-dark">
                            <div className="space-y-3">
                                <Button variant="outline" className="w-full justify-start h-16 text-slate-300 border-white/5 bg-white/5 hover:border-neon-400 hover:bg-neon-400/5 group rounded-2xl group transition-all" onClick={handleGeneratePassport}>
                                    <span className="mr-3 text-2xl group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(0,212,255,0.8)] transition-transform">📋</span>
                                    <div className="text-left">
                                        <span className="font-bold block text-xs tracking-wider uppercase">Sync Passport</span>
                                        <span className="text-[10px] text-slate-500 font-medium">Export Encrypted PDF</span>
                                    </div>
                                </Button>
                                <Button variant="outline" className="w-full justify-start h-16 text-slate-300 border-white/5 bg-white/5 hover:border-bio-400 hover:bg-bio-400/5 group rounded-2xl group transition-all" onClick={() => document.getElementById('documents')?.scrollIntoView({ behavior: 'smooth' })}>
                                    <span className="mr-3 text-2xl group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(0,255,179,0.8)] transition-transform">📂</span>
                                    <div className="text-left">
                                        <span className="font-bold block text-xs tracking-wider uppercase">Upload Vault</span>
                                        <span className="text-[10px] text-slate-500 font-medium">Store Imaging/Lab Results</span>
                                    </div>
                                </Button>
                                <Button variant="outline" className="w-full justify-start h-16 text-pulse-400 border-white/5 bg-white/5 hover:border-pulse-500 hover:bg-pulse-500/5 group rounded-2xl group transition-all" onClick={() => setShowContactModal(true)}>
                                    <span className="mr-3 text-2xl group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(255,0,110,0.8)] transition-transform">🆘</span>
                                    <div className="text-left">
                                        <span className="font-bold block text-xs tracking-wider uppercase">SOS Config</span>
                                        <span className="text-[10px] text-pulse-500/70 font-medium">Emergency Contacts</span>
                                    </div>
                                </Button>
                            </div>
                        </Card>
                    </motion.div>

                    {/* Up Next Appointment */}
                    <motion.div variants={itemVariants}>
                        <Card title="Active Protocol" className="border-neon-500/10 glass-card-dark">
                            {appointments.filter(a => a.status === 'SCHEDULED').length > 0 ? (
                                (() => {
                                    const next = appointments.filter(a => a.status === 'SCHEDULED')[0];
                                    const dateObj = new Date(next.date);
                                    const info = queueInfo[next.id];
                                    const ahead = info?.ahead;
                                    const delay = info?.delayMinutes ?? 0;
                                    const isLate = delay >= 5;
                                    let queueMessage = '';
                                    if (ahead !== undefined) {
                                        if (ahead === 0) queueMessage = 'Connection Established';
                                        else if (ahead === 1) queueMessage = '1 Subject Ahead';
                                        else if (ahead > 1) queueMessage = `${ahead} Subjects Ahead`;
                                    }
                                    return (
                                        <div className="bg-white/5 rounded-2xl p-5 border border-white/5 relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 w-24 h-24 bg-neon-500/5 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500"></div>
                                            <div className="flex gap-4 items-start mb-5 relative z-10">
                                                <div className="flex flex-col items-center justify-center bg-space-900 rounded-2xl w-16 h-18 shadow-xl border border-white/10 shrink-0">
                                                    <span className="text-[10px] font-bold text-neon-400 uppercase tracking-widest mb-1">{dateObj.toLocaleDateString('en-US', { month: 'short' })}</span>
                                                    <span className="text-3xl font-bold text-white font-['Space_Grotesk']">{dateObj.getDate()}</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-bold text-white tracking-tight text-lg truncate font-['Space_Grotesk']">{next.doctorName}</h4>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{next.time}</span>
                                                        <span className="w-1 h-1 rounded-full bg-slate-700" />
                                                        <span className="text-[10px] text-neon-400/80 font-bold uppercase tracking-wider">{next.consultationType}</span>
                                                    </div>
                                                    {queueMessage && (
                                                        <div className="mt-3 flex items-center gap-1.5 capitalize">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-bio-400 animate-pulse" />
                                                            <span className="text-[11px] font-bold text-bio-300/80 uppercase tracking-wider">
                                                                {queueMessage}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {isLate && (
                                                        <div className="mt-2 flex items-center gap-1.5 capitalize">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-pulse-500 animate-pulse" />
                                                            <span className="text-[11px] font-bold text-pulse-400 uppercase tracking-wider">
                                                                Sync Latency: {delay}m
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 relative z-10">
                                                {next.consultationType === 'VIDEO' && (
                                                    <Button
                                                        variant="neon"
                                                        size="sm"
                                                        className="w-full text-[10px] font-bold uppercase tracking-widest h-10"
                                                        onMouseEnter={prefetchVideoCall}
                                                        onFocus={prefetchVideoCall}
                                                        onClick={() => {
                                                            prefetchVideoCall();
                                                            setActiveVideoCall(next);
                                                        }}
                                                    >
                                                        Initialize
                                                    </Button>
                                                )}
                                                <Button size="sm" variant="cyber" className="w-full text-[10px] font-bold uppercase tracking-widest h-10" onClick={() => setActiveChatAppt(next)}>Comms</Button>
                                            </div>
                                        </div>
                                    );
                                })()
                            ) : (
                                <div className="flex flex-col items-center justify-center py-10 text-slate-500 bg-white/5 rounded-2xl border border-dashed border-white/10 group">
                                    <div className="text-4xl mb-4 opacity-50 group-hover:scale-110 transition-transform">📅</div>
                                    <span className="text-xs font-bold uppercase tracking-widest">No Active Protocol</span>
                                    <button onClick={() => setShowBookingModal(true)} className="mt-4 text-[10px] font-bold text-neon-400 hover:text-neon-300 uppercase tracking-[0.2em] transition-colors border-b border-neon-400/30 pb-0.5">Initialize Session</button>
                                </div>
                            )}
                        </Card>
                    </motion.div>


                    {/* Medications */}
                    <motion.div variants={itemVariants}>
                        <Card title="Active Medications" className="border-neon-500/10 glass-card-dark">
                            {medications.length === 0 ? (
                                <div className="text-center py-6 text-slate-500 text-xs italic tracking-wide uppercase">No Active Protocols.</div>
                            ) : (
                                <div className="space-y-3">
                                    {medications.map(m => (
                                        <div key={m.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 shadow-sm hover:shadow-neon-500/10 hover:border-neon-500/30 transition-all group">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0 shadow-sm ${m.taken ? 'bg-bio-500 shadow-[0_0_10px_rgba(0,255,179,0.4)]' : 'bg-gradient-to-br from-neon-500 to-neon-600 shadow-[0_4px_10px_rgba(0,212,255,0.4)]'}`}>
                                                {m.taken ? '✓' : '💊'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-bold truncate tracking-tight font-['Space_Grotesk'] ${m.taken ? 'line-through text-slate-500' : 'text-white'}`}>{m.name}</p>
                                                <p className="text-[10px] text-slate-500 truncate uppercase font-bold tracking-wider">{m.dosage} • {m.time}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    </motion.div>
                </div>
            </div>


            {/* 4. LOWER SECTION: Doctors & Records */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-10 border-t border-white/5">
                <div id="documents" className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-bold text-white flex items-center gap-3 font-['Space_Grotesk'] tracking-tight">
                            <span className="text-2xl drop-shadow-[0_0_8px_rgba(0,212,255,0.6)]">📂</span> Secure Vault
                        </h3>
                        <div className="relative">
                            <input
                                type="file"
                                multiple
                                className="hidden"
                                ref={fileUploadRef}
                                onChange={handleFileUpload}
                                accept="image/*,application/pdf"
                            />
                            <Button size="sm" variant="cyber" isLoading={isUploading} onClick={() => fileUploadRef.current?.click()} className="text-[10px] font-bold tracking-widest uppercase">
                                + Add Record
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 max-h-80 overflow-y-auto custom-scrollbar p-1">
                        {documents.length === 0 && (
                            <div className="text-center py-10 bg-white/5 rounded-2xl border-2 border-dashed border-white/10">
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">No Encrypted Records Found.</p>
                                <p className="text-slate-600 text-[10px] mt-2 uppercase">Store medical imaging and lab data securely.</p>
                            </div>
                        )}
                        {documents.map(doc => (
                            <div key={doc.id} className="group bg-white/5 p-4 rounded-2xl border border-white/5 flex items-center justify-between shadow-sm hover:shadow-neon-500/10 transition-all hover:border-neon-500/30">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-space-900 rounded-xl flex items-center justify-center text-2xl shadow-inner border border-white/5">
                                        {doc.type.includes('pdf') ? '📄' : '🖼️'}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-white truncate max-w-[200px] group-hover:text-neon-400 transition-colors font-['Space_Grotesk']">{doc.name}</p>
                                        <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase font-bold tracking-[0.15em] mt-1.5">
                                            <span className="bg-white/5 px-2 py-0.5 rounded-md">{doc.date}</span>
                                            <span className="opacity-30">|</span>
                                            <span>{doc.size}</span>
                                        </div>
                                    </div>
                                </div>
                                <a href={doc.url} target="_blank" className="text-xs font-bold text-slate-500 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 px-4 py-2 rounded-lg transition-colors border border-slate-100 dark:border-slate-700">
                                    View
                                </a>
                            </div>
                        ))}
                    </div>


                    <Card title="Consultation History" className="mt-6 border-neon-500/10 glass-card-dark">
                        {appointments.length === 0 ? (
                            <p className="text-slate-500 italic text-xs tracking-wide uppercase py-4">No Sessions Recorded.</p>
                        ) : (
                            <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                                {appointments
                                    .slice()
                                    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
                                    .map(appt => (
                                        <div key={appt.id} className="p-4 rounded-2xl border border-white/5 bg-white/5 shadow-sm group hover:border-neon-500/20 transition-all">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <p className="text-[10px] font-bold text-neon-400 uppercase tracking-widest mb-1">{appt.date} • {appt.time}</p>
                                                    <p className="text-base font-bold text-white font-['Space_Grotesk'] tracking-tight">{appt.doctorName}</p>
                                                </div>
                                                <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold uppercase tracking-widest ${appt.status === 'COMPLETED' ? 'bg-bio-500/20 text-bio-400' : 'bg-white/5 text-slate-400'
                                                    }`}>
                                                    {appt.status}
                                                </span>
                                            </div>
                                            {appt.notes ? (
                                                <p className="mt-3 text-xs text-slate-400 leading-relaxed max-w-sm line-clamp-2 italic">
                                                    "{appt.notes}"
                                                </p>
                                            ) : (
                                                <p className="mt-3 text-[10px] text-slate-600 uppercase font-bold tracking-wider">
                                                    Final Report Pending
                                                </p>
                                            )}
                                            {(appt.status === 'SCHEDULED' || appt.status === 'PENDING') && (
                                                <div className="mt-3 flex justify-end">
                                                    <Button
                                                        size="sm"
                                                        variant="danger"
                                                        onClick={() => handleCancelAppointment(appt.id)}
                                                        isLoading={cancelingAppointmentId === appt.id}
                                                    >
                                                        Cancel Appointment
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                            </div>
                        )}
                    </Card>
                </div>

                <div className="space-y-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-3 font-['Space_Grotesk'] tracking-tight">
                        <span className="text-2xl drop-shadow-[0_0_8px_rgba(0,255,179,0.6)]">👨‍⚕️</span> Available Specialists
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                        {recommendedDoctors.slice(0, 3).map(d => (
                            <div key={d.id} className="bg-white/5 p-5 rounded-[24px] border border-white/5 flex items-center justify-between shadow-sm hover:shadow-neon-500/10 hover:border-neon-500/30 transition-all group">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-space-900 rounded-2xl flex items-center justify-center font-bold text-white text-xl shadow-xl ring-1 ring-white/10 group-hover:ring-neon-400/30 transition-all">
                                        {d.name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-bold text-base text-white font-['Space_Grotesk'] tracking-tight group-hover:text-neon-400 transition-colors">{d.name}</p>
                                        <p className="text-[11px] text-bio-400 font-bold uppercase tracking-widest mt-1">{d.specialization}</p>
                                        <div className="flex items-center gap-1.5 mt-2">
                                            <span className="text-neon-400 text-xs drop-shadow-[0_0_5px_rgba(0,212,255,0.5)]">★</span>
                                            <span className="text-xs text-slate-500 font-bold tracking-tighter">{d.rating || 4.8}</span>
                                            <span className="mx-1 text-slate-700">•</span>
                                            <span className="text-[10px] text-slate-600 font-bold uppercase uppercase">Verified</span>
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    variant="neon"
                                    onClick={() => {
                                        // Map recommended doctor (mock) to real backend doctor by email
                                        const backendMatch = doctors.find(bd => bd.email === d.email);
                                        if (backendMatch) {
                                            setSelectedDoctorId(backendMatch.id);
                                            setShowBookingModal(true);
                                        } else {
                                            alert('This doctor is not yet available for online booking.');
                                        }
                                    }}
                                    className="text-[10px] font-bold px-6 uppercase tracking-widest h-10 shadow-lg"
                                >
                                    Book
                                </Button>
                            </div >
                        ))}
                    </div >
                </div >
            </motion.div >


            {/* --- MODALS (Reused) --- */}
            {/* Booking Modal */}
            {showBookingModal && (
                <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg p-8 border border-slate-100 dark:border-slate-800 transform transition-all">
                        <h3 className="text-2xl font-bold mb-6 text-slate-800 dark:text-white">Book Appointment</h3>
                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Specialist</label>
                                <select className="w-full p-3.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-rose-500" value={selectedDoctorId} onChange={e => setSelectedDoctorId(e.target.value)}>
                                    <option value="">Select Doctor</option>
                                    {doctors.map(d => <option key={d.id} value={d.id}>{d.name} ({d.specialization})</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Date</label>
                                <input type="date" className="w-full p-3.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-rose-500" value={bookingDate} onChange={e => setBookingDate(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Consultation Type</label>
                                <select className="w-full p-3.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-rose-500" value={bookingType} onChange={e => setBookingType(e.target.value)}>
                                    <option value="Video Consultation">Video Consultation</option>
                                    <option value="In-Person Consultation">In-Person Consultation</option>
                                </select>
                            </div>

                            {availableSlots.length > 0 && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Available Slots</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {availableSlots.map(slot => (
                                            <button key={slot.id} disabled={slot.isBlocked || slot.bookedCount >= slot.maxPatients} onClick={() => setSelectedSlotId(slot.id)} className={`p-2 rounded-lg text-sm font-bold border transition-colors ${selectedSlotId === slot.id ? 'bg-rose-600 text-white border-rose-600 shadow-md' : 'border-slate-200 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/10'}`}>
                                                {slot.startTime}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Symptoms / Notes For Doctor</label>
                                <textarea
                                    className="w-full p-3.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-rose-500 min-h-[88px]"
                                    value={bookingSymptoms}
                                    onChange={(e) => setBookingSymptoms(e.target.value)}
                                    placeholder="Describe symptoms and concerns for this visit"
                                />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <Button className="flex-1" onClick={handleBookAppointment} disabled={!selectedSlotId} isLoading={bookingLoading}>Confirm Booking</Button>
                                <Button variant="ghost" className="flex-1" onClick={() => setShowBookingModal(false)}>Cancel</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Emergency Contact Modal */}
            {showContactModal && (
                <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md p-8 border border-slate-100 dark:border-slate-800 transform transition-all">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 text-2xl">🆘</div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white">Emergency Contact</h3>
                        </div>
                        <div className="space-y-4">
                            <Input label="Contact Name" value={contactForm.name} onChange={e => setContactForm({ ...contactForm, name: e.target.value })} placeholder="e.g. Jane Doe" />
                            <Input label="Relationship" value={contactForm.relationship} onChange={e => setContactForm({ ...contactForm, relationship: e.target.value })} placeholder="e.g. Spouse" />
                            <Input label="Phone Number" value={contactForm.phone} onChange={e => setContactForm({ ...contactForm, phone: e.target.value })} placeholder="e.g. +1 555-0123" />
                            <div className="pt-4 flex gap-3">
                                <Button className="flex-1" onClick={handleSaveContact} isLoading={savingContact}>Save Contact</Button>
                                <Button variant="ghost" className="flex-1" onClick={() => setShowContactModal(false)}>Cancel</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Passport Modal */}
            {
                showPassportModal && passportData && (
                    <div className="fixed inset-0 z-[120] bg-white dark:bg-slate-900 overflow-y-auto">
                        <HealthPassport data={passportData} onClose={() => setShowPassportModal(false)} />
                    </div>
                )
            }

            {/* Assistants */}


            {activeVideoCall && (
                <Suspense fallback={<div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm" />}>
                    <LazyVideoCall
                        appointmentId={activeVideoCall.id}
                        otherUserName={activeVideoCall.doctorName}
                        currentUserRole={UserRole.PATIENT}
                        onClose={() => setActiveVideoCall(null)}
                    />
                </Suspense>
            )}
            {activeChatAppt && <ChatSystem currentUserId={user.id} currentUserRole={UserRole.PATIENT} appointmentId={activeChatAppt.id} otherUserId={activeChatAppt.doctorId} otherUserName={activeChatAppt.doctorName} onClose={() => setActiveChatAppt(null)} />}

            {/* Automation AI Assistant */}
            <AutomationAssistant onAction={handleAssistantAction} />
        </motion.div >
    );
};
