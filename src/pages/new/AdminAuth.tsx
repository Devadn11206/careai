import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, ArrowRight, Loader2, Shield } from "lucide-react";
import { NeonInput } from "@/components/carex/NeonInput";
import { NeonButton } from "@/components/carex/NeonButton";
import { BackendAPI } from "@/services/apiClient";
import { useHealth } from "@/services/HealthContext";
import { UserRole } from "@/types";
import { toast } from "sonner";
import { SplitAuthLayout } from "@/components/common/SplitAuthLayout";
import { CharacterState } from "@/components/visuals/LoginCharacter";

const AdminAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [charState, setCharState] = useState<CharacterState>("IDLE");
  
  const navigate = useNavigate();
  const { setUser } = useHealth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setCharState("WATCHING");

    try {
      const res = await BackendAPI.login(email, password);
      if (res.user.role !== UserRole.ADMIN) {
        throw new Error("Access denied. Authorized Admin credentials required.");
      }
      setUser(res.user as any);
      setCharState("SUCCESS");
      toast.success(`Admin Authorization Successful`);
      setTimeout(() => navigate("/dashboard"), 1000);
    } catch (err: any) {
      setCharState("ERROR");
      toast.error(err.message || "Authentication failed");
      setIsLoading(false);
    }
  };

  return (
    <SplitAuthLayout
      role="Admin"
      characterState={charState}
      title="Admin Command"
      subtitle="Authorized personnel only. System-level access required."
      themeColor="from-rose-500/10"
    >
      <div className="flex glass rounded-full p-1 mb-8 w-fit mx-auto md:mx-0">
        <div className="px-6 py-2 rounded-full text-sm font-bold bg-rose-600 text-white shadow-glow">
          SECURE LOGIN
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <NeonInput 
          label="Admin Identifier" 
          icon={<Shield className="h-4 w-4" />} 
          placeholder="admin@carexai.com" 
          type="email" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onFocus={() => setCharState("WATCHING")}
          onBlur={() => setCharState("IDLE")}
          required
        />
        <NeonInput 
          label="Passphrase" 
          icon={<Lock className="h-4 w-4" />} 
          placeholder="••••••••" 
          type="password" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onFocus={() => setCharState("HIDING")}
          onBlur={() => setCharState("IDLE")}
          required
        />

        <NeonButton type="submit" size="lg" className="w-full mt-4 bg-rose-600 hover:bg-rose-500 border-rose-500/50" disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
            <span className="flex items-center gap-2">
              Execute Login
              <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </NeonButton>
      </form>
    </SplitAuthLayout>
  );
};

export default AdminAuth;
