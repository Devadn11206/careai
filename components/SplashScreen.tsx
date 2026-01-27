
import React from 'react';
import { motion } from 'framer-motion';

interface Props {
  onComplete: () => void;
}

export const SplashScreen: React.FC<Props> = ({ onComplete }) => {
  
  // --- Variants for Staggered Entrance ---
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  const heartbeatLineVariants = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: { 
      pathLength: 1, 
      opacity: 1, 
      transition: { duration: 1.5, ease: "easeInOut" } 
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-gradient-to-br from-slate-50 via-teal-50/50 to-white flex items-center justify-center overflow-hidden font-sans text-slate-800">
      
      {/* --- Ambient Particles --- */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute bg-teal-200/20 rounded-full blur-3xl"
            style={{
              width: Math.random() * 300 + 100,
              height: Math.random() * 300 + 100,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -40, 0],
              x: [0, 20, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 10 + Math.random() * 10,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      <div className="max-w-7xl w-full mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center h-full relative z-10">
        
        {/* --- LEFT: AI Heart Visual --- */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="hidden lg:flex justify-center items-center relative order-2 lg:order-1"
        >
           <div className="relative w-[500px] h-[500px] flex items-center justify-center">
              {/* Rotating Outer Ring (Neural Network) */}
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0"
              >
                 <svg viewBox="0 0 500 500" className="w-full h-full text-teal-100 opacity-60">
                    <circle cx="250" cy="250" r="240" stroke="currentColor" strokeWidth="1" fill="none" strokeDasharray="10 20" />
                    <circle cx="250" cy="250" r="180" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.5" />
                    {/* Nodes */}
                    {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
                       <circle key={i} cx="250" cy="10" r="4" fill="#2dd4bf" transform={`rotate(${deg} 250 250)`} />
                    ))}
                 </svg>
              </motion.div>

              {/* Glowing Heart Core */}
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="relative z-10 w-64 h-64 bg-gradient-to-tr from-teal-500 to-emerald-400 rounded-full blur-[60px] opacity-40"
              />
              
              <div className="absolute z-20 text-teal-600 drop-shadow-2xl">
                 <svg className="w-48 h-48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5">
                    <path strokeLinecap="round" strokeLinejoin="round" fill="url(#heartGradient)" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    <defs>
                      <linearGradient id="heartGradient" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.1" />
                        <stop offset="100%" stopColor="#0d9488" stopOpacity="0.2" />
                      </linearGradient>
                    </defs>
                 </svg>
                 
                 {/* ECG Line Overlay on Heart */}
                 <svg className="absolute top-1/2 left-0 w-full h-12 -translate-y-1/2 text-white/80" viewBox="0 0 100 20" preserveAspectRatio="none">
                    <motion.path
                       d="M0 10 H20 L25 10 L30 2 L35 18 L40 10 H100"
                       fill="none"
                       stroke="currentColor"
                       strokeWidth="2"
                       strokeLinecap="round"
                       strokeLinejoin="round"
                       initial={{ pathLength: 0, opacity: 0 }}
                       animate={{ pathLength: 1, opacity: 1 }}
                       transition={{ duration: 2, repeat: Infinity, ease: "linear", repeatDelay: 1 }}
                    />
                 </svg>
              </div>
           </div>
        </motion.div>

        {/* --- RIGHT: Content & Interactions --- */}
        <motion.div 
          className="flex flex-col justify-center text-center lg:text-left order-1 lg:order-2"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
           {/* Brand */}
           <motion.div variants={itemVariants} className="mb-2">
              <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-slate-900">
                CareX<span className="text-teal-500">AI</span>
              </h1>
           </motion.div>

           {/* Tagline */}
           <motion.div variants={itemVariants} className="mb-6">
              <p className="text-xl md:text-2xl font-light text-slate-500 leading-relaxed max-w-lg mx-auto lg:mx-0">
                AI That Understands Your Health, <br/><span className="font-semibold text-slate-700">Every Single Day.</span>
              </p>
           </motion.div>

           {/* Heartbeat Divider */}
           <motion.div variants={itemVariants} className="w-full max-w-sm mx-auto lg:mx-0 h-12 relative mb-8 opacity-50">
              <svg className="w-full h-full text-teal-400" viewBox="0 0 300 50" preserveAspectRatio="none">
                 <motion.path 
                   d="M0 25 H50 L60 25 L70 10 L80 40 L90 25 H300"
                   fill="none"
                   stroke="currentColor"
                   strokeWidth="2"
                   strokeLinecap="round"
                   strokeLinejoin="round"
                   variants={heartbeatLineVariants}
                 />
              </svg>
           </motion.div>

           {/* Features */}
           <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-10">
              {[
                { icon: '🫀', text: 'Vitals Monitoring' },
                { icon: '🤖', text: 'AI Health Insights' },
                { icon: '📈', text: 'Early Risk Alerts' },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100 text-sm font-semibold text-slate-600">
                   <span>{f.icon}</span> {f.text}
                </div>
              ))}
           </motion.div>

           {/* CTA */}
           <motion.div variants={itemVariants} className="space-y-3">
              <motion.button
                onClick={onComplete}
                whileHover={{ scale: 1.05, boxShadow: "0 20px 25px -5px rgb(20 184 166 / 0.3)" }}
                whileTap={{ scale: 0.98 }}
                animate={{ 
                  boxShadow: ["0 0 0 0 rgba(20, 184, 166, 0.4)", "0 0 0 10px rgba(20, 184, 166, 0)"],
                }}
                transition={{ 
                  boxShadow: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                }}
                className="bg-teal-500 hover:bg-teal-600 text-white text-lg font-bold px-10 py-4 rounded-full shadow-xl shadow-teal-500/30 transition-colors w-full sm:w-auto"
              >
                Check My Health Now
              </motion.button>
              <p className="text-xs text-slate-400 font-medium tracking-wide">
                ⚡ Takes less than 1 minute
              </p>
           </motion.div>

        </motion.div>
      </div>

      {/* --- Footer --- */}
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        transition={{ delay: 2, duration: 1 }}
        className="absolute bottom-6 w-full text-center px-4"
      >
         <div className="flex flex-col md:flex-row items-center justify-center gap-4 text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
            <span className="flex items-center gap-1">🔒 Your health data is private & secure</span>
            <span className="hidden md:inline text-slate-300">•</span>
            <span className="flex items-center gap-1">⚕️ For monitoring and awareness, not medical diagnosis</span>
         </div>
      </motion.div>

    </div>
  );
};
