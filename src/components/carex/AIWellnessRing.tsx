import React from 'react';
import { motion } from 'framer-motion';

interface AIWellnessRingProps {
  value: number;
  label: string;
  color: string;
  size?: number;
}

export const AIWellnessRing: React.FC<AIWellnessRingProps> = ({ value, label, color, size = 120 }) => {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-4 group">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Glow Ring */}
        <div className="absolute inset-0 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500" style={{ backgroundColor: color }} />
        
        <svg className="transform -rotate-90 w-full h-full">
          {/* Background Ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth="4"
            fill="transparent"
            className="text-white/5"
          />
          {/* Progress Ring */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth="4"
            fill="transparent"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            strokeLinecap="round"
            className="filter drop-shadow-[0_0_8px_rgba(0,242,255,0.4)]"
          />
        </svg>
        
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black font-mono tracking-tighter" style={{ color }}>{value}%</span>
        </div>
      </div>
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground group-hover:text-white transition-colors">{label}</span>
    </div>
  );
};
