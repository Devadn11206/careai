import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '../components/ui/Button';
import { HoloBackdrop3D } from '../components/visuals/HoloBackdrop3D';

const BeatingHeart3D = React.lazy(() => import('../components/visuals/BeatingHeart3D'));

interface LandingPageProps {
  onSignIn: () => void;
}

const HeroParticles: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId: number;
    const pts: { x: number; y: number; vx: number; vy: number; r: number; c: string }[] = [];
    const COLS = ['var(--primary)', 'var(--secondary)', 'var(--accent)'];
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);
    for (let i = 0; i < 50; i++) {
      pts.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, vx: (Math.random() - .5) * .3, vy: (Math.random() - .5) * .3, r: Math.random() * 1.5 + .5, c: COLS[Math.floor(Math.random() * 3)] });
    }
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.c + '66'; ctx.fill();
      });
      pts.forEach((a, i) => pts.slice(i + 1).forEach(b => {
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 100) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.strokeStyle = `rgba(0,212,255,${(1 - d / 100) * .2})`; ctx.lineWidth = .5; ctx.stroke(); }
      }));
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ opacity: .6 }} />;
};

const StatCard: React.FC<{ label: string; value: string; color: string; delay?: number }> = ({ label, value, color, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay, duration: 0.5, type: 'spring', stiffness: 200 }}
    className="rounded-2xl px-4 py-3 text-center glass-card"
    style={{ borderColor: `${color}40` }}
  >
    <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-1 opacity-60" style={{ color }}>{label}</p>
    <p className="text-base font-black font-display" style={{ color }}>{value}</p>
  </motion.div>
);

