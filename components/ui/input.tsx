import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-border bg-card px-3.5 text-sm text-foreground transition-colors placeholder:text-faint focus-visible:border-accent/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/15 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
