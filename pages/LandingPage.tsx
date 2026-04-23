import React, { Suspense, useMemo, useRef, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '../components/ui/Button';

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
    const COLS = ['#00D4FF', '#00FFB3', '#7aeeff'];
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
    className="rounded-2xl px-4 py-3 text-center"
    style={{ background: `${color}10`, border: `1px solid ${color}30`, backdropFilter: 'blur(12px)' }}
  >
    <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: `${color}99` }}>{label}</p>
    <p className="text-base font-bold" style={{ color }}>{value}</p>
  </motion.div>
);

// Feature card
const FeatureCard: React.FC<{ title: string; desc: string; index: number; icon: string }> = ({ title, desc, index, icon }) => {
  const reduceMotion = useReducedMotion();
  const neonColors = ['#00D4FF', '#00FFB3', '#FF006E', '#00D4FF', '#00FFB3'];
  const color = neonColors[index % neonColors.length];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      whileHover={reduceMotion ? undefined : { y: -8, scale: 1.01 }}
      className="group relative rounded-2xl p-6 overflow-hidden cursor-default"
      style={{
        background: 'rgba(5,10,20,0.6)',
        border: `1px solid ${color}20`,
        backdropFilter: 'blur(16px)',
        transition: 'box-shadow 0.3s ease',
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 0 30px ${color}15, 0 20px 40px rgba(0,0,0,0.3)`)}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      {/* Background gradient on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(circle at top left, ${color}08, transparent 60%)` }}
      />

      {/* Index badge */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
          style={{ background: `${color}15`, border: `1px solid ${color}30`, boxShadow: `0 0 10px ${color}20` }}
        >
          {icon}
        </div>
        <span
          className="text-2xl font-bold opacity-20 group-hover:opacity-40 transition-opacity"
          style={{ fontFamily: "'Space Grotesk', sans-serif", color }}
        >
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>

      <h3 className="text-sm font-bold text-white mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{title}</h3>
      <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{desc}</p>

      {/* Bottom neon line */}
      <div className="absolute bottom-0 left-0 h-px w-0 group-hover:w-full transition-all duration-500 rounded-full"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
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
          border: '1px solid rgba(0,212,255,0.2)',
          color: '#00D4FF',
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

export const LandingPage: React.FC<LandingPageProps> = ({ onSignIn }) => {
  const reduceMotion = useReducedMotion();

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
    <div className="relative overflow-x-hidden bg-slate-50 dark:bg-space-950" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ========== NAVBAR ========== */}
      <div className="relative z-20 mx-auto max-w-7xl px-6 md:px-10 pt-6">
        <div
          className="flex items-center justify-between rounded-2xl px-5 py-3.5"
          style={{
            background: 'rgba(5,10,20,0.7)',
            border: '1px solid rgba(0,212,255,0.15)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 0 20px rgba(0,212,255,0.05)',
          }}
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
      <div id="top" className="relative min-h-screen flex items-center overflow-hidden">
        {/* Background elements */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 grid-dot-bg-animated opacity-30 dark:opacity-100" />
          <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full blur-[120px] opacity-30" style={{ background: 'rgba(0,212,255,0.15)' }} />
          <div className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full blur-[120px] opacity-20" style={{ background: 'rgba(0,255,179,0.12)' }} />
          <div className="absolute inset-0 hidden dark:block">
            <HeroParticles />
          </div>
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-10 pt-32 pb-24 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

            {/* Left: text */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            >
              {/* Eyebrow badge */}
              <div
                className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] mb-6"
                style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.25)', color: '#00D4FF', backdropFilter: 'blur(8px)' }}
              >
                <motion.span
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="h-2 w-2 rounded-full"
                  style={{ background: '#00FFB3', boxShadow: '0 0 8px rgba(0,255,179,0.8)' }}
                />
                AI-Powered Telehealth Ecosystem
              </div>

              <h1
                className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.02] mb-6"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                CareXAI —{' '}
                <span
                  className="block"
                  style={{
                    background: 'linear-gradient(135deg, #00D4FF 0%, #00FFB3 50%, #7aeeff 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    filter: 'drop-shadow(0 0 20px rgba(0,212,255,0.3))',
                  }}
                >
                  Healthcare Intelligence
                </span>
              </h1>

              <p className="text-base md:text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl mb-8">
                AI-powered telehealth platform combining appointments, clinical insights, risk prediction, and secure doctor–patient communication in one intelligent healthcare ecosystem.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-10">
                <motion.button
                  onClick={() => scrollTo('cta')}
                  whileHover={reduceMotion ? undefined : { y: -3, scale: 1.02 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                  className="relative overflow-hidden rounded-2xl px-7 py-4 text-base font-bold shimmer-btn"
                  style={{
                    background: 'linear-gradient(135deg, #00D4FF 0%, #00FFB3 100%)',
                    color: '#050A14',
                    boxShadow: '0 0 30px rgba(0,212,255,0.4), 0 10px 30px rgba(0,0,0,0.2)',
                  }}
                >
                  <span className="relative z-10">Get Started</span>
                </motion.button>
                <Button variant="cyber" size="lg" onClick={onSignIn} className="rounded-2xl">
                  Sign In →
                </Button>
              </div>

              {/* Live stats */}
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Heart Rate" value="72 bpm" color="#00D4FF" delay={0.3} />
                <StatCard label="SpO₂" value="98%" color="#00FFB3" delay={0.4} />
                <StatCard label="BP" value="118/76" color="#7aeeff" delay={0.5} />
              </div>
            </motion.div>

            {/* Right: 3D heart visualization */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }}
            >
              <div
                className="relative rounded-3xl overflow-hidden"
                style={{
                  background: 'rgba(5,10,20,0.7)',
                  border: '1px solid rgba(0,212,255,0.2)',
                  backdropFilter: 'blur(20px)',
                  boxShadow: '0 0 40px rgba(0,212,255,0.1), 0 40px 80px rgba(0,0,0,0.3)',
                }}
              >
                {/* Header */}
                <div className="p-5 pb-0 flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] mb-1" style={{ color: 'rgba(0,212,255,0.6)' }}>Live Clinical Visualization</div>
                    <div className="text-base font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>3D Cardiac Monitor</div>
                  </div>
                  <div
                    className="flex-shrink-0 rounded-xl px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider"
                    style={{ background: 'rgba(0,255,179,0.1)', border: '1px solid rgba(0,255,179,0.2)', color: '#00FFB3' }}
                  >
                    Live
                  </div>
                </div>

                <Suspense fallback={
                  <div className="mt-4 h-[320px] sm:h-[360px] w-full flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full border-2 border-neon-400/30 border-t-neon-400 animate-spin" />
                  </div>
                }>
                  <BeatingHeart3D className="mt-2 h-[320px] sm:h-[360px] w-full" bpm={72} />
                </Suspense>

                {/* ECG strip at bottom */}
                <div className="p-4 pt-2">
                  <svg viewBox="0 0 400 30" className="w-full h-8" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="landingEcg" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="rgba(0,212,255,0)" />
                        <stop offset="30%" stopColor="#00D4FF" />
                        <stop offset="70%" stopColor="#00FFB3" />
                        <stop offset="100%" stopColor="rgba(0,255,179,0)" />
                      </linearGradient>
                    </defs>
                    <motion.path
                      d="M0 15 H80 L95 15 L105 3 L115 27 L125 15 H200 L215 15 L225 2 L235 28 L245 15 H400"
                      fill="none" stroke="url(#landingEcg)" strokeWidth="1.5" strokeLinecap="round"
                      style={{ filter: 'drop-shadow(0 0 3px rgba(0,212,255,0.5))' }}
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 2, repeat: Infinity, repeatDelay: 0.5, ease: 'linear' }}
                    />
                  </svg>
                </div>

                {/* Corner decorations */}
                <div className="absolute top-3 left-3 w-4 h-4 border-t border-l" style={{ borderColor: 'rgba(0,212,255,0.4)' }} />
                <div className="absolute top-3 right-3 w-4 h-4 border-t border-r" style={{ borderColor: 'rgba(0,212,255,0.4)' }} />
                <div className="absolute bottom-3 left-3 w-4 h-4 border-b border-l" style={{ borderColor: 'rgba(0,212,255,0.4)' }} />
                <div className="absolute bottom-3 right-3 w-4 h-4 border-b border-r" style={{ borderColor: 'rgba(0,212,255,0.4)' }} />
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
