
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { User, UserRole, PatientProfile, DoctorProfile } from './types';
import { Layout } from './components/Layout';
import { MockBackend } from './services/mockBackend';
import { BackendAPI, setToken, getToken } from './services/apiClient';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { AnimatePresence, motion } from 'framer-motion';

const SplashScreen = lazy(() => import('./components/SplashScreen').then((m) => ({ default: m.SplashScreen })));
const LandingPage = lazy(() => import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })));
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })));
const SymptomScreening = lazy(() => import('./components/SymptomScreening').then((m) => ({ default: m.SymptomScreening })));
const PatientDashboard = lazy(() => import('./pages/PatientDashboard').then((m) => ({ default: m.PatientDashboard })));
const DoctorDashboard = lazy(() => import('./pages/DoctorDashboard').then((m) => ({ default: m.DoctorDashboard })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));

type AppView = 'SPLASH' | 'LANDING' | 'AUTH' | 'APP' | 'SCREENING';

function App() {
  const [view, setView] = useState<AppView>('SPLASH');
  const [user, setUser] = useState<User | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  // Bootstrap dark mode — default to dark if no preference stored
  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    if (!storedTheme) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else if (storedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

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
      setBootstrapped(true);
      return;
    }

    (async () => {
      try {
        const backendUser = await BackendAPI.getCurrentUser();
        setUser(backendUser as User);
        try {
          BackendAPI.getSocket();
        } catch (socketErr) {
          // A realtime connection failure should not force logout.
          console.warn('Socket initialization failed during bootstrap', socketErr);
        }
      } catch {
        // Token invalid/expired; clear it and show login
        setToken(null);
        setUser(null);
      } finally {
        setBootstrapped(true);
      }
    })();
  }, []);

  // If splash is done and session rehydration completed after the splash,
  // automatically enter the app.
  useEffect(() => {
    if (!bootstrapped) return;
    if (!user) return;
    if (view === 'SPLASH' || view === 'SCREENING') return;
    setView('APP');
  }, [bootstrapped, user, view]);

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
        return (
          <AppErrorBoundary
            fallbackTitle="Doctor dashboard failed to load"
            fallbackMessage="A runtime error occurred in the doctor dashboard. You can reload and continue working."
          >
            <DoctorDashboard user={user as DoctorProfile} />
          </AppErrorBoundary>
        );
      case UserRole.ADMIN:
        return <AdminDashboard />;
      default:
        return <div>Unknown Role</div>;
    }
  };

  const pageFallback = (
    <div className="flex min-h-[60vh] items-center justify-center px-4 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
      Loading experience...
    </div>
  );

  if (view === 'SPLASH') {
    return (
      <Suspense fallback={pageFallback}>
        <SplashScreen
          onComplete={() => {
            // If session rehydration already succeeded, go straight to the app.
            // Otherwise, show the landing page first.
            if (user) {
              setView('APP');
            } else {
              setView('LANDING');
            }
          }}
        />
      </Suspense>
    );
  }

  if (view === 'SCREENING' && user && user.role === UserRole.PATIENT) {
    return (
      <Suspense fallback={pageFallback}>
        <SymptomScreening patient={user as PatientProfile} onComplete={handleScreeningComplete} onSkip={() => setView('APP')} />
      </Suspense>
    );
  }

  return (
    <Layout user={user} onLogout={handleLogout}>
      <AnimatePresence mode="wait">
        <motion.div
          key={view + (user ? user.role : 'guest')}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="w-full h-full"
        >
          <Suspense fallback={pageFallback}>
            {!user ? (
              view === 'AUTH' ? (
                <div className="relative">
                  <button
                    onClick={() => setView('LANDING')}
                    className="fixed top-5 left-5 z-[60] rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 backdrop-blur px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 shadow-sm hover:shadow-md hover:border-rose-200 dark:hover:border-rose-900/40 transition"
                    aria-label="Back to landing"
                  >
                    ← Back
                  </button>
                  <Login onLogin={handleLogin} />
                </div>
              ) : (
                <LandingPage onSignIn={() => setView('AUTH')} />
              )
            ) : (
              renderDashboard()
            )}
          </Suspense>
        </motion.div>
      </AnimatePresence>
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
