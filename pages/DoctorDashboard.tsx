
import React, { useState, useEffect } from 'react';
import { DoctorProfile, PatientProfile, DaySchedule, Appointment, UserRole, DoctorAnalytics, TimeSlot, HealthPassportData, Medication, Document, HealthMetrics } from '../types';
import { MockBackend } from '../services/mockBackend';
import { BackendAPI } from '../services/apiClient';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { motion, AnimatePresence } from 'framer-motion';
import { HealthPassport } from '../components/HealthPassport';
import { BarChart, Bar, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie } from 'recharts';
import { VideoCall } from '../components/VideoCall';
import { ChatSystem } from '../components/ChatSystem';

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
    const [patientDocs, setPatientDocs] = useState<Document[]>([]);

    const [manageDate, setManageDate] = useState(new Date().toISOString().split('T')[0]);
    const [dailySlots, setDailySlots] = useState<TimeSlot[]>([]);
    const [slotDetails, setSlotDetails] = useState<{ slot: TimeSlot, appts: Appointment[] } | null>(null);
    const [passportToView, setPassportToView] = useState<HealthPassportData | null>(null);

    const [newMedName, setNewMedName] = useState('');
    const [newMedDosage, setNewMedDosage] = useState('');
    const [newMedTime, setNewMedTime] = useState('Morning');
    const [clinicalNote, setClinicalNote] = useState('');

    const [activeVideoCall, setActiveVideoCall] = useState<Appointment | null>(null);
    const [activeChatAppt, setActiveChatAppt] = useState<Appointment | null>(null);

    const [schedule, setSchedule] = useState<DaySchedule[]>(user.schedule || getDefaultSchedule());
    const [slotDuration, setSlotDuration] = useState<number>(user.slotDuration || 30);
    const [maxPatients, setMaxPatients] = useState<number>(user.defaultMaxPatients || 1);
    const [savingConfig, setSavingConfig] = useState(false);

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
                    MockBackend.getMedications(selectedPatient.id),
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

        const unsubscribeApptUpdated = BackendAPI.getSocket()
            ? BackendAPI.getSocket()!.on('appointment:updated', upsertAppointment)
            : () => { };

        return () => {
            unsubscribeMock();
            unsubscribeAppt();
            unsubscribeSlot();
            if (typeof unsubscribeApptUpdated === 'function') (unsubscribeApptUpdated as any)();
        };
    }, [user.id, user.status, viewMode, manageDate, selectedPatient?.id]);

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
        await MockBackend.addMedication(selectedPatient.id, newMedName, newMedDosage, newMedTime);
        setNewMedName(''); setNewMedDosage(''); setNewMedTime('Morning');
    };

    const handleDeleteMedication = async (medId: string) => {
        if (confirm("Remove this medication?")) await MockBackend.deleteMedication(medId);
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

    // --- RENDERERS ---

    const renderDashboard = () => {
        const todayStr = new Date().toLocaleDateString('en-CA');
        const todaysAppts = appointments
            .filter(a => a.date === todayStr && a.status === 'SCHEDULED')
            .sort((a, b) => a.time.localeCompare(b.time));

        // Determine next patient
        const now = new Date();
        const nextAppt = todaysAppts.find(a => {
            const [h, m] = a.time.split(':').map(Number);
            const apptTime = new Date();
            apptTime.setHours(h, m, 0);
            return apptTime > now || (apptTime.getTime() + 30 * 60000) > now.getTime();
        });

        return (
            <div className="space-y-8">
                {/* Header Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[
                        { icon: '📅', label: "Today's Appts", value: todaysAppts.length, color: 'rose' },
                        { icon: '👥', label: "Total Patients", value: analytics?.totalPatients || 0, color: 'blue' },
                        { icon: '⏳', label: "Pending", value: appointments.filter(a => a.status === 'PENDING').length, color: 'orange' },
                        { icon: '⭐', label: "Rating", value: analytics?.averageRating || 4.5, color: 'emerald' }
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

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* LEFT: Live Queue / Next Patient */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex justify-between items-center">
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
                                        </div>
                                        <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl text-center border border-white/20 shadow-lg">
                                            <p className="text-xs font-bold uppercase opacity-80">Token</p>
                                            <p className="text-4xl font-black">#{nextAppt.tokenNumber || 1}</p>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-4">
                                        {nextAppt.consultationType === 'VIDEO' && (
                                            <Button onClick={() => setActiveVideoCall(nextAppt)} className="bg-white text-indigo-700 hover:bg-indigo-50 border-none shadow-xl px-8 py-3 text-sm rounded-xl">
                                                Start Video Call
                                            </Button>
                                        )}
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
                                            <Button
                                                variant="outline"
                                                className="text-emerald-100 border-emerald-200/60 hover:bg-emerald-500/20 rounded-xl"
                                                onClick={() => BackendAPI.updateAppointmentStatus({ appointmentId: nextAppt.id, status: 'COMPLETED' })}
                                            >
                                                Mark as Completed
                                            </Button>
                                        )}
                                        <Button variant="outline" className="text-white border-white/30 hover:bg-white/10 rounded-xl" onClick={() => {
                                            const p = patients.find(pat => pat.id === nextAppt.patientId);
                                            if (p) { setSelectedPatient(p); setViewMode('patients'); }
                                        }}>
                                            View Patient File
                                        </Button>
                                        <Button variant="outline" className="text-white border-white/30 hover:bg-white/10 rounded-xl" onClick={() => setActiveChatAppt(nextAppt)}>
                                            Message
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
                                {todaysAppts.map(appt => (
                                    <div key={appt.id} className="p-4 flex items-center hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-50 dark:border-slate-800 last:border-0">
                                        <div className="w-20 text-sm font-bold text-slate-500 dark:text-slate-400 font-mono">{appt.time}</div>
                                        <div className="flex-1">
                                            <p className="font-bold text-slate-800 dark:text-white">{appt.patientName}</p>
                                            <p className="text-xs text-slate-500 flex items-center gap-2">
                                                <span>{appt.type}</span>
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
                                                    {appt.consultationType === 'VIDEO' && (
                                                        <button onClick={() => setActiveVideoCall(appt)} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors" title="Start Video">
                                                            📹
                                                        </button>
                                                    )}
                                                    <button onClick={() => setActiveChatAppt(appt)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors" title="Chat">
                                                        💬
                                                    </button>
                                                    {appt.status !== 'IN_PROGRESS' && (
                                                        <button
                                                            onClick={() => BackendAPI.updateAppointmentStatus({ appointmentId: appt.id, status: 'IN_PROGRESS' })}
                                                            className="px-2 py-1 text-[10px] font-bold rounded bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-100"
                                                        >
                                                            Start
                                                        </button>
                                                    )}
                                                    {appt.status === 'IN_PROGRESS' && (
                                                        <button
                                                            onClick={() => BackendAPI.updateAppointmentStatus({ appointmentId: appt.id, status: 'COMPLETED' })}
                                                            className="px-2 py-1 text-[10px] font-bold rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100"
                                                        >
                                                            Complete
                                                        </button>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Patient Rating</p>
                            <h3 className="text-3xl font-black text-slate-800 dark:text-white">{analytics.averageRating} <span className="text-lg text-slate-400">/ 5.0</span></h3>
                            <div className="flex mt-2">
                                {[1, 2, 3, 4, 5].map(s => (
                                    <span key={s} className={`text-sm ${s <= Math.round(analytics.averageRating) ? 'text-yellow-400' : 'text-slate-200'}`}>★</span>
                                ))}
                            </div>
                        </div>
                        <div className="absolute -bottom-4 -right-4 text-slate-50 dark:text-slate-800/50">
                            <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
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
                                                <div className="flex gap-2">
                                                    {a.consultationType === 'VIDEO' && (
                                                        <button onClick={() => setActiveVideoCall(a)} className="text-indigo-600 hover:text-indigo-800 font-bold text-xs">Video</button>
                                                    )}
                                                    <button onClick={() => setActiveChatAppt(a)} className="text-blue-600 hover:text-blue-800 font-bold text-xs">Chat</button>
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
                        <Button
                            onClick={() => {
                                const patientAppts = appointments.filter(a => a.patientId === selectedPatient.id);
                                if (patientAppts.length === 0) {
                                    alert('No scheduled appointments with this patient yet. Start a visit to enable chat.');
                                    return;
                                }
                                const latestAppt = patientAppts[patientAppts.length - 1];
                                setActiveChatAppt(latestAppt);
                            }}
                        >
                            Message Patient
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
                                    </div>
                                ) : <p className="text-slate-400 italic">No vitals history recorded.</p>}
                            </Card>

                            <Card title="Active Medications">
                                {patientMeds.length === 0 && <p className="text-slate-400 italic">No active medications.</p>}
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
                        <Card title="Vitals History" className="mt-6">
                            <div className="h-80 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={patientHistory}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="timestamp" hide />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Line type="monotone" dataKey="systolicBP" stroke="#ef4444" name="Sys BP" strokeWidth={2} dot={{ r: 4 }} />
                                        <Line type="monotone" dataKey="glucose" stroke="#10b981" name="Glucose" strokeWidth={2} dot={{ r: 4 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    )}

                    {patientTab === 'MEDS' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                            <Card title="Prescriptions">
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
                                            <select className="w-full p-2.5 border rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white" value={newMedTime} onChange={e => setNewMedTime(e.target.value)}>
                                                <option>Morning</option>
                                                <option>Afternoon</option>
                                                <option>Night</option>
                                                <option>Twice Daily</option>
                                            </select>
                                        </div>
                                    </div>
                                    <Button onClick={handleAddMedication} disabled={!newMedName || !newMedDosage} className="w-full">Prescribe</Button>
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

            {/* Overlays */}
            {passportToView && (
                <div className="fixed inset-0 z-[120] bg-white dark:bg-slate-900 overflow-y-auto">
                    <HealthPassport data={passportToView} onClose={() => setPassportToView(null)} isDoctorView={true} />
                </div>
            )}
            {activeVideoCall && (
                <VideoCall appointmentId={activeVideoCall.id} otherUserName={activeVideoCall.patientName} onClose={() => setActiveVideoCall(null)} />
            )}
            {activeChatAppt && (
                <ChatSystem currentUserId={user.id} currentUserRole={UserRole.DOCTOR} appointmentId={activeChatAppt.id} otherUserName={activeChatAppt.patientName} onClose={() => setActiveChatAppt(null)} />
            )}
        </div>
    );
};
