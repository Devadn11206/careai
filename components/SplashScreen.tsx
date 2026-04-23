
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HoloBackdrop3D } from './visuals/HoloBackdrop3D';

interface Props {
  onComplete: () => void;
}

// Particle system data
interface Particle {
  x: number; y: number; vx: number; vy: number; size: number; opacity: number; color: string;
}

const ParticleCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const particles: Particle[] = [];
    const COLORS = ['#00D4FF', '#00FFB3', '#7aeeff', '#3dffc0', '#00b8e0'];
    const MAX_DIST = 130;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 2.5 + 0.5,
        opacity: Math.random() * 0.6 + 0.2,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        // Draw dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.floor(p.opacity * 255).toString(16).padStart(2, '0');
        ctx.fill();

        // Draw connections
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dist = Math.hypot(p.x - q.x, p.y - q.y);
          if (dist < MAX_DIST) {
            const alpha = (1 - dist / MAX_DIST) * 0.3;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(0, 212, 255, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ opacity: 0.7 }}
    />
  );
};

export const SplashScreen: React.FC<Props> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'ready'>('loading');

  useEffect(() => {
    // Auto-progress over ~3s
    const start = Date.now();
    const duration = 3000;
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min((elapsed / duration) * 100, 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(interval);
        setPhase('ready');
      }
    }, 30);
    return () => clearInterval(interval);
  }, []);

  const brandLetters = 'CareXAI'.split('');

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden font-sans" style={{ background: '#050A14' }}>

      <HoloBackdrop3D className="opacity-90" intensity={1.1} />

      {/* Neural particle canvas */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,212,255,0.08),transparent_34%),radial-gradient(circle_at_75%_30%,rgba(0,255,179,0.08),transparent_26%)]" />

      {/* Ambient glow blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[120px]" style={{ background: 'rgba(0,212,255,0.06)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-[100px]" style={{ background: 'rgba(0,255,179,0.05)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[140px]" style={{ background: 'rgba(0,212,255,0.04)' }} />
      </div>

      {/* Grid dot background */}
      <div className="absolute inset-0 grid-dot-bg-animated pointer-events-none opacity-40" />

      {/* Center Content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-6">

        {/* Orbital rings around logo */}
        <div className="relative flex items-center justify-center mb-12">
          <div className="relative w-48 h-48" style={{ perspective: '600px' }}>
            {/* Ring 1 */}
            <div
              className="absolute inset-0 rounded-full border"
              style={{
                borderColor: 'rgba(0,212,255,0.3)',
                borderWidth: '1px',
                transform: 'rotateX(70deg)',
                animation: 'orbit-slow 8s linear infinite',
              }}
            >
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-neon-400" style={{ boxShadow: '0 0 10px rgba(0,212,255,0.8)' }} />
            </div>
            {/* Ring 2 */}
            <div
              className="absolute inset-4 rounded-full border"
              style={{
                borderColor: 'rgba(0,255,179,0.25)',
                borderWidth: '1px',
                transform: 'rotateX(60deg) rotateZ(45deg)',
                animation: 'orbit-reverse 12s linear infinite',
              }}
            >
              <div className="absolute -bottom-1.5 right-4 w-2 h-2 rounded-full" style={{ background: '#00FFB3', boxShadow: '0 0 8px rgba(0,255,179,0.8)' }} />
            </div>
            {/* Ring 3 */}
            <div
              className="absolute inset-8 rounded-full border"
              style={{
                borderColor: 'rgba(255,0,110,0.2)',
                borderWidth: '1px',
                transform: 'rotateX(50deg) rotateY(30deg)',
                animation: 'orbit-tilt 5s linear infinite',
              }}
            />

            {/* Core glow */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="absolute w-28 h-28 rounded-full blur-2xl" style={{ background: 'rgba(0,212,255,0.15)' }} />
              {/* Heart icon */}
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                className="relative z-10"
              >
                <svg className="w-20 h-20" viewBox="0 0 24 24" fill="none">
                  <defs>
                    <linearGradient id="splashHeartGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#00D4FF" />
                      <stop offset="100%" stopColor="#00FFB3" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    fill="url(#splashHeartGrad)"
                    stroke="url(#splashHeartGrad)"
                    strokeWidth="0.5"
                    style={{ filter: 'drop-shadow(0 0 12px rgba(0,212,255,0.7))' }}
                  />
                </svg>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Brand name — letter stagger */}
        <div className="flex items-center gap-1 mb-4">
          {brandLetters.map((letter, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.07, ease: 'easeOut' }}
              className="text-6xl md:text-7xl font-bold tracking-tight"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                color: i >= 5 ? '#00D4FF' : 'white',
                textShadow: i >= 5 ? '0 0 20px rgba(0,212,255,0.9), 0 0 40px rgba(0,212,255,0.5)' : '0 0 20px rgba(255,255,255,0.1)',
              }}
            >
              {letter}
            </motion.span>
          ))}
        </div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.9 }}
          className="text-lg md:text-xl text-center mb-3"
          style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 300 }}
        >
          AI That Understands Your Health,{' '}
          <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>Every Single Day.</span>
        </motion.p>

        {/* Animated ECG line */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0, duration: 0.5 }}
          className="w-full max-w-sm h-10 mb-8"
        >
          <svg className="w-full h-full" viewBox="0 0 300 40" preserveAspectRatio="none">
            <defs>
              <linearGradient id="ecgGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(0,212,255,0)" />
                <stop offset="30%" stopColor="#00D4FF" />
                <stop offset="70%" stopColor="#00FFB3" />
                <stop offset="100%" stopColor="rgba(0,255,179,0)" />
              </linearGradient>
            </defs>
            <motion.path
              d="M0 20 H60 L70 20 L80 8 L90 32 L100 20 H150 L160 20 L170 6 L180 34 L190 20 H300"
              fill="none"
              stroke="url(#ecgGrad)"
              strokeWidth="1.5"
              strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0 4px rgba(0,212,255,0.6))' }}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.5, delay: 1.1, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1 }}
            />
          </svg>
        </motion.div>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="flex flex-wrap justify-center gap-3 mb-10"
        >
          {[
            { icon: '🫀', text: 'Vitals Monitoring', color: '#00D4FF' },
            { icon: '🤖', text: 'AI Health Insights', color: '#00FFB3' },
            { icon: '📈', text: 'Early Risk Alerts', color: '#FF006E' },
          ].map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
              style={{
                background: 'rgba(0,212,255,0.06)',
                border: `1px solid ${f.color}30`,
                color: 'rgba(255,255,255,0.75)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <span>{f.icon}</span>
              <span>{f.text}</span>
            </div>
          ))}
        </motion.div>

        {/* CTA Button */}
        <AnimatePresence>
          {phase === 'ready' && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0 }}
              onClick={onComplete}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="relative overflow-hidden px-10 py-4 rounded-[22px] text-lg font-bold text-white shimmer-btn mb-6"
              style={{
                background: 'linear-gradient(135deg, #00D4FF 0%, #00FFB3 100%)',
                boxShadow: '0 0 30px rgba(0,212,255,0.5), 0 0 60px rgba(0,212,255,0.2)',
                color: '#050A14',
              }}
            >
              Enter CareXAI
            </motion.button>
          )}
        </AnimatePresence>

        {/* Loading button when not ready */}
        {phase === 'loading' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="mb-6"
          >
            <div className="flex items-center gap-3 text-sm" style={{ color: 'rgba(0,212,255,0.7)' }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </motion.div>
              Initializing systems…
            </div>
          </motion.div>
        )}

        {/* Progress bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="w-full max-w-xs"
        >
          <div className="flex justify-between text-xs mb-1.5" style={{ color: 'rgba(0,212,255,0.5)' }}>
            <span>System Boot</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-[2px] rounded-full w-full overflow-hidden" style={{ background: 'rgba(0,212,255,0.15)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, #00D4FF, #00FFB3)',
                width: `${progress}%`,
                boxShadow: '0 0 8px rgba(0,212,255,0.8)',
                transition: 'width 0.1s linear',
              }}
            />
          </div>
        </motion.div>

      </div>

      {/* Footer disclaimer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
        className="absolute bottom-6 w-full text-center px-4"
      >
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'rgba(255,255,255,0.25)' }}>
          <span>🔒 Your health data is private &amp; secure</span>
          <span className="hidden md:inline" style={{ color: 'rgba(255,255,255,0.15)' }}>•</span>
          <span>⚕️ For monitoring and awareness, not medical diagnosis</span>
        </div>
      </motion.div>
    </div>
  );
};
