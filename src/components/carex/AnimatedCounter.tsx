import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}

export const AnimatedCounter = ({
  value,
  duration = 1.4,
  decimals = 0,
  suffix = "",
  prefix = "",
  className,
}: AnimatedCounterProps) => {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const from = display;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (value - from) * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return (
    <motion.span
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {prefix}
      {display.toFixed(decimals)}
      {suffix}
    </motion.span>
  );
};
