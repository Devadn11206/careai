import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '../components/ui/Button';
import { HoloBackdrop3D } from '../components/visuals/HoloBackdrop3D';

const BeatingHeart3D = React.lazy(() => import('../components/visuals/BeatingHeart3D'));

interface LandingPageProps {
  onSignIn: () => void;
}

// Particle canvas for hero background
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

// Animated mini stat card
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

// Feature card
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
      className="group relative rounded-[2.5rem] p-8 overflow-hidden cursor-default glass-card"
      style={{
        borderColor: `${color}20`,
      }}
    >
      {/* Background gradient on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(circle at top left, ${color}10, transparent 60%)` }}
      />

      {/* Index badge */}
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

      <h3 className="text-xl font-black font-display mb-3 text-[var(--text-main)] group-hover:premium-gradient-text transition-all">
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-[var(--text-muted)] font-medium">
        {desc}
      </p>

      {/* Hover glow line */}
      <div 
        className="absolute bottom-0 left-0 h-1 w-0 group-hover:w-full transition-all duration-700"
        style={{ background: `linear-gradient(to right, ${color}, transparent)` }}
      />
    </motion.div>
  );
};

// Section wrapper
const Section: React.FC<{ id?: string; eyebrow: string; title: string; subtitle: string; children: React.ReactNode; light?: boolean }> = ({ id, eyebrow, title, subtitle, children, light }) => (
  <motion.section
    id={id}
    initial={{ opacity: 0, y: 18 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.15 }}
    transition={{ duration: 0.6, ease: 'easeOut' }}
    className="mx-auto max-w-7xl px-6 md:px-10"
  >
    <div className="mb-10">
      <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] mb-4"
        style={{
          background: light ? 'rgba(0,212,255,0.1)' : 'rgba(0,212,255,0.08)',
          border: '1px solid var(--primary-low)',
          color: 'var(--primary)',
        }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#00FFB3', boxShadow: '0 0 6px rgba(0,255,179,0.8)' }} />
        {eyebrow}
      </div>
      <h2
        className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white mb-3"
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      >{title}</h2>
      <p className="max-w-2xl text-base md:text-lg leading-relaxed text-slate-600 dark:text-slate-400">{subtitle}</p>
    </div>
    {children}
  </motion.section>
);

// ─── 3D Tilt Service Card ───────────────────────────────────────────────────
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
      <div ref={ref} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} className="tilt-card h-full rounded-2xl p-6 cursor-default group relative overflow-hidden"
        style={{ background: 'rgba(5,10,20,0.7)', border: `1px solid ${service.color}25`, backdropFilter: 'blur(20px)', transition: 'transform 0.15s ease-out, box-shadow 0.3s ease' }}>
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
          style={{ background: `radial-gradient(circle at 30% 30%, ${service.color}12, transparent 60%)` }} />
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-5 animate-float"
          style={{ background: `${service.color}15`, border: `1px solid ${service.color}35`, boxShadow: `0 0 20px ${service.color}20` }}>
          {service.icon}
        </div>
        <h3 className="text-lg font-bold text-white mb-2" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>{service.label}</h3>
        <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{service.desc}</p>
        <div className="absolute bottom-0 left-0 h-0.5 w-0 group-hover:w-full transition-all duration-500 rounded-full"
          style={{ background: `linear-gradient(90deg, transparent, ${service.color}, transparent)` }} />
      </div>
    </motion.div>
  );
};

// ─── Stats Counter ──────────────────────────────────────────────────────────
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
    <div ref={ref} className="text-5xl md:text-6xl font-bold" style={{ fontFamily: "'Space Grotesk',sans-serif", color, textShadow: `0 0 30px ${color}60` }}>
      {target < 100 ? count.toFixed(target % 1 !== 0 ? 1 : 0) : Math.floor(count).toLocaleString()}{suffix}
    </div>
  );
};

