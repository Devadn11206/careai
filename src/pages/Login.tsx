import React, { Suspense, useRef, useState } from 'react';
import { User, UserRole } from '../types';
import { MockBackend } from '../services/mockBackend';
import { BackendAPI, setToken } from '../services/apiClient';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { LoginCharacter, CharacterState } from '../components/visuals/LoginCharacter';
import { HoloBackdrop3D } from '../components/visuals/HoloBackdrop3D';
import { NeonInput } from '@/components/carex/NeonInput';
import { NeonButton } from '@/components/carex/NeonButton';
import { GlassCard } from '@/components/carex/GlassCard';
import { cn } from '@/lib/utils';
import { 
    Mail, 
    Lock, 
    User as UserIcon, 
    Stethoscope, 
    ShieldCheck, 
    Eye, 
    EyeOff,
    ChevronRight,
    Brain,
    Activity,
    HeartPulse
} from 'lucide-react';

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
  PATIENT: { icon: HeartPulse, label: 'Patient', color: 'text-primary', glow: 'shadow-glow-primary' },
  DOCTOR: { icon: Stethoscope, label: 'Doctor', color: 'text-cyan-400', glow: 'shadow-glow-primary' },
  ADMIN: { icon: ShieldCheck, label: 'Admin', color: 'text-secondary', glow: 'shadow-glow-secondary' },
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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Registration states
  const [regName, setRegName] = useState('');
  const [regAge, setRegAge] = useState('');
  const [regGender, setRegGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [regBloodGroup, setRegBloodGroup] = useState('O+');

  const [docName, setDocName] = useState('');
  const [docSpec, setDocSpec] = useState('');
  const [docRegNo, setDocRegNo] = useState('');
  const [docCouncil, setDocCouncil] = useState(MEDICAL_COUNCILS[0]);
  const [docExp, setDocExp] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);

  const roleConf = ROLE_CONFIG[role];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { 
        setError("Clinical credentials required."); 
        setCharacterState('ERROR'); 
        return; 
    }
    setLoading(true); 
    setError('');
    try {
      const { user: backendUser } = await BackendAPI.login(email, password);
      if (backendUser.role !== role) {
        setError(`Node mismatch: Account is registered as ${backendUser.role}.`);
        setCharacterState('ERROR'); 
        setLoading(false); 
        return;
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
      setTimeout(() => onLogin(finalUser), 1500);
    } catch (err) {
      setError((err as any)?.message || 'Neural link failure. Retrying…');
      setCharacterState('ERROR');
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setError('');
    if (role === 'PATIENT') {
      if (!regName || !email || !password || !regAge) { 
          setError('Complete all biometric fields.'); 
          setCharacterState('ERROR'); 
          return; 
      }
    } else if (role === 'DOCTOR') {
      if (!docName || !email || !password || !docSpec || !docRegNo || !docFile) {
        setError('License verification documents required.');
        setCharacterState('ERROR');
        return;
      }
    }
    setLoading(true);
    try {
      let backendUser: User | null = null;
      if (role === 'PATIENT') {
        const result = await BackendAPI.register({ name: regName, email, password, role: UserRole.PATIENT });
        backendUser = result.user as unknown as User;
        try { await MockBackend.registerPatient(regName, email, password, parseInt(regAge, 10) || 0, regGender, regBloodGroup); } catch {}
      } else if (role === 'DOCTOR') {
        const verificationDocumentUrl = await fileToDataUrl(docFile as File);
        const result = await BackendAPI.register({
          name: docName,
          email,
          password,
          role: UserRole.DOCTOR,
          specialization: docSpec,
          qualification: '',
          registrationNumber: docRegNo,
          medicalCouncil: docCouncil,
          experienceYears: parseInt(docExp || '0', 10) || 0,
          verificationDocumentUrl,
          verificationDocumentName: (docFile as File).name,
        });
        try {
          const localDoctor = await MockBackend.registerDoctor(docName, email, password, docSpec, '', docRegNo, parseInt(docExp || '0', 10) || 0, docCouncil, docFile || undefined);
          backendUser = { ...(localDoctor as any), ...(result.user as any), id: result.user.id, email: result.user.email, role: result.user.role, name: result.user.name, status: (result.user as any).status ?? (localDoctor as any).status } as User;
        } catch { backendUser = result.user as unknown as User; }
      }
      if (!backendUser) throw new Error('Initialization failure.');
      setCharacterState('SUCCESS');
      if (role === 'DOCTOR') {
        setToken(null);
        setTimeout(() => {
          setLoading(false);
          setMode('LOGIN');
          setError('Clinical node registered. Awaiting Admin verification.');
        }, 1200);
        return;
      }
      setTimeout(() => onLogin(backendUser as User), 1500);
    } catch (err: any) {
      setError(err.message || 'Registry error.'); 
      setCharacterState('ERROR'); 
      setLoading(false);
    }
  };

  const switchRole = (r: RoleType) => {
    setRole(r); 
    setMode('LOGIN'); 
    setError(''); 
    setCharacterState('IDLE');
  };

  return (
    <div className="min-h-screen flex bg-background overflow-hidden relative selection:bg-primary/30">
      <HoloBackdrop3D 
        className="opacity-30" 
        intensity={0.4} 
        palette={role === 'DOCTOR' ? ['#00FFB3', '#00D4FF', '#7B61FF'] : role === 'ADMIN' ? ['#7000ff', '#00f2ff', '#FF006E'] : ['#00f2ff', '#10b981', '#7B61FF']} 
      />

      {/* LEFT: Cinematic Intelligence Panel */}
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8 }}
        className="hidden lg:flex lg:w-1/2 relative items-center justify-center flex-col z-10 border-r border-white/5"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
        
        {/* Animated Grid Lines */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" 
             style={{ backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)', backgroundSize: '50px 50px' }} />

        {/* 3D Heart Visual */}
        <div className="relative w-[500px] h-[500px] flex items-center justify-center">
            <div className="absolute inset-0 bg-primary/5 rounded-full blur-[100px] animate-ai-pulse" />
            <Suspense fallback={<div className="h-48 w-48 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />}>
                <BeatingHeart3D className="w-full h-full scale-125 opacity-60" bpm={mode === 'LOGIN' ? 60 : 85} />
            </Suspense>
        </div>

        <div className="relative z-10 text-center space-y-6 mt-[-50px]">
            <div className="flex items-center justify-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-primary shadow-glow-primary">
                    <Brain size={24} className="animate-pulse" />
                </div>
                <h2 className="text-4xl font-black tracking-tighter uppercase font-display">CareXAI <span className="text-primary">Nexus</span></h2>
            </div>
            
            <p className="max-w-md mx-auto text-sm text-muted-foreground leading-relaxed font-medium">
                Autonomous medical intelligence operating system. Secure your clinical node to access real-time neural diagnostics.
            </p>

            <div className="flex items-center justify-center gap-6">
                {[
                    { icon: Activity, label: 'Neural Sync', value: 'Active' },
                    { icon: Lock, label: 'Encryption', value: 'AES-256' },
                ].map((stat, i) => (
                    <div key={i} className="flex flex-col items-center gap-2 px-6 py-3 rounded-2xl bg-white/5 border border-white/10">
                        <stat.icon size={16} className="text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{stat.label}</span>
                        <span className="text-xs font-bold font-mono">{stat.value}</span>
                    </div>
                ))}
            </div>
        </div>

        {/* Dynamic Character Feedback */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 transform scale-75 opacity-50">
            <LoginCharacter state={characterState} />
        </div>
      </motion.div>

      {/* RIGHT: Authentication Portal */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 md:p-16 z-10 overflow-y-auto custom-scrollbar">
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md space-y-10"
        >
            <div className="space-y-2">
                <h1 className="text-4xl font-black tracking-tight uppercase">
                    {mode === 'LOGIN' ? 'Initiate' : 'Establish'} <span className="text-primary">Uplink</span>
                </h1>
                <p className="text-muted-foreground font-medium">
                    {mode === 'LOGIN' ? 'Synchronize your medical identity' : 'Create a new decentralized health node'}
                </p>
            </div>

            {/* Role Selection Tabs */}
            <div className="p-1.5 glass rounded-[24px] flex relative">
                {(['PATIENT', 'DOCTOR', 'ADMIN'] as RoleType[]).map((r) => {
                    const Config = ROLE_CONFIG[r];
                    return (
                        <button
                            key={r}
                            onClick={() => switchRole(r)}
                            className={cn(
                                "flex-1 py-3.5 rounded-2xl flex flex-col items-center gap-2 transition-all relative z-10",
                                role === r ? "text-primary" : "text-muted-foreground hover:text-white"
                            )}
                        >
                            <Config.icon size={18} className={cn("transition-transform", role === r && "scale-110")} />
                            <span className="text-[10px] font-black uppercase tracking-widest">{Config.label}</span>
                            {role === r && (
                                <motion.div 
                                    layoutId="active-role" 
                                    className={cn("absolute inset-0 bg-primary/10 border border-primary/20 rounded-2xl -z-10", Config.glow)} 
                                />
                            )}
                        </button>
                    );
                })}
            </div>

            <GlassCard className="p-8 border-white/5 space-y-6">
                <form onSubmit={mode === 'LOGIN' ? handleLogin : handleRegister} className="space-y-6">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={mode + role}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-5"
                        >
                            {mode === 'LOGIN' ? (
                                <>
                                    <NeonInput 
                                        label="Clinical Email" 
                                        type="email" 
                                        value={email} 
                                        onChange={(e) => setEmail(e.target.value)}
                                        icon={<Mail size={18} />}
                                        placeholder="node@carexai.nexus"
                                        onFocus={() => setCharacterState('WATCHING')}
                                        onBlur={() => setCharacterState('IDLE')}
                                    />
                                    <div className="relative">
                                        <NeonInput 
                                            label="Neural Key" 
                                            type={showPassword ? "text" : "password"} 
                                            value={password} 
                                            onChange={(e) => setPassword(e.target.value)}
                                            icon={<Lock size={18} />}
                                            placeholder="••••••••"
                                            onFocus={() => setCharacterState('HIDING')}
                                            onBlur={() => setCharacterState('IDLE')}
                                            className="pr-12"
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-[42px] text-muted-foreground hover:text-primary transition-colors"
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    {role === 'PATIENT' ? (
                                        <>
                                            <NeonInput label="Full Identity" value={regName} onChange={(e) => setRegName(e.target.value)} icon={<UserIcon size={18} />} placeholder="Enter legal name" />
                                            <div className="grid grid-cols-2 gap-4">
                                                <NeonInput label="Age" type="number" value={regAge} onChange={(e) => setRegAge(e.target.value)} icon={<Activity size={18} />} placeholder="Years" />
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-muted-foreground">Biology</label>
                                                    <select 
                                                        className="w-full h-12 rounded-xl bg-input/50 border border-border px-4 text-sm font-medium outline-none focus:border-primary/40 transition-all"
                                                        value={regGender}
                                                        onChange={(e) => setRegGender(e.target.value as any)}
                                                    >
                                                        <option value="Male">Male</option>
                                                        <option value="Female">Female</option>
                                                        <option value="Other">Other</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <NeonInput label="Contact Node" type="email" value={email} onChange={(e) => setEmail(e.target.value)} icon={<Mail size={18} />} placeholder="email@nexus.com" />
                                            <NeonInput label="Neural Passphrase" type="password" value={password} onChange={(e) => setPassword(e.target.value)} icon={<Lock size={18} />} placeholder="Create secure key" />
                                        </>
                                    ) : (
                                        <>
                                            <NeonInput label="Clinical Name (Dr.)" value={docName} onChange={(e) => setDocName(e.target.value)} icon={<Stethoscope size={18} />} placeholder="Dr. Full Name" />
                                            <NeonInput label="Specialization" value={docSpec} onChange={(e) => setDocSpec(e.target.value)} icon={<Brain size={18} />} placeholder="e.g. Cardiology" />
                                            <NeonInput label="Registry ID" value={docRegNo} onChange={(e) => setDocRegNo(e.target.value)} icon={<ShieldCheck size={18} />} placeholder="Medical License #" />
                                            <NeonInput label="Node Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} icon={<Mail size={18} />} placeholder="doctor@clinic.nexus" />
                                            <NeonInput label="Passphrase" type="password" value={password} onChange={(e) => setPassword(e.target.value)} icon={<Lock size={18} />} placeholder="Access key" />
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-muted-foreground">Credentials (PDF/JPG)</label>
                                                <div className="h-24 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-primary/40 transition-all cursor-pointer relative group overflow-hidden">
                                                    <input 
                                                        type="file" 
                                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                                        onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                                                    />
                                                    <ShieldCheck size={24} className="text-muted-foreground group-hover:text-primary transition-colors" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-white">
                                                        {docFile ? docFile.name : 'Upload Credentials'}
                                                    </span>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {error && (
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold flex items-center gap-3">
                            <ShieldCheck size={16} /> {error}
                        </motion.div>
                    )}

                    <NeonButton 
                        type="submit" 
                        disabled={loading} 
                        className="w-full h-14 text-sm uppercase tracking-[0.2em] font-black group"
                    >
                        {loading ? (
                            <div className="h-5 w-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                        ) : (
                            <>
                                {mode === 'LOGIN' ? 'Establish Uplink' : 'Initialize Node'}
                                <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </NeonButton>
                </form>

                {role !== 'ADMIN' && (
                    <div className="text-center pt-4 border-t border-white/5">
                        <button 
                            onClick={() => setMode(mode === 'LOGIN' ? 'REGISTER' : 'LOGIN')}
                            className="text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
                        >
                            {mode === 'LOGIN' ? "Establish new node" : "Access existing uplink"}
                        </button>
                    </div>
                )}
            </GlassCard>

            <div className="text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/30">
                    Neural Node identity verified by CareXAI Protocol v2.6.4
                </p>
            </div>
        </motion.div>
      </div>
    </div>
  );
};
