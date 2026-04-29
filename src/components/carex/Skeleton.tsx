import { cn } from "@/lib/utils";

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn("animate-shimmer rounded-lg", className)} />
);
