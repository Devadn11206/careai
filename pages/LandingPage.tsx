import React, { Suspense, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '../components/ui/Button';

const BeatingHeart3D = React.lazy(() => import('../components/visuals/BeatingHeart3D'));

interface LandingPageProps {
  onSignIn: () => void;
}

const Section: React.FC<{
  id?: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}> = ({ id, eyebrow, title, subtitle, children }) => {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="mx-auto max-w-7xl px-6 md:px-10"
    >
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 px-4 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-secondary-500" />
          {eyebrow}
        </div>
        <h2 className="mt-4 text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">{title}</h2>
        <p className="mt-3 max-w-2xl text-base md:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">{subtitle}</p>
      </div>
      {children}
    </motion.section>
  );
};

const MiniChart: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const reduceMotion = useReducedMotion();

  const points = useMemo(() => {
    // Smooth-ish path across 12 points (deterministic)
    const values = [22, 24, 23, 26, 29, 28, 31, 30, 33, 35, 34, 38];
    const width = 220;
    const height = 86;
    const pad = 8;
    const xStep = (width - pad * 2) / (values.length - 1);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const y = (v: number) => {
      const t = (v - min) / (max - min || 1);
      return height - pad - t * (height - pad * 2);
    };

    const pts = values.map((v, i) => ({ x: pad + xStep * i, y: y(v) }));
    return { pts, width, height };
  }, []);

  const d = useMemo(() => {
    const { pts } = points;
    // Simple smooth curve using quadratic beziers
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const cur = pts[i];
      const cx = (prev.x + cur.x) / 2;
      const cy = (prev.y + cur.y) / 2;
      path += ` Q ${prev.x} ${prev.y} ${cx} ${cy}`;
    }
    const last = pts[pts.length - 1];
    path += ` T ${last.x} ${last.y}`;
    return path;
  }, [points]);

  const glow = compact ? 'blur-[14px]' : 'blur-[22px]';

  return (
    <div className="relative">
      <div className={`absolute -inset-6 bg-gradient-to-tr from-primary-600/18 via-secondary-500/10 to-indigo-500/10 ${glow}`} />
      <div className="relative rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-100">Health signals</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Trends update in real time</p>
          </div>
          <div className="rounded-full border border-secondary-200/60 dark:border-secondary-900/40 bg-secondary-50/70 dark:bg-secondary-900/25 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-secondary-700 dark:text-secondary-300">
            HIPAA-ready
          </div>
        </div>

        <svg
          viewBox={`0 0 ${points.width} ${points.height}`}
          className="w-full h-[90px]"
          aria-hidden
        >
          <defs>
            <linearGradient id="cxaiLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#2563EB" stopOpacity="1" />
              <stop offset="55%" stopColor="#14B8A6" stopOpacity="1" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="cxaiFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
            </linearGradient>
          </defs>

          <path
            d={`${d} L ${points.width - 8} ${points.height - 8} L 8 ${points.height - 8} Z`}
            fill="url(#cxaiFill)"
          />

          <motion.path
            d={d}
            fill="none"
            stroke="url(#cxaiLine)"
            strokeWidth="3"
            strokeLinecap="round"
            initial={reduceMotion ? false : { pathLength: 0, opacity: 0.7 }}
            animate={reduceMotion ? { opacity: 1 } : { pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.2, ease: 'easeInOut' }}
          />

          {!reduceMotion && (
            <motion.circle
              r="4"
              fill="#14B8A6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
            >
              <animateMotion dur="2.2s" repeatCount="indefinite" path={d} />
            </motion.circle>
          )}
        </svg>

        <div className="mt-3 grid grid-cols-3 gap-3">
          {[
            { k: 'HR', v: '72 bpm' },
            { k: 'SpO₂', v: '98%' },
            { k: 'BP', v: '118/76' },
          ].map((m) => (
            <div
              key={m.k}
              className="rounded-xl border border-slate-200/70 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 px-3 py-2"
            >
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">{m.k}</p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{m.v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const LandingPage: React.FC<LandingPageProps> = ({ onSignIn }) => {
  const reduceMotion = useReducedMotion();

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="relative overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Ambient gradient motion */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 cxai-gradient-motion opacity-80" />
        <div className="absolute -top-24 -left-24 h-[360px] w-[360px] rounded-full bg-primary-300/20 blur-3xl animate-blob" />
        <div className="absolute top-12 -right-24 h-[320px] w-[320px] rounded-full bg-indigo-300/15 blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute -bottom-28 left-1/4 h-[340px] w-[340px] rounded-full bg-secondary-300/15 blur-3xl animate-blob animation-delay-4000" />
      </div>

      {/* Top nav */}
      <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-10 pt-6">
        <div className="flex items-center justify-between rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white/70 dark:bg-slate-900/65 backdrop-blur px-5 py-4 shadow-sm">
          <button
            onClick={() => scrollTo('top')}
            className="flex items-center gap-3"
            aria-label="CareXAI Home"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-secondary-500 rounded-xl flex items-center justify-center text-white font-extrabold text-xl shadow-lg shadow-primary-500/20 ring-2 ring-primary-100 dark:ring-primary-900/30">
              C
            </div>
            <div className="leading-tight">
              <div className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                CareX<span className="text-secondary-500">AI</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Healthcare intelligence, made simple</div>
            </div>
          </button>

          <div className="hidden md:flex items-center gap-2">
            {[
              { id: 'features', label: 'Features' },
              { id: 'workflow', label: 'Workflow' },
              { id: 'trust', label: 'Trust' },
            ].map((l) => (
              <button
                key={l.id}
                onClick={() => scrollTo(l.id)}
                className="px-3 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/50 transition"
              >
                {l.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onSignIn} className="rounded-xl">
              Sign in
            </Button>
            <motion.button
              onClick={() => {
                scrollTo('cta');
              }}
              whileHover={reduceMotion ? undefined : { scale: 1.03 }}
              whileTap={reduceMotion ? undefined : { scale: 0.98 }}
              className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary-600 to-secondary-500 px-4 py-2 text-sm font-extrabold text-white shadow-lg shadow-primary-500/25"
            >
              {!reduceMotion && (
                <motion.span
                  aria-hidden
                  className="absolute -left-1/3 top-0 h-full w-1/3 bg-white/25 skew-x-[-18deg]"
                  animate={{ x: ['-40%', '220%'] }}
                  transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 2.8, ease: 'easeInOut' }}
                />
              )}
              <span className="relative z-10">Get started</span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div id="top" className="relative z-10 mx-auto max-w-7xl px-6 md:px-10 pt-14 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 px-4 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-secondary-500" />
              AI-powered telehealth ecosystem
            </div>

            <h1 className="mt-5 text-4xl md:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.02]">
              CareXAI —
              <span className="block bg-clip-text text-transparent bg-gradient-to-r from-primary-600 via-secondary-500 to-indigo-500"> Healthcare Intelligence Made Simple</span>
            </h1>
            <p className="mt-5 text-base md:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
              AI-powered telehealth platform combining appointments, clinical insights, risk prediction, and secure doctor–patient communication in one intelligent healthcare ecosystem.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <motion.button
                onClick={() => scrollTo('cta')}
                whileHover={reduceMotion ? undefined : { y: -2 }}
                whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                className="rounded-2xl bg-gradient-to-r from-primary-600 to-secondary-500 px-6 py-3.5 text-white font-extrabold shadow-xl shadow-primary-500/25"
              >
                Get Started
              </motion.button>
              <Button
                variant="outline"
                size="lg"
                onClick={onSignIn}
                className="rounded-2xl"
              >
                Upload Health Report
              </Button>
            </div>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { k: 'Key highlight', v: 'Real-time patient–doctor communication' },
                { k: 'Key highlight', v: 'AI-powered health risk prediction' },
                { k: 'Key highlight', v: 'Secure clinical decision support' },
                { k: 'Key highlight', v: 'Smart appointment and consultation workflows' },
                { k: 'Key highlight', v: 'Live vitals and health trend monitoring' },
              ].map((p, idx) => (
                <motion.div
                  key={`${p.v}_${idx}`}
                  whileHover={reduceMotion ? undefined : { y: -4 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 backdrop-blur px-4 py-3 shadow-sm"
                >
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{p.k}</div>
                  <div className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">{p.v}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
            className="lg:pl-8"
          >
            <div className="relative rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 backdrop-blur shadow-sm overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary-600/12 via-transparent to-secondary-500/10" />
              <div className="relative p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Live clinical visualization</div>
                    <div className="mt-1 text-base font-extrabold text-slate-900 dark:text-white">Semi‑transparent 3D heart</div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Soft blue‑teal lighting, gentle pulse, minimal monitoring particles.</div>
                  </div>
                  <div className="shrink-0 rounded-2xl border border-secondary-200/60 dark:border-secondary-900/40 bg-secondary-50/70 dark:bg-secondary-900/25 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-secondary-700 dark:text-secondary-300">
                    Lightweight
                  </div>
                </div>

                <Suspense
                  fallback={
                    <div className="mt-4 h-[320px] sm:h-[380px] w-full rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-gradient-to-tr from-primary-600/8 via-white/10 to-secondary-500/10" />
                  }
                >
                  <BeatingHeart3D className="mt-4 h-[320px] sm:h-[380px] w-full" bpm={72} />
                </Suspense>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.6 }}
              className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              {[{
                title: 'Queue visibility',
                body: 'Patients see their live position. Doctors see ahead/delay.'
              }, {
                title: 'AI-ready workflows',
                body: 'Triage, summaries, and report parsing—when you need it.'
              }].map((c) => (
                <motion.div
                  key={c.title}
                  whileHover={reduceMotion ? undefined : { y: -6 }}
                  className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 backdrop-blur p-5 shadow-sm"
                >
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white">{c.title}</div>
                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{c.body}</div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </div>

      <div className="py-14">
        <Section
          id="features"
          eyebrow="Key highlights"
          title="Everything you need in one care ecosystem"
          subtitle="Appointments, clinical insights, risk prediction, and secure communication—designed to stay calm and reliable in real clinical environments."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                title: 'Real-time patient–doctor communication',
                desc: 'Secure chat and consultation-ready messaging to keep care teams aligned.',
              },
              {
                title: 'AI-powered health risk prediction',
                desc: 'Risk insights from reports and health data to support earlier intervention.',
              },
              {
                title: 'Secure clinical decision support',
                desc: 'Summaries, alerts, and trends presented with clarity—not noise.',
              },
              {
                title: 'Smart appointment & consultation workflows',
                desc: 'Booking, queue visibility, and guided steps for patients and clinicians.',
              },
              {
                title: 'Live vitals & health trend monitoring',
                desc: 'Vitals charts and history tracking for better follow-ups and continuity of care.',
              },
            ].map((f, idx) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.55, delay: idx * 0.08 }}
                whileHover={reduceMotion ? undefined : { y: -8 }}
                className="group relative rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 backdrop-blur p-6 shadow-sm overflow-hidden"
              >
                <div className="pointer-events-none absolute -inset-20 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <div className="absolute inset-0 bg-gradient-to-tr from-primary-600/10 via-secondary-500/5 to-indigo-500/10 blur-2xl" />
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-extrabold text-slate-900 dark:text-white">{f.title}</div>
                    <div className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{f.desc}</div>
                  </div>
                  <div className="shrink-0 h-10 w-10 rounded-2xl bg-secondary-50/70 dark:bg-secondary-900/25 border border-secondary-200/60 dark:border-secondary-900/40 flex items-center justify-center text-secondary-700 dark:text-secondary-300 font-extrabold">
                    {idx + 1}
                  </div>
                </div>

                <div className="mt-5">
                  <MiniChart compact />
                </div>
              </motion.div>
            ))}
          </div>
        </Section>
      </div>

      <div className="py-14">
        <Section
          id="workflow"
          eyebrow="How it works"
          title="Simple workflows for patients, doctors, and admins"
          subtitle="A clear role-based experience keeps care delivery organized end-to-end."
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {[
              {
                title: 'Patients',
                items: ['Upload reports or enter health data', 'Get AI risk insights', 'Book consultation and communicate with doctors'],
              },
              {
                title: 'Doctors',
                items: ['View patient history and trends', 'Access clinical alerts and summaries', 'Conduct secure consultations'],
              },
              {
                title: 'Admins',
                items: ['Doctor verification', 'Platform monitoring', 'System analytics'],
              },
            ].map((col, i) => (
              <motion.div
                key={col.title}
                whileHover={reduceMotion ? undefined : { y: -6 }}
                className="rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 backdrop-blur p-6 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="text-base font-extrabold text-slate-900 dark:text-white">{col.title}</div>
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Step {i + 1}</div>
                </div>
                <div className="mt-4 space-y-3">
                  {col.items.map((it) => (
                    <motion.div
                      key={it}
                      initial={{ opacity: 0, x: -8 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, amount: 0.4 }}
                      transition={{ duration: 0.35 }}
                      className="flex items-start gap-3"
                    >
                      <div className="mt-1 h-2.5 w-2.5 rounded-full bg-secondary-500/80" />
                      <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{it}</div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </Section>
      </div>

      <div className="py-14">
        <Section
          id="trust"
          eyebrow="Trust"
          title="Security and privacy designed for clinical environments"
          subtitle="Secure medical-grade data protection, role-based access control, and privacy-first healthcare workflows designed for reliable clinical environments."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              {
                title: 'Medical-grade protection',
                desc: 'Secure handling of sensitive data with strong defaults and consistent safeguards.',
              },
              {
                title: 'Role-based access control',
                desc: 'Clear separation of patient, doctor, and admin capabilities to reduce risk.',
              },
              {
                title: 'Privacy-first workflows',
                desc: 'Designed around consent, least-privilege access, and predictable clinical UX.',
              },
              {
                title: 'Auditability & oversight',
                desc: 'Admin visibility for verification, monitoring, and system health analytics.',
              },
            ].map((t, idx) => (
              <motion.div
                key={t.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.5, delay: idx * 0.06 }}
                whileHover={reduceMotion ? undefined : { y: -6 }}
                className="rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 backdrop-blur p-6 shadow-sm"
              >
                <div className="text-sm font-extrabold text-slate-900 dark:text-white">{t.title}</div>
                <div className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{t.desc}</div>
              </motion.div>
            ))}
          </div>
        </Section>
      </div>

      {/* CTA */}
      <div id="cta" className="relative z-10 pb-20 pt-6">
        <div className="mx-auto max-w-7xl px-6 md:px-10">
          <div className="rounded-[28px] border border-slate-200/70 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 backdrop-blur p-8 md:p-10 shadow-sm overflow-hidden relative">
            <div className="absolute -inset-24 bg-gradient-to-tr from-primary-600/15 via-secondary-500/10 to-indigo-500/15 blur-2xl" />
            <div className="relative">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">CTA</div>
                  <div className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                    Start your AI-driven healthcare journey today
                  </div>
                  <div className="mt-3 text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                    Create a secure account to upload reports, get AI risk insights, and connect with clinicians in a privacy-first workflow.
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 lg:justify-end">
                  <Button variant="outline" size="lg" className="rounded-2xl" onClick={onSignIn}>
                    Upload Health Report
                  </Button>
                  <motion.button
                    onClick={onSignIn}
                    whileHover={reduceMotion ? undefined : { y: -2 }}
                    whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                    className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary-600 to-secondary-500 px-7 py-4 text-white font-extrabold shadow-xl shadow-primary-500/25"
                  >
                    {!reduceMotion && (
                      <motion.span
                        aria-hidden
                        className="absolute -left-1/3 top-0 h-full w-1/3 bg-white/20 skew-x-[-18deg]"
                        animate={{ x: ['-40%', '220%'] }}
                        transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2.2, ease: 'easeInOut' }}
                      />
                    )}
                    <span className="relative z-10">Get Started</span>
                  </motion.button>
                </div>
              </div>

              <div className="mt-8 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                By continuing, you agree to the platform terms. CareXAI provides decision support and does not replace professional medical diagnosis.
              </div>
            </div>
          </div>

          <div className="mt-10 text-center text-xs text-slate-400 dark:text-slate-500">
            © 2026 CareXAI — Built for clear, trustworthy care.
          </div>
        </div>
      </div>
    </div>
  );
};
