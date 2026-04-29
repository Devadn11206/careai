
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NeonButton as Button } from '@/components/carex/NeonButton';

interface Props {
  onComplete: () => void;
}

const FEATURES = [
  {
    id: 'monitoring',
    title: 'Chronic Monitoring',
    desc: 'Real-time tracking for Kidney, Thyroid, and Stroke risks using advanced biomarkers.',
    color: 'bg-blue-100 text-blue-600',
    icon: (
      <svg className="w-24 h-24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        <path d="M12 7v5" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  },
  {
    id: 'trends',
    title: 'Intelligent Trends',
    desc: 'Visualize your health journey. Spot patterns early with AI-driven historical analysis.',
    color: 'bg-emerald-100 text-emerald-600',
    icon: (
      <svg className="w-24 h-24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
      </svg>
    )
  },
  {
    id: 'emergency',
    title: 'Emergency Readiness',
    desc: 'Calm guidance and location-based support when critical vitals are detected.',
    color: 'bg-orange-100 text-orange-600',
    icon: (
      <svg className="w-24 h-24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    )
  },
  {
    id: 'doctor',
    title: 'Expert Connection',
    desc: 'Seamlessly share reports and video consult with specialists who understand your history.',
    color: 'bg-teal-100 text-teal-600',
    icon: (
      <svg className="w-24 h-24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    )
  }
];

export const Onboarding: React.FC<Props> = ({ onComplete }) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((prev) => (prev + 1) % FEATURES.length);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  const currentFeature = FEATURES[step];

  return (
    <div className="min-h-screen bg-white flex flex-col relative overflow-hidden font-sans">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-[60vh] bg-gradient-to-b from-slate-50 to-white -z-10 rounded-b-[3rem]" />
      
      {/* Visual Storytelling Area */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        {/* Central Morphing Display */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentFeature.id}
            initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 1.1, rotate: 10 }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
            className={`w-64 h-64 rounded-full flex items-center justify-center shadow-2xl ${currentFeature.color} bg-opacity-30 relative`}
          >
            {/* Pulsing Ring */}
            <motion.div 
              className={`absolute inset-0 rounded-full border-2 opacity-50 ${currentFeature.color.replace('bg-', 'border-')}`}
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ repeat: Infinity, duration: 2 }}
            />
            
            {/* Icon */}
            <div className={`text-${currentFeature.color.split(' ')[1].split('-')[1]}-600 drop-shadow-sm`}>
               {currentFeature.icon}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col justify-start px-8 pb-12 max-w-lg mx-auto w-full text-center z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="mb-8 h-32"
          >
            <h2 className="text-2xl font-bold text-slate-800 mb-3">{currentFeature.title}</h2>
            <p className="text-slate-500 leading-relaxed">{currentFeature.desc}</p>
          </motion.div>
        </AnimatePresence>

        {/* Progress Indicators */}
        <div className="flex justify-center gap-2 mb-10">
          {FEATURES.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-teal-600' : 'w-2 bg-slate-200'}`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="space-y-4">
          <Button onClick={onComplete} className="w-full py-4 text-lg shadow-xl shadow-teal-500/20 rounded-2xl">
            Get Started
          </Button>
          <button 
            onClick={onComplete} 
            className="text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors"
          >
            Skip Intro
          </button>
        </div>
      </div>
    </div>
  );
};