// ─── Doctor Flip Card ───────────────────────────────────────────────────────
const DOCTORS = [
  { name: 'Dr. Ananya Sharma', spec: 'Cardiologist', exp: '12 yrs', rating: 4.9, color: '#FF6B9D', bio: 'Board-certified cardiologist specialising in interventional procedures and heart failure management.' },
  { name: 'Dr. Rohan Mehta', spec: 'Neurologist', exp: '9 yrs', rating: 4.8, color: '#7B61FF', bio: 'Expert in epilepsy, stroke recovery, and cognitive neuroscience with clinical AI research background.' },
  { name: 'Dr. Priya Nair', spec: 'Oncologist', exp: '15 yrs', rating: 5.0, color: '#00F5D4', bio: 'Leading oncologist in precision medicine and early-detection protocols using multi-modal biomarkers.' },
  { name: 'Dr. Vikram Das', spec: 'Pediatrician', exp: '8 yrs', rating: 4.9, color: '#00CFFF', bio: 'Child health specialist focused on developmental wellness, vaccination, and telemedicine care.' },
];

const DoctorFlipCard: React.FC<{ doc: typeof DOCTORS[0]; delay: number; onBook: () => void }> = ({ doc, delay, onBook }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay }} className="flip-card h-64">
    <div className="flip-card-inner rounded-2xl">
      {/* FRONT */}
      <div className="flip-card-front rounded-2xl p-6 flex flex-col items-center justify-center text-center"
        style={{ background: 'rgba(5,10,20,0.85)', border: `1px solid ${doc.color}25`, backdropFilter: 'blur(20px)' }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold mb-4"
          style={{ background: `${doc.color}20`, border: `1px solid ${doc.color}40`, color: doc.color, boxShadow: `0 0 20px ${doc.color}30`, fontFamily: "'Space Grotesk',sans-serif" }}>
          {doc.name.charAt(3)}
        </div>
        <h3 className="text-base font-bold text-white mb-1" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>{doc.name}</h3>
        <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: doc.color }}>{doc.spec}</p>
        <div className="flex items-center gap-1.5">
          <span style={{ color: doc.color }}>★</span>
          <span className="text-sm font-bold text-white">{doc.rating}</span>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>· {doc.exp}</span>
        </div>
        <p className="text-[10px] mt-3" style={{ color: 'rgba(255,255,255,0.3)' }}>Hover to learn more</p>
      </div>
      {/* BACK */}
      <div className="flip-card-back rounded-2xl p-6 flex flex-col justify-between"
        style={{ background: `linear-gradient(135deg, ${doc.color}18, rgba(5,10,20,0.95))`, border: `1px solid ${doc.color}40`, backdropFilter: 'blur(20px)' }}>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: doc.color }}>{doc.spec}</p>
          <h3 className="text-base font-bold text-white mb-3" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>{doc.name}</h3>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>{doc.bio}</p>
        </div>
        <button onClick={onBook} className="mt-4 w-full py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105"
          style={{ background: `linear-gradient(135deg, ${doc.color}, ${doc.color}99)`, color: '#050A1F', boxShadow: `0 0 20px ${doc.color}40` }}>
          Book Consultation
        </button>
      </div>
    </div>
  </motion.div>
);

