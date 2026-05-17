import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { User, PatientProfile, HealthMetrics, RiskAlert, UserRole, Appointment, Medication, AlertStatus, AiInsight } from '../types';
import { MockBackend } from './mockBackend';
import { BackendAPI, getToken } from './apiClient';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';

interface HealthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  vitals: HealthMetrics[];
  alerts: RiskAlert[];
  appointments: Appointment[];
  medications: Medication[];
  adherence: any[];
  latestAiInsight: AiInsight | null;
  isLoading: boolean;
  refreshData: () => void;
  refreshAiInsights: () => void;
  refreshAdherence: () => void;
  addAlert: (alert: RiskAlert) => void;
  sendAlert: (alert: Partial<RiskAlert>) => void;
  clearAlerts: () => void;
  updateAlertStatus: (alertId: string, status: AlertStatus) => void;
  logout: () => void;
  activeReminder: any | null;
  dismissReminder: () => void;
  setAppointments: React.Dispatch<React.SetStateAction<Appointment[]>>;
  setAlerts: React.Dispatch<React.SetStateAction<RiskAlert[]>>;
  setMedications: React.Dispatch<React.SetStateAction<Medication[]>>;
  doctorStats: {
    activePatients: number;
    criticalAlerts: number;
    appointmentsToday: number;
    pendingConsults: number;
  };
  patientRoster: any[];
  upcomingSessions: any[];
  refreshDoctorData: () => void;
  medicalRecords: any[];
  refreshMedicalRecords: () => void;
  socket: Socket | null;
}

const HealthContext = createContext<HealthContextType | undefined>(undefined);

