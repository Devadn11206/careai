import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, Video, VideoOff, PhoneOff, MonitorUp, MessageSquare, Sparkles } from "lucide-react";
import { AppLayout } from "@/components/carex/AppLayout";
import { GlassCard } from "@/components/carex/GlassCard";
import { NeonButton } from "@/components/carex/NeonButton";
import { useHealth } from "@/services/HealthContext";
import { BackendAPI } from "@/services/apiClient";
import { toast } from "sonner";

const Consult = () => {
  const [muted, setMuted] = useState(false);
  const [video, setVideo] = useState(true);
  const { user } = useHealth();
  const remoteRef = useRef<HTMLDivElement>(null);
  const localRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // In a real app, you'd fetch tokens and join channel here
    // For this demo, we ensure the UI is ready for the streams
    toast.info("Connecting to secure clinical channel...");
  }, []);

  return (
    <AppLayout title="Video Consultation" subtitle="Live with Dr. Reena Kapoor · Cardiology">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main video */}
        <div className="lg:col-span-3 space-y-4">
          <GlassCard variant="strong" hover={false} className="relative aspect-video p-0 overflow-hidden">
            <div ref={remoteRef} className="absolute inset-0 bg-gradient-to-br from-secondary/30 via-background to-primary/20 grid-bg" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="h-32 w-32 rounded-full bg-gradient-aurora shadow-glow flex items-center justify-center text-4xl font-display font-bold text-primary-foreground mx-auto"
                >
                  RK
                </motion.div>
                <p className="mt-4 font-display text-xl">Dr. Reena Kapoor</p>
                <p className="text-sm text-muted-foreground">Connecting · HD Quality</p>
              </div>
            </div>

            {/* Self preview */}
            <motion.div
              drag dragMomentum={false}
              className="absolute bottom-4 right-4 w-40 h-28 rounded-xl glass border border-primary/40 shadow-glow overflow-hidden cursor-move bg-black"
            >
              <div ref={localRef} className="absolute inset-0" />
              <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center pointer-events-none">
                <span className="font-semibold text-primary-foreground text-xs">You</span>
              </div>
            </motion.div>

            {/* Live badge */}
            <div className="absolute top-4 left-4 glass rounded-full px-3 py-1 text-xs flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" /> LIVE · 04:32
            </div>
          </GlassCard>

          {/* Controls */}
          <GlassCard hover={false} className="flex items-center justify-center gap-3 py-4">
            <NeonButton variant={muted ? "destructive" : "neon"} size="icon" onClick={() => setMuted(!muted)}>
              {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </NeonButton>
            <NeonButton variant={video ? "neon" : "destructive"} size="icon" onClick={() => setVideo(!video)}>
              {video ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
            </NeonButton>
            <NeonButton variant="neon" size="icon">
              <MonitorUp className="h-4 w-4" />
            </NeonButton>
            <NeonButton variant="destructive" size="lg">
              <PhoneOff className="h-4 w-4" /> End
            </NeonButton>
          </GlassCard>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="font-display font-semibold text-sm">AI Live Notes</h3>
            </div>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>• Patient reports occasional chest tightness</p>
              <p>• BP trend stable past 30 days</p>
              <p>• Discussed medication adjustment</p>
              <p>• Recommended follow-up in 2 weeks</p>
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="h-4 w-4 text-primary" />
              <h3 className="font-display font-semibold text-sm">Live Transcript</h3>
            </div>
            <div className="space-y-3 text-xs max-h-64 overflow-y-auto">
              <div>
                <p className="font-semibold text-primary">Dr. Kapoor</p>
                <p className="text-muted-foreground">How have you been feeling this week?</p>
              </div>
              <div>
                <p className="font-semibold text-secondary">You</p>
                <p className="text-muted-foreground">Mostly good — slight tightness yesterday morning.</p>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </AppLayout>
  );
};

export default Consult;
