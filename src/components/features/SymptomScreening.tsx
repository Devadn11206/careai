import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NeonButton as Button } from '@/components/carex/NeonButton';
import { MockBackend } from '@/services/mockBackend';
import { PatientProfile } from '@/types';
import { 
    Stethoscope, 
    ChevronRight, 
    ArrowRight, 
    Activity, 
    Zap, 
    ShieldCheck,
    Brain,
    HeartPulse
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  patient: PatientProfile;
  onComplete: (updatedPatient: PatientProfile) => void;
  onSkip: () => void;
}

const QUESTIONS = [
  {
    id: 'bp_intro',
    type: 'info',
    title: 'Vascular Integrity Audit',
    text: 'Initializing diagnostic sub-routines for cardiovascular and systemic pressure markers.',
    icon: <HeartPulse className="text-rose-500" size={32} />
  },
  {
    id: 'bp_headaches',
    type: 'question',
    text: 'Frequency of acute neurological pressure (headaches)?'
  },
  {
    id: 'bp_dizziness',
    type: 'question',
    text: 'Equilibrium instability detected upon rapid elevation?'
  },
  {
    id: 'bp_chest',
    type: 'question',
    text: 'Thoracic compression or discomfort markers?'
  },
  {
    id: 'bp_history',
    type: 'question',
    text: 'Previous clinical identification of hypertensive/hypotensive states?'
  },
  {
    id: 'gl_intro',
    type: 'info',
    title: 'Metabolic Vector Analysis',
    text: 'Switching focus to glycemic telemetry and metabolic instability markers.',
    icon: <Activity className="text-primary" size={32} />
  },
  {
    id: 'gl_thirst',
    type: 'question',
    text: 'Elevated polydipsia (excessive thirst) levels?'
  },
  {
    id: 'gl_urine',
    type: 'question',
    text: 'Increased nocturia (nocturnal urination) frequency?'
  },
  {
    id: 'gl_fatigue',
    type: 'question',
    text: 'Systemic energy depletion or muscular weakness?'
  },
  {
    id: 'gl_history',
    type: 'question',
    text: 'Family genetic lineage includes metabolic disorders (diabetes)?'
  },
  {
    id: 'gl_weight',
    type: 'question',
    text: 'Autonomous weight fluctuation without protocol change?'
  }
];

