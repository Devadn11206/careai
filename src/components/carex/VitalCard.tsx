import { motion } from "framer-motion";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { GlassCard } from "./GlassCard";
import { AnimatedCounter } from "./AnimatedCounter";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface VitalCardProps {
  label: string;
  value: number;
  unit: string;
  icon: LucideIcon;
  data: { v: number }[];
  trend?: number;
  color?: "primary" | "secondary" | "success" | "warning" | "destructive";
  decimals?: number;
}

const colorMap = {
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--secondary))",
  success: "hsl(var(--success))",
  warning: "hsl(var(--warning))",
  destructive: "hsl(var(--destructive))",
};

export const VitalCard = ({
  label, value, unit, icon: Icon, data, trend = 0, color = "primary", decimals = 0,
}: VitalCardProps) => {
  const stroke = colorMap[color];
  const id = `grad-${label.replace(/\s/g, "")}`;

  return (
    <GlassCard className="overflow-hidden p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center"
            style={{
              background: `${stroke}1A`,
              boxShadow: `0 0 20px ${stroke}30`,
            }}
          >
            <Icon className="h-5 w-5" style={{ color: stroke }} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
            <div className="flex items-baseline gap-1 mt-1">
              <AnimatedCounter
                value={value}
                decimals={decimals}
                className="font-display text-2xl font-bold text-foreground"
              />
              <span className="text-xs text-muted-foreground">{unit}</span>
            </div>
          </div>
        </div>
        {trend !== 0 && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`inline-flex items-center gap-1 text-xs font-medium ${trend > 0 ? "text-success" : "text-destructive"}`}
          >
            {trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend)}%
          </motion.span>
        )}
      </div>

      <div className="h-16 -mx-5 -mb-5">
        <ResponsiveContainer width="100%" height={64} minWidth={0} debounce={50}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.5} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke={stroke}
              strokeWidth={2}
              fill={`url(#${id})`}
              isAnimationActive
              animationDuration={1200}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
};
