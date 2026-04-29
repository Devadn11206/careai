
import React, { Suspense, useRef, useState } from 'react';
import { User, UserRole } from '../types';
import { MockBackend } from '../services/mockBackend';
import { BackendAPI, setToken } from '../services/apiClient';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { LoginCharacter, CharacterState } from '../components/visuals/LoginCharacter';
import { HoloBackdrop3D } from '../components/visuals/HoloBackdrop3D';

const BeatingHeart3D = React.lazy(() => import('../components/visuals/BeatingHeart3D'));

interface LoginProps {
  onLogin: (user: User) => void;
}

type AuthMode = 'LOGIN' | 'REGISTER';
type RoleType = 'PATIENT' | 'DOCTOR' | 'ADMIN';

const IS_DEMO_MODE = (import.meta as any).env.DEV === true;

const MEDICAL_COUNCILS = [
  "Medical Council of India (MCI)",
  "Maharashtra Medical Council",
  "Delhi Medical Council",
  "Karnataka Medical Council",
  "Tamil Nadu Medical Council",
  "Andhra Pradesh Medical Council",
  "West Bengal Medical Council",
  "Gujarat Medical Council"
];

const ROLE_CONFIG = {
  PATIENT: { icon: '🏥', label: 'Patient', color: '#00D4FF', shadow: 'rgba(0,212,255,0.4)' },
  DOCTOR: { icon: '🩺', label: 'Doctor', color: '#00FFB3', shadow: 'rgba(0,255,179,0.4)' },
  ADMIN: { icon: '🛡️', label: 'Admin', color: '#FF006E', shadow: 'rgba(255,0,110,0.4)' },
};

// Premium mode-aware floating input
const FloatingInput = ({ label, type = "text", value, onChange, icon, rightAdornment, required = false, onFocus, onBlur, ...props }: any) => {
  const [focused, setFocused] = useState(false);
  return (
    <div className="relative mb-5 group">
      {/* Icon */}
      <div className={`absolute top-4 left-4 transition-colors duration-300 ${focused || value ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'}`}>
        {icon}
      </div>

      <input
        type={type}
        value={value}
        onChange={onChange}
        onFocus={(e) => { setFocused(true); onFocus && onFocus(e); }}
        onBlur={(e) => { setFocused(false); onBlur && onBlur(e); }}
        required={required}
        className={`w-full rounded-2xl py-3.5 pl-12 ${rightAdornment ? 'pr-12' : 'pr-4'} outline-none transition-all duration-300 font-bold text-[var(--text-main)] placeholder-transparent glass-card`}
        style={{
          boxShadow: focused ? 'var(--neon-glow)' : 'none',
          borderColor: focused ? 'var(--accent-primary)' : undefined,
        }}
        placeholder=" "
        {...props}
      />

      {rightAdornment && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
          {rightAdornment}
        </div>
      )}

      <label
        className={`absolute left-12 transition-all duration-300 pointer-events-none ${focused || value
          ? '-top-2.5 px-2 text-[10px] font-black uppercase tracking-widest'
          : 'top-3.5 text-[var(--text-muted)] font-medium'
          }`}
        style={{
          color: focused || value ? 'var(--accent-primary)' : undefined,
          background: focused || value ? 'var(--bg-surface)' : 'transparent',
        }}
      >
        {label}
      </label>
    </div>
  );
};

