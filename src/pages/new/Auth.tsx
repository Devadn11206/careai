import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, User, Heart, Github, ArrowRight, Loader2 } from "lucide-react";
import { NeonInput } from "@/components/carex/NeonInput";
import { NeonButton } from "@/components/carex/NeonButton";
import { GlassCard } from "@/components/carex/GlassCard";
import { ParticleField } from "@/components/carex/ParticleField";
import { AIOrb } from "@/components/carex/AIOrb";
import { BackendAPI } from "@/services/apiClient";
import { useHealth } from "@/services/HealthContext";
import { UserRole } from "@/types";
import { toast } from "sonner";

const Auth = ({ mode = "login" as "login" | "signup" }) => {
  const [tab, setTab] = useState(mode);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const navigate = useNavigate();
  const { setUser } = useHealth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (tab === "login") {
        const res = await BackendAPI.login(email, password);
        setUser(res.user as any);
        toast.success(`Welcome back, ${res.user.name}`);
        navigate("/dashboard");
      } else {
        const res = await BackendAPI.register({
          name,
          email,
          password,
          role: UserRole.PATIENT // Default for new users in this UI
        });
        setUser(res.user as any);
        toast.success(`Account created successfully!`);
        navigate("/dashboard");
      }
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <ParticleField count={30} />
      <div className="absolute inset-0 grid-bg opacity-30" />

      {/* Floating orbs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-secondary/20 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        <Link to="/" className="flex items-center justify-center gap-2.5 mb-8">
          <div className="h-11 w-11 rounded-xl bg-gradient-aurora shadow-glow flex items-center justify-center animate-float">
            <Heart className="h-6 w-6 text-primary-foreground" fill="currentColor" />
          </div>
          <span className="font-display font-bold text-2xl">CareXAI</span>
        </Link>

        <GlassCard variant="strong" hover={false} className="p-8">
          <div className="flex justify-center mb-8">
            <div className="glass rounded-full p-1 flex">
              <button
                onClick={() => setTab("login")}
                className={`px-6 py-1.5 rounded-full text-sm font-medium transition-all ${tab === "login" ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground"}`}
              >
                Sign In
              </button>
              <button
                onClick={() => setTab("signup")}
                className={`px-6 py-1.5 rounded-full text-sm font-medium transition-all ${tab === "signup" ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground"}`}
              >
                Sign Up
              </button>
            </div>
          </div>

          <motion.h1
            key={tab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="font-display text-3xl font-bold text-center"
          >
            {tab === "login" ? "Welcome back" : "Create account"}
          </motion.h1>
          <p className="text-sm text-muted-foreground text-center mt-2 mb-8">
            {tab === "login" ? "Sign in to access your dashboard" : "Get started with CareXAI in seconds"}
          </p>

          <form
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            {tab === "signup" && (
              <NeonInput 
                label="Full Name" 
                icon={<User className="h-4 w-4" />} 
                placeholder="Dr. Jane Doe" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            )}
            <NeonInput 
              label="Email" 
              icon={<Mail className="h-4 w-4" />} 
              placeholder="you@hospital.com" 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <NeonInput 
              label="Password" 
              icon={<Lock className="h-4 w-4" />} 
              placeholder="••••••••" 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {tab === "login" && (
              <div className="flex justify-end">
                <a href="#" className="text-xs text-primary hover:text-primary-glow transition-colors">Forgot password?</a>
              </div>
            )}

            <NeonButton type="submit" size="lg" className="w-full mt-2" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {tab === "login" ? "Sign In" : "Create Account"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </NeonButton>
          </form>

          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">OR</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <NeonButton variant="outline" size="lg" className="w-full">
            <Github className="h-4 w-4" /> Continue with GitHub
          </NeonButton>
        </GlassCard>

        <p className="text-center text-xs text-muted-foreground mt-6">
          By continuing, you agree to our Terms & HIPAA-compliant Privacy Policy.
        </p>
      </motion.div>

      <AIOrb floating size={56} onClick={() => navigate("/chat")} />
    </div>
  );
};

export default Auth;
