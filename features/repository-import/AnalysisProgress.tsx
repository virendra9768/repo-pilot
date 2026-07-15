"use client";

import { motion } from "framer-motion";
import {
  Check,
  GitBranch,
  Loader2,
  Network,
  ScanSearch,
  Sparkles,
  Waypoints,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const ANALYSIS_STAGES = [
  { label: "Cloning repository", icon: GitBranch },
  { label: "Scanning files & metadata", icon: ScanSearch },
  { label: "Detecting routes, models & imports", icon: Waypoints },
  { label: "Building the intelligence graph", icon: Network },
  { label: "Preparing your guide", icon: Sparkles },
];

export function AnalysisProgress({
  target,
  stageIndex,
  done,
}: {
  target: string;
  stageIndex: number;
  done: boolean;
}) {
  const progress = done
    ? 100
    : Math.min(96, ((stageIndex + 0.6) / ANALYSIS_STAGES.length) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-accent-bright" />
          Analyzing repository
        </span>
        <span className="max-w-[55%] truncate font-mono text-xs text-foreground">{target}</span>
      </div>

      <div className="mt-4 h-1 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full bg-linear-to-r from-accent-2 to-accent"
          initial={{ width: "4%" }}
          animate={{ width: `${progress}%` }}
          transition={{ ease: "easeOut", duration: 0.6 }}
        />
      </div>

      <ul className="mt-5 space-y-1">
        {ANALYSIS_STAGES.map((stage, i) => {
          const state = done || i < stageIndex ? "done" : i === stageIndex ? "active" : "pending";
          const Icon = stage.icon;
          return (
            <li
              key={stage.label}
              className={cn(
                "flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors",
                state === "active" && "bg-accent/5",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                  state === "done" && "bg-accent/15 text-accent-bright",
                  state === "active" && "bg-accent/15 text-accent-bright",
                  state === "pending" && "bg-muted text-faint",
                )}
              >
                {state === "done" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : state === "active" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
              </span>
              <span
                className={cn(
                  state === "pending" ? "text-faint" : "text-foreground",
                  state === "active" && "font-medium",
                )}
              >
                {stage.label}
              </span>
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
}
