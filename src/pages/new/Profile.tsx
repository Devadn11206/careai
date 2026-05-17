import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { 
  User as UserIcon, Mail, Phone, Calendar, 
  MapPin, Shield, Camera, Save, X, Lock, 
  LogOut, Briefcase, Award, Hash, Clock
} from "lucide-react";
import { AppLayout } from "@/components/carex/AppLayout";
import { GlassCard } from "@/components/carex/GlassCard";
import { NeonButton } from "@/components/carex/NeonButton";
import { NeonInput } from "@/components/carex/NeonInput";
import { useHealth } from "@/services/HealthContext";
import { BackendAPI } from "@/services/apiClient";
import { toast } from "sonner";
import { UserRole } from "@/types";

const Profile = () => {
  const { user, setUser, logout } = useHealth();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    age: user?.age || "",
    gender: user?.gender || "",
    specialization: user?.specialization || "",
    experienceYears: user?.experienceYears || "",
    qualification: user?.qualification || "",
  });

  const [passwordData, setPasswordData] = useState({
    current: "",
    new: "",
    confirm: ""
  });
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }

    setIsLoading(true);
    try {
      const updatedUser = await BackendAPI.updateProfile(formData as any);
      setUser({ ...user, ...updatedUser } as any);
      setIsEditing(false);
      toast.success("Profile updated successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        const res = await BackendAPI.updateProfilePic(base64);
        setUser({ ...user, profilePicUrl: res.profilePicUrl } as any);
        toast.success("Profile picture updated");
      } catch (err: any) {
        toast.error(err.message || "Failed to upload photo");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleChangePassword = async () => {
    if (passwordData.new !== passwordData.confirm) {
      toast.error("New passwords do not match");
      return;
    }
    if (passwordData.new.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      await BackendAPI.changePassword({
        currentPassword: passwordData.current,
        newPassword: passwordData.new
      });
      toast.success("Password changed successfully");
      setShowPasswordModal(false);
      setPasswordData({ current: "", new: "", confirm: "" });
    } catch (err: any) {
      toast.error(err.message || "Failed to change password");
    }
  };

  if (!user) return null;

  return (
    <AppLayout title="Profile Settings" subtitle="Manage your clinical identity and neural link">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Avatar & Basic Info */}
        <div className="lg:col-span-1 space-y-6">
          <GlassCard className="p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary to-accent" />
            
            <div className="relative inline-block group mb-6">
              <div className="h-32 w-32 rounded-full border-4 border-primary/20 p-1 bg-muted/30">
                {user.profilePicUrl ? (
                  <img src={user.profilePicUrl} alt="Profile" className="h-full w-full rounded-full object-cover" />
                ) : (
                  <div className="h-full w-full rounded-full bg-primary/10 flex items-center justify-center">
                    <UserIcon className="h-12 w-12 text-primary" />
                  </div>
                )}
              </div>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-glow-primary hover:scale-110 transition-transform"
              >
                <Camera className="h-5 w-5" />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handlePhotoUpload} 
              />
            </div>

            <h2 className="text-2xl font-bold mb-1">{user.name}</h2>
            <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest mb-6">
              {user.role} <span className="mx-2 text-primary">|</span> {user.id.slice(-8).toUpperCase()}
            </p>

            <div className="space-y-3 pt-6 border-t border-border/50 text-left">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 text-primary" />
                <span>{user.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Phone className="h-4 w-4 text-primary" />
                <span>{user.phone || "Not provided"}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Clock className="h-4 w-4 text-primary" />
                <span>Joined {new Date(user.createdAt || "").toLocaleDateString()}</span>
              </div>
            </div>

            <div className="mt-8 space-y-3">
              <NeonButton variant="ghost" className="w-full justify-start text-xs" onClick={() => setShowPasswordModal(true)}>
                <Lock className="h-4 w-4 mr-3" /> Change Password
              </NeonButton>
              <NeonButton variant="ghost" className="w-full justify-start text-xs text-destructive hover:bg-destructive/10" onClick={logout}>
                <LogOut className="h-4 w-4 mr-3" /> Logout Session
              </NeonButton>
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="h-5 w-5 text-primary" />
              <h3 className="font-bold">Account Status</h3>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
              <span className="text-sm">Verification</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${user.status === 'VERIFIED' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
                {user.status || 'ACTIVE'}
              </span>
            </div>
          </GlassCard>
        </div>

        {/* Right Column: Editable Profile Details */}
        <div className="lg:col-span-2 space-y-6">
          <GlassCard className="p-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold flex items-center gap-3">
                <Briefcase className="h-6 w-6 text-primary" />
                Identity Details
              </h3>
              {!isEditing ? (
                <NeonButton size="sm" onClick={() => setIsEditing(true)}>Edit Profile</NeonButton>
              ) : (
                <div className="flex gap-2">
                  <NeonButton variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Cancel</NeonButton>
                  <NeonButton size="sm" onClick={handleSave} disabled={isLoading}>
                    {isLoading ? "Saving..." : "Save Changes"}
                  </NeonButton>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Full Name</label>
                <NeonInput 
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  icon={<UserIcon className="h-5 w-5" />}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Phone Number</label>
                <NeonInput 
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  icon={<Phone className="h-5 w-5" />}
                  placeholder="+1 (555) 000-0000"
                />
              </div>

              {/* Role-Based Fields */}
              {user.role === UserRole.PATIENT && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Age</label>
                    <NeonInput 
                      name="age"
                      type="number"
                      value={formData.age}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      icon={<Calendar className="h-5 w-5" />}
                      placeholder="25"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Gender</label>
                    <NeonInput 
                      name="gender"
                      value={formData.gender}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      icon={<UserIcon className="h-5 w-5" />}
                      placeholder="e.g. Male, Female"
                    />
                  </div>
                </>
              )}

              {user.role === UserRole.DOCTOR && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Specialization</label>
                    <NeonInput 
                      name="specialization"
                      value={formData.specialization}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      icon={<Stethoscope className="h-5 w-5" />}
                      placeholder="e.g. Cardiology"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Experience (Years)</label>
                    <NeonInput 
                      name="experienceYears"
                      type="number"
                      value={formData.experienceYears}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      icon={<Award className="h-5 w-5" />}
                      placeholder="10"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Qualification</label>
                    <NeonInput 
                      name="qualification"
                      value={formData.qualification}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      icon={<Hash className="h-5 w-5" />}
                      placeholder="e.g. MBBS, MD"
                    />
                  </div>
                </>
              )}
            </div>
          </GlassCard>

          <GlassCard className="p-8 border-dashed border-2 border-primary/20 bg-primary/5">
            <h3 className="font-bold mb-4 flex items-center gap-3">
              <Mail className="h-5 w-5 text-primary" />
              Email & System Auth
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Your primary email address is used for authentication and neural notifications. 
              Email changes require administrative override.
            </p>
            <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-primary" />
                <span className="font-mono text-sm">{user.email}</span>
              </div>
              <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">PRIMARY</span>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md"
          >
            <GlassCard className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold flex items-center gap-3">
                  <Lock className="h-6 w-6 text-primary" />
                  Change Password
                </h3>
                <button onClick={() => setShowPasswordModal(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Current Password</label>
                  <NeonInput 
                    type="password"
                    value={passwordData.current}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, current: e.target.value }))}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase">New Password</label>
                  <NeonInput 
                    type="password"
                    value={passwordData.new}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, new: e.target.value }))}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Confirm New Password</label>
                  <NeonInput 
                    type="password"
                    value={passwordData.confirm}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, confirm: e.target.value }))}
                    placeholder="••••••••"
                  />
                </div>
                <div className="pt-4 flex gap-3">
                  <NeonButton variant="ghost" className="flex-1" onClick={() => setShowPasswordModal(false)}>Cancel</NeonButton>
                  <NeonButton className="flex-1" onClick={handleChangePassword}>Update Password</NeonButton>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      )}
    </AppLayout>
  );
};

// Internal icon helper
const Stethoscope = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}
  >
    <path d="M4.8 2.3A.3.3 0 1 0 5 2a.3.3 0 1 0-.2.3Z"/><path d="M10 2v2"/><path d="M7 2v2"/><path d="M6 4v2"/><path d="M12 4v2"/><path d="M3 14c0-3.3 2.7-6 6-6s6 2.7 6 6v3a3 3 0 0 1-3 3 3 3 0 0 1-3-3v-3"/><path d="M18 10h3"/><path d="M18 10.5V19a2 2 0 0 0 2 2h1"/>
  </svg>
);

export default Profile;
