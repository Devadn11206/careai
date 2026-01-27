
import React, { useState, useEffect } from 'react';
import { User, UserRole, PatientProfile, DoctorProfile } from './types';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { PatientDashboard } from './pages/PatientDashboard';
import { DoctorDashboard } from './pages/DoctorDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { MockBackend } from './services/mockBackend';
import { BackendAPI, setToken, getToken } from './services/apiClient';
import { SplashScreen } from './components/SplashScreen';
import { SymptomScreening } from './components/SymptomScreening';

type AppView = 'SPLASH' | 'APP' | 'SCREENING';

function App() {
  const [view, setView] = useState<AppView>('SPLASH');
  const [user, setUser] = useState<User | null>(null);

  // Initialize Background Simulation Engine
  useEffect(() => {
    const intervalId = setInterval(() => {
      MockBackend.simulatePatientVitals();
    }, 5000);
    return () => clearInterval(intervalId);
  }, []);

  // Rehydrate user session from stored JWT on initial load
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setView('APP');
      return;
    }

    (async () => {
      try {
        const backendUser = await BackendAPI.getCurrentUser();
        setUser(backendUser as User);
        BackendAPI.getSocket();
        setView('APP');
      } catch {
        // Token invalid/expired; clear it and show login
        setToken(null);
        setView('APP');
      }
    })();
  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    // Ensure realtime connection is established after login
    BackendAPI.getSocket();

    // Logic to trigger screening
    // In a real app, check if loggedInUser.symptomRiskProfile is undefined.
    // For demo, we force it for patients if they haven't done it this session (simplified).
    if (loggedInUser.role === UserRole.PATIENT) {
      const p = loggedInUser as PatientProfile;
      if (!p.symptomRiskProfile) {
        setView('SCREENING');
        return;
      }
    }
    setView('APP');
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    setView('APP');
  };

  const handleScreeningComplete = (updatedPatient: PatientProfile) => {
    setUser(updatedPatient);
    setView('APP');
  };

  const renderDashboard = () => {
    switch (user?.role) {
      case UserRole.PATIENT:
        return <PatientDashboard user={user as PatientProfile} />;
      case UserRole.DOCTOR:
        return <DoctorDashboard user={user as DoctorProfile} />;
      case UserRole.ADMIN:
        return <AdminDashboard />;
      default:
        return <div>Unknown Role</div>;
    }
  };

  if (view === 'SPLASH') {
    return <SplashScreen onComplete={() => setView('APP')} />;
  }

  if (view === 'SCREENING' && user && user.role === UserRole.PATIENT) {
    return <SymptomScreening patient={user as PatientProfile} onComplete={handleScreeningComplete} onSkip={() => setView('APP')} />;
  }

  return (
    <Layout user={user} onLogout={handleLogout}>
      {!user ? (
        <Login onLogin={handleLogin} />
      ) : (
        renderDashboard()
      )}
      <footer className="mt-12 py-6 border-t border-slate-200 dark:border-slate-800 text-center">
        <p className="text-xs text-slate-400 dark:text-slate-500">
          © 2026 CareXAI. <br />
          <span className="font-semibold text-rose-500 dark:text-rose-400">DISCLAIMER:</span> CareXAI provides decision support only and does not replace professional medical diagnosis.
        </p>
      </footer>
    </Layout>
  );
}

export default App;
