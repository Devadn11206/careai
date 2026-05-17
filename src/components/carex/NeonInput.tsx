import * as React from "react";
import { cn } from "@/lib/utils";
import { HelpCircle } from "lucide-react";

export interface NeonInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  label?: string;
  tooltip?: string;
}

export const NeonInput = React.forwardRef<HTMLInputElement, NeonInputProps>(
  ({ className, icon, label, tooltip, id, ...props }, ref) => {
    const inputId = id || React.useId();
    return (
      <div className="space-y-2">
        {label && (
          <div className="flex items-center gap-1.5">
            <label htmlFor={inputId} className="text-sm font-medium text-muted-foreground">
              {label}
            </label>
            {tooltip && (
              <span title={tooltip}>
                <HelpCircle 
                  className="h-3.5 w-3.5 text-muted-foreground/50 cursor-help hover:text-primary transition-colors" 
                />
              </span>
            )}
          </div>
        )}
        <div className="relative group">
          {icon && (
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
              {icon}
            </span>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              "w-full h-12 rounded-xl bg-input/40 backdrop-blur-md border border-border/50 px-4 text-foreground placeholder:text-muted-foreground/50",
              "transition-all duration-300 outline-none shadow-inner",
              "focus:border-primary/50 focus:bg-input/60 focus:shadow-[0_0_0_4px_hsl(var(--primary)/0.1),0_0_20px_hsl(var(--primary)/0.15)]",
              icon && "pl-11",
              className
            )}
            {...props}
          />
        </div>
      </div>
    );
  }
);
NeonInput.displayName = "NeonInput";
