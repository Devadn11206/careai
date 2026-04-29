
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HoloBackdrop3D } from '../visuals/HoloBackdrop3D';

interface Props {
  onComplete: () => void;
}

const SYSTEM_LOGS = [
  "DECRYPTING BIO-METRIC DATA...",
  "INITIALIZING NEURAL LINK...",
  "VERIFYING CLINICAL ACCESS...",
  "NODE CONNECTIVITY: 100%",
  "QUANTUM ENGINE: READY",
  "CAREXAI CORE: ONLINE"
];

const ParticleCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const particles: any[] = [];
    const COLORS = ['#00D4FF', '#00FFB3', '#7B61FF'];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    
    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', onMouseMove);

    for (let i = 0; i < 100; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 2 + 0.5,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        opacity: Math.random() * 0.5 + 0.1
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        // Simple mouse repulsion
        const dx = p.x - mouseRef.current.x;
        const dy = p.y - mouseRef.current.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 150) {
          const force = (150 - dist) / 150;
          p.x += dx * force * 0.05;
          p.y += dy * force * 0.05;
        }

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${Math.floor(p.opacity * 255).toString(16).padStart(2, '0')}`;
        ctx.fill();
      });
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none opacity-50" />;
};

export const SplashScreen: React.FC<Props> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [currentLogIndex, setCurrentLogIndex] = useState(0);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const duration = 4000;
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min((elapsed / duration) * 100, 100);
      setProgress(pct);
      
      // Update logs based on progress
      const logIdx = Math.min(Math.floor((pct / 100) * SYSTEM_LOGS.length), SYSTEM_LOGS.length - 1);
      setCurrentLogIndex(logIdx);

      if (pct >= 100) {
        clearInterval(interval);
        setTimeout(() => setShowContent(true), 500);
      }
    }, 16);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-[#050A14] flex flex-col items-center justify-between overflow-hidden">
      <HoloBackdrop3D intensity={1.5} />
      <ParticleCanvas />

      {/* Top Status Bar */}
      <div className="w-full max-w-7xl px-10 py-8 flex justify-between items-center relative z-20">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-4"
        >
          <div className="w-3 h-3 rounded-full bg-primary animate-pulse shadow-[0_0_10px_#00D4FF]" />
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/70">
            Node Status: Connected
          </span>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-6"
        >
          <div className="flex flex-col items-end">
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">Security protocol</span>
            <span className="text-[10px] font-bold text-white uppercase tracking-widest">AES-256 Quantum</span>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="flex flex-col items-end">
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">Latency</span>
            <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">14ms</span>
          </div>
        </motion.div>
      </div>

      {/* Main Cinematic Center */}
      <div className="flex-1 w-full flex flex-col items-center justify-center relative z-20">
        {/* Holographic Logo Core */}
        <div className="relative mb-16">
          <motion.div
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-64 h-64 flex items-center justify-center"
          >
            {/* Orbital Rings */}
            <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-[spin_10s_linear_infinite]" style={{ transform: 'rotateX(75deg)' }} />
            <div className="absolute inset-4 rounded-full border border-secondary/30 animate-[spin_15s_linear_infinite_reverse]" style={{ transform: 'rotateY(75deg)' }} />
            <div className="absolute inset-8 rounded-full border border-white/10 animate-[spin_20s_linear_infinite]" style={{ transform: 'rotateZ(45deg)' }} />
            
            {/* Core Heart Pulse */}
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                filter: ['brightness(1)', 'brightness(1.5)', 'brightness(1)']
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="relative z-10"
            >
              <svg className="w-24 h-24" viewBox="0 0 24 24" fill="none">
                <defs>
                  <linearGradient id="splashGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#00D4FF" />
                    <stop offset="100%" stopColor="#00FFB3" />
                  </linearGradient>
                </defs>
                <path
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  fill="url(#splashGrad)"
                  stroke="white"
                  strokeWidth="0.5"
                />
              </svg>
            </motion.div>
          </motion.div>
          
          {/* Base Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-primary/20 rounded-full blur-[60px] animate-pulse" />
        </div>

        {/* Title & Slogan */}
        <div className="text-center">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-7xl md:text-8xl font-black tracking-tighter text-white mb-6 font-orbitron"
          >
            CARE<span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent italic">XAI</span>
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-lg md:text-xl text-slate-400 font-medium tracking-widest uppercase mb-12"
          >
            Quantum Healthcare Intelligence
          </motion.p>
        </div>

        {/* Bottom Actions / Progress */}
        <div className="w-full max-w-md px-10">
          <AnimatePresence mode="wait">
            {!showContent ? (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Diagnostic Console */}
                <div className="bg-black/40 backdrop-blur-md rounded-2xl p-6 border border-white/5 font-mono overflow-hidden h-28 relative">
                  <div className="absolute top-0 left-0 w-full h-1 bg-primary/20 animate-scan" />
                  <div className="space-y-2">
                    {SYSTEM_LOGS.slice(Math.max(0, currentLogIndex - 2), currentLogIndex + 1).map((log, i) => (
                      <motion.p 
                        key={log}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-[10px] tracking-widest text-primary/80"
                      >
                        <span className="text-slate-500 mr-2">[{new Date().toLocaleTimeString()}]</span>
                        {log}
                      </motion.p>
                    ))}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                    <span>Synchronizing</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-primary to-secondary"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="cta"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center"
              >
                <motion.button
                  whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(0,212,255,0.4)' }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onComplete}
                  className="px-12 py-5 bg-gradient-to-r from-primary to-secondary rounded-2xl text-slate-900 font-black uppercase tracking-[0.2em] text-sm shadow-xl transition-shadow"
                >
                  Enter CareXAI Portal
                </motion.button>
                <p className="mt-6 text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">
                  Biometric Access Granted
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer Info */}
      <div className="w-full px-10 py-10 flex justify-between items-end relative z-20">
        <div className="space-y-1">
          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-600">Built on</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Web-Quantum-Architecture</p>
        </div>
        <div className="text-right space-y-1">
          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-600">Version</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">v4.2.0-STABLE</p>
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(400%); }
        }
      `}</style>
    </div>
  );
};
export default SplashScreen;
