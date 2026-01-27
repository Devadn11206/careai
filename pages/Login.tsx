
import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { MockBackend } from '../services/mockBackend';
import { BackendAPI } from '../services/apiClient';
import { motion, AnimatePresence } from 'framer-motion';
import { LoginCharacter, CharacterState } from '../components/LoginCharacter';

interface LoginProps {
  onLogin: (user: User) => void;
}

type AuthMode = 'LOGIN' | 'REGISTER';
type RoleType = 'PATIENT' | 'DOCTOR' | 'ADMIN';

// Demo mode is enabled only during local development builds.
// In production, we must avoid using seeded/mock doctor profiles.
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

// --- Custom Floating Input with External Focus Handlers ---
const FloatingInput = ({ label, type = "text", value, onChange, icon, required = false, onFocus, onBlur, ...props }: any) => {
  const [focused, setFocused] = useState(false);
  return (
    <div className="relative mb-5 group">
      <div className={`absolute top-4 left-4 transition-colors duration-300 ${focused || value ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
        {icon}
      </div>
      <input
        type={type}
        value={value}
        onChange={onChange}
        onFocus={(e) => { setFocused(true); onFocus && onFocus(e); }}
        onBlur={(e) => { setFocused(false); onBlur && onBlur(e); }}
        required={required}
        className={`w-full bg-slate-50 dark:bg-slate-800 border-2 rounded-xl py-3.5 pl-12 pr-4 outline-none transition-all duration-300 font-medium text-slate-700 dark:text-slate-100 ${focused
            ? 'border-rose-500 bg-white dark:bg-slate-900 shadow-lg shadow-rose-500/10'
            : 'border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600'
          } ${value ? 'bg-white dark:bg-slate-900' : ''}`}
        placeholder=" "
        {...props}
      />
      <label
        className={`absolute left-12 transition-all duration-300 pointer-events-none ${focused || value
            ? '-top-2.5 bg-white dark:bg-slate-900 px-2 text-xs font-bold text-rose-600 dark:text-rose-400'
            : 'top-3.5 text-slate-400 font-medium'
          }`}
      >
        {label}
      </label>
    </div>
  );
};

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [role, setRole] = useState<RoleType>('PATIENT');
  const [mode, setMode] = useState<AuthMode>('LOGIN');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Character State
  const [characterState, setCharacterState] = useState<CharacterState>('IDLE');

  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Registration States
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regAge, setRegAge] = useState('');
  const [regGender, setRegGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [regBloodGroup, setRegBloodGroup] = useState('O+');

  const [docName, setDocName] = useState('');
  const [docEmail, setDocEmail] = useState('');
  const [docPassword, setDocPassword] = useState('');
  const [docSpec, setDocSpec] = useState('');
  const [docQual, setDocQual] = useState('');
  const [docRegNo, setDocRegNo] = useState('');
  const [docCouncil, setDocCouncil] = useState(MEDICAL_COUNCILS[0]);
  const [docExp, setDocExp] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter both email and password.");
      setCharacterState('ERROR');
      return;
    }
    setLoading(true);
    setError('');

    try {
      // Authenticate against real backend
      const { user: backendUser } = await BackendAPI.login(email, password);

      if (backendUser.role !== role) {
        setError(`Account exists but is not registered as a ${role.toLowerCase()}. Please switch tabs.`);
        setCharacterState('ERROR');
        setLoading(false);
        return;
      }

      // In demo/dev we optionally hydrate from MockBackend for richer UI,
      // but in production we always trust the real backend user profile.
      let finalUser: User = backendUser;
      if (IS_DEMO_MODE) {
        const localProfile = await MockBackend.login(email, password);
        if (localProfile && localProfile.role === backendUser.role) {
          finalUser = localProfile as User;
        }
      }

      setCharacterState('SUCCESS');
      setTimeout(() => onLogin(finalUser), 1500); // Delay to show success animation
    } catch (err) {
      setError('An error occurred. Please try again.');
      setCharacterState('ERROR');
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Basic client-side validation
    if (role === 'PATIENT') {
      if (!regName || !regEmail || !regPassword || !regAge) {
        setError('Please fill in all required patient details.');
        setCharacterState('ERROR');
        return;
      }
    } else if (role === 'DOCTOR') {
      if (!docName || !docEmail || !docPassword || !docSpec || !docRegNo) {
        setError('Please fill in all required doctor details.');
        setCharacterState('ERROR');
        return;
      }
    }

    setLoading(true);

    try {
      let backendUser: User | null = null;

      if (role === 'PATIENT') {
        const result = await BackendAPI.register({
          name: regName,
          email: regEmail,
          password: regPassword,
          role: UserRole.PATIENT,
        });

        backendUser = result.user as unknown as User;

        // Optionally hydrate richer local profile
        try {
          await MockBackend.registerPatient(
            regName,
            regEmail,
            regPassword,
            parseInt(regAge, 10) || 0,
            regGender,
            regBloodGroup
          );
        } catch {
          // Ignore local mock registration failures
        }
      } else if (role === 'DOCTOR') {
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
        });

        // Then mirror this doctor into the local mock backend and
        // use that richer profile (with status/schedule) for the UI session.
        try {
          const localDoctor = await MockBackend.registerDoctor(
            docName,
            docEmail,
            docPassword,
            docSpec,
            docQual,
            docRegNo,
            parseInt(docExp || '0', 10) || 0,
            docCouncil,
            docFile || undefined
          );
          backendUser = localDoctor as unknown as User;
        } catch {
          // If local registration fails, fall back to the backend user
          backendUser = result.user as unknown as User;
        }
      } else {
        throw new Error('Admin self-registration is not allowed.');
      }

      if (!backendUser) throw new Error('Registration failed.');

      setCharacterState('SUCCESS');
      setTimeout(() => onLogin(backendUser as User), 1500);
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
      setCharacterState('ERROR');
      setLoading(false);
    }
  };

  const switchRole = (r: RoleType) => {
    setRole(r); setMode('LOGIN'); setError(''); setEmail(''); setPassword('');
    setCharacterState('IDLE');
  };

  return (
    <div className="min-h-screen flex bg-white dark:bg-slate-900 font-sans overflow-hidden selection:bg-rose-100 selection:text-rose-900">

      {/* LEFT SIDE: CHARACTER INTERACTION (Desktop Only) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="hidden lg:flex lg:w-[50%] relative bg-gradient-to-br from-slate-50 to-teal-50 dark:from-slate-800 dark:to-slate-900 items-center justify-center overflow-hidden flex-col"
      >
        {/* Background Decor */}
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <div className="absolute top-10 left-10 w-32 h-32 bg-teal-200 rounded-full blur-3xl mix-blend-multiply animate-blob"></div>
          <div className="absolute top-10 right-10 w-32 h-32 bg-rose-200 rounded-full blur-3xl mix-blend-multiply animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-32 h-32 bg-purple-200 rounded-full blur-3xl mix-blend-multiply animate-blob animation-delay-4000"></div>
        </div>

        {/* Character Component */}
        <div className="relative z-10 transform scale-125 mb-10">
          <LoginCharacter state={characterState} />
        </div>

        <div className="relative z-10 text-center px-10">
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">CareXAI Assistant</h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            I'm here to ensure your health data is secure and your experience is seamless.
          </p>
        </div>
      </motion.div>

      {/* RIGHT SIDE: AUTH FORM */}
      <div className="w-full lg:w-[50%] flex flex-col justify-center items-center p-6 md:p-12 relative bg-white dark:bg-slate-900 overflow-y-auto">

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          {/* Mobile Logo & Character Fallback (Visible only on small screens) */}
          <div className="lg:hidden mb-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 relative">
              {/* Simplified Static Character for Mobile */}
              <div className="w-full h-full bg-teal-500 rounded-full flex items-center justify-center text-3xl shadow-lg">🤖</div>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">CareXAI</h2>
          </div>

          {/* Header */}
          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              {mode === 'LOGIN' ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-slate-500 dark:text-slate-400">
              {mode === 'LOGIN'
                ? 'Please enter your details to sign in.'
                : 'Join us to monitor your health intelligently.'}
            </p>
          </div>

          {/* Role Switcher */}
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-8 relative">
            {(['PATIENT', 'DOCTOR', 'ADMIN'] as RoleType[]).map((r) => (
              <button
                key={r}
                onClick={() => switchRole(r)}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all relative z-10 ${role === r ? 'text-rose-700 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
              >
                {r}
              </button>
            ))}
            {/* Animated Pill Background */}
            <motion.div
              className="absolute top-1 bottom-1 bg-white dark:bg-slate-700 rounded-lg shadow-sm border border-slate-200/50 dark:border-slate-600"
              initial={false}
              animate={{
                left: role === 'PATIENT' ? '4px' : role === 'DOCTOR' ? '33.33%' : '66.66%',
                width: 'calc(33.33% - 8px)',
                translateX: role === 'PATIENT' ? 0 : role === 'DOCTOR' ? 4 : 8
              }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          </div>

          {/* Form */}
          <form onSubmit={mode === 'LOGIN' ? handleLogin : handleRegister} className="relative">
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
                    <FloatingInput
                      label="Email Address"
                      type="email"
                      value={email}
                      onChange={(e: any) => setEmail(e.target.value)}
                      onFocus={() => setCharacterState('WATCHING')}
                      onBlur={() => setCharacterState('IDLE')}
                      icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" /></svg>}
                    />
                    <FloatingInput
                      label="Password"
                      type="password"
                      value={password}
                      onChange={(e: any) => setPassword(e.target.value)}
                      onFocus={() => setCharacterState('HIDING')}
                      onBlur={() => setCharacterState('IDLE')}
                      icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}
                    />
                  </>
                )}

                {mode === 'REGISTER' && role === 'PATIENT' && (
                  <>
                    <FloatingInput label="Full Name" value={regName} onChange={(e: any) => setRegName(e.target.value)} icon={<span className="text-lg">👤</span>} onFocus={() => setCharacterState('WATCHING')} onBlur={() => setCharacterState('IDLE')} />
                    <div className="grid grid-cols-2 gap-4">
                      <FloatingInput label="Age" type="number" value={regAge} onChange={(e: any) => setRegAge(e.target.value)} icon={<span className="text-lg">🎂</span>} onFocus={() => setCharacterState('WATCHING')} onBlur={() => setCharacterState('IDLE')} />
                      <div className="relative mb-5">
                        <div className="absolute top-4 left-4 text-slate-400"><span className="text-lg">⚧</span></div>
                        <select className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl py-3.5 pl-12 pr-4 outline-none text-slate-700 dark:text-slate-100 font-medium appearance-none" value={regGender} onChange={e => setRegGender(e.target.value as any)}>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>
                    <div className="relative mb-5">
                      <div className="absolute top-4 left-4 text-slate-400"><span className="text-lg">🩸</span></div>
                      <select className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl py-3.5 pl-12 pr-4 outline-none text-slate-700 dark:text-slate-100 font-medium appearance-none" value={regBloodGroup} onChange={e => setRegBloodGroup(e.target.value)}>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                      </select>
                      <label className="absolute left-12 -top-2.5 bg-white dark:bg-slate-900 px-2 text-xs font-bold text-rose-600 dark:text-rose-400">Blood Group</label>
                    </div>
                    <FloatingInput label="Email" type="email" value={regEmail} onChange={(e: any) => setRegEmail(e.target.value)} icon={<span className="text-lg">✉️</span>} onFocus={() => setCharacterState('WATCHING')} onBlur={() => setCharacterState('IDLE')} />
                    <FloatingInput label="Password" type="password" value={regPassword} onChange={(e: any) => setRegPassword(e.target.value)} icon={<span className="text-lg">🔒</span>} onFocus={() => setCharacterState('HIDING')} onBlur={() => setCharacterState('IDLE')} />
                  </>
                )}

                {mode === 'REGISTER' && role === 'DOCTOR' && (
                  <div className="max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                    <FloatingInput label="Full Name (Dr.)" value={docName} onChange={(e: any) => setDocName(e.target.value)} icon={<span className="text-lg">👨‍⚕️</span>} onFocus={() => setCharacterState('WATCHING')} onBlur={() => setCharacterState('IDLE')} />
                    <FloatingInput label="Specialization" value={docSpec} onChange={(e: any) => setDocSpec(e.target.value)} icon={<span className="text-lg">🩺</span>} onFocus={() => setCharacterState('WATCHING')} onBlur={() => setCharacterState('IDLE')} />
                    <FloatingInput label="Reg. Number" value={docRegNo} onChange={(e: any) => setDocRegNo(e.target.value)} icon={<span className="text-lg">🆔</span>} onFocus={() => setCharacterState('WATCHING')} onBlur={() => setCharacterState('IDLE')} />
                    <FloatingInput label="Email" type="email" value={docEmail} onChange={(e: any) => setDocEmail(e.target.value)} icon={<span className="text-lg">✉️</span>} onFocus={() => setCharacterState('WATCHING')} onBlur={() => setCharacterState('IDLE')} />
                    <FloatingInput label="Password" type="password" value={docPassword} onChange={(e: any) => setDocPassword(e.target.value)} icon={<span className="text-lg">🔒</span>} onFocus={() => setCharacterState('HIDING')} onBlur={() => setCharacterState('IDLE')} />
                    <div className="mb-4">
                      <label className="text-xs font-bold text-slate-500 uppercase ml-1">Medical Certificate</label>
                      <input type="file" className="mt-1 block w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-rose-50 dark:file:bg-rose-900 file:text-rose-700 dark:file:text-rose-400 hover:file:bg-rose-100" onChange={e => setDocFile(e.target.files ? e.target.files[0] : null)} />
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Error Message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 px-4 py-3 rounded-xl text-sm font-medium mb-4 flex items-center gap-2"
                >
                  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={loading}
              className="w-full bg-rose-600 dark:bg-rose-600 text-white py-4 rounded-xl font-bold shadow-xl shadow-rose-500/20 dark:shadow-rose-900/20 hover:bg-rose-700 dark:hover:bg-rose-700 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
            >
              {loading && <svg className="animate-spin w-5 h-5 text-white/50" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
              {loading ? 'Processing...' : (mode === 'LOGIN' ? 'Sign In' : 'Create Account')}
              {!loading && <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>}
            </motion.button>
          </form>

          {/* Toggle Mode */}
          {role !== 'ADMIN' && (
            <div className="mt-8 text-center">
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {mode === 'LOGIN' ? "Don't have an account?" : "Already have an account?"}
                <button
                  onClick={() => { setMode(mode === 'LOGIN' ? 'REGISTER' : 'LOGIN'); setError(''); setCharacterState('IDLE'); }}
                  className="ml-2 font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 underline decoration-rose-200 dark:decoration-rose-800 underline-offset-4"
                >
                  {mode === 'LOGIN' ? 'Sign up' : 'Log in'}
                </button>
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-12 text-center">
            <p className="text-xs text-slate-300 dark:text-slate-500">© 2026 CareXAI Healthcare. Secure & Encrypted.</p>
          </div>

        </motion.div>
      </div>

    </div>
  );
};