export const SymptomScreening: React.FC<Props> = ({ patient, onComplete, onSkip }) => {
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAnswer = (value: number) => {
    const currentQ = QUESTIONS[step];
    if (currentQ.type === 'question') {
      setAnswers(prev => ({ ...prev, [currentQ.id]: value }));
    }
    
    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      finishScreening();
    }
  };

  const finishScreening = async () => {
    setIsProcessing(true);
    try {
        const finalP = await MockBackend.saveSymptomScreening(patient.id, answers);
        onComplete(finalP);
    } catch (e) {
        console.error(e);
        onSkip();
    } finally {
        setIsProcessing(false);
    }
  };

  const handleNext = () => {
      setStep(step + 1);
  };

  // Welcome Screen
  if (step === -1) {
    return (
      <div className="fixed inset-0 z-[200] bg-background flex flex-col items-center justify-center p-8 selection:bg-primary/30">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,242,255,0.05),transparent_60%)]" />
        <motion.div 
          initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          className="max-w-xl w-full text-center space-y-12 relative z-10"
        >
          <div className="w-32 h-32 bg-primary/10 rounded-[2.5rem] flex items-center justify-center mx-auto border border-primary/20 shadow-glow-primary relative group">
            <div className="absolute inset-0 bg-primary/5 rounded-[2.5rem] animate-ping opacity-20" />
            <Stethoscope className="text-primary group-hover:scale-110 transition-transform duration-500" size={56} />
          </div>
          <div className="space-y-4">
            <h1 className="text-5xl font-black text-white uppercase font-display tracking-tighter leading-none">Biometric <span className="text-primary italic">Audit</span></h1>
            <p className="text-muted-foreground text-lg font-medium leading-relaxed max-w-md mx-auto">
                Initialize autonomous screening protocol. <br/>
                <span className="font-black text-primary uppercase tracking-[0.2em] text-xs">Clinical telemetry not required for initial sync.</span>
            </p>
          </div>
          <div className="space-y-6 pt-4">
            <Button onClick={() => setStep(0)} className="h-16 w-full text-lg shadow-glow-primary rounded-2xl group">
              Begin Clinical Stream
              <ChevronRight className="ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <button 
                onClick={onSkip} 
                className="text-[10px] font-black text-muted-foreground/40 hover:text-white uppercase tracking-[0.4em] transition-all"
            >
              Skip Core Synchronization
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const currentQ = QUESTIONS[step];

  return (
    <div className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-3xl flex flex-col items-center justify-center p-8">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
      
      <div className="w-full max-w-2xl relative z-10">
        {/* Progress Bar */}
        <div className="mb-12">
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                <motion.div 
                    className="h-full bg-gradient-to-r from-primary via-secondary to-primary shadow-glow-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }}
                    transition={{ type: 'spring', stiffness: 100 }}
                />
            </div>
            <div className="flex justify-between items-center mt-3">
                <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Stream: {currentQ.id.toUpperCase()}</span>
                <p className="text-[10px] text-muted-foreground/40 font-black uppercase tracking-widest">Protocol {step + 1} / {QUESTIONS.length}</p>
            </div>
        </div>

        <AnimatePresence mode='wait'>
            <motion.div
                key={step}
                initial={{ opacity: 0, x: 50, filter: 'blur(10px)' }}
                animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, x: -50, filter: 'blur(10px)' }}
                transition={{ duration: 0.5, ease: "anticipate" }}
                className="bg-[#060912]/80 rounded-[3rem] shadow-[0_40px_100px_rgba(0,0,0,0.5)] border border-white/10 p-12 min-h-[450px] flex flex-col justify-center backdrop-blur-2xl relative overflow-hidden"
            >
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
                
                {currentQ.type === 'info' ? (
                    <div className="text-center space-y-8">
                        <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto border border-white/10 mb-4">
                            {currentQ.icon || <Brain className="text-primary" />}
                        </div>
                        <h2 className="text-3xl font-black text-white uppercase tracking-tight font-display">{currentQ.title}</h2>
                        <p className="text-muted-foreground text-lg font-medium leading-relaxed max-w-sm mx-auto">{currentQ.text}</p>
                        <Button onClick={handleNext} className="w-full h-14 rounded-2xl group shadow-glow-primary">
                            Synchronize Next Protocol
                            <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-10">
                        <div className="flex items-center gap-4 justify-center mb-4">
                             <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-primary/30" />
                             <Brain size={20} className="text-primary/40" />
                             <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-primary/30" />
                        </div>
                        <h2 className="text-2xl font-black text-white leading-tight text-center font-display uppercase tracking-tight">{currentQ.text}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button 
                                onClick={() => handleAnswer(1)}
                                className="group relative p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-primary/5 transition-all overflow-hidden"
                            >
                                <div className="relative z-10 flex flex-col items-center gap-2">
                                    <span className="text-sm font-black uppercase tracking-[0.3em] text-muted-foreground group-hover:text-primary transition-colors">Positive</span>
                                    <span className="text-2xl font-black text-white">YES</span>
                                </div>
                                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                            <button 
                                onClick={() => handleAnswer(0)}
                                className="group relative p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-rose-500/50 hover:bg-rose-500/5 transition-all overflow-hidden"
                            >
                                <div className="relative z-10 flex flex-col items-center gap-2">
                                    <span className="text-sm font-black uppercase tracking-[0.3em] text-muted-foreground group-hover:text-rose-500 transition-colors">Negative</span>
                                    <span className="text-2xl font-black text-white">NO</span>
                                </div>
                                <div className="absolute inset-0 bg-rose-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                            <button 
                                onClick={() => handleAnswer(0.5)}
                                className="md:col-span-2 group relative p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all text-center"
                            >
                                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/40 group-hover:text-white transition-colors">Neural Uncertainty / Unknown</span>
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
        
        <div className="text-center mt-12 space-y-4">
            <div className="flex items-center justify-center gap-8 opacity-20">
                <ShieldCheck size={16} className="text-primary" />
                <Zap size={16} className="text-primary" />
                <Activity size={16} className="text-primary" />
            </div>
            <p className="text-[8px] font-black text-muted-foreground/20 uppercase tracking-[0.5em] max-w-sm mx-auto">
                CareXAI Neural Core: Predictive vectoring in effect. Output intended for clinical decision support.
            </p>
        </div>
      </div>
    </div>
  );
};
