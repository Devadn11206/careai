import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity, Brain, Bell, MessageSquare, Heart, Shield, Zap,
  Stethoscope, ArrowRight, Sparkles, ChevronRight, Star
} from "lucide-react";
import { NeonButton } from "@/components/carex/NeonButton";
import { GlassCard } from "@/components/carex/GlassCard";
import { ParticleField } from "@/components/carex/ParticleField";
import { AIOrb } from "@/components/carex/AIOrb";
import { AnimatedCounter } from "@/components/carex/AnimatedCounter";

const features = [
  { icon: Activity, title: "Real-Time Vitals", desc: "Continuous monitoring of heart rate, BP, glucose with AI-driven anomaly detection." },
  { icon: Brain, title: "AI Insights", desc: "Predictive analytics on patient risk, treatment outcomes, and care optimization." },
  { icon: MessageSquare, title: "AI Assistant", desc: "24/7 clinical co-pilot for triage, summaries, and patient questions." },
  { icon: Bell, title: "Smart Alerts", desc: "Prioritized notifications with severity scoring — never miss a critical event." },
  { icon: Shield, title: "HIPAA Secure", desc: "End-to-end encryption with audit-grade compliance for every interaction." },
  { icon: Stethoscope, title: "Telehealth Built-In", desc: "Crystal-clear video consults with live transcription and AI notes." },
];

const stats = [
  { value: 99.8, suffix: "%", label: "Diagnostic Accuracy" },
  { value: 12, suffix: "M+", label: "Vitals Analyzed Daily" },
  { value: 4500, suffix: "+", label: "Clinicians Onboard" },
  { value: 24, suffix: "/7", label: "AI Monitoring" },
];

const Landing = () => {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <ParticleField count={40} />

      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <nav className="glass rounded-2xl px-6 py-3 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-aurora shadow-glow flex items-center justify-center">
                <Heart className="h-5 w-5 text-primary-foreground" fill="currentColor" />
              </div>
              <span className="font-display font-bold text-lg">CareXAI</span>
            </Link>
            <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
              <a href="#features" className="hover:text-foreground transition-colors">Features</a>
              <a href="#stats" className="hover:text-foreground transition-colors">Platform</a>
              <a href="#cta" className="hover:text-foreground transition-colors">Pricing</a>
            </div>
            <div className="flex items-center gap-2">
              <NeonButton asChild variant="ghost" size="sm"><Link to="/login">Sign in</Link></NeonButton>
              <NeonButton asChild size="sm"><Link to="/signup">Get Started</Link></NeonButton>
            </div>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-40 pb-24 px-4 grid-bg">
        <div className="container mx-auto max-w-6xl text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs text-muted-foreground mb-8"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Introducing CareXAI 3.0 — Predictive Care, Reimagined
            <ChevronRight className="h-3 w-3" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-display text-5xl md:text-7xl lg:text-8xl font-bold leading-[1.05] tracking-tight"
          >
            The AI Co-Pilot
            <br />
            for <span className="text-gradient">Modern Healthcare</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto"
          >
            Real-time vitals, predictive insights, and a clinical AI assistant — all in one
            beautifully unified platform built for clinicians and patients.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <NeonButton asChild size="lg">
              <Link to="/dashboard">
                Launch Dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            </NeonButton>
            <NeonButton variant="neon" size="lg" asChild>
              <Link to="/chat">Try AI Assistant</Link>
            </NeonButton>
          </motion.div>

          {/* Floating preview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 60 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="mt-20 relative"
          >
            <div className="relative mx-auto max-w-4xl">
              <div className="absolute inset-0 bg-gradient-aurora blur-3xl opacity-30 rounded-3xl" />
              <GlassCard variant="strong" hover={false} className="relative p-2 md:p-4">
                <div className="rounded-xl bg-background/40 p-6 md:p-10 grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { icon: Heart, label: "Heart Rate", value: "72", unit: "bpm", color: "text-destructive" },
                    { icon: Activity, label: "Blood Pressure", value: "120/80", unit: "mmHg", color: "text-primary" },
                    { icon: Zap, label: "Glucose", value: "98", unit: "mg/dL", color: "text-success" },
                    { icon: Brain, label: "AI Score", value: "94", unit: "/100", color: "text-secondary" },
                  ].map((s, i) => (
                    <motion.div
                      key={s.label}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.8 + i * 0.1 }}
                      className="glass rounded-xl p-4 text-left"
                    >
                      <s.icon className={`h-5 w-5 ${s.color} mb-2`} />
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className="font-display text-2xl font-bold mt-1">{s.value}<span className="text-xs text-muted-foreground ml-1">{s.unit}</span></p>
                    </motion.div>
                  ))}
                </div>
              </GlassCard>
              <AIOrb className="absolute -top-6 -right-6 hidden md:flex" size={72} />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass rounded-2xl p-6 text-center"
              >
                <AnimatedCounter
                  value={s.value}
                  suffix={s.suffix}
                  decimals={s.value % 1 !== 0 ? 1 : 0}
                  className="font-display text-3xl md:text-5xl font-bold text-gradient block"
                />
                <p className="mt-2 text-sm text-muted-foreground">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-xs font-semibold tracking-widest text-primary uppercase">Capabilities</span>
            <h2 className="font-display text-4xl md:text-5xl font-bold mt-3">
              Everything care teams <br />actually need.
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.08 }}
              >
                <GlassCard className="h-full">
                  <div className="h-12 w-12 rounded-xl bg-gradient-aurora flex items-center justify-center shadow-glow mb-4">
                    <f.icon className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <h3 className="font-display text-xl font-semibold mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <GlassCard variant="strong" hover={false} className="p-10 md:p-14 text-center">
            <div className="flex justify-center gap-1 mb-6">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-5 w-5 fill-warning text-warning" />
              ))}
            </div>
            <p className="font-display text-2xl md:text-3xl leading-snug">
              "CareXAI cut our chart-review time by 60%. The AI insights flag what
              actually matters — it feels like having a senior resident reading
              every chart with me."
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <div className="h-12 w-12 rounded-full bg-gradient-aurora flex items-center justify-center font-semibold text-primary-foreground">
                DR
              </div>
              <div className="text-left">
                <p className="font-semibold">Dr. Reena Kapoor</p>
                <p className="text-sm text-muted-foreground">Chief of Cardiology, Mercy Health</p>
              </div>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="py-24 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="relative rounded-3xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-aurora opacity-90" />
            <div className="absolute inset-0 grid-bg opacity-30" />
            <div className="relative p-12 md:p-20 text-center">
              <h2 className="font-display text-4xl md:text-6xl font-bold text-primary-foreground">
                Ready to upgrade care?
              </h2>
              <p className="mt-4 text-lg text-primary-foreground/80 max-w-2xl mx-auto">
                Join thousands of clinicians using CareXAI to deliver faster, smarter, more human care.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                <NeonButton asChild variant="neon" size="lg" className="bg-background text-foreground border-background hover:bg-background/90">
                  <Link to="/signup">Start Free Trial <ArrowRight className="h-4 w-4" /></Link>
                </NeonButton>
                <NeonButton asChild variant="ghost" size="lg" className="text-primary-foreground hover:bg-primary-foreground/10">
                  <Link to="/dashboard">Explore Demo</Link>
                </NeonButton>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-4 border-t border-border/50 text-center text-sm text-muted-foreground">
        <p>© 2026 CareXAI. Built for clinicians, designed for humans.</p>
      </footer>
    </div>
  );
};

export default Landing;
