
import React, { useState, useEffect } from 'react';
import { DoctorProfile, DoctorStatus, PatientProfile, UserRole, Appointment, AuditLog, SystemConfig, AdminStats, AdminDocument, RiskAlert, AlertSeverity } from '../types';
import { MockBackend } from '../services/mockBackend';
import { BackendAPI, BackendDoctor } from '../services/apiClient';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell } from 'recharts';
import { AutomationAssistant } from '../components/features/AutomationAssistant';
import { ClientAction } from '../types';


type AdminTab = 'OVERVIEW' | 'USERS' | 'VERIFICATION' | 'APPOINTMENTS' | 'RECORDS' | 'SAFETY' | 'BROADCAST' | 'ANALYTICS' | 'SETTINGS' | 'LOGS';

// Demo mode: when running locally we can use mock/demo doctors for richer
// verification flows. In production we must only surface real doctors coming
// from the backend API/database.
const IS_DEMO_MODE = false; // Demo mode disabled: only real registered accounts and backend data are permitted.

export const AdminDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<AdminTab>('OVERVIEW');
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [users, setUsers] = useState<(DoctorProfile | PatientProfile)[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [config, setConfig] = useState<SystemConfig | null>(null);

    // New State for expanded features
    const [documents, setDocuments] = useState<AdminDocument[]>([]);
    const [alerts, setAlerts] = useState<RiskAlert[]>([]);
    const [broadcastMsg, setBroadcastMsg] = useState('');
    const [broadcastTarget, setBroadcastTarget] = useState('ALL');

    // Verification State
    const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
    const [selectedDoctor, setSelectedDoctor] = useState<DoctorProfile | null>(null);
    const [remarks, setRemarks] = useState('');
    const [isAssistantOpen, setIsAssistantOpen] = useState(false);

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

    const refreshData = async () => {
        const [s, u, a, l, c, mockDoctors, docs, al, backendDoctors] = await Promise.all([
            MockBackend.getAdminStats(),
            MockBackend.getAllUsers(),
            BackendAPI.getAppointments(),
            MockBackend.getAuditLogs(),
            MockBackend.getSystemConfig(),
            MockBackend.getDoctors(),
            MockBackend.getAllAdminDocuments(),
            MockBackend.getGlobalAlerts(),
            BackendAPI.getDoctors()
        ]);
        setStats(s);
        setUsers(u);
        setAppointments(a);
        setLogs(l);
        setConfig(c);
        // Normalize backend doctors into DoctorProfile shape for admin views,
        // using real backend metadata when available.
        const liveDoctors: DoctorProfile[] = backendDoctors.map((d: BackendDoctor) => ({
            id: d.id,
            name: d.name,
            email: d.email,
            role: UserRole.DOCTOR,
            specialization: d.specialization || '',
            experienceYears: d.experienceYears ?? 0,
            qualification: d.qualification || '',
            registrationNumber: d.registrationNumber || '',
            medicalCouncil: d.medicalCouncil,
            verificationDocumentUrl: d.verificationDocumentUrl,
            status: d.status || DoctorStatus.PENDING,
            rating: d.rating,
            bio: '',
        }));

        // Keep backend doctors authoritative for verification status.
        // In demo mode, append mock-only doctors that don't exist in backend.
        const mergedDoctors = IS_DEMO_MODE
            ? [
                ...liveDoctors,
                ...mockDoctors.filter((md) => !liveDoctors.some((ld) => ld.email === md.email)),
            ]
            : liveDoctors;

        setDoctors(mergedDoctors);
        setDocuments(docs);
        setAlerts(al);
    };

    useEffect(() => {
        refreshData();
        const unsubscribeMock = MockBackend.subscribe(refreshData);
        const unsubscribeSocket = BackendAPI.onAppointmentCreated((appt) => {
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
        const unsubscribeApptUpdated = BackendAPI.onAppointmentUpdated((appt) => {
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

        const unsubscribeDoctor = BackendAPI.onDoctorUpdated((doctor) => {
            const profile: DoctorProfile = {
                id: doctor.id,
                name: doctor.name,
                email: doctor.email,
                role: UserRole.DOCTOR,
                specialization: doctor.specialization || '',
                experienceYears: doctor.experienceYears ?? 0,
                qualification: doctor.qualification || '',
                registrationNumber: doctor.registrationNumber || '',
                medicalCouncil: doctor.medicalCouncil,
                verificationDocumentUrl: doctor.verificationDocumentUrl,
                status: doctor.status || DoctorStatus.PENDING,
                rating: doctor.rating,
                bio: '',
            };

            setDoctors((prev) => {
                const idx = prev.findIndex(d => d.id === profile.id);
                if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = profile;
                    return next;
                }
                return [...prev, profile];
            });
        });

        // Hash navigation listener
        const handleHashChange = () => {
            const hash = window.location.hash.replace('#', '').toUpperCase();
            const validTabs: AdminTab[] = ['OVERVIEW', 'USERS', 'VERIFICATION', 'APPOINTMENTS', 'RECORDS', 'SAFETY', 'BROADCAST', 'ANALYTICS', 'SETTINGS', 'LOGS'];

            if (hash && validTabs.includes(hash as AdminTab)) {
                setActiveTab(hash as AdminTab);
            } else {
                setActiveTab('OVERVIEW');
            }
        };

        // Initialize from current hash
        handleHashChange();
        window.addEventListener('hashchange', handleHashChange);

        return () => {
            unsubscribeMock();
            unsubscribeSocket();
            unsubscribeApptUpdated();
            unsubscribeDoctor();
            window.removeEventListener('hashchange', handleHashChange);
        };
    }, []);

    const handleBlockUser = async (id: string, currentStatus: boolean) => {
        if (window.confirm(`Are you sure you want to ${currentStatus ? 'unblock' : 'block'} this user?`)) {
            await MockBackend.toggleUserBlock(id, !currentStatus);
        }
    };

    const handleDeleteAppointment = async (id: string) => {
        if (window.confirm("Delete this appointment record?")) {
            await MockBackend.deleteAppointment(id);
        }
    };

    const handleDeleteDocument = async (patientId: string, docId: string) => {
        if (window.confirm("Permanently delete this medical record?")) {
            await MockBackend.deleteDocument(patientId, docId);
        }
    };

    const handleConfigUpdate = async () => {
        if (config) {
            await MockBackend.updateSystemConfig(config);
            alert("System configuration updated.");
        }
    };

    const handleAdminAssistantAction = (action: ClientAction) => {
        const navigateAdminTab = (tab: AdminTab) => {
            setActiveTab(tab);
            window.location.hash = tab.toLowerCase();
        };

        switch (action.type) {
            case 'NAVIGATE':
                if (action.target) {
                    const rawTarget = action.target.toUpperCase();
                    const compactTarget = rawTarget.replace(/[^A-Z]/g, '');
                    let target = rawTarget;

                    if (compactTarget.includes('USER')) target = 'USERS';
                    else if (compactTarget.includes('VERIFY') || compactTarget.includes('VERIFICATION') || compactTarget.includes('IDENTITY')) target = 'VERIFICATION';
                    else if (compactTarget.includes('APPOINTMENT') || compactTarget.includes('SCHEDULE')) target = 'APPOINTMENTS';
                    else if (compactTarget.includes('RECORD') || compactTarget.includes('VAULT')) target = 'RECORDS';
                    else if (compactTarget.includes('SAFETY') || compactTarget.includes('ALERT')) target = 'SAFETY';
                    else if (compactTarget.includes('BROADCAST') || compactTarget.includes('ANNOUNCE')) target = 'BROADCAST';
                    else if (compactTarget.includes('ANALYTIC') || compactTarget.includes('INTEL')) target = 'ANALYTICS';
                    else if (compactTarget.includes('SETTING') || compactTarget.includes('CONFIG') || compactTarget.includes('KERNEL')) target = 'SETTINGS';
                    else if (compactTarget.includes('LOG') || compactTarget.includes('SECURITY')) target = 'LOGS';
                    else if (compactTarget.includes('OVERVIEW') || compactTarget.includes('DASHBOARD') || compactTarget.includes('HOME') || compactTarget.includes('COMMANDCENTER')) target = 'OVERVIEW';

                    const validTabs: AdminTab[] = ['OVERVIEW', 'USERS', 'VERIFICATION', 'APPOINTMENTS', 'RECORDS', 'SAFETY', 'BROADCAST', 'ANALYTICS', 'SETTINGS', 'LOGS'];
                    if (validTabs.includes(target as AdminTab)) {
                        navigateAdminTab(target as AdminTab);
                    }
                }
                break;
            case 'OPEN_USERS': navigateAdminTab('USERS'); break;
            case 'OPEN_VERIFICATION': navigateAdminTab('VERIFICATION'); break;
            case 'OPEN_APPOINTMENTS': navigateAdminTab('APPOINTMENTS'); break;
            case 'OPEN_RECORDS': navigateAdminTab('RECORDS'); break;
            case 'OPEN_SAFETY': navigateAdminTab('SAFETY'); break;
            case 'OPEN_BROADCAST': navigateAdminTab('BROADCAST'); break;
            case 'OPEN_ANALYTICS': navigateAdminTab('ANALYTICS'); break;
            case 'OPEN_SETTINGS': navigateAdminTab('SETTINGS'); break;
            case 'OPEN_LOGS': navigateAdminTab('LOGS'); break;
            case 'REFRESH_DATA': refreshData(); break;
            case 'SCROLL_TO':
                if (action.target) {
                    const el = document.getElementById(action.target.replace('#', ''));
                    el?.scrollIntoView({ behavior: 'smooth' });
                }
                break;
            case 'BLOCK_USER':
                if (action.payload?.userId) {
                    handleBlockUser(action.payload.userId, false);
                }
                break;
            case 'VERIFY_DOCTOR':
                if (action.payload?.doctorId) {
                    handleStatusChange(action.payload.doctorId, DoctorStatus.VERIFIED);
                }
                break;
            default:
                window.dispatchEvent(new CustomEvent('carexai-action', { detail: action }));
                break;
        }
    };


    const handleStatusChange = async (id: string, status: DoctorStatus) => {
        // Always update backend as source of truth for access control.
        await BackendAPI.updateDoctorStatus({ doctorId: id, status });

        // In demo mode we also mirror into local mock data where possible.
        if (IS_DEMO_MODE) {
            try {
                await MockBackend.updateDoctorStatus(id, status, remarks);
            } catch {
                // Ignore mock sync failures for backend-only doctor IDs.
            }
        }
        if (selectedDoctor?.id === id) {
            setSelectedDoctor(null);
            setRemarks('');
        }
    };

    const handleBroadcast = async () => {
        if (!broadcastMsg.trim()) return;
        await MockBackend.broadcastNotification(broadcastMsg, broadcastTarget as any);
        setBroadcastMsg('');
        alert("Notification broadcasted successfully.");
    };

    // --- SUB-COMPONENTS ---

    const renderOverview = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="bg-space-900 border border-white/10 p-8 rounded-[32px] glass-card relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-neon-500/10 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700"></div>
                    <div className="relative z-10">
                        <div className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Total Users</div>
                        <div className="text-5xl font-bold text-white font-['Space_Grotesk'] tracking-tighter">{stats?.totalUsers}</div>
                    </div>
                </Card>
                <Card className="bg-space-900 border border-white/10 p-8 rounded-[32px] glass-card relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700"></div>
                    <div className="relative z-10">
                        <div className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Pending Doctors</div>
                        <div className="text-5xl font-bold text-amber-400 font-['Space_Grotesk'] tracking-tighter drop-shadow-[0_0_10px_rgba(251,191,36,0.3)]">{stats?.pendingVerifications}</div>
                    </div>
                </Card>
                <Card className="bg-space-900 border border-pulse-500/20 p-8 rounded-[32px] glass-card relative overflow-hidden group animate-neon-pulse shadow-[0_0_20px_rgba(255,0,110,0.1)]">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-pulse-500/10 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700"></div>
                    <div className="relative z-10">
                        <div className="text-pulse-400/70 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Active Alerts</div>
                        <div className="text-5xl font-bold text-pulse-400 font-['Space_Grotesk'] tracking-tighter drop-shadow-[0_0_15px_rgba(255,0,110,0.5)]">{alerts.length}</div>
                    </div>
                </Card>
                <Card className="bg-space-900 border border-white/10 p-8 rounded-[32px] glass-card relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-bio-500/10 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700"></div>
                    <div className="relative z-10">
                        <div className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4">System Health</div>
                        <div className="flex items-center gap-3">
                            <span className="w-4 h-4 rounded-full bg-bio-400 animate-pulse shadow-[0_0_15px_rgba(0,255,179,0.8)]"></span>
                            <span className="text-3xl font-bold text-white font-['Space_Grotesk'] tracking-widest uppercase">{stats?.systemHealth}</span>
                        </div>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title="User Growth (Last 7 Days)" className="border-white/5 glass-card-dark">
                    <div className="h-64 w-full pt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={[
                                { name: 'Mon', uv: 4 }, { name: 'Tue', uv: 7 }, { name: 'Wed', uv: 5 },
                                { name: 'Thu', uv: 10 }, { name: 'Fri', uv: 12 }, { name: 'Sat', uv: 15 }, { name: 'Sun', uv: stats?.totalUsers || 20 }
                            ]}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff" strokeOpacity={0.05} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                                <Tooltip contentStyle={{ backgroundColor: '#0a0b14', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} itemStyle={{ color: '#00d4ff', fontSize: '12px', fontWeight: 'bold' }} cursor={{ stroke: '#00d4ff', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                <Line type="monotone" dataKey="uv" stroke="#00d4ff" strokeWidth={4} activeDot={{ r: 6, fill: '#00d4ff', strokeWidth: 0 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
                <Card title="Patient Risk Distribution" className="border-white/5 glass-card-dark">
                    <div className="h-64 w-full pt-4 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: 'Stable', value: users.filter(u => (u as PatientProfile).riskStatus === 'STABLE').length },
                                        { name: 'Watch', value: users.filter(u => (u as PatientProfile).riskStatus === 'WATCH').length },
                                        { name: 'Critical', value: users.filter(u => (u as PatientProfile).riskStatus === 'CRITICAL').length },
                                    ]}
                                    cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={8} dataKey="value" stroke="none"
                                >
                                    {[{ color: '#00ff9f' }, { color: '#f59e0b' }, { color: '#ff006e' }].map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#0a0b14', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 'bold' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>
        </div>
    );

    const renderAnalytics = () => {
        // Calculate dynamic data for Appointments by Doctor
        const appointmentsByDoctor = appointments.reduce((acc, appt) => {
            acc[appt.doctorName] = (acc[appt.doctorName] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const barData = Object.entries(appointmentsByDoctor).map(([name, count]) => ({ name, count }));

        return (
            <div className="space-y-6">
                <h3 className="text-xl font-bold text-white font-['Space_Grotesk'] tracking-tight">Intelligence & Reporting</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card title="User Growth (Detailed)" className="border-white/5 glass-card-dark">
                        <div className="h-64 w-full pt-4">
                            <ResponsiveContainer width="100%" height={240} minWidth={0} debounce={50}>
                                <LineChart data={[
                                    { name: 'Mon', uv: 4 }, { name: 'Tue', uv: 7 }, { name: 'Wed', uv: 5 },
                                    { name: 'Thu', uv: 10 }, { name: 'Fri', uv: 12 }, { name: 'Sat', uv: 15 }, { name: 'Sun', uv: stats?.totalUsers || 20 }
                                ]}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff" strokeOpacity={0.05} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                                    <Tooltip contentStyle={{ backgroundColor: '#0a0b14', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} itemStyle={{ color: '#00d4ff', fontSize: '12px', fontWeight: 'bold' }} cursor={{ stroke: '#00d4ff', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                    <Line type="monotone" dataKey="uv" stroke="#00d4ff" strokeWidth={4} activeDot={{ r: 6, fill: '#00d4ff', strokeWidth: 0 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                    <Card title="Patient Risk Segmentation" className="border-white/5 glass-card-dark">
                        <div className="h-64 w-full pt-4 flex items-center justify-center">
                            <ResponsiveContainer width="100%" height={240} minWidth={0} debounce={50}>
                                <PieChart>
                                    <Pie
                                        data={[
                                            { name: 'Stable', value: users.filter(u => (u as PatientProfile).riskStatus === 'STABLE').length },
                                            { name: 'Watch', value: users.filter(u => (u as PatientProfile).riskStatus === 'WATCH').length },
                                            { name: 'Critical', value: users.filter(u => (u as PatientProfile).riskStatus === 'CRITICAL').length },
                                        ]}
                                        cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={8} dataKey="value" stroke="none"
                                    >
                                        {[{ color: '#00ff9f' }, { color: '#f59e0b' }, { color: '#ff006e' }].map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: '#0a0b14', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 'bold' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                    <Card title="Appointments by Doctor" className="lg:col-span-2 border-white/5 glass-card-dark">
                        <div className="h-64 w-full pt-4">
                            <ResponsiveContainer width="100%" height={240} minWidth={0} debounce={50}>
                                {barData.length > 0 ? (
                                    <BarChart data={barData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff" strokeOpacity={0.05} />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                                        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                                        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} contentStyle={{ backgroundColor: '#0a0b14', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                                        <Bar dataKey="count" fill="url(#barNeon)" barSize={40} radius={[8, 8, 0, 0]}>
                                            <defs>
                                                <linearGradient id="barNeon" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#00d4ff" stopOpacity={1} />
                                                    <stop offset="100%" stopColor="#00d4ff" stopOpacity={0.2} />
                                                </linearGradient>
                                            </defs>
                                        </Bar>
                                    </BarChart>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-slate-400">No appointment data available</div>
                                )}
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>
            </div>
        );
    };

    const renderUsers = () => (
        <Card title="User Registry" className="overflow-hidden border-white/5 glass-card-dark">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-white/5 text-slate-500 uppercase text-[10px] font-black tracking-[0.2em] border-b border-white/5">
                        <tr>
                            <th className="px-6 py-5">Identity</th>
                            <th className="px-6 py-5">Role</th>
                            <th className="px-6 py-5">Comm Link</th>
                            <th className="px-6 py-5">Status</th>
                            <th className="px-6 py-5 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {users.map(u => (
                            <tr key={u.id} className="hover:bg-white/5 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-space-950 border border-white/10 flex items-center justify-center font-black text-neon-400 text-xs shrink-0">{u.name.charAt(0)}</div>
                                        <span className="font-bold text-white text-sm tracking-tight font-['Space_Grotesk']">{u.name}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4"><span className="bg-white/5 border border-white/10 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-slate-400">{u.role}</span></td>
                                <td className="px-6 py-4 text-slate-500 text-xs font-bold tracking-wide">{u.email}</td>
                                <td className="px-6 py-4">
                                    {(u.role === UserRole.DOCTOR && (u as DoctorProfile).status && (u as DoctorProfile).status !== DoctorStatus.VERIFIED) ? (
                                        <span className="text-amber-400 font-black text-[10px] bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full uppercase tracking-wider">{(u as DoctorProfile).status}</span>
                                    ) : u.isBlocked ? (
                                        <span className="text-pulse-400 font-black text-[10px] bg-pulse-500/10 border border-pulse-500/30 px-3 py-1 rounded-full uppercase tracking-wider">Blocked</span>
                                    ) : <span className="text-bio-400 font-black text-[10px] bg-bio-500/10 border border-bio-500/30 px-3 py-1 rounded-full uppercase tracking-wider">Active</span>}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {u.role !== UserRole.ADMIN && (
                                        <Button size="sm" variant={u.isBlocked ? "neon" : "outline"} className={u.isBlocked ? "rounded-xl text-[10px] font-black uppercase tracking-widest" : "rounded-xl text-[10px] font-black uppercase tracking-widest border-pulse-500/30 text-pulse-400 hover:bg-pulse-500/10"} onClick={() => handleBlockUser(u.id, u.isBlocked || false)}>
                                            {u.isBlocked ? "Restore" : "Block"}
                                        </Button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );

    const renderVerification = () => {
        const pendingDoctors = doctors.filter(d => d.status === DoctorStatus.PENDING);
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white font-['Space_Grotesk'] tracking-tight">Verification Queue</h3>
                    <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest">{pendingDoctors.length} Pending</span>
                </div>
                {pendingDoctors.length === 0 && <div className="p-12 text-center text-slate-600 bg-white/5 rounded-[24px] border border-dashed border-white/10 text-[10px] font-black uppercase tracking-[0.3em]">Queue Clear — No Pending Requests.</div>}
                {pendingDoctors.map(doc => (
                    <div key={doc.id} className="bg-space-900 border border-amber-500/20 rounded-[28px] p-6 glass-card relative overflow-hidden group hover:border-amber-500/40 transition-all">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-700 pointer-events-none" />
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5 relative z-10">
                            <div>
                                <h4 className="font-bold text-white text-xl font-['Space_Grotesk'] tracking-tight">{doc.name}</h4>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">{doc.qualification} · {doc.specialization}</p>
                                <div className="flex flex-wrap gap-2 mt-3">
                                    <span className="bg-white/5 border border-white/10 px-3 py-1 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-wider">Reg: {doc.registrationNumber}</span>
                                    <span className="bg-white/5 border border-white/10 px-3 py-1 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-wider">{doc.medicalCouncil}</span>
                                </div>
                            </div>
                            <Button variant="cyber" className="h-12 px-6 rounded-[16px] text-[10px] font-black uppercase tracking-widest border-amber-500/30 text-amber-400 hover:bg-amber-500/10 shrink-0" onClick={() => setSelectedDoctor(doc)}>Review Identity</Button>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderAppointments = () => (
        <Card title="Session Registry" className="overflow-hidden border-white/5 glass-card-dark">
            <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
                <table className="w-full text-sm text-left">
                    <thead className="bg-white/5 text-slate-500 uppercase text-[10px] font-black tracking-[0.2em] border-b border-white/5 sticky top-0 z-10 backdrop-blur-md">
                        <tr>
                            <th className="px-6 py-5">Vector Date</th>
                            <th className="px-6 py-5">Specialist</th>
                            <th className="px-6 py-5">Subject</th>
                            <th className="px-6 py-5">Status</th>
                            <th className="px-6 py-5 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {appointments.map(appt => (
                            <tr key={appt.id} className="hover:bg-white/5 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="font-bold text-white text-sm">{new Date(appt.date).toLocaleDateString()}</div>
                                    <div className="text-[10px] text-neon-400/60 font-black tracking-widest uppercase mt-0.5">{appt.time}</div>
                                </td>
                                <td className="px-6 py-4 text-slate-400 font-bold text-xs tracking-wide">{appt.doctorName}</td>
                                <td className="px-6 py-4 text-slate-400 font-bold text-xs tracking-wide">{appt.patientName}</td>
                                <td className="px-6 py-4">
                                    <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-wider border ${appt.status === 'SCHEDULED' ? 'bg-neon-500/10 text-neon-400 border-neon-500/30' :
                                            appt.status === 'COMPLETED' ? 'bg-bio-500/10 text-bio-400 border-bio-500/30' :
                                                'bg-white/5 text-slate-500 border-white/10'
                                        }`}>{appt.status}</span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button onClick={() => handleDeleteAppointment(appt.id)} className="text-pulse-500/60 hover:text-pulse-400 text-[10px] font-black uppercase tracking-wider transition-colors">Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );

    const renderRecords = () => (
        <Card title="Encrypted Vault" className="overflow-hidden border-white/5 glass-card-dark">
            <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
                <table className="w-full text-sm text-left">
                    <thead className="bg-white/5 text-slate-500 uppercase text-[10px] font-black tracking-[0.2em] border-b border-white/5 sticky top-0 z-10 backdrop-blur-md">
                        <tr>
                            <th className="px-6 py-5">Record</th>
                            <th className="px-6 py-5">Subject</th>
                            <th className="px-6 py-5">Category</th>
                            <th className="px-6 py-5">Size</th>
                            <th className="px-6 py-5 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {documents.length === 0 ? (
                            <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-600 text-[10px] font-black uppercase tracking-[0.3em]">Vault Empty — No Records Found.</td></tr>
                        ) : (
                            documents.map(doc => (
                                <tr key={doc.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <span className="w-9 h-9 bg-space-950 border border-white/10 rounded-xl flex items-center justify-center text-lg shrink-0">{doc.type.includes('pdf') ? '📄' : '🖼️'}</span>
                                            <span className="font-bold text-white text-sm truncate max-w-[200px] group-hover:text-neon-400 transition-colors">{doc.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-400 font-bold text-xs">{doc.patientName}</td>
                                    <td className="px-6 py-4"><span className="bg-white/5 border border-white/10 text-[10px] font-black px-3 py-1 rounded-full text-slate-400 uppercase tracking-wider">{doc.category || 'General'}</span></td>
                                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">{doc.size}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-3">
                                            {doc.url ? (
                                                <button type="button" onClick={() => openDocument(doc.url)} className="text-neon-400/60 hover:text-neon-400 text-[10px] font-black uppercase tracking-wider transition-colors">View</button>
                                            ) : (
                                                <span className="text-[10px] bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2 py-1 rounded font-black uppercase tracking-wider">Re-upload</span>
                                            )}
                                            <button onClick={() => handleDeleteDocument(doc.patientId, doc.id)} className="text-pulse-500/60 hover:text-pulse-400 text-[10px] font-black uppercase tracking-wider transition-colors">Delete</button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
    );

    const renderSafety = () => (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-white font-['Space_Grotesk'] tracking-tight">Emergency Monitor</h3>
                {alerts.length > 0 && <span className="bg-pulse-500/10 border border-pulse-500/30 text-pulse-400 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">{alerts.length} Active Risks</span>}
            </div>
            <div className="grid grid-cols-1 gap-5">
                {alerts.length === 0 && (
                    <div className="text-center p-14 bg-bio-500/5 border border-bio-500/20 rounded-[28px] text-bio-400 text-[10px] font-black uppercase tracking-[0.3em]">
                        <div className="text-4xl mb-4">🛡️</div>
                        System Nominal — No Critical Alerts.
                    </div>
                )}
                {alerts.map(alert => (
                    <div key={alert.id} className={`p-6 rounded-[28px] glass-card relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${alert.severity === AlertSeverity.CRITICAL
                            ? 'bg-pulse-500/10 border border-pulse-500/30 shadow-[0_0_30px_rgba(255,0,110,0.1)]'
                            : 'bg-amber-500/10 border border-amber-500/30'
                        }`}>
                        <div className="absolute top-0 right-0 w-24 h-24 rounded-full -mr-8 -mt-8 blur-xl pointer-events-none" style={{ background: alert.severity === AlertSeverity.CRITICAL ? 'rgba(255,0,110,0.15)' : 'rgba(245,158,11,0.15)' }} />
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`w-2 h-2 rounded-full animate-pulse ${alert.severity === AlertSeverity.CRITICAL ? 'bg-pulse-500' : 'bg-amber-400'}`} />
                                <span className="font-bold text-white text-lg font-['Space_Grotesk'] tracking-tight">{alert.patientName}</span>
                                <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-wider border ${alert.severity === AlertSeverity.CRITICAL ? 'bg-pulse-500/20 text-pulse-400 border-pulse-500/40' : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                                    }`}>{alert.severity}</span>
                            </div>
                            <p className="text-sm text-slate-400 leading-relaxed">{alert.message}</p>
                            <p className="text-[10px] text-slate-600 mt-2 uppercase font-black tracking-widest">{new Date(alert.timestamp).toLocaleString()}</p>
                        </div>
                        <div className="text-right relative z-10 shrink-0">
                            <div className={`text-4xl font-bold font-['Space_Grotesk'] tracking-tighter ${alert.severity === AlertSeverity.CRITICAL ? 'text-pulse-400 drop-shadow-[0_0_15px_rgba(255,0,110,0.5)]' : 'text-amber-400'
                                }`}>{alert.riskScore}<span className="text-sm text-slate-500 font-normal">/100</span></div>
                            <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">Risk Index</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderBroadcast = () => (
        <div className="max-w-2xl mx-auto">
            <div className="bg-space-900 border border-neon-500/20 rounded-[40px] p-10 glass-card relative overflow-hidden shadow-[0_0_40px_rgba(0,212,255,0.05)]">
                <div className="absolute -top-20 -right-20 w-60 h-60 bg-neon-600/10 rounded-full blur-[80px] pointer-events-none" />
                <div className="relative z-10 space-y-8">
                    <div>
                        <h3 className="text-2xl font-bold text-white font-['Space_Grotesk'] tracking-tight mb-2">Broadcast Transmission</h3>
                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em]">Dispatch system-wide notifications to all nodes.</p>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] block mb-3 ml-1">Target Node Group</label>
                        <select className="w-full h-14 px-5 rounded-[20px] bg-space-950 border border-white/10 text-white font-bold text-sm focus:ring-2 focus:ring-neon-400/30 focus:border-neon-400 transition-all appearance-none cursor-pointer" value={broadcastTarget} onChange={e => setBroadcastTarget(e.target.value)}>
                            <option value="ALL" className="bg-space-900">All Subjects</option>
                            <option value="PATIENTS" className="bg-space-900">Patients Only</option>
                            <option value="DOCTORS" className="bg-space-900">Doctors Only</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] block mb-3 ml-1">Transmission Data</label>
                        <textarea
                            className="w-full min-h-[140px] p-5 border border-white/10 rounded-[20px] bg-space-950 text-white font-bold text-xs tracking-widest placeholder:text-slate-700 focus:ring-2 focus:ring-neon-400/30 focus:border-neon-400 transition-all resize-none outline-none custom-scrollbar"
                            placeholder="Compose announcement payload..."
                            value={broadcastMsg}
                            onChange={e => setBroadcastMsg(e.target.value)}
                        />
                    </div>
                    <Button variant="neon" className="w-full h-14 rounded-[20px] text-[11px] font-black uppercase tracking-[0.3em] shadow-neon-500/20" onClick={handleBroadcast} disabled={!broadcastMsg.trim()}>Transmit Signal</Button>
                </div>
            </div>
        </div>
    );

    const renderSettings = () => (
        <div className="max-w-2xl mx-auto space-y-6">
            <Card title="Biometric Thresholds" className="border-white/5 glass-card-dark">
                <div className="space-y-6 pt-2">
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] block mb-3 ml-1">High BP Threshold (Systolic mmHg)</label>
                        <input type="number" className="w-full h-14 px-5 rounded-[20px] bg-space-950 border border-white/10 text-white font-bold text-sm focus:ring-2 focus:ring-neon-400/30 focus:border-neon-400 transition-all" value={config?.bpThreshold || 140} onChange={e => setConfig(prev => prev ? { ...prev, bpThreshold: +e.target.value } : null)} />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] block mb-3 ml-1">High Glucose Threshold (mg/dL)</label>
                        <input type="number" className="w-full h-14 px-5 rounded-[20px] bg-space-950 border border-white/10 text-white font-bold text-sm focus:ring-2 focus:ring-neon-400/30 focus:border-neon-400 transition-all" value={config?.glucoseThreshold || 180} onChange={e => setConfig(prev => prev ? { ...prev, glucoseThreshold: +e.target.value } : null)} />
                    </div>
                </div>
            </Card>
            <Card title="System Controls" className="border-white/5 glass-card-dark">
                <div className="space-y-5 pt-2">
                    <div className="flex items-center justify-between p-5 bg-white/5 rounded-[20px] border border-white/5 hover:border-white/10 transition-colors">
                        <div>
                            <span className="font-bold text-white text-sm">Maintenance Mode</span>
                            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">Locks all user-facing interfaces</p>
                        </div>
                        <div
                            onClick={() => setConfig(prev => prev ? { ...prev, maintenanceMode: !prev.maintenanceMode } : null)}
                            className={`w-14 h-7 rounded-full cursor-pointer relative transition-all duration-300 ${config?.maintenanceMode ? 'bg-pulse-500 shadow-[0_0_15px_rgba(255,0,110,0.4)]' : 'bg-white/10'}`}
                        >
                            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all duration-300 shadow-lg ${config?.maintenanceMode ? 'left-8' : 'left-1'}`} />
                        </div>
                    </div>
                    <div className="flex items-center justify-between p-5 bg-white/5 rounded-[20px] border border-white/5 hover:border-white/10 transition-colors">
                        <div>
                            <span className="font-bold text-white text-sm">Allow New Registrations</span>
                            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">Open intake for new subjects</p>
                        </div>
                        <div
                            onClick={() => setConfig(prev => prev ? { ...prev, allowNewRegistrations: !prev.allowNewRegistrations } : null)}
                            className={`w-14 h-7 rounded-full cursor-pointer relative transition-all duration-300 ${config?.allowNewRegistrations ? 'bg-bio-500 shadow-[0_0_15px_rgba(0,255,179,0.4)]' : 'bg-white/10'}`}
                        >
                            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all duration-300 shadow-lg ${config?.allowNewRegistrations ? 'left-8' : 'left-1'}`} />
                        </div>
                    </div>
                </div>
            </Card>
            <div className="flex justify-end">
                <Button variant="neon" className="h-14 px-10 rounded-[20px] text-[11px] font-black uppercase tracking-[0.3em]" onClick={handleConfigUpdate}>Synchronize Config</Button>
            </div>
        </div>
    );

    const renderLogs = () => (
        <Card title="System Audit Chain" className="overflow-hidden border-white/5 glass-card-dark">
            <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                {logs.length === 0 && <div className="text-center text-slate-600 py-12 text-[10px] font-black uppercase tracking-[0.3em]">Chain Empty — No Logs Yet.</div>}
                {logs.map((log, idx) => (
                    <div key={log.id} className="flex gap-4 p-4 rounded-[16px] border border-white/5 hover:bg-white/5 hover:border-white/10 transition-all group cursor-default">
                        <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
                            <div className="w-2 h-2 rounded-full bg-neon-400/60 group-hover:bg-neon-400 transition-colors" />
                            {idx < logs.length - 1 && <div className="w-px flex-1 bg-white/5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white tracking-tight font-['Space_Grotesk']">{log.action}</p>
                            <p className="text-[10px] text-slate-500 mt-1 font-bold uppercase tracking-wider">{log.details} <span className="text-slate-700">·</span> Target: <span className="font-mono text-neon-400/60">{log.targetName}</span></p>
                        </div>
                        <div className="text-[10px] text-slate-600 whitespace-nowrap font-bold uppercase tracking-wider shrink-0 pt-1">
                            {new Date(log.timestamp).toLocaleString()}
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );

    return (
        <div className="flex flex-col h-full overflow-hidden p-6 md:p-10 bg-black/20">
            <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative">
                <div className="relative z-10">
                    <motion.h2 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-4xl font-black text-white font-orbitron tracking-tighter"
                    >
                        Nexus <span className="premium-gradient-text">Command</span>
                    </motion.h2>
                    <p className="text-[10px] text-slate-500 uppercase tracking-[0.4em] mt-3 font-black">Central Administration • Core Node 01</p>
                </div>

                <div className="flex flex-wrap gap-4 relative z-10">
                    {activeTab !== 'OVERVIEW' && (
                        <Button 
                            variant="secondary" 
                            size="sm" 
                            className="rounded-xl font-orbitron"
                            onClick={() => { setActiveTab('OVERVIEW'); window.location.hash = 'overview'; }}
                        >
                            Back to Core
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                <AnimatePresence mode='wait'>
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.3 }}
                    >
                        {activeTab === 'OVERVIEW' && renderOverview()}
                        {activeTab === 'USERS' && renderUsers()}
                        {activeTab === 'VERIFICATION' && renderVerification()}
                        {activeTab === 'APPOINTMENTS' && renderAppointments()}
                        {activeTab === 'RECORDS' && renderRecords()}
                        {activeTab === 'SAFETY' && renderSafety()}
                        {activeTab === 'BROADCAST' && renderBroadcast()}
                        {activeTab === 'ANALYTICS' && renderAnalytics()}
                        {activeTab === 'SETTINGS' && renderSettings()}
                        {activeTab === 'LOGS' && renderLogs()}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Verification Modal */}
            {selectedDoctor && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-md" onClick={() => setSelectedDoctor(null)}>
                    <div className="glass-card border-[var(--accent-primary)]/30 max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col relative" onClick={e => e.stopPropagation()}>
                        <div className="p-8 flex justify-between items-center text-white shrink-0 border-b border-white/5 relative z-10">
                            <h3 className="text-2xl font-black font-orbitron tracking-tighter flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full bg-[var(--accent-primary)] animate-pulse shadow-[0_0_8px_var(--accent-primary)]" />
                                Verify Identity: {selectedDoctor.name}
                            </h3>
                            <button onClick={() => setSelectedDoctor(null)} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 text-slate-400 hover:text-white transition-all">✕</button>
                        </div>
                        <div className="flex-1 p-8 flex flex-col lg:flex-row gap-8 overflow-y-auto custom-scrollbar relative z-10">
                            <div className="flex-1 space-y-8">
                                <div className="p-8 bg-white/[0.02] rounded-[32px] border border-white/5 shadow-inner">
                                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-[0.3em] mb-2">Registration Token</p>
                                    <p className="text-3xl font-black tracking-widest premium-gradient-text font-orbitron">{selectedDoctor.registrationNumber}</p>
                                    <p className="text-[10px] text-slate-500 mt-6 uppercase font-black tracking-[0.3em] mb-2">Directing Council</p>
                                    <p className="text-sm font-black tracking-wider text-slate-300 uppercase font-orbitron">{selectedDoctor.medicalCouncil}</p>
                                </div>
                                <div className="space-y-4">
                                    <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] block ml-1">Admin Logs / Remarks</label>
                                    <textarea className="input-cyber w-full h-32 p-5 resize-none outline-none" placeholder="Analysis notes..." value={remarks} onChange={e => setRemarks(e.target.value)} />
                                </div>
                                <div className="flex gap-4">
                                    <Button variant="outline" className="flex-1 h-14 rounded-2xl border-rose-500/30 text-rose-500 hover:bg-rose-500/10" onClick={() => handleStatusChange(selectedDoctor.id, DoctorStatus.REJECTED)}>Reject Node</Button>
                                    <Button variant="neon" className="flex-1 h-14 rounded-2xl" onClick={() => handleStatusChange(selectedDoctor.id, DoctorStatus.VERIFIED)}>Verify & Approve</Button>
                                </div>
                            </div>
                            <div className="flex-[1.5] bg-black/40 rounded-[40px] flex items-center justify-center border border-white/5 min-h-[400px] relative overflow-hidden">
                                {selectedDoctor.verificationDocumentUrl ? (
                                    <iframe src={selectedDoctor.verificationDocumentUrl} className="w-full h-full border-none opacity-90 group-hover:opacity-100 transition-opacity" title="Doc" />
                                ) : (
                                    <div className="text-center">
                                        <span className="text-6xl opacity-20 mb-6 block">📄</span>
                                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em]">No Data Decrypted</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Automation Assistant */}
            <AutomationAssistant 
                isOpen={isAssistantOpen} 
                onClose={() => setIsAssistantOpen(false)} 
                onAction={handleAdminAssistantAction} 
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
