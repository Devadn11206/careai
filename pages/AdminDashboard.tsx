
import React, { useState, useEffect } from 'react';
import { DoctorProfile, DoctorStatus, PatientProfile, UserRole, Appointment, AuditLog, SystemConfig, AdminStats, AdminDocument, RiskAlert, AlertSeverity } from '../types';
import { MockBackend } from '../services/mockBackend';
import { BackendAPI, BackendDoctor } from '../services/apiClient';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell } from 'recharts';

type AdminTab = 'OVERVIEW' | 'USERS' | 'VERIFICATION' | 'APPOINTMENTS' | 'RECORDS' | 'SAFETY' | 'BROADCAST' | 'ANALYTICS' | 'SETTINGS' | 'LOGS';

// Demo mode: when running locally we can use mock/demo doctors for richer
// verification flows. In production we must only surface real doctors coming
// from the backend API/database.
const IS_DEMO_MODE = (import.meta as any).env.DEV === true;

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
      if(config) {
          await MockBackend.updateSystemConfig(config);
          alert("System configuration updated.");
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
      if(!broadcastMsg.trim()) return;
      await MockBackend.broadcastNotification(broadcastMsg, broadcastTarget as any);
      setBroadcastMsg('');
      alert("Notification broadcasted successfully.");
  };

  // --- SUB-COMPONENTS ---

  const renderOverview = () => (
      <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="bg-gradient-to-br from-rose-500 to-pink-600 text-white border-none shadow-lg">
                  <div className="text-rose-100 text-xs font-bold uppercase tracking-wider mb-1">Total Users</div>
                  <div className="text-4xl font-bold">{stats?.totalUsers}</div>
              </Card>
              <Card className="bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700">
                  <div className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Pending Doctors</div>
                  <div className="text-4xl font-bold text-orange-500">{stats?.pendingVerifications}</div>
              </Card>
              <Card className="bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700">
                  <div className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Active Alerts</div>
                  <div className="text-4xl font-bold text-red-600">{alerts.length}</div>
              </Card>
              <Card className="bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700">
                  <div className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">System Health</div>
                  <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="text-2xl font-bold text-slate-800 dark:text-white">{stats?.systemHealth}</span>
                  </div>
              </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card title="User Growth (Last 7 Days)">
                  <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={[
                              {name: 'Mon', uv: 4}, {name: 'Tue', uv: 7}, {name: 'Wed', uv: 5},
                              {name: 'Thu', uv: 10}, {name: 'Fri', uv: 12}, {name: 'Sat', uv: 15}, {name: 'Sun', uv: stats?.totalUsers || 20}
                          ]}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.2} />
                              <XAxis dataKey="name" stroke="#94a3b8" />
                              <YAxis stroke="#94a3b8" />
                              <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none', color: '#fff'}} />
                              <Line type="monotone" dataKey="uv" stroke="#e11d48" strokeWidth={3} />
                          </LineChart>
                      </ResponsiveContainer>
                  </div>
              </Card>
              <Card title="Patient Risk Distribution">
                  <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                              <Pie
                                  data={[
                                      { name: 'Stable', value: users.filter(u => (u as PatientProfile).riskStatus === 'STABLE').length },
                                      { name: 'Watch', value: users.filter(u => (u as PatientProfile).riskStatus === 'WATCH').length },
                                      { name: 'Critical', value: users.filter(u => (u as PatientProfile).riskStatus === 'CRITICAL').length },
                                  ]}
                                  cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value"
                              >
                                  {[{color: '#10b981'}, {color: '#f59e0b'}, {color: '#ef4444'}].map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                              </Pie>
                              <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none', color: '#fff'}} />
                              <Legend />
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
              <h3 className="text-lg font-bold text-slate-700 dark:text-white">System Analytics & Reporting</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card title="User Growth (Detailed)">
                      <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={[
                                  {name: 'Mon', uv: 4}, {name: 'Tue', uv: 7}, {name: 'Wed', uv: 5},
                                  {name: 'Thu', uv: 10}, {name: 'Fri', uv: 12}, {name: 'Sat', uv: 15}, {name: 'Sun', uv: stats?.totalUsers || 20}
                              ]}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.2} />
                                  <XAxis dataKey="name" stroke="#94a3b8" />
                                  <YAxis stroke="#94a3b8" />
                                  <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none', color: '#fff'}} />
                                  <Line type="monotone" dataKey="uv" stroke="#e11d48" strokeWidth={3} />
                              </LineChart>
                          </ResponsiveContainer>
                      </div>
                  </Card>
                  <Card title="Patient Risk Segmentation">
                      <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                  <Pie
                                      data={[
                                          { name: 'Stable', value: users.filter(u => (u as PatientProfile).riskStatus === 'STABLE').length },
                                          { name: 'Watch', value: users.filter(u => (u as PatientProfile).riskStatus === 'WATCH').length },
                                          { name: 'Critical', value: users.filter(u => (u as PatientProfile).riskStatus === 'CRITICAL').length },
                                      ]}
                                      cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value"
                                  >
                                      {[{color: '#10b981'}, {color: '#f59e0b'}, {color: '#ef4444'}].map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={entry.color} />
                                      ))}
                                  </Pie>
                                  <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none', color: '#fff'}} />
                                  <Legend />
                              </PieChart>
                          </ResponsiveContainer>
                      </div>
                  </Card>
                  <Card title="Appointments by Doctor" className="lg:col-span-2">
                      <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                              {barData.length > 0 ? (
                                  <BarChart data={barData}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.2} />
                                      <XAxis dataKey="name" stroke="#94a3b8" />
                                      <YAxis allowDecimals={false} stroke="#94a3b8" />
                                      <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none', color: '#fff'}} />
                                      <Bar dataKey="count" fill="#8884d8" barSize={40} radius={[4, 4, 0, 0]} />
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
      <Card title="User Management" className="overflow-hidden">
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase text-xs font-bold border-b border-slate-100 dark:border-slate-700">
                      <tr>
                          <th className="px-6 py-4">Name</th>
                          <th className="px-6 py-4">Role</th>
                          <th className="px-6 py-4">Email</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                      {users.map(u => (
                          <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{u.name}</td>
                              <td className="px-6 py-4"><span className="bg-slate-100 dark:bg-slate-700 dark:text-slate-300 px-2 py-1 rounded text-xs font-bold">{u.role}</span></td>
                              <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{u.email}</td>
                              <td className="px-6 py-4">
                                  {(u.role === UserRole.DOCTOR && (u as DoctorProfile).status && (u as DoctorProfile).status !== DoctorStatus.VERIFIED) ? (
                                      <span className="text-amber-700 font-bold text-xs bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded">
                                          {(u as DoctorProfile).status}
                                      </span>
                                  ) : u.isBlocked ? (
                                      <span className="text-red-500 font-bold text-xs bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded">BLOCKED</span>
                                  ) : <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded">ACTIVE</span>}
                              </td>
                              <td className="px-6 py-4 text-right">
                                  {u.role !== UserRole.ADMIN && (
                                      <Button size="sm" variant={u.isBlocked ? "primary" : "danger"} onClick={() => handleBlockUser(u.id, u.isBlocked || false)}>
                                          {u.isBlocked ? "Unblock" : "Block"}
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
                  <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">Verification Requests</h3>
                  <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold">{pendingDoctors.length} Pending</span>
              </div>
              {pendingDoctors.length === 0 && <div className="p-8 text-center text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">No pending verification requests.</div>}
              {pendingDoctors.map(doc => (
                  <Card key={doc.id} className="border-l-4 border-l-yellow-400">
                      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                          <div>
                              <h4 className="font-bold text-slate-800 dark:text-white text-lg">{doc.name}</h4>
                              <p className="text-sm text-slate-600 dark:text-slate-300">{doc.qualification} • {doc.specialization}</p>
                              <div className="flex gap-2 mt-2 text-xs">
                                  <span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-500 dark:text-slate-300">Reg: {doc.registrationNumber}</span>
                                  <span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-500 dark:text-slate-300">{doc.medicalCouncil}</span>
                              </div>
                          </div>
                          <Button onClick={() => setSelectedDoctor(doc)}>Review Application</Button>
                      </div>
                  </Card>
              ))}
          </div>
      );
  };

  const renderAppointments = () => (
      <Card title="All Appointments" className="overflow-hidden">
          <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
              <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase text-xs font-bold border-b border-slate-100 dark:border-slate-700 sticky top-0 z-10">
                      <tr>
                          <th className="px-6 py-4">Date</th>
                          <th className="px-6 py-4">Doctor</th>
                          <th className="px-6 py-4">Patient</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                      {appointments.map(appt => (
                          <tr key={appt.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="px-6 py-4">
                                  <div className="font-bold text-slate-700 dark:text-slate-300">{new Date(appt.date).toLocaleDateString()}</div>
                                  <div className="text-xs text-slate-400">{appt.time}</div>
                              </td>
                              <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{appt.doctorName}</td>
                              <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{appt.patientName}</td>
                              <td className="px-6 py-4">
                                  <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${
                                      appt.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                                      appt.status === 'COMPLETED' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                                      'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                                  }`}>{appt.status}</span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                  <button onClick={() => handleDeleteAppointment(appt.id)} className="text-red-500 hover:text-red-700 text-xs font-bold">Delete</button>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </Card>
  );

  const renderRecords = () => (
      <Card title="Medical Records Oversight" className="overflow-hidden">
          <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
              <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase text-xs font-bold border-b border-slate-100 dark:border-slate-700 sticky top-0 z-10">
                      <tr>
                          <th className="px-6 py-4">Document</th>
                          <th className="px-6 py-4">Patient</th>
                          <th className="px-6 py-4">Category</th>
                          <th className="px-6 py-4">Size</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                      {documents.length === 0 ? (
                          <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">No records found.</td></tr>
                      ) : (
                          documents.map(doc => (
                              <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                  <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                      <span className="p-1 bg-slate-100 dark:bg-slate-700 rounded text-slate-500">{doc.type.includes('pdf') ? '📄' : '🖼️'}</span>
                                      {doc.name}
                                  </td>
                                  <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{doc.patientName}</td>
                                  <td className="px-6 py-4"><span className="bg-slate-100 dark:bg-slate-700 dark:text-slate-300 text-xs px-2 py-1 rounded">{doc.category || 'General'}</span></td>
                                  <td className="px-6 py-4 text-slate-500 font-mono text-xs">{doc.size}</td>
                                  <td className="px-6 py-4 text-right flex justify-end gap-2">
                                      <a href={doc.url} download={doc.name} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-xs font-bold">View</a>
                                      <button onClick={() => handleDeleteDocument(doc.patientId, doc.id)} className="text-red-500 hover:text-red-700 text-xs font-bold">Delete</button>
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
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Emergency Monitoring</h3>
              <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-bold animate-pulse">{alerts.length} Active Risks</span>
          </div>
          <div className="grid grid-cols-1 gap-4">
              {alerts.length === 0 && <div className="text-center p-12 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400">System Normal. No critical alerts.</div>}
              {alerts.map(alert => (
                  <div key={alert.id} className={`bg-white dark:bg-slate-800 p-4 rounded-xl border-l-4 shadow-sm flex justify-between items-center ${alert.severity === AlertSeverity.CRITICAL ? 'border-l-red-500' : 'border-l-orange-500'}`}>
                      <div>
                          <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-slate-800 dark:text-white">{alert.patientName}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded font-bold text-white uppercase ${alert.severity === AlertSeverity.CRITICAL ? 'bg-red-500' : 'bg-orange-500'}`}>{alert.severity}</span>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-300">{alert.message}</p>
                          <p className="text-xs text-slate-400 mt-1">{new Date(alert.timestamp).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                          <div className="text-2xl font-bold text-slate-800 dark:text-white">{alert.riskScore}<span className="text-sm text-slate-400 font-normal">/100</span></div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold">Risk Score</div>
                      </div>
                  </div>
              ))}
          </div>
      </div>
  );

  const renderBroadcast = () => (
      <Card title="System Broadcast" className="max-w-xl mx-auto">
          <div className="space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">Send a global notification to users. Use for maintenance alerts or health advisories.</p>
              <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Target Audience</label>
                  <select className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200" value={broadcastTarget} onChange={e => setBroadcastTarget(e.target.value)}>
                      <option value="ALL">All Users</option>
                      <option value="PATIENTS">Patients Only</option>
                      <option value="DOCTORS">Doctors Only</option>
                  </select>
              </div>
              <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Message</label>
                  <textarea 
                      className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-lg h-32 resize-none focus:ring-2 focus:ring-rose-500 outline-none bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                      placeholder="Enter announcement..."
                      value={broadcastMsg}
                      onChange={e => setBroadcastMsg(e.target.value)}
                  ></textarea>
              </div>
              <Button className="w-full" onClick={handleBroadcast} disabled={!broadcastMsg.trim()}>Send Broadcast</Button>
          </div>
      </Card>
  );

  const renderSettings = () => (
      <div className="max-w-2xl mx-auto space-y-6">
          <Card title="Clinical Thresholds">
              <div className="space-y-4">
                  <div>
                      <Input label="High BP Threshold (Systolic)" type="number" value={config?.bpThreshold || 140} onChange={e => setConfig(prev => prev ? {...prev, bpThreshold: +e.target.value} : null)} />
                  </div>
                  <div>
                      <Input label="High Glucose Threshold (mg/dL)" type="number" value={config?.glucoseThreshold || 180} onChange={e => setConfig(prev => prev ? {...prev, glucoseThreshold: +e.target.value} : null)} />
                  </div>
              </div>
          </Card>
          <Card title="System Controls">
              <div className="space-y-4">
                  <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-700 dark:text-slate-300">Maintenance Mode</span>
                      <div 
                          onClick={() => setConfig(prev => prev ? {...prev, maintenanceMode: !prev.maintenanceMode} : null)}
                          className={`w-12 h-6 rounded-full cursor-pointer relative transition-colors ${config?.maintenanceMode ? 'bg-red-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                      >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${config?.maintenanceMode ? 'left-7' : 'left-1'}`} />
                      </div>
                  </div>
                  <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-700 dark:text-slate-300">Allow New Registrations</span>
                      <div 
                          onClick={() => setConfig(prev => prev ? {...prev, allowNewRegistrations: !prev.allowNewRegistrations} : null)}
                          className={`w-12 h-6 rounded-full cursor-pointer relative transition-colors ${config?.allowNewRegistrations ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                      >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${config?.allowNewRegistrations ? 'left-7' : 'left-1'}`} />
                      </div>
                  </div>
              </div>
          </Card>
          <div className="flex justify-end">
              <Button onClick={handleConfigUpdate}>Save Configuration</Button>
          </div>
      </div>
  );

  const renderLogs = () => (
      <Card title="System Audit Logs" className="overflow-hidden">
          <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
              {logs.length === 0 && <div className="text-center text-slate-400 py-8">No logs recorded yet.</div>}
              {logs.map(log => (
                  <div key={log.id} className="flex gap-4 p-3 border-b border-slate-50 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors rounded-lg">
                      <div className="w-2 h-2 mt-2 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                      <div className="flex-1">
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{log.action}</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">{log.details} • Target: <span className="font-mono">{log.targetName}</span></p>
                      </div>
                      <div className="text-xs text-slate-400 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                      </div>
                  </div>
              ))}
          </div>
      </Card>
  );

  // --- MAIN LAYOUT ---

  return (
    <div className="flex flex-col h-full overflow-hidden p-6">
        <div className="mb-6 flex-shrink-0">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{activeTab.charAt(0) + activeTab.slice(1).toLowerCase().replace('_', ' ')}</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">System Administration Console</p>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
            <AnimatePresence mode='wait'>
                <motion.div 
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
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

        {/* Verification Modal (Reused Logic) */}
        {selectedDoctor && (
           <div className="fixed inset-0 bg-slate-900/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedDoctor(null)}>
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                 <div className="bg-slate-800 p-6 flex justify-between items-center text-white shrink-0">
                    <h3 className="text-xl font-bold">Verify Doctor: {selectedDoctor.name}</h3>
                    <button onClick={() => setSelectedDoctor(null)} className="text-slate-400 hover:text-white">✕</button>
                 </div>
                 <div className="flex-1 p-6 flex flex-col md:flex-row gap-6 overflow-y-auto">
                    <div className="flex-1 space-y-4">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold">Reg Number</p>
                            <p className="text-lg font-mono font-bold text-slate-800 dark:text-slate-200">{selectedDoctor.registrationNumber}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 uppercase font-bold">Council</p>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{selectedDoctor.medicalCouncil}</p>
                        </div>
                        <textarea className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-white" placeholder="Admin remarks..." value={remarks} onChange={e => setRemarks(e.target.value)} />
                        <div className="flex gap-3">
                            <Button variant="danger" className="flex-1" onClick={() => handleStatusChange(selectedDoctor.id, DoctorStatus.REJECTED)}>Reject</Button>
                            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleStatusChange(selectedDoctor.id, DoctorStatus.VERIFIED)}>Verify & Approve</Button>
                        </div>
                    </div>
                    <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 min-h-[300px]">
                        {selectedDoctor.verificationDocumentUrl ? (
                            <iframe src={selectedDoctor.verificationDocumentUrl} className="w-full h-full" title="Doc" />
                        ) : <span className="text-slate-400">No Document Uploaded</span>}
                    </div>
                 </div>
              </div>
           </div>
        )}
    </div>
  );
};
