import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart, Stethoscope, Shield, ArrowRight, Activity, Zap } from "lucide-react";
import { GlassCard } from "@/components/carex/GlassCard";
import { ParticleField } from "@/components/carex/ParticleField";
import { cn } from "@/lib/utils";

const Auth = () => {
  const portals = [
    {
      role: "Patient",
      path: "/login/patient",
      icon: Heart,
      color: "text-primary",
      glow: "shadow-primary/20",
      desc: "Vitals & AI Health Insights"
    },
    {
      role: "Doctor",
      path: "/login/doctor",
      icon: Stethoscope,
      color: "text-secondary",
      glow: "shadow-secondary/20",
      desc: "Clinical Panels & Consults"
    },
    {
      role: "Admin",
      path: "/login/admin",
      icon: Shield,
      color: "text-success",
      glow: "shadow-success/20",
      desc: "System Command & Metrics"
    }
  ];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <ParticleField count={30} />
      <div className="absolute inset-0 grid-bg opacity-30" />

      {/* Background orbs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-secondary/10 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-4xl"
      >
        <div className="text-center mb-12">
          <Link to="/" className="inline-flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-2xl bg-gradient-aurora shadow-glow flex items-center justify-center animate-float">
              <Heart className="h-7 w-7 text-primary-foreground" fill="currentColor" />
            </div>
            <span className="font-display font-bold text-3xl">CareXAI</span>
          </Link>
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">Select Your Portal</h1>
          <p className="text-muted-foreground mt-4 text-lg">Choose your specific entry point to the CareXAI ecosystem.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {portals.map((p, i) => (
            <motion.div
              key={p.role}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Link to={p.path} className="block group h-full">
                <GlassCard 
                  variant="strong" 
                  className={cn(
                    "h-full p-8 flex flex-col items-center text-center border-border/50 group-hover:border-primary/50 transition-all duration-500",
                    "hover:shadow-2xl hover:-translate-y-2"
                  )}
                >
                  <div className={cn(
                    "h-20 w-20 rounded-3xl bg-background border flex items-center justify-center mb-8",
                    "group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-xl",
                    p.color,
                    p.glow
                  )}>
                    <p.icon className="h-10 w-10" />
                  </div>
                  
                  <h3 className="font-display text-2xl font-bold mb-3">{p.role} Portal</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-8">{p.desc}</p>
                  
                  <div className="mt-auto flex items-center gap-2 text-sm font-bold text-primary opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                    Authorize Access <ArrowRight className="h-4 w-4" />
                  </div>
                </GlassCard>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Support link */}
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            Having trouble? <a href="#" className="text-primary hover:underline">Contact System Administrator</a>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