export const HealthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [vitals, setVitals] = useState<HealthMetrics[]>([]);
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [adherence, setAdherence] = useState<any[]>([]);
  const [latestAiInsight, setLatestAiInsight] = useState<AiInsight | null>(null);
  const [activeReminder, setActiveReminder] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [doctorStats, setDoctorStats] = useState({
    activePatients: 0,
    criticalAlerts: 0,
    appointmentsToday: 0,
    pendingConsults: 0
  });
  const [patientRoster, setPatientRoster] = useState<any[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);
  const [medicalRecords, setMedicalRecords] = useState<any[]>([]);

  const fetchAllData = async (userId: string, role: UserRole) => {
    try {
      // Requirement 11: No dummy data. Use BackendAPI instead of MockBackend.
      if (role === UserRole.PATIENT) {
        const [v, a, appt, med, insight, adh] = await Promise.all([
          BackendAPI.getMyMetrics().catch(() => []),
          (BackendAPI as any).getAlerts?.() || [], 
          BackendAPI.getPatientAppointments(),
          BackendAPI.getMedicationOrders({ active: 'true' }),
          BackendAPI.getLatestAiInsights().catch(() => null),
          BackendAPI.getMedicationAdherence().catch(() => [])
        ]);
        setVitals(v);
        // If backend doesn't support getAlerts yet, we'll rely on real-time alerts only
        if (Array.isArray(a)) setAlerts(a);
        console.log(`[CareXAI] Syncing ${appt.length} appointments for patient ${userId}`);
        setAppointments(appt);
        setMedications(med);
        setLatestAiInsight(insight);
        setAdherence(adh);
      } else if (role === UserRole.DOCTOR) {
        await fetchDoctorDashboard();
      }
      
      if (role === UserRole.PATIENT) {
        await fetchMedicalRecords();
      }
    } catch (error) {
      console.error("Failed to fetch health data:", error);
    }
  };

  const socketRef = useRef<Socket | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (user) {
      // Initialize audio for alerts
      audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      
      const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:4000';
      const socket = io(API_BASE, {
        auth: { token: getToken() || 'mock-token' },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('[CareXAI] Real-time neural link established');
        fetchAllData(user.id, user.role);
      });

      socket.on('alert:received', (newAlert: RiskAlert) => {
        console.log('[CareXAI] New alert broadcast received:', newAlert);
        setAlerts(prev => {
          // Prevent duplicates
          if (prev.find(a => a.id === newAlert.id)) return prev;
          return [newAlert, ...prev];
        });

        // Play high-impact sound for critical alerts
        if (newAlert.severity === 'CRITICAL' || newAlert.severity === 'HIGH') {
          audioRef.current?.play().catch(() => {});
          // Use browser notification if possible
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(`CRITICAL ALERT: ${newAlert.type}`, {
              body: newAlert.message,
              icon: '/favicon.svg'
            });
          }
        }
      });

      socket.on('alert:updated', (updatedAlert: RiskAlert) => {
        console.log('[CareXAI] Alert updated remotely:', updatedAlert);
        setAlerts(prev => prev.map(a => a.id === updatedAlert.id ? updatedAlert : a));
      });
      
      socket.on('ai_insight_update', (newInsight: AiInsight) => {
        console.log('[CareXAI] Real-time AI Insight update received:', newInsight);
        setLatestAiInsight(newInsight);
      });

      socket.on('medication_update', () => {
        console.log('[CareXAI] Medication adherence updated. Refreshing...');
        refreshAdherence();
      });

      // Requirement 2: Reminder System alerts
      socket.on('appointment:reminder', (reminder: any) => {
        console.log('[CareXAI] Appointment reminder received:', reminder);
        setActiveReminder(reminder);
        
        // Requirement 2: Trigger sound (beep alert)
        audioRef.current?.play().catch(() => {});

        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(reminder.title, {
            body: reminder.message,
            icon: '/favicon.svg'
          });
        }
      });

      socket.on('appointment:created', (appt: Appointment) => {
        console.log('[CareXAI] New appointment created:', appt);
        setAppointments(prev => {
          if (prev.find(a => a.id === appt.id)) return prev;
          return [appt, ...prev];
        });
        
        const isDoctor = user?.role === UserRole.DOCTOR;
        const msg = isDoctor 
          ? `New session booked: ${appt.patientName} at ${appt.time}`
          : `Confirmed: Appointment with Dr. ${appt.doctorName} at ${appt.time}`;
        
        toast.success(msg, { icon: '📅' });
        audioRef.current?.play().catch(() => {});
      });

      socket.on('appointment:confirmed', (data: { appointment: Appointment }) => {
        const appt = data.appointment;
        console.log('[CareXAI] Session confirmed via socket:', appt);
        setAppointments(prev => {
          if (prev.find(a => a.id === appt.id)) return prev;
          return [appt, ...prev];
        });
        toast.success(`Session confirmed with Dr. ${appt.doctorName}`, { icon: '✨' });
      });

      socket.on('appointment_booked', (newAppt: Appointment) => {
        console.log('[CareXAI] Real-time appointment_booked received:', newAppt);
        setAppointments(prev => {
          if (prev.find(a => a.id === newAppt.id)) return prev;
          return [newAppt, ...prev];
        });
        toast.success(`Session confirmed with Dr. ${newAppt.doctorName}`, { icon: '✨' });
      });

      socket.on('appointment_cancelled', (appointmentId: string) => {
        console.log('[CareXAI] Real-time appointment_cancelled received:', appointmentId);
        setAppointments(prev => prev.filter(a => a.id !== appointmentId));
        toast.info("Appointment removed from schedule", { icon: '🗑️' });
      });

      socket.on('appointment:updated', (appt: Appointment) => {
        console.log('[CareXAI] Appointment updated:', appt);
        setAppointments(prev => prev.map(a => a.id === appt.id ? appt : a));
        if (user?.role === UserRole.DOCTOR) fetchDoctorDashboard();
      });

      // Doctor-specific real-time updates
      socket.on('doctor:dashboard_update', () => {
        console.log('[CareXAI] Doctor dashboard update triggered via socket');
        fetchDoctorDashboard();
      });

      socket.on('active_patients_updated', (data: { count: number }) => {
        setDoctorStats(prev => ({ ...prev, activePatients: data.count }));
      });

      socket.on('critical_alert_generated', (newAlert: any) => {
        setDoctorStats(prev => ({ ...prev, criticalAlerts: prev.criticalAlerts + 1 }));
        setAlerts(prev => {
          if (prev.find(a => a.id === newAlert.id)) return prev;
          return [newAlert, ...prev];
        });
        audioRef.current?.play().catch(() => {});
      });

      socket.on('consultation_started', (data: { appointmentId: string }) => {
        console.log('[CareXAI] Consultation started:', data);
        if (user?.role === UserRole.DOCTOR) fetchDoctorDashboard();
        if (user?.role === UserRole.PATIENT) {
          toast.info("Your consultation is starting now. Click to join uplink.", {
            icon: '📞',
            duration: 10000,
            action: {
              label: 'Join Uplink',
              onClick: () => {
                // This will be handled by the UI listening to state or direct navigation
                window.dispatchEvent(new CustomEvent('carexai:join_consultation', { detail: data }));
              }
            }
          });
        }
      });

      socket.on('consultation_ended', () => {
        if (user?.role === UserRole.DOCTOR) fetchDoctorDashboard();
      });

      socket.on('prescription_received', (prescription: any) => {
        console.log('[CareXAI] New prescription received:', prescription);
        toast.success(`New prescription from your clinical team`, { 
          icon: '💊',
          description: "AI Safety Audit verified."
        });
        if (user?.role === UserRole.PATIENT) {
          fetchAllData(user.id, user.role);
        }
      });

      socket.on('vitals_updated', (data: { userId: string, vitals: any }) => {
        if (user?.role === UserRole.DOCTOR) {
          // Doctors refresh their feed or the specific patient list
          // handled in DoctorDashboard directly for now, but we could sync it here too
        }
        if (user?.role === UserRole.PATIENT && user.id === data.userId) {
          setVitals(prev => [...prev, data.vitals].slice(-50));
        }
      });

      socket.on('records:access_requested', (data: { permissionId: string, doctorName: string, doctorId: string }) => {
        console.log('[CareXAI] Record access requested by:', data.doctorName);
        toast(`Dr. ${data.doctorName} is requesting access to your medical records.`, {
          action: {
            label: 'Grant Access',
            onClick: () => BackendAPI.grantRecordAccess({ doctorId: data.doctorId, status: 'GRANTED', durationDays: 1 })
          }
        });
      });

      socket.on('records:access_granted', (data: { patientId: string, patientName: string }) => {
        console.log('[CareXAI] Record access granted for patient:', data.patientName);
        toast.success(`Access granted for ${data.patientName}'s medical records.`, { icon: '🔓' });
        refreshDoctorData();
      });

      socket.on('disconnect', () => {
        console.warn('[CareXAI] Real-time connection lost. Attempting sync...');
      });

      socketRef.current = socket;

      return () => {
        socket.disconnect();
      };
    }
  }, [user]);

  const sendAlert = (alertData: Partial<RiskAlert>) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('alert:new', {
        ...alertData,
        patientId: user?.id,
        timestamp: new Date().toISOString()
      });
    } else {
      console.error('[CareXAI] Socket not connected. Alert queued locally.');
      // Fallback to local state
      const localAlert = {
        id: `local-${Date.now()}`,
        patientId: user?.id || '',
        timestamp: new Date().toISOString(),
        status: AlertStatus.NEW,
        ...alertData
      } as RiskAlert;
      setAlerts(prev => [localAlert, ...prev]);
    }
  };

  const refreshData = () => {
    if (user) {
      fetchAllData(user.id, user.role);
    }
  };

  const refreshAiInsights = async () => {
    if (user && user.role === UserRole.PATIENT) {
      try {
        const insight = await BackendAPI.getLatestAiInsights();
        setLatestAiInsight(insight);
      } catch (err) {
        console.error("Failed to refresh AI insights:", err);
      }
    }
  };

  const refreshAdherence = async () => {
    if (user && user.role === UserRole.PATIENT) {
      try {
        const adh = await BackendAPI.getMedicationAdherence();
        setAdherence(adh);
      } catch (err) {
        console.error("Failed to refresh adherence:", err);
      }
    }
  };

  const addAlert = (alert: RiskAlert) => {
    setAlerts(prev => [alert, ...prev]);
  };

  const fetchDoctorDashboard = async () => {
    try {
      const [active, critical, today, pending, roster, upcoming] = await Promise.all([
        BackendAPI.getDoctorActivePatients(),
        BackendAPI.getDoctorCriticalAlerts(),
        BackendAPI.getDoctorAppointmentsToday(),
        BackendAPI.getDoctorPendingConsults(),
        BackendAPI.getDoctorPatientRoster(),
        BackendAPI.getDoctorUpcomingSessions()
      ]);

      setDoctorStats({
        activePatients: active.count,
        criticalAlerts: critical.count,
        appointmentsToday: today.count,
        pendingConsults: pending.count
      });
      setPatientRoster(roster);
      setUpcomingSessions(upcoming);
      setAlerts(critical.alerts || []);
      setAppointments(today.appointments || []); // Use today's appointments for general listing
    } catch (err) {
      console.error("Failed to fetch doctor dashboard data:", err);
    }
  };

  const refreshDoctorData = () => {
    if (user && user.role === UserRole.DOCTOR) {
      fetchDoctorDashboard();
    }
  };

  const fetchMedicalRecords = async () => {
    try {
      const records = await BackendAPI.getMedicalRecords();
      setMedicalRecords(records);
    } catch (err) {
      console.error("Failed to fetch medical records:", err);
    }
  };

  const refreshMedicalRecords = () => {
    if (user && user.role === UserRole.PATIENT) {
      fetchMedicalRecords();
    }
  };

  const logout = () => {
    // Clear auth and disconnect socket via API client
    import('@/services/apiClient').then(({ setToken }) => {
      setToken(null);
    });

    // Reset local state
    setUser(null);
    setVitals([]);
    setAlerts([]);
    setAppointments([]);
    setMedications([]);
    
    // Clear any other session-specific data
    localStorage.removeItem('carexai_last_prediction');
    sessionStorage.clear();
    
    console.log('[CareXAI] Session terminated and socket disconnected.');
  };

  const updateAlertStatus = (alertId: string, status: AlertStatus) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('alert:update', { alertId, status });
    } else {
      // Fallback local update
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status } : a));
    }
  };

  const clearAlerts = () => {
    setAlerts([]);
  };

  const dismissReminder = () => {
    setActiveReminder(null);
  };

  useEffect(() => {
    if (user) {
      fetchAllData(user.id, user.role);
    }
    setIsLoading(false);
  }, [user]);

  return (
    <HealthContext.Provider value={{
      user,
      setUser,
      vitals,
      alerts,
      appointments,
      medications,
      adherence,
      latestAiInsight,
      isLoading,
      refreshData,
      refreshAiInsights,
      refreshAdherence,
      addAlert,
      sendAlert,
      updateAlertStatus,
      clearAlerts,
      logout,
      activeReminder,
      dismissReminder,
      setMedications,
      setAppointments,
      setAlerts,
      doctorStats,
      patientRoster,
      upcomingSessions,
      refreshDoctorData,
      medicalRecords,
      refreshMedicalRecords,
      socket: socketRef.current
    }}>
      {children}
    </HealthContext.Provider>
  );
};

export const useHealth = () => {
  const context = useContext(HealthContext);
  if (context === undefined) {
    throw new Error('useHealth must be used within a HealthProvider');
  }
  return context;
};
