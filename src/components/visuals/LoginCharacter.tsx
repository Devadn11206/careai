
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';

export type CharacterState = 'IDLE' | 'WATCHING' | 'HIDING' | 'SUCCESS' | 'ERROR';

interface Props {
  state: CharacterState;
}

export const LoginCharacter: React.FC<Props> = ({ state }) => {
  const [isBlinking, setIsBlinking] = useState(false);

  // Blinking Logic (Random intervals)
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      if (state !== 'HIDING' && state !== 'SUCCESS') { // Don't blink if eyes are closed or in specific state
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 150);
      }
    }, 4000 + Math.random() * 2000);
    return () => clearInterval(blinkInterval);
  }, [state]);

  // --- VARIANTS ---

  const headVariants: Variants = {
    idle: { y: [0, -2, 0], rotate: 0, transition: { duration: 3, repeat: Infinity, ease: "easeInOut" } },
    watching: { y: 2, rotate: 3, transition: { duration: 0.4 } },
    hiding: { y: 5, rotate: -2, transition: { duration: 0.4 } },
    success: { y: [0, -5, 0], rotate: 0, transition: { duration: 0.5, repeat: 1 } }, // Nod/Bounce
    error: { x: [0, -5, 5, -5, 5, 0], rotate: [0, -2, 2, -2, 2, 0], transition: { duration: 0.5 } }
  };

  const pupilVariants: Variants = {
    idle: { x: 0, y: 0 },
    watching: { x: 8, y: 2 }, // Look right towards form
    hiding: { x: 0, y: 10 }, // Look down (masked)
    success: { x: 0, y: 0 },
    error: { x: 0, y: 0 }
  };

  const eyebrowVariants: Variants = {
    idle: { y: 0, rotate: 0 },
    watching: { y: -2, rotate: 0 }, // Perked up
    hiding: { y: 0, rotate: 0 },
    success: { y: -5, rotate: 0 }, // Happy surprise
    error: { y: 2, rotate: [0, 5, -5] } // Concerned
  };

  const mouthVariants: Variants = {
    idle: { d: "M 135 190 Q 150 195 165 190" }, // Neutral/Slight smile
    watching: { d: "M 135 188 Q 150 200 165 188" }, // Smile
    hiding: { d: "M 140 190 Q 150 185 160 190" }, // Small O / quiet
    success: { d: "M 135 188 Q 150 215 165 188" }, // Big Grin
    error: { d: "M 135 195 Q 150 185 165 195" } // Frown/Concern
  };

  const handLeftVariants: Variants = {
    idle: { y: 300 }, // Off screen
    watching: { y: 300 },
    hiding: { y: 140, x: -10, rotate: -10, transition: { type: "spring", stiffness: 120 } }, // Cover eyes
    success: { y: 300 },
    error: { y: 300 }
  };

  const handRightVariants: Variants = {
    idle: { y: 300 },
    watching: { y: 300 },
    hiding: { y: 140, x: 10, rotate: 10, transition: { type: "spring", stiffness: 120 } }, // Cover eyes
    success: { y: 180, x: 60, rotate: -10, transition: { type: "spring", stiffness: 150 } }, // Thumbs up
    error: { y: 300 }
  };

  // Colors
  const skinColor = "#FCD7B0";
  const skinShadow = "#E8C29E";
  const hairColor = "#2D3748"; // Dark Slate
  const jacketColor = "#0F766E"; // Teal 700
  const shirtColor = "#F0FDFA"; // Teal 50

  // Safely derive current mouth path so `d` is never undefined
  const mouthKey = state.toLowerCase() as keyof typeof mouthVariants;
  const mouthPath = ((mouthVariants[mouthKey] || mouthVariants.idle) as any).d;

  return (
    <div className="relative w-80 h-80 flex items-center justify-center">
      {/* Background Glow for Success */}
      <AnimatePresence>
        {state === 'SUCCESS' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 0.6, scale: 1.2 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-teal-400 rounded-full blur-3xl -z-10"
          />
        )}
      </AnimatePresence>

      <svg viewBox="0 0 300 300" className="w-full h-full drop-shadow-xl overflow-visible">
        {/* --- BODY --- */}
        <motion.g animate={state === 'IDLE' ? { y: [0, 1, 0] } : {}} transition={{ duration: 2, repeat: Infinity }}>
          {/* Shoulders/Jacket */}
          <path d="M 50 280 C 50 230 90 220 110 210 L 190 210 C 210 220 250 230 250 280 V 300 H 50 Z" fill={jacketColor} />
          {/* Shirt Collar */}
          <path d="M 110 210 L 150 280 L 190 210 L 150 230 Z" fill={shirtColor} />
          {/* Jacket Collar */}
          <path d="M 110 210 L 150 280 L 125 280 L 95 230 Z" fill="#0D9488" /> {/* Darker Teal */}
          <path d="M 190 210 L 150 280 L 175 280 L 205 230 Z" fill="#0D9488" />
          {/* Medical Cross Badge on Left Chest */}
          <circle cx="210" cy="250" r="12" fill="white" opacity="0.9" />
          <path d="M 210 242 V 258 M 202 250 H 218" stroke="#EF4444" strokeWidth="4" strokeLinecap="round" />
        </motion.g>

        {/* --- HEAD GROUP --- */}
        <motion.g
          variants={headVariants}
          animate={state.toLowerCase()}
          style={{ originX: "150px", originY: "250px" }} // Pivot at neck base
        >
          {/* Neck */}
          <path d="M 130 200 L 130 230 C 130 240 170 240 170 230 L 170 200" fill={skinShadow} />

          {/* Back Hair (Big Volume 80s Style) */}
          <path
            d="M 80 120 
                   C 70 80, 100 20, 150 20 
                   C 200 20, 230 80, 220 120 
                   C 225 160, 220 200, 200 210 
                   L 100 210 
                   C 80 200, 75 160, 80 120 Z"
            fill={hairColor}
          />

          {/* Face Shape */}
          <path d="M 100 100 C 100 40 200 40 200 100 V 180 C 200 230 100 230 100 180 Z" fill={skinColor} />

          {/* Face Features */}
          <g transform="translate(0, 10)">
            {/* Eyebrows */}
            <motion.path
              d="M 115 130 Q 130 125 145 130"
              fill="none" stroke="#4A5568" strokeWidth="3" strokeLinecap="round"
              variants={eyebrowVariants} animate={state.toLowerCase()}
            />
            <motion.path
              d="M 155 130 Q 170 125 185 130"
              fill="none" stroke="#4A5568" strokeWidth="3" strokeLinecap="round"
              variants={eyebrowVariants} animate={state.toLowerCase()}
            />

            {/* Eyes */}
            <g>
              {/* Left Eye */}
              <g transform="translate(130, 145)">
                <ellipse rx="10" ry="8" fill="white" />
                <motion.circle r="3" fill="#1F2937" variants={pupilVariants} animate={state.toLowerCase()} />
                {/* Eyelid */}
                <motion.rect
                  x="-12" y="-10" width="24" height="20" fill={skinColor}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: (isBlinking || state === 'HIDING') ? 1 : 0 }}
                  style={{ originY: 0 }}
                />
              </g>
              {/* Right Eye */}
              <g transform="translate(170, 145)">
                <ellipse rx="10" ry="8" fill="white" />
                <motion.circle r="3" fill="#1F2937" variants={pupilVariants} animate={state.toLowerCase()} />
                {/* Eyelid */}
                <motion.rect
                  x="-12" y="-10" width="24" height="20" fill={skinColor}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: (isBlinking || state === 'HIDING') ? 1 : 0 }}
                  style={{ originY: 0 }}
                />
              </g>
            </g>

            {/* Nose */}
            <path d="M 150 155 L 145 170 L 155 175" fill="none" stroke={skinShadow} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />

            {/* Mouth */}
            <motion.path
              d={mouthPath}
              fill="none" stroke="#975A16" strokeWidth="3" strokeLinecap="round"
            />

            {/* Cheeks */}
            <motion.circle cx="120" cy="165" r="8" fill="#FCA5A5" opacity="0.3" animate={{ scale: state === 'SUCCESS' ? 1.2 : 1 }} />
            <motion.circle cx="180" cy="165" r="8" fill="#FCA5A5" opacity="0.3" animate={{ scale: state === 'SUCCESS' ? 1.2 : 1 }} />
          </g>

          {/* Front Hair (Bangs/Quiff) */}
          <path
            d="M 100 80 C 100 80, 130 110, 150 80 C 170 110, 200 80, 200 80 C 200 80, 180 40, 150 40 C 120 40, 100 80, 100 80"
            fill={hairColor}
          />
        </motion.g>

        {/* --- HANDS (Overlay for Hiding/Success) --- */}
        {/* Left Hand (Covers eye) */}
        <motion.g variants={handLeftVariants} animate={state.toLowerCase()}>
          <circle cx="130" cy="0" r="25" fill={skinColor} stroke={skinShadow} strokeWidth="2" />
          <path d="M 130 -25 L 130 25 M 120 -20 L 120 20 M 140 -20 L 140 20" stroke={skinShadow} strokeWidth="2" opacity="0.5" />
        </motion.g>

        {/* Right Hand (Covers eye OR Thumbs Up) */}
        <motion.g variants={handRightVariants} animate={state.toLowerCase()}>
          {state === 'SUCCESS' ? (
            // Thumbs Up Shape
            <g transform="scale(1.2)">
              <path d="M 0 0 C 10 -10, 20 -10, 30 0 L 30 30 C 20 40, 10 40, 0 30 Z" fill={skinColor} stroke={skinShadow} strokeWidth="2" /> {/* Fist */}
              <path d="M 5 10 L -5 -20 C -10 -25, -5 -30, 5 -20 L 10 10 Z" fill={skinColor} stroke={skinShadow} strokeWidth="2" /> {/* Thumb */}
            </g>
          ) : (
            // Open Palm / Cover
            <>
              <circle cx="170" cy="0" r="25" fill={skinColor} stroke={skinShadow} strokeWidth="2" />
              <path d="M 170 -25 L 170 25 M 160 -20 L 160 20 M 180 -20 L 180 20" stroke={skinShadow} strokeWidth="2" opacity="0.5" />
            </>
          )}
        </motion.g>

      </svg>

      {/* Speech Bubble */}
      <motion.div
        className="absolute -top-10 bg-white px-4 py-2 rounded-2xl rounded-bl-none shadow-lg border border-slate-100 z-20"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <p className="text-xs font-bold text-slate-700">
          {state === 'IDLE' && "Hi! I'll keep your data safe."}
          {state === 'WATCHING' && "Need a hand?"}
          {state === 'HIDING' && "No peeking! 🙈"}
          {state === 'SUCCESS' && "You're in! Great to see you."}
          {state === 'ERROR' && "Hmm, that didn't work. Try again?"}
        </p>
      </motion.div>
    </div>
  );
};
