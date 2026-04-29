import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, PatientProfile, HealthMetrics, RiskAlert, UserRole, Appointment, Medication } from '../types';
import { MockBackend } from './mockBackend';

interface HealthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  vitals: HealthMetrics[];
  alerts: RiskAlert[];
  appointments: Appointment[];
  medications: Medication[];
  isLoading: boolean;
  refreshData: () => void;
  addAlert: (alert: RiskAlert) => void;
  clearAlerts: () => void;
}

const HealthContext = createContext<HealthContextType | undefined>(undefined);

export const HealthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [vitals, setVitals] = useState<HealthMetrics[]>([]);
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAllData = async (userId: string, role: UserRole) => {
    try {
      if (role === UserRole.PATIENT) {
        const [v, a, appt, med] = await Promise.all([
          MockBackend.getPatientHistory(userId),
          (MockBackend as any).getPatientAlerts(userId),
          MockBackend.getAppointments(userId, UserRole.PATIENT),
          MockBackend.getMedications(userId)
        ]);
        setVitals(v);
        setAlerts(a);
        setAppointments(appt);
        setMedications(med);
      } else if (role === UserRole.DOCTOR) {
        const [a, appt, pats] = await Promise.all([
          MockBackend.getAlerts(userId),
          MockBackend.getAppointments(userId, UserRole.DOCTOR),
          MockBackend.getAssignedPatients(userId)
        ]);
        setAlerts(a);
        setAppointments(appt);
        // Patients list could be added to context if needed
      }
    } catch (error) {
      console.error("Failed to fetch health data:", error);
    }
  };

  // Sync data periodically and on backend changes
  useEffect(() => {
    if (user) {
      fetchAllData(user.id, user.role);
      
      // Subscribe to real-time updates from MockBackend
      const unsubscribe = MockBackend.subscribe(() => {
        fetchAllData(user.id, user.role);
      });

      const interval = setInterval(() => fetchAllData(user.id, user.role), 10000); // Poll less frequently if subscribed
      return () => {
        unsubscribe();
        clearInterval(interval);
      };
    }
  }, [user]);

  const refreshData = () => {
    if (user) {
      fetchAllData(user.id, user.role);
    }
  };

  const addAlert = (alert: RiskAlert) => {
    setAlerts(prev => [alert, ...prev]);
  };

  const clearAlerts = () => {
    setAlerts([]);
  };

  useEffect(() => {
    setIsLoading(false);
  }, []);

  return (
    <HealthContext.Provider value={{
      user,
      setUser,
      vitals,
      alerts,
      appointments,
      medications,
      isLoading,
      refreshData,
      addAlert,
      clearAlerts
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
