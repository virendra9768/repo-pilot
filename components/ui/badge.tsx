import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "accent" | "outline";

const VARIANTS: Record<Variant, string> = {
  default: "border-border bg-muted text-muted-foreground",
  accent: "border-accent/20 bg-accent/10 text-accent-bright",
  outline: "border-border text-muted-foreground",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