const EyeIcon = ({ open }: { open: boolean }) => {
  if (open) {
    return (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <path d="M4 4l16 16" />
    </svg>
  );
};

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read verification document'));
    reader.readAsDataURL(file);
  });

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const reduceMotion = useReducedMotion();
  const [role, setRole] = useState<RoleType>('PATIENT');
  const [mode, setMode] = useState<AuthMode>('LOGIN');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [characterState, setCharacterState] = useState<CharacterState>('IDLE');
  const formPanelRef = useRef<HTMLDivElement>(null);

  const handleFormTilt = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!formPanelRef.current) return;
    const r = formPanelRef.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * 12;
    const y = ((e.clientY - r.top) / r.height - 0.5) * -12;
    formPanelRef.current.style.transform = `perspective(1200px) rotateY(${x}deg) rotateX(${y}deg)`;
  };
  const handleFormLeave = () => {
    if (formPanelRef.current) formPanelRef.current.style.transform = 'perspective(1200px) rotateY(0deg) rotateX(0deg)';
  };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regAge, setRegAge] = useState('');
  const [regGender, setRegGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [regBloodGroup, setRegBloodGroup] = useState('O+');

  const [docName, setDocName] = useState('');
  const [docEmail, setDocEmail] = useState('');
  const [docPassword, setDocPassword] = useState('');
  const [showDocPassword, setShowDocPassword] = useState(false);
  const [docSpec, setDocSpec] = useState('');
  const [docQual, setDocQual] = useState('');
  const [docRegNo, setDocRegNo] = useState('');
  const [docCouncil, setDocCouncil] = useState(MEDICAL_COUNCILS[0]);
  const [docExp, setDocExp] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);

  const roleConf = ROLE_CONFIG[role];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Please enter both email and password."); setCharacterState('ERROR'); return; }
    setLoading(true); setError('');
    try {
      const { user: backendUser } = await BackendAPI.login(email, password);
      if (backendUser.role !== role) {
        setError(`Account exists but is not registered as a ${role.toLowerCase()}. Please switch tabs.`);
        setCharacterState('ERROR'); setLoading(false); return;
      }
      let finalUser: User = backendUser;
      if (IS_DEMO_MODE) {
        const localProfile = await MockBackend.login(email, password);
        if (localProfile && localProfile.role === backendUser.role) {
          if (backendUser.role === UserRole.DOCTOR) {
            finalUser = { ...(localProfile as any), ...(backendUser as any), id: backendUser.id, email: backendUser.email, role: backendUser.role, name: backendUser.name, status: (backendUser as any).status ?? (localProfile as any).status } as User;
          } else {
            finalUser = localProfile as User;
          }
        }
      }
      setCharacterState('SUCCESS');
      setTimeout(() => onLogin(finalUser), 1500); // Delay to show success animation
    } catch (err) {
      setError((err as any)?.message || 'An error occurred. Please try again.');
      setCharacterState('ERROR');
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (role === 'PATIENT') {
      if (!regName || !regEmail || !regPassword || !regAge) { setError('Please fill in all required patient details.'); setCharacterState('ERROR'); return; }
    } else if (role === 'DOCTOR') {
      if (!docName || !docEmail || !docPassword || !docSpec || !docRegNo || !docFile) {
        setError('Please fill all doctor details and upload certificate/license.');
        setCharacterState('ERROR');
        return;
      }
      if (docFile.size > 5 * 1024 * 1024) {
        setError('Certificate/license file must be under 5MB.');
        setCharacterState('ERROR');
        return;
      }
    }
    setLoading(true);
    try {
      let backendUser: User | null = null;
      if (role === 'PATIENT') {
        const result = await BackendAPI.register({ name: regName, email: regEmail, password: regPassword, role: UserRole.PATIENT });
        backendUser = result.user as unknown as User;
        try { await MockBackend.registerPatient(regName, regEmail, regPassword, parseInt(regAge, 10) || 0, regGender, regBloodGroup); } catch {}
      } else if (role === 'DOCTOR') {
        const verificationDocumentUrl = await fileToDataUrl(docFile as File);

        // First create the doctor in the real backend (authoritative auth)
        const result = await BackendAPI.register({
          name: docName,
          email: docEmail,
          password: docPassword,
          role: UserRole.DOCTOR,
          specialization: docSpec,
          qualification: docQual,
          registrationNumber: docRegNo,
          medicalCouncil: docCouncil,
          experienceYears: parseInt(docExp || '0', 10) || 0,
          verificationDocumentUrl,
          verificationDocumentName: (docFile as File).name,
        });

        // Then mirror this doctor into the local mock backend and
        // use that richer profile (with status/schedule) for the UI session.
        try {
          const localDoctor = await MockBackend.registerDoctor(docName, docEmail, docPassword, docSpec, docQual, docRegNo, parseInt(docExp || '0', 10) || 0, docCouncil, docFile || undefined);
          backendUser = { ...(localDoctor as any), ...(result.user as any), id: result.user.id, email: result.user.email, role: result.user.role, name: result.user.name, status: (result.user as any).status ?? (localDoctor as any).status } as User;
        } catch { backendUser = result.user as unknown as User; }
      } else {
        throw new Error('Admin self-registration is not allowed.');
      }
      if (!backendUser) throw new Error('Registration failed.');
      setCharacterState('SUCCESS');
      if (role === 'DOCTOR') {
        setToken(null);
        setTimeout(() => {
          setLoading(false);
          setMode('LOGIN');
          setRole('DOCTOR');
          setPassword('');
          setDocPassword('');
          setError('Registration submitted. Admin verification is required before doctor login.');
        }, 1200);
        return;
      }

      setTimeout(() => onLogin(backendUser as User), 1500);
    } catch (err: any) {
      setError(err.message || 'Registration failed.'); setCharacterState('ERROR'); setLoading(false);
    }
  };

  const switchRole = (r: RoleType) => {
    setRole(r); setMode('LOGIN'); setError(''); setEmail(''); setPassword('');
    setShowLoginPassword(false); setShowRegPassword(false); setShowDocPassword(false); setCharacterState('IDLE');
  };

  const selectStyle = {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '0.75rem',
    padding: '0.875rem 1rem 0.875rem 3rem',
    color: 'white',
    outline: 'none',
    backdropFilter: 'blur(8px)',
    appearance: 'none' as const,
  };

  return (
    <div
      className="min-h-screen flex font-sans overflow-hidden relative transition-colors duration-500"
      style={{ background: 'var(--bg-gradient)' }}
    >
      <HoloBackdrop3D className="opacity-40" intensity={0.6} palette={role === 'DOCTOR' ? ['#00FFB3', '#00D4FF', '#7B61FF'] : role === 'ADMIN' ? ['#FF006E', '#00D4FF', '#00FFB3'] : ['#00D4FF', '#00FFB3', '#7B61FF']} />

      {/* Drifting orbs */}
      <div className="absolute inset-0 pointer-events-none aurora-bg opacity-20" />

      {/* LEFT: Holographic panel */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="hidden lg:flex lg:w-[50%] relative items-center justify-center overflow-hidden flex-col z-10"
        style={{ background: 'transparent', borderRight: '1px solid var(--glass-border)' }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(0,212,255,0.08),transparent_45%,rgba(0,255,179,0.08))]" />

        {/* 3D Heart */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-80">
          <Suspense fallback={<div className="w-[480px] h-[480px] rounded-full" style={{ background: 'rgba(0,212,255,0.03)' }} />}>
            <BeatingHeart3D className="w-[480px] h-[480px]" bpm={72} />
          </Suspense>
        </div>

        {/* Scanning line */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute left-0 right-0 h-px"
            style={{ background: `linear-gradient(90deg, transparent, ${roleConf.color}60, transparent)` }}
            animate={{ top: ['0%', '100%'] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
          />
        </div>

        {/* Character */}
        <div className="relative z-10 transform scale-125 mb-8">
          <LoginCharacter state={characterState} />
        </div>

        <div className="relative z-10 text-center px-10">
          <h2
            className="text-3xl font-bold text-white mb-2"
            style={{ fontFamily: "'Space Grotesk', sans-serif", textShadow: `0 0 20px ${roleConf.color}30` }}
          >
            CareXAI Assistant
          </h2>
          <p className="max-w-sm mx-auto text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            I'm here to ensure your health data is secure and your experience is seamless.
          </p>

          {/* Live stats strip */}
          <div className="mt-6 flex items-center justify-center gap-4">
            {[{ label: 'HR', value: '72 bpm' }, { label: 'SpO₂', value: '98%' }, { label: 'BP', value: '118/76' }].map((s, i) => (
              <div key={s.label} className="text-center px-3 py-2 rounded-xl" style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.12)' }}>
                <p className="text-[10px] font-bold uppercase mb-0.5" style={{ color: 'rgba(0,212,255,0.6)' }}>{s.label}</p>
                <p className="text-sm font-bold" style={{ color: '#00D4FF' }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Corner brackets */}
        {['top-4 left-4 border-t border-l', 'top-4 right-4 border-t border-r', 'bottom-4 left-4 border-b border-l', 'bottom-4 right-4 border-b border-r'].map((cls, i) => (
          <div key={i} className={`absolute ${cls} w-6 h-6`} style={{ borderColor: 'rgba(0,212,255,0.3)' }} />
        ))}
      </motion.div>

      {/* RIGHT: Auth form */}
      <div
        className="w-full lg:w-[50%] flex flex-col justify-center items-center p-6 md:p-12 overflow-y-auto z-10 relative"
        onMouseMove={handleFormTilt}
        onMouseLeave={handleFormLeave}
      >

        {/* Mobile logo */}
        <div className="lg:hidden mb-8 text-center">
          <div
            className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center text-2xl font-bold"
            style={{ background: 'linear-gradient(135deg, #00D4FF, #00FFB3)', color: '#050A14', boxShadow: '0 0 20px rgba(0,212,255,0.4)' }}
          >
            C
          </div>
          <h2 className="text-2xl font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>CareXAI</h2>
        </div>

        <motion.div
          ref={formPanelRef}
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="w-full max-w-md"
          style={{ transition: 'transform 0.15s ease-out' }}
        >
          {/* Header */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="mb-8"
            >
              <h2 className="text-3xl font-bold text-white mb-1.5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {mode === 'LOGIN' ? 'Welcome Back' : 'Create Account'}
              </h2>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {mode === 'LOGIN' ? 'Sign in to your secure healthcare account.' : 'Join CareXAI to monitor your health intelligently.'}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Role tabs */}
          <div
            className="flex p-1 rounded-[24px] mb-8 relative glass-shell"
          >
            {/* Animated pill */}
            <motion.div
              className="absolute top-1 bottom-1 rounded-xl"
              initial={false}
              animate={{
                left: role === 'PATIENT' ? '4px' : role === 'DOCTOR' ? '33.33%' : '66.66%',
                width: 'calc(33.33% - 8px)',
                x: role === 'PATIENT' ? 0 : role === 'DOCTOR' ? 4 : 8,
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              style={{
                background: `${roleConf.color}15`,
                border: `1px solid ${roleConf.color}30`,
                boxShadow: `0 0 12px ${roleConf.color}20`,
              }}
            />
            {(['PATIENT', 'DOCTOR', 'ADMIN'] as RoleType[]).map(r => (
              <button
                key={r}
                onClick={() => switchRole(r)}
                className="flex-1 py-2.5 text-xs font-bold rounded-xl transition-all relative z-10 flex flex-col items-center gap-1"
                style={{ color: role === r ? ROLE_CONFIG[r].color : 'rgba(255,255,255,0.3)' }}
              >
                <span className="text-base">{ROLE_CONFIG[r].icon}</span>
                <span>{ROLE_CONFIG[r].label}</span>
              </button>
            ))}
          </div>

          {/* Form card */}
          <div
            className="rounded-[28px] p-7 border-glow-cycle glass-shell depth-card"
          >
            <form onSubmit={mode === 'LOGIN' ? handleLogin : handleRegister}>

              {/* Loading bar */}
              <AnimatePresence>
                {loading && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-4">
                    <div className="h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,212,255,0.15)' }}>
                      <motion.div
                        className="h-full w-1/3 rounded-full"
                        style={{ background: 'linear-gradient(90deg, #00D4FF, #00FFB3)' }}
                        animate={reduceMotion ? undefined : { x: ['-60%', '260%'] }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    </div>
                    <div className="mt-2 text-[11px] font-semibold" style={{ color: 'rgba(0,212,255,0.6)' }}>Securing session…</div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait">
                <motion.div
                  key={mode + role}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  {mode === 'LOGIN' && (
                    <>
                      <FloatingInput label="Email Address" type="email" value={email} onChange={(e: any) => setEmail(e.target.value)} onFocus={() => setCharacterState('WATCHING')} onBlur={() => setCharacterState('IDLE')} icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" /></svg>} />
                      <FloatingInput label="Password" type={showLoginPassword ? 'text' : 'password'} value={password} onChange={(e: any) => setPassword(e.target.value)} onFocus={() => setCharacterState('HIDING')} onBlur={() => setCharacterState('IDLE')} icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}
                        rightAdornment={
                          <button type="button" onClick={() => setShowLoginPassword(s => !s)} className="p-1.5 rounded-lg transition-colors" style={{ color: 'rgba(0,212,255,0.5)' }}>
                            <EyeIcon open={showLoginPassword} />
                          </button>
                        }
                      />
                    </>
                  )}

                  {mode === 'REGISTER' && role === 'PATIENT' && (
                    <>
                      <FloatingInput label="Full Name" value={regName} onChange={(e: any) => setRegName(e.target.value)} icon={<span className="text-lg">👤</span>} onFocus={() => setCharacterState('WATCHING')} onBlur={() => setCharacterState('IDLE')} />
                      <div className="grid grid-cols-2 gap-4">
                        <FloatingInput label="Age" type="number" value={regAge} onChange={(e: any) => setRegAge(e.target.value)} icon={<span className="text-lg">🎂</span>} onFocus={() => setCharacterState('WATCHING')} onBlur={() => setCharacterState('IDLE')} />
                        <div className="relative mb-5">
                          <div className="absolute top-4 left-4 text-slate-500"><span className="text-lg">⚧</span></div>
                          <select style={selectStyle} value={regGender} onChange={e => setRegGender(e.target.value as any)}>
                            <option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
                          </select>
                        </div>
                      </div>
                      <div className="relative mb-5">
                        <div className="absolute top-4 left-4 text-slate-500"><span className="text-lg">🩸</span></div>
                        <select style={selectStyle} value={regBloodGroup} onChange={e => setRegBloodGroup(e.target.value)}>
                          {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                        <label className="absolute -top-2.5 left-12 px-2 text-xs font-bold" style={{ color: '#00D4FF', background: 'rgba(12,20,38,1)' }}>Blood Group</label>
                      </div>
                      <FloatingInput label="Email" type="email" value={regEmail} onChange={(e: any) => setRegEmail(e.target.value)} icon={<span className="text-lg">✉️</span>} onFocus={() => setCharacterState('WATCHING')} onBlur={() => setCharacterState('IDLE')} />
                      <FloatingInput label="Password" type={showRegPassword ? 'text' : 'password'} value={regPassword} onChange={(e: any) => setRegPassword(e.target.value)} icon={<span className="text-lg">🔒</span>} onFocus={() => setCharacterState('HIDING')} onBlur={() => setCharacterState('IDLE')}
                        rightAdornment={<button type="button" onClick={() => setShowRegPassword(s => !s)} className="p-1.5 rounded-lg" style={{ color: 'rgba(0,212,255,0.5)' }}><EyeIcon open={showRegPassword} /></button>}
                      />
                    </>
                  )}

                  {mode === 'REGISTER' && role === 'DOCTOR' && (
                    <div className="max-h-[380px] overflow-y-auto custom-scrollbar pr-2 space-y-0">
                      <FloatingInput label="Full Name (Dr.)" value={docName} onChange={(e: any) => setDocName(e.target.value)} icon={<span className="text-lg">👨‍⚕️</span>} onFocus={() => setCharacterState('WATCHING')} onBlur={() => setCharacterState('IDLE')} />
                      <FloatingInput label="Specialization" value={docSpec} onChange={(e: any) => setDocSpec(e.target.value)} icon={<span className="text-lg">🩺</span>} onFocus={() => setCharacterState('WATCHING')} onBlur={() => setCharacterState('IDLE')} />
                      <FloatingInput label="Reg. Number" value={docRegNo} onChange={(e: any) => setDocRegNo(e.target.value)} icon={<span className="text-lg">🆔</span>} onFocus={() => setCharacterState('WATCHING')} onBlur={() => setCharacterState('IDLE')} />
                      <FloatingInput label="Email" type="email" value={docEmail} onChange={(e: any) => setDocEmail(e.target.value)} icon={<span className="text-lg">✉️</span>} onFocus={() => setCharacterState('WATCHING')} onBlur={() => setCharacterState('IDLE')} />
                      <FloatingInput label="Password" type={showDocPassword ? 'text' : 'password'} value={docPassword} onChange={(e: any) => setDocPassword(e.target.value)} icon={<span className="text-lg">🔒</span>} onFocus={() => setCharacterState('HIDING')} onBlur={() => setCharacterState('IDLE')}
                        rightAdornment={<button type="button" onClick={() => setShowDocPassword(s => !s)} className="p-1.5 rounded-lg" style={{ color: 'rgba(0,212,255,0.5)' }}><EyeIcon open={showDocPassword} /></button>}
                      />
                      <div className="mb-4">
                        <label className="text-xs font-bold uppercase ml-1 mb-2 block" style={{ color: 'rgba(0,212,255,0.6)' }}>Medical Certificate</label>
                        <input type="file" className="mt-1 block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold"
                          style={{ color: 'rgba(255,255,255,0.4)' }}
                          onChange={e => setDocFile(e.target.files ? e.target.files[0] : null)}
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium mb-4"
                    style={{ background: 'rgba(255,0,110,0.1)', border: '1px solid rgba(255,0,110,0.3)', color: '#FF006E' }}
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit button */}
              <motion.button
                whileHover={reduceMotion ? undefined : { scale: 1.02, y: -2 }}
                whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                disabled={loading}
                className="w-full relative overflow-hidden py-4 rounded-[22px] font-bold text-space-950 shimmer-btn flex items-center justify-center gap-2 group"
                style={{
                  background: `linear-gradient(135deg, ${roleConf.color} 0%, ${role === 'PATIENT' ? '#00FFB3' : role === 'DOCTOR' ? '#00D4FF' : '#FF006E'} 100%)`,
                  boxShadow: `0 0 20px ${roleConf.shadow}, 0 10px 30px rgba(0,0,0,0.2)`,
                  color: '#050A14',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={loading ? 'loading' : 'ready'}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    className="relative z-10 flex items-center gap-2"
                  >
                    {loading && <svg className="animate-spin w-5 h-5 opacity-70" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>}
                    {loading ? 'Processing…' : mode === 'LOGIN' ? 'Sign In' : 'Create Account'}
                    {!loading && <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>}
                  </motion.span>
                </AnimatePresence>
              </motion.button>
            </form>
          </div>

          {/* Toggle mode */}
          {role !== 'ADMIN' && (
            <div className="mt-6 text-center">
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {mode === 'LOGIN' ? "Don't have an account?" : "Already have an account?"}
                <button
                  onClick={() => { setMode(mode === 'LOGIN' ? 'REGISTER' : 'LOGIN'); setError(''); setCharacterState('IDLE'); }}
                  className="ml-2 font-bold underline underline-offset-4 transition-colors"
                  style={{ color: roleConf.color, textShadow: `0 0 8px ${roleConf.shadow}` }}
                >
                  {mode === 'LOGIN' ? 'Sign up' : 'Log in'}
                </button>
              </p>
            </div>
          )}

          <div className="mt-8 text-center">
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>© 2026 CareXAI Healthcare. Secure &amp; Encrypted.</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
