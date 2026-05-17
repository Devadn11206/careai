import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, ArrowRight, Loader2, Heart } from "lucide-react";
import { NeonInput } from "@/components/carex/NeonInput";
import { NeonButton } from "@/components/carex/NeonButton";
import { BackendAPI } from "@/services/apiClient";
import { useHealth } from "@/services/HealthContext";
import { UserRole } from "@/types";
import { toast } from "sonner";
import { SplitAuthLayout } from "@/components/common/SplitAuthLayout";
import { CharacterState } from "@/components/visuals/LoginCharacter";

const PatientAuth = () => {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [charState, setCharState] = useState<CharacterState>("IDLE");
  
  const navigate = useNavigate();
  const { setUser } = useHealth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setCharState("WATCHING");

    try {
      if (tab === "login") {
        const res = await BackendAPI.login(email, password);
        if (res.user.role !== UserRole.PATIENT) {
          throw new Error("This account is not a Patient account. Please use the correct portal.");
        }
        setUser(res.user as any);
        setCharState("SUCCESS");
        toast.success(`Welcome back, ${res.user.name}`);
        setTimeout(() => navigate("/dashboard"), 1000);
      } else {
        const res = await BackendAPI.register({
          name,
          email,
          password,
          role: UserRole.PATIENT
        });
        setUser(res.user as any);
        setCharState("SUCCESS");
        toast.success(`Account created successfully!`);
        setTimeout(() => navigate("/dashboard"), 1000);
      }
    } catch (err: any) {
      setCharState("ERROR");
      toast.error(err.message || "Authentication failed");
      setIsLoading(false);
    }
  };

  return (
    <SplitAuthLayout
      role="Patient"
      characterState={charState}
      title={tab === "login" ? "Welcome Back" : "Start Journey"}
      subtitle={tab === "login" ? "Sign in to access your health records." : "Join CareXAI to track your health with AI."}
      themeColor="from-blue-500/10"
    >
      <div className="flex glass rounded-full p-1 mb-8 w-fit mx-auto md:mx-0">
        <button
          onClick={() => setTab("login")}
          className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${tab === "login" ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"}`}
        >
          Sign In
        </button>
        <button
          onClick={() => setTab("signup")}
          className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${tab === "signup" ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"}`}
        >
          Sign Up
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {tab === "signup" && (
          <NeonInput 
            label="Full Name" 
            icon={<Heart className="h-4 w-4" />} 
            placeholder="Jane Doe" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={() => setCharState("WATCHING")}
            onBlur={() => setCharState("IDLE")}
            required
          />
        )}
        <NeonInput 
          label="Email Address" 
          icon={<Mail className="h-4 w-4" />} 
          placeholder="jane@example.com" 
          type="email" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onFocus={() => setCharState("WATCHING")}
          onBlur={() => setCharState("IDLE")}
          required
        />
        <NeonInput 
          label="Password" 
          icon={<Lock className="h-4 w-4" />} 
          placeholder="••••••••" 
          type="password" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onFocus={() => setCharState("HIDING")}
          onBlur={() => setCharState("IDLE")}
          required
        />

        <NeonButton type="submit" size="lg" className="w-full mt-4" disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
            <span className="flex items-center gap-2">
              {tab === "login" ? "Sign In to Dashboard" : "Create Patient Account"}
              <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </NeonButton>
      </form>
    </SplitAuthLayout>
  );
};

export default PatientAuth;
