
import React, { useState, useEffect, useRef } from 'react';
import { PatientProfile, HealthMetrics, AIAnalysisResult, DoctorProfile, DoctorStatus, EmergencyGuidance, Appointment, UserRole, HealthPassportData, Document, Medication, TimeSlot, ExtractedParameter } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { MockBackend } from '../services/mockBackend';
import { BackendAPI, BackendDoctor, QueueUpdate } from '../services/apiClient';
import { ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { MedicalChatbot } from '../components/MedicalChatbot';
import { ChatSystem } from '../components/ChatSystem';
import { HealthRiskPredictionModule } from '../components/HealthRiskPredictionModule';
import { HealthPassport } from '../components/HealthPassport';
import { VideoCall } from '../components/VideoCall';

interface Props {
    user: PatientProfile;
}

// Demo mode: enabled in local development only. In production builds we must
// never surface hardcoded/demo doctors; only real backend doctors are shown.
const IS_DEMO_MODE = (import.meta as any).env.DEV === true;

// Animation Variants
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } }
};

export const PatientDashboard: React.FC<Props> = ({ user }) => {
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
    const [, setLastBookingMessage] = useState<string | null>(null);

    // Comm
    const [activeChatAppt, setActiveChatAppt] = useState<Appointment | null>(null);
    const [activeVideoCall, setActiveVideoCall] = useState<Appointment | null>(null);
    const [queueInfo, setQueueInfo] = useState<Record<string, { ahead: number; delayMinutes: number; status: Appointment['status'] }>>({});

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
    }, [user.id]);

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
    const handleAnalyze = async () => {
        setLoading(true);
        try {
            const currentMetrics = { ...metrics };

            const result = await BackendAPI.analyzeHealthRisk({
                metrics: currentMetrics,
                age: Number(user.age) || 0,
                gender: user.gender,
            });

            setAiResult(result);

            // Save full combined data via real backend
            await BackendAPI.saveMyMetrics({
                ...currentMetrics,
                timestamp: new Date().toISOString(),
                ...result
            });

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

            const appt = await BackendAPI.createAppointment({
                doctorId: selectedDoctorId,
                date: bookingDate,
                time: slot.startTime,
                type: bookingType,
                consultationType,
                slotId: slot.id,
                symptoms: bookingSymptoms,
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
            <motion.div variants={itemVariants} className="relative rounded-[32px] overflow-hidden shadow-2xl bg-slate-900 text-white border border-slate-700/50">
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-rose-600/30 rounded-full blur-[140px] -mr-32 -mt-32 pointer-events-none opacity-60" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-600/30 rounded-full blur-[120px] -ml-20 -mb-20 pointer-events-none opacity-50" />

                <div className="relative z-10 p-8 md:p-12">
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-8 mb-10">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-bold uppercase tracking-wider text-rose-200 backdrop-blur-md">
                                    Patient Portal
                                </span>
                                <span className={`px-3 py-1 rounded-full border backdrop-blur-md text-xs font-bold uppercase tracking-wider ${user.riskStatus === 'STABLE' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' :
                                    user.riskStatus === 'WATCH' ? 'bg-orange-500/20 border-orange-500/40 text-orange-300' :
                                        'bg-red-500/20 border-red-500/40 text-red-300'
                                    }`}>
                                    {user.riskStatus} Status
                                </span>
                            </div>
                            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-3">
                                Hello, <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-300 via-rose-200 to-white">{user.name.split(' ')[0]}</span>
                            </h1>
                            <p className="text-slate-300 text-lg max-w-xl font-medium leading-relaxed">
                                Welcome back. Your health monitoring is active. <br className="hidden md:block" />You have <span className="text-white font-bold">{appointments.filter(a => a.status === 'SCHEDULED').length}</span> upcoming appointments this week.
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Button
                                onClick={() => document.getElementById('risk-module')?.scrollIntoView({ behavior: 'smooth' })}
                                className="!bg-white !text-slate-900 hover:!bg-slate-100 !border-none shadow-xl px-8 py-4 rounded-2xl flex items-center gap-3 font-bold text-base transition-transform hover:-translate-y-1"
                            >
                                <span className="text-2xl">🩺</span> Check Vitals
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setShowBookingModal(true)}
                                className="!bg-white/5 !border-white/20 !text-white hover:!bg-white/10 backdrop-blur-md px-8 py-4 rounded-2xl flex items-center gap-3 font-bold text-base hover:border-white/40 transition-transform hover:-translate-y-1"
                            >
                                <span className="text-2xl">📅</span> Book Visit
                            </Button>
                        </div>
                    </div>

                    {/* Stats Ribbon */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 border-t border-white/10">
                        {[
                            { label: 'Blood Pressure', value: metrics.systolicBP ? `${metrics.systolicBP}/${metrics.diastolicBP}` : '--/--', unit: 'mmHg', icon: '❤️' },
                            { label: 'Glucose', value: metrics.glucose || '--', unit: 'mg/dL', icon: '🍬' },
                            { label: 'BMI Score', value: metrics.bmi || '--', unit: 'kg/m²', icon: '⚖️' },
                            { label: 'Active Risks', value: aiResult?.predictions?.filter(p => p.riskLevel !== 'Low').length || 0, unit: 'Alerts', icon: '⚠️', highlight: true }
                        ].map((stat, i) => (
                            <div key={i} className="bg-gradient-to-br from-white/5 to-white/0 border border-white/10 rounded-2xl p-5 backdrop-blur-sm hover:bg-white/10 transition-colors group">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">{stat.label}</span>
                                    <span className="text-xl opacity-80 group-hover:scale-110 transition-transform">{stat.icon}</span>
                                </div>
                                <div className="flex items-baseline gap-1.5">
                                    <span className={`text-3xl font-bold tracking-tight ${stat.highlight && typeof stat.value === 'number' && stat.value > 0 ? 'text-rose-400' : 'text-white'}`}>{stat.value}</span>
                                    <span className="text-xs text-slate-500 font-bold">{stat.unit}</span>
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
                </div>

                {/* 3. RIGHT: SIDEBAR (Workflow Items) */}
                <div className="space-y-6">
                    {/* Action Center */}
                    <motion.div variants={itemVariants}>
                        <Card title="Quick Actions" className="shadow-sm border-slate-100 dark:border-slate-800">
                            <div className="space-y-3">
                                <Button variant="outline" className="w-full justify-start h-14 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 group rounded-xl" onClick={handleGeneratePassport}>
                                    <span className="mr-3 text-2xl group-hover:scale-110 transition-transform">📋</span>
                                    <div className="text-left">
                                        <span className="font-bold block text-sm">Health Passport</span>
                                        <span className="text-[10px] text-slate-400 font-normal">Generate PDF Report</span>
                                    </div>
                                </Button>
                                <Button variant="outline" className="w-full justify-start h-14 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 group rounded-xl" onClick={() => document.getElementById('documents')?.scrollIntoView({ behavior: 'smooth' })}>
                                    <span className="mr-3 text-2xl group-hover:scale-110 transition-transform">📂</span>
                                    <div className="text-left">
                                        <span className="font-bold block text-sm">Upload Records</span>
                                        <span className="text-[10px] text-slate-400 font-normal">Store Lab Results</span>
                                    </div>
                                </Button>
                                <Button variant="outline" className="w-full justify-start h-14 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 group rounded-xl" onClick={() => setShowContactModal(true)}>
                                    <span className="mr-3 text-2xl group-hover:scale-110 transition-transform">🆘</span>
                                    <div className="text-left">
                                        <span className="font-bold block text-sm">Emergency Contact</span>
                                        <span className="text-[10px] text-red-300 font-normal">Update Details</span>
                                    </div>
                                </Button>
                            </div>
                        </Card>
                    </motion.div>

                    {/* Up Next Appointment */}
                    <motion.div variants={itemVariants}>
                        <Card title="Next Appointment" className="shadow-sm border-slate-100 dark:border-slate-800">
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
                                        if (ahead === 0) queueMessage = 'You are next';
                                        else if (ahead === 1) queueMessage = '1 patient ahead';
                                        else if (ahead > 1) queueMessage = `${ahead} patients ahead`;
                                    }
                                    return (
                                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 rounded-full -mr-6 -mt-6"></div>
                                            <div className="flex gap-4 items-start mb-5 relative z-10">
                                                <div className="flex flex-col items-center justify-center bg-white dark:bg-slate-700 rounded-2xl w-16 h-16 shadow-sm border border-slate-200 dark:border-slate-600 shrink-0">
                                                    <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">{dateObj.toLocaleDateString('en-US', { month: 'short' })}</span>
                                                    <span className="text-2xl font-black text-slate-800 dark:text-white">{dateObj.getDate()}</span>
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-800 dark:text-white leading-tight text-lg">{next.doctorName}</h4>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">{next.time} • {next.consultationType}</p>
                                                    <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                                        {next.type}
                                                    </span>
                                                    {queueMessage && (
                                                        <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                                            {queueMessage}
                                                        </p>
                                                    )}
                                                    {isLate && (
                                                        <p className="mt-1 text-[11px] font-semibold text-amber-600 dark:text-amber-300">
                                                            Doctor running approximately {delay} minutes late
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 relative z-10">
                                                {next.consultationType === 'VIDEO' && (
                                                    <Button size="sm" className="w-full text-xs font-bold shadow-md" onClick={() => setActiveVideoCall(next)}>Join Call</Button>
                                                )}
                                                <Button size="sm" variant="secondary" className="w-full text-xs font-bold" onClick={() => setActiveChatAppt(next)}>Chat</Button>
                                            </div>
                                        </div>
                                    );
                                })()
                            ) : (
                                <div className="flex flex-col items-center justify-center py-8 text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                                    <span className="text-3xl mb-2 grayscale opacity-50">📅</span>
                                    <span className="text-sm font-medium">No upcoming visits</span>
                                    <button onClick={() => setShowBookingModal(true)} className="mt-3 text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline">Book an Appointment</button>
                                </div>
                            )}
                        </Card>
                    </motion.div>

                    {/* Medications */}
                    <motion.div variants={itemVariants}>
                        <Card title="My Medications" className="shadow-sm border-slate-100 dark:border-slate-800">
                            {medications.length === 0 ? (
                                <div className="text-center py-6 text-slate-400 text-sm italic">No active prescriptions.</div>
                            ) : (
                                <div className="space-y-3">
                                    {medications.map(m => (
                                        <div key={m.id} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0 shadow-sm ${m.taken ? 'bg-emerald-400' : 'bg-gradient-to-br from-rose-400 to-rose-500'}`}>
                                                {m.taken ? '✓' : '💊'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-bold truncate ${m.taken ? 'line-through text-slate-400' : 'text-slate-800 dark:text-white'}`}>{m.name}</p>
                                                <p className="text-xs text-slate-500 truncate">{m.dosage} • {m.time}</p>
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
            <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-slate-200 dark:border-slate-800">
                <div id="documents" className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <span className="text-2xl">📂</span> Medical Records
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
                            <Button size="sm" variant="secondary" isLoading={isUploading} onClick={() => fileUploadRef.current?.click()} className="text-xs font-bold">
                                + Upload
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 max-h-80 overflow-y-auto custom-scrollbar p-1">
                        {documents.length === 0 && (
                            <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                                <p className="text-slate-400 text-sm font-medium">No records uploaded yet.</p>
                                <p className="text-slate-400 text-xs mt-1">Upload prescriptions or lab reports safely.</p>
                            </div>
                        )}
                        {documents.map(doc => (
                            <div key={doc.id} className="group bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between shadow-sm hover:shadow-lg transition-all hover:border-rose-200 dark:hover:border-rose-900">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center text-2xl shadow-inner">
                                        {doc.type.includes('pdf') ? '📄' : '🖼️'}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-slate-700 dark:text-slate-200 truncate max-w-[200px] group-hover:text-rose-600 transition-colors">{doc.name}</p>
                                        <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase font-bold tracking-wide mt-1">
                                            <span className="bg-slate-100 dark:bg-slate-800 px-1.5 rounded">{doc.date}</span>
                                            <span>•</span>
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

                    <Card title="Visit History & Notes" className="mt-4">
                        {appointments.length === 0 ? (
                            <p className="text-slate-400 italic text-sm">No consultations recorded yet.</p>
                        ) : (
                            <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                                {appointments
                                    .slice()
                                    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
                                    .map(appt => (
                                        <div key={appt.id} className="p-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
                                            <div className="flex justify-between items-center mb-1">
                                                <div>
                                                    <p className="text-xs font-bold text-slate-500">{appt.date} • {appt.time}</p>
                                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{appt.doctorName}</p>
                                                </div>
                                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                                    {appt.status}
                                                </span>
                                            </div>
                                            {appt.notes ? (
                                                <p className="mt-2 text-xs text-slate-700 dark:text-slate-200 whitespace-pre-line">
                                                    {appt.notes}
                                                </p>
                                            ) : (
                                                <p className="mt-2 text-xs text-slate-400 italic">
                                                    No doctor notes added for this visit yet.
                                                </p>
                                            )}
                                        </div>
                                    ))}
                            </div>
                        )}
                    </Card>
                </div>

                <div className="space-y-4">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <span className="text-2xl">👨‍⚕️</span> Top Specialists
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                        {recommendedDoctors.slice(0, 3).map(d => (
                            <div key={d.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center font-bold text-white text-lg shadow-md ring-2 ring-indigo-100 dark:ring-indigo-900">
                                        {d.name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-slate-800 dark:text-white">{d.name}</p>
                                        <p className="text-xs text-rose-500 font-medium">{d.specialization}</p>
                                        <div className="flex items-center gap-1 mt-1">
                                            <span className="text-yellow-400 text-xs">★</span>
                                            <span className="text-xs text-slate-500 font-bold">{d.rating || 4.8}</span>
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
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
                                    className="text-xs font-bold px-4"
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
            <AnimatePresence>
                {showBookingModal && (
                    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg p-8 border border-slate-100 dark:border-slate-800">
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
                                <div className="pt-4 flex gap-3">
                                    <Button className="flex-1" onClick={handleBookAppointment} disabled={!selectedSlotId} isLoading={bookingLoading}>Confirm Booking</Button>
                                    <Button variant="ghost" className="flex-1" onClick={() => setShowBookingModal(false)}>Cancel</Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Emergency Contact Modal */}
            <AnimatePresence>
                {showContactModal && (
                    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md p-8 border border-slate-100 dark:border-slate-800">
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
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Passport Modal */}
            {
                showPassportModal && passportData && (
                    <div className="fixed inset-0 z-[120] bg-white dark:bg-slate-900 overflow-y-auto">
                        <HealthPassport data={passportData} onClose={() => setShowPassportModal(false)} />
                    </div>
                )
            }

            {/* Assistants */}
            <MedicalChatbot />
            {activeVideoCall && <VideoCall appointmentId={activeVideoCall.id} otherUserName={activeVideoCall.doctorName} onClose={() => setActiveVideoCall(null)} />}
            {activeChatAppt && <ChatSystem currentUserId={user.id} currentUserRole={UserRole.PATIENT} appointmentId={activeChatAppt.id} otherUserName={activeChatAppt.doctorName} onClose={() => setActiveChatAppt(null)} />}
        </motion.div >
    );
};