// ─── Testimonials ───────────────────────────────────────────────────────────
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
        className="rounded-3xl p-8 md:p-10 relative overflow-hidden"
        style={{ background: 'rgba(5,10,20,0.7)', border: `1px solid ${t.color}25`, backdropFilter: 'blur(24px)', boxShadow: `0 0 40px ${t.color}10` }}>
        <div className="absolute top-6 left-8 text-7xl font-serif leading-none pointer-events-none select-none" style={{ color: `${t.color}25` }}>"</div>
        <div className="relative z-10">
          <p className="text-lg md:text-xl leading-relaxed text-white mb-8 italic" style={{ fontFamily: "'DM Sans',sans-serif" }}>{t.quote}</p>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
              style={{ background: `${t.color}20`, border: `1px solid ${t.color}40`, color: t.color }}>
              {t.name.charAt(0)}
            </div>
            <div>
              <p className="font-bold text-white text-sm" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>{t.name}</p>
              <p className="text-xs" style={{ color: t.color }}>{t.condition}</p>
            </div>
          </div>
        </div>
      </motion.div>
      <div className="flex justify-center gap-2 mt-6">
        {TESTIMONIALS.map((_, i) => (
          <button key={i} onClick={() => setIdx(i)} className="w-2 h-2 rounded-full transition-all duration-300"
            style={{ background: i === idx ? t.color : 'rgba(255,255,255,0.2)', boxShadow: i === idx ? `0 0 8px ${t.color}` : 'none', transform: i === idx ? 'scale(1.4)' : 'scale(1)' }} />
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
    }, 1100);

    return () => window.clearTimeout(idleTimer);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const features = [
    { icon: '💬', title: 'Real-time patient–doctor communication', desc: 'Secure chat and consultation-ready messaging to keep care teams aligned.' },
    { icon: '🧠', title: 'AI-powered health risk prediction', desc: 'Risk insights from reports and health data to support earlier intervention.' },
    { icon: '🔐', title: 'Secure clinical decision support', desc: 'Summaries, alerts, and trends presented with clarity—not noise.' },
    { icon: '📅', title: 'Smart appointment & consultation workflows', desc: 'Booking, queue visibility, and guided steps for patients and clinicians.' },
    { icon: '📊', title: 'Live vitals & health trend monitoring', desc: 'Vitals charts and history tracking for better follow-ups and continuity of care.' },
  ];

  return (
    <div className="relative overflow-x-hidden bg-slate-50 dark:bg-space-950" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(0,212,255,0.12),transparent_26%),radial-gradient(circle_at_78%_15%,rgba(0,255,179,0.12),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(123,97,255,0.09),transparent_28%)]" />

      {/* ========== NAVBAR ========== */}
      <div className="relative z-20 mx-auto max-w-7xl px-6 md:px-10 pt-6">
        <div
          className="glass-shell flex items-center justify-between rounded-[28px] px-5 py-3.5 shadow-[0_24px_80px_rgba(0,0,0,0.2)]"
        >
          <button onClick={() => scrollTo('top')} className="flex items-center gap-3" aria-label="CareXAI Home">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-base"
              style={{
                background: 'linear-gradient(135deg, #00D4FF, #00FFB3)',
                color: '#050A14',
                boxShadow: '0 0 15px rgba(0,212,255,0.4)',
              }}
            >C</div>
            <span className="text-lg font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              CareX<span style={{ color: '#00D4FF', textShadow: '0 0 10px rgba(0,212,255,0.6)' }}>AI</span>
            </span>
          </button>

          <div className="hidden md:flex items-center gap-1">
            {[{ id: 'features', label: 'Features' }, { id: 'workflow', label: 'Workflow' }, { id: 'trust', label: 'Trust' }].map(l => (
              <button
                key={l.id}
                onClick={() => scrollTo(l.id)}
                className="px-3 py-2 rounded-xl text-sm font-semibold transition-all text-slate-400 hover:text-white hover:bg-white/5"
              >{l.label}</button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="cyber" size="sm" onClick={onSignIn} className="rounded-xl">
              Sign in
            </Button>
            <motion.button
              onClick={() => scrollTo('cta')}
              whileHover={reduceMotion ? undefined : { scale: 1.04, y: -1 }}
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              className="relative overflow-hidden rounded-xl px-4 py-2 text-sm font-bold shimmer-btn"
              style={{
                background: 'linear-gradient(135deg, #00D4FF 0%, #00FFB3 100%)',
                color: '#050A14',
                boxShadow: '0 0 20px rgba(0,212,255,0.4)',
              }}
            >
              <span className="relative z-10">Get started</span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* ========== HERO ========== */}
      <div id="top" className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background elements */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
          {/* Centered Small 3D Object for performance and aesthetics */}
          <div className="relative w-full max-w-[800px] aspect-square opacity-60 mix-blend-screen scale-150 md:scale-125">
            <HoloBackdrop3D intensity={0.9} />
          </div>
          <div className="absolute inset-0 grid-dot-bg-animated opacity-24 dark:opacity-70" />
          <div className="absolute top-24 -left-32 w-[30rem] h-[30rem] rounded-full blur-[120px] opacity-30 aurora-drift" style={{ background: 'rgba(0,212,255,0.14)' }} />
          <div className="absolute bottom-16 -right-24 w-[28rem] h-[28rem] rounded-full blur-[120px] opacity-25 aurora-drift" style={{ background: 'rgba(0,255,179,0.12)', animationDelay: '-4s' }} />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-10 pt-32 pb-24 w-full">
          <div className="flex flex-col items-center justify-center max-w-4xl mx-auto text-center">

            {/* Hero text */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center"
            >
              {/* Eyebrow badge */}
              <div
                className="inline-flex items-center gap-3 rounded-full px-5 py-2 text-[10px] font-black uppercase tracking-[0.25em] mb-8 glass-card border-none bg-white/5"
                style={{ color: 'var(--accent-primary)', backdropFilter: 'blur(12px)', boxShadow: '0 0 20px rgba(0,212,255,0.1)' }}
              >
                <motion.span
                  animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="h-2 w-2 rounded-full"
                  style={{ background: 'var(--accent-secondary)', boxShadow: '0 0 10px var(--accent-secondary)' }}
                />
                Quantum Medical Intelligence
              </div>

              <h1
                className="text-6xl md:text-8xl font-black tracking-tighter text-white leading-[0.9] mb-8 font-orbitron"
              >
                CARE<span className="premium-gradient-text italic">XAI</span>
              </h1>

              <p className="text-lg md:text-xl text-slate-400 font-medium leading-relaxed max-w-2xl mx-auto mb-10">
                The next evolution of healthcare. Real-time clinical insights, predictive risk modeling, and seamless care coordination in one autonomous ecosystem.
              </p>

              <div className="flex flex-col sm:flex-row gap-5 mb-12 justify-center w-full px-6">
                <motion.button
                  onClick={() => scrollTo('cta')}
                  whileHover={{ y: -4, scale: 1.05, boxShadow: '0 0 40px rgba(0,212,255,0.5)' }}
                  whileTap={{ scale: 0.98 }}
                  className="btn-primary px-10 py-5 text-base"
                >
                  <span className="relative z-10">Initialize System</span>
                </motion.button>
                <Button variant="cyber" size="lg" onClick={onSignIn} className="rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 px-10 py-5 font-bold">
                  Access Portal →
                </Button>
              </div>

              {/* Live telemetry simulation */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl mx-auto">
                <StatCard label="Neural Latency" value="14ms" color="var(--accent-primary)" delay={0.4} />
                <StatCard label="Data Integrity" value="99.99%" color="var(--accent-secondary)" delay={0.5} />
                <StatCard label="Active Nodes" value="2.4k" color="var(--accent-indigo)" delay={0.6} />
              </div>
            </motion.div>



          </div>
        </div>
      </div>

      {/* ========== FEATURES ========== */}
      <div className="py-20" style={{ background: 'linear-gradient(180deg, transparent, rgba(0,212,255,0.03), transparent)' }}>
        <Section
          id="features"
          eyebrow="Key Highlights"
          title="Everything you need in one care ecosystem"
          subtitle="Appointments, clinical insights, risk prediction, and secure communication—designed to stay calm and reliable in real clinical environments."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <FeatureCard key={f.title} title={f.title} desc={f.desc} index={i} icon={f.icon} />
            ))}
          </div>
        </Section>
      </div>

      {/* ========== WORKFLOW ========== */}
      <div className="py-20">
        <Section
          id="workflow"
          eyebrow="How It Works"
          title="Simple workflows for patients, doctors, and admins"
          subtitle="A clear role-based experience keeps care delivery organized end-to-end."
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
            {/* Connecting line */}
            <div className="hidden lg:block absolute top-8 left-1/6 right-1/6 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.3), transparent)' }} />

            {[
              { title: 'Patients', emoji: '🏥', color: '#00D4FF', step: '01', items: ['Upload reports or enter health data', 'Get AI risk insights', 'Book consultation and communicate with doctors'] },
              { title: 'Doctors', emoji: '🩺', color: '#00FFB3', step: '02', items: ['View patient history and trends', 'Access clinical alerts and summaries', 'Conduct secure consultations'] },
              { title: 'Admins', emoji: '🛡️', color: '#FF006E', step: '03', items: ['Doctor verification', 'Platform monitoring', 'System analytics'] },
            ].map((col, i) => (
              <motion.div
                key={col.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: i * 0.12 }}
                whileHover={useReducedMotion() ? undefined : { y: -6 }}
                className="relative rounded-2xl p-6 overflow-hidden"
                style={{
                  background: 'rgba(5,10,20,0.6)',
                  border: `1px solid ${col.color}20`,
                  backdropFilter: 'blur(16px)',
                }}
              >
                <div className="absolute top-4 right-4 text-4xl font-bold opacity-[0.07]" style={{ fontFamily: "'Space Grotesk', sans-serif", color: col.color }}>
                  {col.step}
                </div>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4" style={{ background: `${col.color}15`, border: `1px solid ${col.color}30` }}>
                  {col.emoji}
                </div>
                <h3 className="text-base font-bold text-white mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{col.title}</h3>
                <div className="space-y-3">
                  {col.items.map(it => (
                    <motion.div key={it} className="flex items-start gap-3"
                      initial={{ opacity: 0, x: -8 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: col.color, boxShadow: `0 0 6px ${col.color}` }} />
                      <div className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>{it}</div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </Section>
      </div>

      {/* ========== TRUST ========== */}
      <div className="py-20" style={{ background: 'linear-gradient(180deg, transparent, rgba(0,255,179,0.02), transparent)' }}>
        <Section
          id="trust"
          eyebrow="Trust & Security"
          title="Security and privacy designed for clinical environments"
          subtitle="Secure medical-grade data protection, role-based access control, and privacy-first healthcare workflows."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              { icon: '🛡️', title: 'Medical-grade protection', desc: 'Secure handling of sensitive data with strong defaults and consistent safeguards.', color: '#00D4FF' },
              { icon: '🔐', title: 'Role-based access control', desc: 'Clear separation of patient, doctor, and admin capabilities to reduce risk.', color: '#00FFB3' },
              { icon: '🔏', title: 'Privacy-first workflows', desc: 'Designed around consent, least-privilege access, and predictable clinical UX.', color: '#00D4FF' },
              { icon: '📋', title: 'Auditability & oversight', desc: 'Admin visibility for verification, monitoring, and system health analytics.', color: '#00FFB3' },
            ].map((t, idx) => (
              <motion.div
                key={t.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.5, delay: idx * 0.08 }}
                whileHover={{ y: -6 }}
                className="rounded-2xl p-6"
                style={{ background: 'rgba(5,10,20,0.6)', border: `1px solid ${t.color}15`, backdropFilter: 'blur(16px)' }}
              >
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 flex-shrink-0 rounded-xl flex items-center justify-center text-xl" style={{ background: `${t.color}10`, border: `1px solid ${t.color}25` }}>
                    {t.icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white mb-1.5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{t.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{t.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </Section>
      </div>

      {renderDeferredSections ? (
        <>
          {/* ========== SERVICES GRID ========== */}
          <div className="py-24" style={{ background: 'linear-gradient(180deg, transparent, rgba(0,245,212,0.03), transparent)' }}>
            <div className="mx-auto max-w-7xl px-6 md:px-10">
              <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="mb-12">
                <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] mb-4" style={{ background: 'rgba(0,245,212,0.08)', border: '1px solid rgba(0,245,212,0.2)', color: '#00F5D4' }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#7B61FF', boxShadow: '0 0 6px rgba(123,97,255,0.8)' }} />
                  Medical Specialties
                </div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-3" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>World-class care, every specialty</h2>
                <p className="max-w-2xl text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>AI-enhanced consultations across cardiology, neurology, oncology, pediatrics, emergency, and telemedicine — all in one unified platform.</p>
              </motion.div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {SERVICES.map((s, i) => <TiltServiceCard key={s.label} service={s} delay={i * 0.08} />)}
              </div>
            </div>
          </div>

          {/* ========== STATS COUNTER ========== */}
          <div className="py-20 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
              <div className="orb-1 absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 rounded-full blur-[140px]" style={{ background: 'rgba(0,245,212,0.06)' }} />
              <div className="orb-2 absolute top-1/2 right-1/4 -translate-y-1/2 w-80 h-80 rounded-full blur-[120px]" style={{ background: 'rgba(123,97,255,0.05)' }} />
            </div>
            <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-10">
              <div className="rounded-3xl p-10 md:p-16" style={{ background: 'rgba(5,10,20,0.6)', border: '1px solid rgba(0,245,212,0.12)', backdropFilter: 'blur(20px)' }}>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-10 text-center">
                  {STATS.map((s) => (
                    <div key={s.label}>
                      <CounterNum target={s.value} suffix={s.suffix} color={s.color} />
                      <p className="mt-2 text-sm font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ========== DOCTORS ========== */}
          <div className="py-24">
            <div className="mx-auto max-w-7xl px-6 md:px-10">
              <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="mb-12">
                <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] mb-4" style={{ background: 'rgba(0,207,255,0.08)', border: '1px solid rgba(0,207,255,0.2)', color: '#00CFFF' }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#00F5D4', boxShadow: '0 0 6px rgba(0,245,212,0.8)' }} />
                  Our Specialists
                </div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-3" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Meet our expert doctors</h2>
                <p className="max-w-xl text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>Hover each card to discover their specialisation and book an instant consultation.</p>
              </motion.div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {DOCTORS.map((d, i) => <DoctorFlipCard key={d.name} doc={d} delay={i * 0.1} onBook={onSignIn} />)}
              </div>
            </div>
          </div>

          {/* ========== TESTIMONIALS ========== */}
          <div className="py-24" style={{ background: 'linear-gradient(180deg, transparent, rgba(123,97,255,0.03), transparent)' }}>
            <div className="mx-auto max-w-4xl px-6 md:px-10">
              <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="mb-12 text-center">
                <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] mb-4" style={{ background: 'rgba(123,97,255,0.08)', border: '1px solid rgba(123,97,255,0.2)', color: '#7B61FF' }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#FF6B9D', boxShadow: '0 0 6px rgba(255,107,157,0.8)' }} />
                  Patient Stories
                </div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-3" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Lives changed by CareXAI</h2>
                <p className="text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>Real stories from patients and doctors who've experienced the future of healthcare.</p>
              </motion.div>
              <TestimonialsCarousel />
            </div>
          </div>
        </>
      ) : (
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-16">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Loading Extended Experience</p>
          </div>
        </div>
      )}

      {/* ========== CTA ========== */}
      <div id="cta" className="relative py-24">
        <div className="mx-auto max-w-7xl px-6 md:px-10">
          <div
            className="relative rounded-[32px] p-10 md:p-14 overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(0,212,255,0.1) 0%, rgba(0,255,179,0.05) 50%, rgba(5,10,20,0.9) 100%)',
              border: '1px solid rgba(0,212,255,0.2)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 0 60px rgba(0,212,255,0.1), 0 40px 80px rgba(0,0,0,0.3)',
            }}
          >
            {/* Ambient glow */}
            <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full blur-[80px] pointer-events-none" style={{ background: 'rgba(0,212,255,0.12)' }} />
            <div className="absolute -bottom-24 -right-24 w-64 h-64 rounded-full blur-[80px] pointer-events-none" style={{ background: 'rgba(0,255,179,0.08)' }} />

            {/* Corner accents */}
            <div className="absolute top-5 left-5 w-6 h-6 border-t-2 border-l-2" style={{ borderColor: 'rgba(0,212,255,0.4)' }} />
            <div className="absolute top-5 right-5 w-6 h-6 border-t-2 border-r-2" style={{ borderColor: 'rgba(0,212,255,0.4)' }} />
            <div className="absolute bottom-5 left-5 w-6 h-6 border-b-2 border-l-2" style={{ borderColor: 'rgba(0,212,255,0.4)' }} />
            <div className="absolute bottom-5 right-5 w-6 h-6 border-b-2 border-r-2" style={{ borderColor: 'rgba(0,212,255,0.4)' }} />

            <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] mb-4" style={{ color: 'rgba(0,212,255,0.6)' }}>
                  Start Today
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  Start your AI-driven healthcare journey today
                </h2>
                <p className="text-base leading-relaxed max-w-lg" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  Create a secure account to upload reports, get AI risk insights, and connect with clinicians in a privacy-first workflow.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 lg:justify-end">
                <Button variant="cyber" size="lg" className="rounded-2xl" onClick={onSignIn}>
                  Upload Health Report
                </Button>
                <motion.button
                  onClick={onSignIn}
                  whileHover={reduceMotion ? undefined : { y: -3, scale: 1.03 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                  className="relative overflow-hidden rounded-2xl px-8 py-4 text-base font-bold shimmer-btn"
                  style={{
                    background: 'linear-gradient(135deg, #00D4FF 0%, #00FFB3 100%)',
                    color: '#050A14',
                    boxShadow: '0 0 30px rgba(0,212,255,0.5)',
                  }}
                >
                  <span className="relative z-10">Get Started</span>
                </motion.button>
              </div>
            </div>

            <div className="relative mt-8 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              By continuing, you agree to the platform terms. CareXAI provides decision support and does not replace professional medical diagnosis.
            </div>
          </div>

          <div className="mt-10 text-center text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
            © 2026 CareXAI — Built for clear, trustworthy care.
          </div>
        </div>
      </div>
    </div>
  );
};
