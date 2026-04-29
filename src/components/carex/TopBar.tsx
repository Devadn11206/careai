import { motion } from "framer-motion";
import { Bell, Search, Menu } from "lucide-react";
import { NeonInput } from "./NeonInput";
import { useNavigate } from "react-router-dom";
import { useHealth } from "@/services/HealthContext";

export const TopBar = ({ title, subtitle }: { title: string; subtitle?: string }) => {
  const navigate = useNavigate();
  const { user, alerts } = useHealth();
  
  const initials = user?.name
    ? user.name.split(" ").map(n => n[0]).join("").toUpperCase()
    : "??";

  return (
    <header className="sticky top-0 z-30 glass-strong border-b border-border/50 px-4 md:px-8 py-4">
      <div className="flex items-center gap-4">
        <button className="md:hidden text-muted-foreground hover:text-foreground">
          <Menu className="h-6 w-6" />
        </button>
        <div className="flex-1 min-w-0">
          <motion.h1
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-xl md:text-2xl font-semibold truncate"
          >
            {title}
          </motion.h1>
          {subtitle && <p className="text-sm text-muted-foreground truncate">{subtitle}</p>}
        </div>

        <div className="hidden md:block w-72">
          <NeonInput icon={<Search className="h-4 w-4" />} placeholder="Search metrics, history..." className="h-10" />
        </div>

        <button
          onClick={() => navigate("/alerts")}
          className="relative h-11 w-11 rounded-xl glass hover:border-primary/40 hover:shadow-glow transition-all flex items-center justify-center group"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5 text-foreground group-hover:text-primary transition-colors" />
          {alerts.length > 0 && (
            <motion.span
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center shadow-glow-destructive"
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            >
              {alerts.length}
            </motion.span>
          )}
        </button>

        <div className="h-11 w-11 rounded-xl bg-gradient-aurora flex items-center justify-center font-semibold text-primary-foreground shadow-glow shrink-0">
          {initials}
        </div>
      </div>
    </header>
  );
};
