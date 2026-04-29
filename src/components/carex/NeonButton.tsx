import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const neonButtonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] overflow-hidden group",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-primary text-primary-foreground shadow-glow hover:shadow-[0_0_45px_hsl(var(--primary)/0.6)] hover:brightness-110",
        neon:
          "glass border-primary/40 text-primary hover:text-primary-foreground hover:bg-primary hover:shadow-glow",
        ghost:
          "text-foreground hover:bg-muted/50 hover:text-primary",
        outline:
          "border border-border bg-transparent hover:border-primary/50 hover:text-primary",
        secondary:
          "bg-secondary/20 text-secondary-foreground border border-secondary/30 hover:bg-secondary/30 hover:shadow-glow-secondary",
        destructive:
          "bg-destructive/90 text-destructive-foreground hover:shadow-glow-destructive",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-6 text-sm",
        lg: "h-13 px-8 text-base py-3.5",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface NeonButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof neonButtonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
}

export const NeonButton = React.forwardRef<HTMLButtonElement, NeonButtonProps>(
  ({ className, variant, size, asChild = false, isLoading, children, ...props }, ref) => {
    const classes = cn(neonButtonVariants({ variant, size, className }));
    
    if (asChild) {
      return (
        <Slot className={classes} ref={ref} {...props}>
          {children}
        </Slot>
      );
    }
    
    return (
      <button 
        className={classes} 
        ref={ref} 
        disabled={isLoading || props.disabled}
        {...props}
      >
        <span className="relative z-10 inline-flex items-center gap-2">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {children}
        </span>
        {variant === "primary" && (
          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        )}
      </button>
    );
  }
);
NeonButton.displayName = "NeonButton";
