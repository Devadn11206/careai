import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Mail, 
  Lock, 
  ArrowRight, 
  Loader2, 
  Stethoscope, 
  Upload, 
  FileCheck, 
  Building2, 
  Award, 
  DollarSign, 
  MapPin, 
  Phone,
  User,
  ShieldCheck,
  ChevronLeft,
  CheckCircle2,
  X
} from "lucide-react";
import { NeonInput } from "@/components/carex/NeonInput";
import { NeonButton } from "@/components/carex/NeonButton";
import { BackendAPI } from "@/services/apiClient";
import { useHealth } from "@/services/HealthContext";
import { UserRole, DoctorStatus } from "@/types";
import { toast } from "sonner";
import { SplitAuthLayout } from "@/components/common/SplitAuthLayout";
import { CharacterState } from "@/components/visuals/LoginCharacter";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const DoctorAuth = () => {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [charState, setCharState] = useState<CharacterState>("IDLE");
  
  // Signup State
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    specialization: "",
    experienceYears: "",
    hospital: "",
    registrationNumber: "",
    consultationFee: "",
    address: ""
  });

  const [documents, setDocuments] = useState<{
    [key: string]: { file: File; name: string; url: string } | null
  }>({
    license: null,
    idProof: null,
    degree: null,
    specialization: null,
    affiliation: null
  });

  const [loginData, setLoginData] = useState({
    email: "",
    password: ""
  });
  
  const navigate = useNavigate();
  const { setUser } = useHealth();

  const handleFileUpload = (type: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
        return;
      }
      setDocuments(prev => ({
        ...prev,
        [type]: {
          file,
          name: file.name,
          url: URL.createObjectURL(file)
        }
      }));
      toast.success(`${file.name} uploaded successfully`);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setCharState("WATCHING");

    try {
      const res = await BackendAPI.login(loginData.email, loginData.password);
      
      if (res.user.role !== UserRole.DOCTOR) {
        throw new Error("This account is not a Clinician account. Please use the correct portal.");
      }

      if (res.user.status !== DoctorStatus.VERIFIED) {
        setCharState("ERROR");
        toast.error("Account Pending Verification", {
          description: "Your credentials are under review by our medical board. You will be notified once authorized."
        });
        setIsLoading(false);
        return;
      }

      setUser(res.user as any);
      setCharState("SUCCESS");
      toast.success(`Welcome back, Dr. ${res.user.name}`);
      setTimeout(() => navigate("/dashboard"), 1000);
    } catch (err: any) {
      setCharState("ERROR");
      toast.error(err.message || "Authentication failed");
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      setStep(prev => prev + 1);
      return;
    }

    // Validate documents
    if (!documents.license || !documents.idProof || !documents.degree) {
      toast.error("Please upload all mandatory documents");
      return;
    }

    setIsLoading(true);
    setCharState("WATCHING");

    try {
      // In a real app, we'd upload to S3/Cloudinary first.
      // For this implementation, we simulate the URLs.
      const res = await BackendAPI.register({
        ...formData,
        role: UserRole.DOCTOR,
        specialization: formData.specialization || null,
        experienceYears: typeof formData.experienceYears === 'number' ? formData.experienceYears : parseInt(formData.experienceYears) || null,
        hospital: formData.hospital || null,
        registrationNumber: formData.registrationNumber || null,
        consultationFee: typeof formData.consultationFee === 'number' ? formData.consultationFee : parseFloat(formData.consultationFee) || 0,
        phone: formData.phone || null,
        verificationDocumentUrl: documents.license.url || null,
        verificationDocumentName: documents.license.name || 'License_Verification'
      });
      
      setCharState("SUCCESS");
      toast.success("Application Submitted!", {
        description: "Dr. " + formData.name + ", your credentials are now being audited. Check your email for status updates."
      });
      
      // Clear sensitive state
      setTimeout(() => {
        setTab("login");
        setStep(1);
        setIsLoading(false);
      }, 3000);

    } catch (err: any) {
      setCharState("ERROR");
      toast.error(err.message || "Registration failed");
      setIsLoading(false);
    }
  };

  return (
    <SplitAuthLayout
      role="Doctor"
      characterState={charState}
      title={tab === "login" ? "Clinician Portal" : "Join Clinical Network"}
      subtitle={tab === "login" ? "Access your patient panels and AI insights." : "Step " + step + " of 3: " + (step === 1 ? "Identity" : step === 2 ? "Professional" : "Verification")}
      themeColor="from-emerald-500/10"
    >
      <div className="flex glass rounded-full p-1 mb-8 w-fit mx-auto md:mx-0">
        <button
          onClick={() => { setTab("login"); setStep(1); }}
          className={cn(
            "px-6 py-2 rounded-full text-sm font-medium transition-all",
            tab === "login" ? "bg-emerald-600 text-white shadow-glow" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Sign In
        </button>
        <button
          onClick={() => setTab("signup")}
          className={cn(
            "px-6 py-2 rounded-full text-sm font-medium transition-all",
            tab === "signup" ? "bg-emerald-600 text-white shadow-glow" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Register
        </button>
      </div>

      <AnimatePresence mode="wait">
        {tab === "login" ? (
          <motion.form 
            key="login"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            onSubmit={handleLogin} 
            className="space-y-5"
          >
            <NeonInput 
              label="Professional Email" 
              icon={<Mail className="h-4 w-4" />} 
              placeholder="dr.smith@hospital.com" 
              type="email" 
              value={loginData.email}
              onChange={(e) => setLoginData(prev => ({ ...prev, email: e.target.value }))}
              onFocus={() => setCharState("WATCHING")}
              onBlur={() => setCharState("IDLE")}
              required
            />
            <NeonInput 
              label="Secure Password" 
              icon={<Lock className="h-4 w-4" />} 
              placeholder="••••••••" 
              type="password" 
              value={loginData.password}
              onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
              onFocus={() => setCharState("HIDING")}
              onBlur={() => setCharState("IDLE")}
              required
            />
            <NeonButton type="submit" size="lg" className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 border-emerald-500/50 shadow-glow-emerald" disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <span className="flex items-center gap-2 uppercase tracking-widest text-xs font-black">
                  Authorize Access <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </NeonButton>
          </motion.form>
        ) : (
          <motion.form 
            key="signup"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            onSubmit={handleSignup} 
            className="space-y-5"
          >
            {step === 1 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                <NeonInput 
                  label="Full Name (Including Dr.)" 
                  icon={<User className="h-4 w-4" />} 
                  placeholder="Dr. Alexander Pierce" 
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
                <NeonInput 
                  label="Professional Email" 
                  icon={<Mail className="h-4 w-4" />} 
                  placeholder="alex.pierce@carex.ai" 
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <NeonInput 
                    label="Mobile Number" 
                    icon={<Phone className="h-4 w-4" />} 
                    placeholder="+1 234 567 890" 
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    required
                  />
                  <NeonInput 
                    label="Password" 
                    icon={<Lock className="h-4 w-4" />} 
                    type="password"
                    placeholder="••••••••" 
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    required
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <NeonInput 
                    label="Medical Specialization" 
                    icon={<Stethoscope className="h-4 w-4" />} 
                    placeholder="Cardiology" 
                    value={formData.specialization}
                    onChange={(e) => setFormData(prev => ({ ...prev, specialization: e.target.value }))}
                    required
                  />
                  <NeonInput 
                    label="Experience (Years)" 
                    icon={<Award className="h-4 w-4" />} 
                    placeholder="12" 
                    type="number"
                    value={formData.experienceYears}
                    onChange={(e) => setFormData(prev => ({ ...prev, experienceYears: e.target.value }))}
                    required
                  />
                </div>
                <NeonInput 
                  label="Primary Hospital/Clinic" 
                  icon={<Building2 className="h-4 w-4" />} 
                  placeholder="Mayo Clinical Center" 
                  value={formData.hospital}
                  onChange={(e) => setFormData(prev => ({ ...prev, hospital: e.target.value }))}
                  required
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <NeonInput 
                    label="Medical License ID" 
                    icon={<ShieldCheck className="h-4 w-4" />} 
                    placeholder="ML-882390" 
                    value={formData.registrationNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, registrationNumber: e.target.value }))}
                    required
                  />
                  <NeonInput 
                    label="Consultation Fee ($)" 
                    icon={<DollarSign className="h-4 w-4" />} 
                    placeholder="150" 
                    type="number"
                    value={formData.consultationFee}
                    onChange={(e) => setFormData(prev => ({ ...prev, consultationFee: e.target.value }))}
                    required
                  />
                </div>
                <NeonInput 
                  label="Professional Address" 
                  icon={<MapPin className="h-4 w-4" />} 
                  placeholder="123 Clinical Way, New York, NY" 
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  required
                />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-4">
                  <p className="text-[10px] text-amber-200 font-bold uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck size={12} /> Mandatory Document Submission
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">Upload high-resolution scans of your credentials for verification.</p>
                </div>

                {[
                  { id: 'license', label: 'Medical License Certificate' },
                  { id: 'idProof', label: 'Government ID Proof' },
                  { id: 'degree', label: 'Medical Degree (MD/MBBS)' },
                  { id: 'affiliation', label: 'Hospital Affiliation Proof' }
                ].map((doc) => (
                  <div key={doc.id} className="relative group">
                    <input 
                      type="file" 
                      id={doc.id}
                      className="hidden" 
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileUpload(doc.id, e)}
                    />
                    <label 
                      htmlFor={doc.id}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-xl border border-dashed transition-all cursor-pointer",
                        documents[doc.id] 
                          ? "bg-emerald-500/10 border-emerald-500/40" 
                          : "bg-muted/10 border-border/40 hover:bg-muted/20 hover:border-primary/40"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2 rounded-lg",
                          documents[doc.id] ? "bg-emerald-500/20 text-emerald-400" : "bg-muted/20 text-muted-foreground"
                        )}>
                          {documents[doc.id] ? <FileCheck size={18} /> : <Upload size={18} />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground">{doc.label}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {documents[doc.id] ? documents[doc.id]?.name : "Supported: PDF, JPG, PNG (Max 5MB)"}
                          </p>
                        </div>
                      </div>
                      {documents[doc.id] && <CheckCircle2 size={16} className="text-emerald-500" />}
                    </label>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-4 mt-8">
              {step > 1 && (
                <NeonButton 
                  type="button" 
                  variant="outline" 
                  onClick={() => setStep(prev => prev - 1)}
                  className="flex-1"
                >
                  <ChevronLeft className="h-4 w-4 mr-2" /> Back
                </NeonButton>
              )}
              <NeonButton 
                type="submit" 
                size="lg" 
                className="flex-[2] bg-emerald-600 hover:bg-emerald-500 border-emerald-500/50 shadow-glow-emerald" 
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <span className="flex items-center gap-2 uppercase tracking-widest text-xs font-black">
                    {step === 3 ? "Submit Application" : "Next Phase"}
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </NeonButton>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </SplitAuthLayout>
  );
};

export default DoctorAuth;
