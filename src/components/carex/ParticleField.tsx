import { motion } from "framer-motion";

export const ParticleField = ({ count = 30 }: { count?: number }) => {
  const particles = Array.from({ length: count });
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
      {particles.map((_, i) => {
        const size = 1 + Math.random() * 3;
        const left = Math.random() * 100;
        const top = Math.random() * 100;
        const delay = Math.random() * 8;
        const duration = 8 + Math.random() * 12;
        const isPurple = Math.random() > 0.6;
        return (
          <motion.span
            key={i}
            className="absolute rounded-full"
            style={{
              width: size,
              height: size,
              left: `${left}%`,
              top: `${top}%`,
              background: isPurple ? "hsl(var(--secondary))" : "hsl(var(--primary))",
              boxShadow: `0 0 ${size * 4}px ${isPurple ? "hsl(var(--secondary))" : "hsl(var(--primary))"}`,
            }}
            animate={{
              y: [0, -40, 0],
              opacity: [0.2, 0.8, 0.2],
            }}
            transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }}
          />
        );
      })}
    </div>
  );
};
