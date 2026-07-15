import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Compact metadata chip (icon + label), used in the repository header. */
export function Chip({
  icon: Icon,
  children,
  className,
  accent,
}: {
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
  accent?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium",
        accent
          ? "border-accent/20 bg-accent/10 text-accent-bright"
          : "border-border bg-card text-muted-foreground",
        className,
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </span>
  );
}
