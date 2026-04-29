import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity, LayoutDashboard, Brain, Bell, MessageSquare,
  Video, User, Settings, ChevronLeft, Heart, Stethoscope
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Vitals", url: "/vitals", icon: Activity },
  { title: "AI Insights", url: "/insights", icon: Brain },
  { title: "Alerts", url: "/alerts", icon: Bell, badge: 3 },
  { title: "AI Assistant", url: "/chat", icon: MessageSquare },
  { title: "Consultations", url: "/consult", icon: Video },
  { title: "Doctor View", url: "/doctor", icon: Stethoscope },
];

export const AppSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const onResize = () => setCollapsed(window.innerWidth < 1024);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 80 : 260 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="hidden md:flex sticky top-0 h-screen flex-col glass-strong border-r border-border/50 z-40"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 p-5 border-b border-border/50">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-aurora shadow-glow">
          <Heart className="h-5 w-5 text-primary-foreground" fill="currentColor" />
        </div>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h1 className="font-display font-bold text-lg leading-none">CareXAI</h1>
            <p className="text-[10px] text-muted-foreground tracking-widest mt-1">HEALTHCARE · AI</p>
          </motion.div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {items.map((item) => {
          const active = pathname === item.url;
          return (
            <NavLink
              key={item.title}
              to={item.url}
              className={cn(
                "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 group",
                active
                  ? "text-primary-foreground bg-gradient-primary shadow-glow"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <item.icon className={cn("h-5 w-5 shrink-0 transition-transform group-hover:scale-110", active && "drop-shadow-[0_0_8px_hsl(var(--primary-foreground))]")} />
              {!collapsed && <span className="flex-1">{item.title}</span>}
              {!collapsed && item.badge && (
                <span className="ml-auto rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground shadow-glow-destructive">
                  {item.badge}
                </span>
              )}
              {collapsed && item.badge && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive shadow-glow-destructive" />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border/50 space-y-1">
        <NavLink to="/profile" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
          <User className="h-5 w-5" />
          {!collapsed && <span>Profile</span>}
        </NavLink>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:text-primary hover:bg-muted/50 transition-all"
        >
          <ChevronLeft className={cn("h-5 w-5 transition-transform", collapsed && "rotate-180")} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </motion.aside>
  );
};