const FeatureCard: React.FC<{ title: string; desc: string; index: number; icon: string }> = ({ title, desc, index, icon }) => {
  const reduceMotion = useReducedMotion();
  const color = `var(--accent-${index % 2 === 0 ? 'primary' : 'secondary'})`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      whileHover={reduceMotion ? undefined : { y: -8, scale: 1.02 }}
      className="group relative rounded-[2.5rem] p-8 overflow-hidden cursor-default glass-card border border-white/5"
      style={{ borderColor: `${color}20` }}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(circle at top left, ${color}10, transparent 60%)` }}
      />

      <div className="flex items-start justify-between gap-4 mb-6">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 bg-white/5 border border-white/10 shadow-lg"
          style={{ borderColor: `${color}40`, color }}
        >
          {icon}
        </div>
        <span
          className="text-[10px] font-black uppercase tracking-[0.3em] opacity-20"
          style={{ color }}
        >
          SEC-0{index + 1}
        </span>
      </div>

      <h3 className="text-xl font-black font-display mb-3 text-white group-hover:premium-gradient-text transition-all">
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-muted-foreground font-medium">
        {desc}
      </p>

      <div 
        className="absolute bottom-0 left-0 h-1 w-0 group-hover:w-full transition-all duration-700"
        style={{ background: `linear-gradient(to right, ${color}, transparent)` }}
      />
    </motion.div>
  );
};

const Section: React.FC<{ id?: string; eyebrow: string; title: string; subtitle: string; children: React.ReactNode }> = ({ id, eyebrow, title, subtitle, children }) => (
  <motion.section
    id={id}
    initial={{ opacity: 0, y: 18 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.15 }}
    transition={{ duration: 0.6, ease: 'easeOut' }}
    className="mx-auto max-w-7xl px-6 md:px-10"
  >
    <div className="mb-10 text-center md:text-left">
      <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] mb-4 bg-primary/10 border border-primary/20 text-primary">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#10b981]" />
        {eyebrow}
      </div>
      <h2 className="text-3xl md:text-5xl font-black tracking-tighter text-white mb-4 uppercase font-display">{title}</h2>
      <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground font-medium">{subtitle}</p>
    </div>
    {children}
  </motion.section>
);

const SERVICES = [
  { icon: '🫀', label: 'Cardiology', desc: 'Heart rhythm analysis, ECG monitoring, and cardiac risk stratification powered by AI.', color: '#FF6B9D' },
  { icon: '🧠', label: 'Neurology', desc: 'Neural pattern detection and cognitive health tracking with precision diagnostics.', color: '#7B61FF' },
  { icon: '🎗️', label: 'Oncology', desc: 'Early-stage risk flags, treatment tracking, and multi-marker clinical summaries.', color: '#00F5D4' },
  { icon: '👶', label: 'Pediatrics', desc: 'Growth milestone monitoring and child-safe telehealth with parental dashboards.', color: '#00CFFF' },
  { icon: '🚨', label: 'Emergency', desc: '24/7 critical alert escalation with direct routing to available specialists.', color: '#FF6B9D' },
  { icon: '📡', label: 'Telemedicine', desc: 'HD video consultations, secure file sharing, and real-time patient vitals sync.', color: '#00F5D4' },
];

const TiltServiceCard: React.FC<{ service: typeof SERVICES[0]; delay: number }> = ({ service, delay }) => {
  const ref = useRef<HTMLDivElement>(null);
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * 18;
    const y = ((e.clientY - r.top) / r.height - 0.5) * -18;
    ref.current.style.transform = `perspective(1000px) rotateY(${x}deg) rotateX(${y}deg) scale(1.03)`;
  };
  const handleMouseLeave = () => { if (ref.current) ref.current.style.transform = 'perspective(1000px) rotateY(0deg) rotateX(0deg) scale(1)'; };
  return (
    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay }}>
      <div ref={ref} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} className="h-full rounded-[2rem] p-8 cursor-default group relative overflow-hidden bg-white/5 border border-white/5 backdrop-blur-2xl transition-all duration-300">
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{ background: `radial-gradient(circle at 30% 30%, ${service.color}12, transparent 60%)` }} />
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-6 shadow-2xl"
          style={{ background: `${service.color}15`, border: `1px solid ${service.color}35`, boxShadow: `0 0 20px ${service.color}20` }}>
          {service.icon}
        </div>
        <h3 className="text-2xl font-black text-white mb-3 uppercase tracking-tight">{service.label}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground font-medium">{service.desc}</p>
        <div className="absolute bottom-0 left-0 h-1 w-0 group-hover:w-full transition-all duration-700"
          style={{ background: `linear-gradient(90deg, transparent, ${service.color}, transparent)` }} />
      </div>
    </motion.div>
  );
};

const STATS = [
  { value: 50000, label: 'Patients Served', suffix: '+', color: '#00F5D4' },
  { value: 200, label: 'Verified Doctors', suffix: '+', color: '#00CFFF' },
  { value: 98, label: 'Satisfaction Rate', suffix: '%', color: '#7B61FF' },
  { value: 99.9, label: 'System Uptime', suffix: '%', color: '#FF6B9D' },
];

const CounterNum: React.FC<{ target: number; suffix: string; color: string }> = ({ target, suffix, color }) => {
  const [count, setCount] = React.useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        const dur = 2000; const steps = 60; const inc = target / steps;
        let cur = 0; let s = 0;
        const t = setInterval(() => { cur += inc; s++; setCount(Math.min(cur, target)); if (s >= steps) clearInterval(t); }, dur / steps);
      }
    }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target]);
  return (
    <div ref={ref} className="text-5xl md:text-7xl font-black tracking-tighter" style={{ color, textShadow: `0 0 40px ${color}40` }}>
      {target < 100 ? count.toFixed(target % 1 !== 0 ? 1 : 0) : Math.floor(count).toLocaleString()}{suffix}
    </div>
  );
};

const DOCTORS = [
  { name: 'Dr. Ananya Sharma', spec: 'Cardiologist', exp: '12 yrs', rating: 4.9, color: '#FF6B9D', bio: 'Board-certified cardiologist specialising in interventional procedures and heart failure management.' },
  { name: 'Dr. Rohan Mehta', spec: 'Neurologist', exp: '9 yrs', rating: 4.8, color: '#7B61FF', bio: 'Expert in epilepsy, stroke recovery, and cognitive neuroscience with clinical AI research background.' },
  { name: 'Dr. Priya Nair', spec: 'Oncologist', exp: '15 yrs', rating: 5.0, color: '#00F5D4', bio: 'Leading oncologist in precision medicine and early-detection protocols using multi-modal biomarkers.' },
  { name: 'Dr. Vikram Das', spec: 'Pediatrician', exp: '8 yrs', rating: 4.9, color: '#00CFFF', bio: 'Child health specialist focused on developmental wellness, vaccination, and telemedicine care.' },
];

const DoctorFlipCard: React.FC<{ doc: typeof DOCTORS[0]; delay: number; onBook: () => void }> = ({ doc, delay, onBook }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay }} className="group h-[340px] perspective-1000">
    <div className="relative w-full h-full transition-all duration-700 preserve-3d group-hover:rotate-y-180">
      {/* FRONT */}
      <div className="absolute inset-0 backface-hidden rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center bg-white/5 border border-white/10 backdrop-blur-3xl shadow-2xl">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-3xl font-black mb-6"
          style={{ background: `${doc.color}20`, border: `1px solid ${doc.color}40`, color: doc.color, boxShadow: `0 0 30px ${doc.color}30` }}>
          {doc.name.charAt(3)}
        </div>
        <h3 className="text-xl font-black text-white mb-2">{doc.name}</h3>
        <p className="text-xs font-black uppercase tracking-[0.2em] mb-4" style={{ color: doc.color }}>{doc.spec}</p>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
          <span style={{ color: doc.color }}>★</span>
          <span className="text-sm font-black text-white">{doc.rating}</span>
          <span className="text-[10px] font-medium opacity-40 uppercase tracking-widest">· {doc.exp}</span>
        </div>
      </div>
      {/* BACK */}
      <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-[2.5rem] p-8 flex flex-col justify-between bg-gradient-to-br from-white/10 to-transparent border border-white/20 backdrop-blur-3xl">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] mb-3" style={{ color: doc.color }}>{doc.spec} Clinical Profile</p>
          <h3 className="text-xl font-black text-white mb-4 leading-tight">{doc.name}</h3>
          <p className="text-sm leading-relaxed text-slate-300 font-medium">{doc.bio}</p>
        </div>
        <button onClick={onBook} className="w-full py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all hover:scale-105 shadow-2xl"
          style={{ background: `linear-gradient(135deg, ${doc.color}, ${doc.color}99)`, color: '#03050a' }}>
          Initialize Booking
        </button>
      </div>
    </div>
  </motion.div>
);

const TESTIMONIALS = [
  { name: 'Meera K.', condition: 'Cardiac Patient', quote: 'CareXAI caught an irregular heartbeat pattern two weeks before my scheduled check-up. The AI alert saved my life.', color: '#FF6B9D' },
  { name: 'Arun S.', condition: 'Diabetes Management', quote: 'My glucose trends are finally under control. The AI insights helped me adjust my diet without needing a constant clinic visit.', color: '#00F5D4' },
  { name: 'Dr. Leela R.', condition: 'Neurologist', quote: 'The consultation summaries and real-time patient data have cut my pre-consultation prep time by 70%. Remarkable platform.', color: '#7B61FF' },
  { name: 'Pradeep M.', condition: 'Post-Surgery Recovery', quote: 'Being able to video-call my surgeon from home during recovery, with my vitals automatically shared, was extraordinary.', color: '#00CFFF' },
];

const TestimonialsCarousel: React.FC = () => {
  const [idx, setIdx] = React.useState(0);
  useEffect(() => { const t = setInterval(() => setIdx(i => (i + 1) % TESTIMONIALS.length), 4000); return () => clearInterval(t); }, []);
  const t = TESTIMONIALS[idx];
  return (
    <div className="relative">
      <motion.div key={idx} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
        className="rounded-[3rem] p-12 md:p-16 relative overflow-hidden bg-white/5 border border-white/10 backdrop-blur-3xl shadow-glow-primary/5">
        <div className="absolute top-10 left-10 text-9xl font-serif leading-none opacity-10 pointer-events-none select-none" style={{ color: t.color }}>"</div>
        <div className="relative z-10">
          <p className="text-xl md:text-3xl leading-snug text-white mb-12 font-medium tracking-tight italic">"{t.quote}"</p>
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center text-2xl font-black"
              style={{ background: `${t.color}20`, border: `1px solid ${t.color}40`, color: t.color }}>
              {t.name.charAt(0)}
            </div>
            <div>
              <p className="font-black text-white text-lg uppercase tracking-tight">{t.name}</p>
              <p className="text-xs font-black uppercase tracking-[0.2em] mt-1" style={{ color: t.color }}>{t.condition}</p>
            </div>
          </div>
        </div>
      </motion.div>
      <div className="flex justify-center gap-3 mt-10">
        {TESTIMONIALS.map((_, i) => (
          <button key={i} onClick={() => setIdx(i)} className="w-3 h-3 rounded-full transition-all duration-500"
            style={{ background: i === idx ? t.color : 'rgba(255,255,255,0.1)', boxShadow: i === idx ? `0 0 15px ${t.color}` : 'none', transform: i === idx ? 'scale(1.5)' : 'scale(1)' }} />
        ))}
      </div>
    </div>
  );
};

export const LandingPage: React.FC<LandingPageProps> = ({ onSignIn }) => {
  const reduceMotion = useReducedMotion();
  const [renderDeferredSections, setRenderDeferredSections] = useState(false);

  useEffect(() => {
    const idleTimer = window.setTimeout(() => {
      setRenderDeferredSections(true);
    }, 800);
    return () => window.clearTimeout(idleTimer);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const features = [
    { icon: '💬', title: 'Neural Clinical Chat', desc: 'Secure, real-time consultation-ready messaging for autonomous care coordination.' },
    { icon: '🧠', title: 'Predictive Biometrics', desc: 'Advanced risk modeling using live telemetry to preempt clinical events.' },
    { icon: '🔐', title: 'Encrypted Health Vault', desc: 'Zero-trust architecture for global interoperability of sensitive medical data.' },
    { icon: '📅', title: 'Smart Node Scheduling', desc: 'Autonomous appointment routing with real-time specialist queue telemetry.' },
    { icon: '📊', title: 'Holographic Vitals Stream', desc: 'High-fidelity health trend monitoring with cinematic data visualization.' },
    { icon: '⚡', title: 'Emergency Protocol X', desc: 'Instant clinical escalation triggered by critical AI biometric flags.' },
  ];

  return (
    <div className="relative min-h-screen bg-background overflow-x-hidden selection:bg-primary/30">
      {/* Cinematic Background Atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,242,255,0.08),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(112,0,255,0.08),transparent_40%)]" />
        <div className="absolute inset-0 opacity-20 mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
        <motion.div animate={{ scale: [1, 1.2, 1], rotate: [0, 10, 0] }} transition={{ duration: 30, repeat: Infinity }} className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-primary/5 rounded-full blur-[150px]" />
        <motion.div animate={{ scale: [1, 1.3, 1], rotate: [0, -10, 0] }} transition={{ duration: 25, repeat: Infinity }} className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] bg-secondary/5 rounded-full blur-[150px]" />
      </div>

      {/* ========== NAVBAR ========== */}
      <nav className="relative z-50 mx-auto max-w-7xl px-6 md:px-10 pt-8">
        <div className="glass flex items-center justify-between rounded-[2.5rem] px-8 py-4 border border-white/5 shadow-2xl backdrop-blur-3xl">
          <button onClick={() => scrollTo('top')} className="flex items-center gap-4 group">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-xl bg-gradient-to-br from-primary to-secondary text-background shadow-glow-primary group-hover:scale-110 transition-transform">C</div>
            <span className="text-2xl font-black text-white tracking-tighter uppercase font-display">
              CareX<span className="text-primary">AI</span>
            </span>
          </button>

          <div className="hidden lg:flex items-center gap-2">
            {['Features', 'Workflow', 'Trust'].map(l => (
              <button
                key={l}
                onClick={() => scrollTo(l.toLowerCase())}
                className="px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground hover:text-white hover:bg-white/5 transition-all"
              >{l}</button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <button onClick={onSignIn} className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground hover:text-primary transition-colors px-4">Portal</button>
            <motion.button
              onClick={onSignIn}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-3.5 rounded-2xl bg-primary text-background font-black text-[10px] uppercase tracking-[0.2em] shadow-glow-primary"
            >
              Get Started
            </motion.button>
          </div>
        </div>
      </nav>

      {/* ========== HERO ========== */}
      <section id="top" className="relative min-h-screen flex items-center justify-center pt-20 pb-32">
        <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
           <HoloBackdrop3D intensity={0.6} />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-10 w-full">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }}>
              <div className="inline-flex items-center gap-3 rounded-full px-6 py-2.5 text-[10px] font-black uppercase tracking-[0.3em] mb-10 bg-white/5 border border-white/10 text-primary backdrop-blur-xl">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_#34d399]" />
                Nexus OS v2.8.4 Deployment Active
              </div>

              <h1 className="text-7xl md:text-[10rem] font-black tracking-tighter text-white leading-[0.8] mb-10 uppercase font-display">
                CAREX<span className="text-primary italic">AI</span>
              </h1>

              <p className="text-xl md:text-2xl text-muted-foreground font-medium leading-relaxed max-w-3xl mx-auto mb-16 px-4">
                The autonomous medical intelligence operating system. Real-time clinical telemetry, predictive risk modeling, and decentralized care synchronization.
              </p>

              <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                <motion.button
                  onClick={onSignIn}
                  whileHover={{ scale: 1.05, y: -5 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-12 py-6 rounded-3xl bg-primary text-background font-black text-xs uppercase tracking-[0.3em] shadow-glow-primary"
                >
                  Access Nexus Portal
                </motion.button>
                <motion.button
                  onClick={() => scrollTo('features')}
                  whileHover={{ scale: 1.05, bg: 'rgba(255,255,255,0.1)' }}
                  className="px-12 py-6 rounded-3xl border border-white/10 text-white font-black text-xs uppercase tracking-[0.3em] backdrop-blur-md"
                >
                  Explore Capabilities
                </motion.button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ========== FEATURES ========== */}
      <section id="features" className="py-32 relative">
        <div className="absolute inset-0 bg-primary/5 blur-[120px] rounded-full -left-1/4 top-1/4 w-[50%] h-[50%] pointer-events-none" />
        <Section
          eyebrow="Quantum Capabilities"
          title="Autonomous Intelligence Hub"
          subtitle="A unified care ecosystem processing 14.2M clinical data points daily with zero-latency synchronization."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <FeatureCard key={f.title} title={f.title} desc={f.desc} index={i} icon={f.icon} />
            ))}
          </div>
        </Section>
      </section>

      {renderDeferredSections && (
        <>
          {/* ========== SERVICES GRID ========== */}
          <section className="py-32 bg-white/[0.02]">
            <Section
              eyebrow="Clinical Specializations"
              title="Global Health Coverage"
              subtitle="Specialized AI engines for cardiology, neurology, and more—optimized for precision diagnostics."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {SERVICES.map((s, i) => <TiltServiceCard key={s.label} service={s} delay={i * 0.08} />)}
              </div>
            </Section>
          </section>

          {/* ========== STATS ========== */}
          <section className="py-32 px-6">
             <div className="mx-auto max-w-7xl rounded-[4rem] p-16 md:p-24 bg-white/5 border border-white/10 backdrop-blur-3xl relative overflow-hidden">
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/10 rounded-full blur-[100px]" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-16 text-center">
                  {STATS.map((s) => (
                    <div key={s.label} className="space-y-4">
                      <CounterNum target={s.value} suffix={s.suffix} color={s.color} />
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>
             </div>
          </section>

          {/* ========== DOCTORS ========== */}
          <section className="py-32">
            <Section
              eyebrow="Clinical Registry"
              title="Expert Medical Nodes"
              subtitle="Connect with board-certified specialists integrated directly into the CareXAI neural network."
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {DOCTORS.map((d, i) => <DoctorFlipCard key={d.name} doc={d} delay={i * 0.1} onBook={onSignIn} />)}
              </div>
            </Section>
          </section>

          {/* ========== TESTIMONIALS ========== */}
          <section className="py-32 bg-white/[0.02]">
            <div className="mx-auto max-w-5xl px-6">
              <div className="text-center mb-16">
                 <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.3em] mb-6 bg-secondary/10 border border-secondary/20 text-secondary">
                  Impact Metrics
                </div>
                <h2 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter mb-4">Patient Narratives</h2>
              </div>
              <TestimonialsCarousel />
            </div>
          </section>
        </>
      )}

      {/* ========== CTA ========== */}
      <section id="cta" className="py-32 px-6">
        <div className="mx-auto max-w-7xl rounded-[4rem] p-16 md:p-32 bg-gradient-to-br from-primary/20 via-background to-secondary/20 border border-white/10 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
          <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} className="relative z-10">
            <h2 className="text-5xl md:text-8xl font-black text-white uppercase tracking-tighter mb-10 leading-none">
              Establish Your<br />Health Node <span className="text-primary">Today</span>
            </h2>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-16 font-medium">
              Join the future of decentralized medical intelligence. Privacy-first, autonomous, and zero-compromise care.
            </p>
            <motion.button
              onClick={onSignIn}
              whileHover={{ scale: 1.1, rotate: -2 }}
              className="px-16 py-8 rounded-[2.5rem] bg-primary text-background font-black text-sm uppercase tracking-[0.4em] shadow-glow-primary"
            >
              Get Started Now
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="py-20 border-t border-white/5 text-center">
        <div className="flex flex-col items-center gap-8">
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center font-black text-xs text-background">C</div>
              <span className="text-lg font-black text-white tracking-widest uppercase">CareXAI</span>
           </div>
           <p className="text-[10px] font-black uppercase tracking-[0.5em] text-muted-foreground/30">
             © 2026 CareXAI Protocol · Neural Link v2.8.4 · Encryption AES-256-GCM
           </p>
        </div>
      </footer>
    </div>
  );
};
