import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { User, UserRole, PatientProfile, DoctorProfile } from './types';
import { HealthProvider, useHealth } from './services/HealthContext';
import { MainLayout } from './components/common/MainLayout';
import { MockBackend } from './services/mockBackend';
import { BackendAPI, setToken, getToken } from './services/apiClient';
import { AppErrorBoundary } from './components/common/AppErrorBoundary';
import { AnimatePresence, motion } from 'framer-motion';

// Lazy loaded pages
const SplashScreen = lazy(() => import('./components/common/SplashScreen'));
import LandingPage from './pages/new/Landing';
// const LandingPage = lazy(() => import('./pages/new/Landing'));
import Auth from './pages/new/Auth';
const Login = Auth;
const SymptomScreening = lazy(() => import('./components/features/SymptomScreening').then((m) => ({ default: m.SymptomScreening })));
const PatientDashboard = lazy(() => import('./pages/new/PatientDashboard'));
const DoctorDashboard = lazy(() => import('./pages/new/DoctorDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));

// New pages
const VitalsPage = lazy(() => import('./pages/new/Vitals'));
const InsightsPage = lazy(() => import('./pages/new/Insights'));
const AlertsPage = lazy(() => import('./pages/new/Alerts'));
const ChatPage = lazy(() => import('./pages/new/ChatPage'));
const ConsultPage = lazy(() => import('./pages/new/ConsultPage'));
const PassportPage = lazy(() => import('./pages/new/PassportPage'));

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useHealth();
  const location = useLocation();

  if (isLoading) return <div className="flex h-screen items-center justify-center font-mono text-primary">Initializing Neural Link...</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  return <>{children}</>;
};

function AppContent() {
  const { user, setUser, isLoading } = useHealth();
  const [showSplash, setShowSplash] = useState(false);
  const location = useLocation();

  const navigate = useNavigate();

  useEffect(() => {
    // Rehydrate session
    const token = getToken();
    if (token) {
      BackendAPI.getCurrentUser()
        .then(u => {
          setUser(u as User);
          BackendAPI.getSocket();
        })
        .catch(() => {
          setToken(null);
          setUser(null);
        });
    }
  }, [setUser]);

  useEffect(() => {
    // Background simulation
    const intervalId = setInterval(() => {
      MockBackend.simulatePatientVitals();
    }, 5000);
    return () => clearInterval(intervalId);
  }, []);

  const pageFallback = (
    <div className="flex h-[60vh] items-center justify-center font-mono text-primary animate-pulse">
      Loading Module...
    </div>
  );

  if (showSplash) {
    return (
      <Suspense fallback={null}>
        <SplashScreen onComplete={() => setShowSplash(false)} />
      </Suspense>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={pageFallback}>
        <Routes location={location} key={location.pathname}>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />

          {/* Protected App Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              {user?.role === UserRole.PATIENT ? (
                <PatientDashboard />
              ) : user?.role === UserRole.DOCTOR ? (
                <DoctorDashboard />
              ) : (
                <AdminDashboard />
              )}
            </ProtectedRoute>
          } />

          <Route path="/vitals" element={<ProtectedRoute><VitalsPage /></ProtectedRoute>} />
          <Route path="/insights" element={<ProtectedRoute><InsightsPage /></ProtectedRoute>} />
          <Route path="/alerts" element={<ProtectedRoute><AlertsPage /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
          <Route path="/consult" element={<ProtectedRoute><ConsultPage /></ProtectedRoute>} />
          <Route path="/passport" element={<ProtectedRoute><PassportPage /></ProtectedRoute>} />

          {/* Redirects */}
          <Route path="*" element={<Navigate to={user ? "/dashboard" : "/"} replace />} />
        </Routes>
      </Suspense>
    </AnimatePresence>
  );
}

function App() {
  return (
    <BrowserRouter>
      <HealthProvider>
        <AppErrorBoundary>
          <AppContent />
        </AppErrorBoundary>
      </HealthProvider>
    </BrowserRouter>
  );
}

export default App;
