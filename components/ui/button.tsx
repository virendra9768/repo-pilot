import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "outline" | "ghost" | "subtle";
type Size = "default" | "sm" | "lg" | "icon";

const VARIANTS: Record<Variant, string> = {
  default:
    "bg-accent text-accent-foreground shadow-[0_1px_0_0_rgba(255,255,255,0.12)_inset,0_8px_24px_-8px_var(--accent-glow)] hover:-translate-y-px hover:shadow-[0_1px_0_0_rgba(255,255,255,0.18)_inset,0_12px_30px_-8px_var(--accent-glow)]",
  outline:
    "border border-border bg-card text-foreground hover:bg-card-hover hover:border-border-strong",
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
  subtle: "bg-muted text-foreground hover:bg-card-hover",
};

const SIZES: Record<Size, string> = {
  default: "h-10 px-4 text-sm",
  sm: "h-8 px-3 text-[13px]",
  lg: "h-12 px-6 text-[15px]",
  icon: "h-10 w-10",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
