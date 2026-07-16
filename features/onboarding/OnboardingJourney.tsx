"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileCode2,
  GraduationCap,
} from "lucide-react";
import type { OnboardingResult } from "@/engine/prompts/onboarding";
import { useAiResource, fetchJson } from "@/hooks/useAiResource";
import { fileUrl } from "@/lib/utils/github";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/states";
import { cn } from "@/lib/utils";

const DIFF: Record<string, { label: string; cls: string; dot: string }> = {
  beginner: { label: "Beginner", cls: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20", dot: "bg-emerald-400" },
  intermediate: { label: "Intermediate", cls: "text-amber-300 bg-amber-500/10 border-amber-500/20", dot: "bg-amber-400" },
  advanced: { label: "Advanced", cls: "text-rose-300 bg-rose-500/10 border-rose-500/20", dot: "bg-rose-400" },
};

export function OnboardingJourney({ id }: { id: string }) {
  const { data, error, loading, reload } = useAiResource<OnboardingResult>(
    () =>
      fetchJson<{ onboarding: OnboardingResult }>(
        `/api/ai/onboarding?id=${encodeURIComponent(id)}`,
      ).then((r) => r.onboarding),
    [id],
  );
  const [active, setActive] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const storageKey = `repopilot:onboarding:${id}`;

  useEffect(() => {
    void (async () => {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) setCompleted(new Set(JSON.parse(raw)));
      } catch {
        /* ignore */
      }
    })();
  }, [storageKey]);

  function toggleComplete(day: number) {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      try {
        localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  if (loading) return <OnboardingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data || data.days.length === 0) return null;

  const days = data.days;
  const day = days[Math.min(active, days.length - 1)];
  const diff = DIFF[day.difficulty] ?? DIFF.beginner;
  const doneCount = days.filter((d) => completed.has(d.day)).length;
  const pct = Math.round((doneCount / days.length) * 100);

  return (
    <div className="space-y-6">
      <div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-bright">
          <GraduationCap className="h-3.5 w-3.5" /> Guided onboarding
        </span>
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">{data.overview}</p>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-1.5 w-48 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-linear-to-r from-accent-2 to-accent"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ ease: "easeOut", duration: 0.5 }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {doneCount}/{days.length} days · {pct}% complete
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        {/* Day rail */}
        <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {days.map((d, i) => {
            const dm = DIFF[d.difficulty] ?? DIFF.beginner;
            const isActive = i === active;
            const isDone = completed.has(d.day);
            return (
              <button
                key={d.day}
                onClick={() => setActive(i)}
                className={cn(
                  "flex min-w-[13rem] items-center gap-3 rounded-xl border p-3 text-left transition-colors lg:min-w-0",
                  isActive
                    ? "border-accent/40 bg-accent/5"
                    : "border-border bg-card hover:border-border-strong",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
                    isDone ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {isDone ? <Check className="h-3.5 w-3.5" /> : d.day}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">{d.title}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className={cn("h-1.5 w-1.5 rounded-full", dm.dot)} />
                    {dm.label} · {d.estimatedMinutes}m
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Day detail */}
        <AnimatePresence mode="wait">
          <motion.div
            key={day.day}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-2xl border border-border bg-card p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-medium text-faint">Day {day.day}</div>
                <h2 className="mt-0.5 text-xl font-semibold tracking-tight">{day.title}</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium", diff.cls)}>
                  {diff.label}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" /> ~{day.estimatedMinutes}m
                </span>
              </div>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{day.objective}</p>

            <div className="mt-5 space-y-2">
              {day.steps.map((step, i) => {
                const url = fileUrl(id, step.path);
                const Wrapper = url ? "a" : "div";
                return (
                  <Wrapper
                    key={`${step.path}-${i}`}
                    {...(url ? { href: url, target: "_blank", rel: "noreferrer" } : {})}
                    className={cn(
                      "group flex gap-3 rounded-xl border border-border bg-bg/40 p-3 transition-colors",
                      url && "hover:border-border-strong",
                    )}
                  >
                    <FileCode2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-bright/80" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <code className="truncate font-mono text-xs text-foreground">{step.path}</code>
                        <span className="flex shrink-0 items-center gap-1.5">
                          <span className="text-[10px] text-faint">~{step.readingTimeMinutes}m</span>
                          {url && (
                            <ArrowUpRight className="h-3.5 w-3.5 text-faint transition-colors group-hover:text-accent-bright" />
                          )}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.reason}</p>
                    </div>
                  </Wrapper>
                );
              })}
            </div>

            <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
              <button
                onClick={() => setActive((a) => Math.max(0, a - 1))}
                disabled={active === 0}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>

              <button
                onClick={() => toggleComplete(day.day)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-all",
                  completed.has(day.day)
                    ? "bg-accent/10 text-accent-bright"
                    : "bg-accent text-accent-foreground shadow-[0_8px_24px_-8px_var(--accent-glow)] hover:-translate-y-px",
                )}
              >
                <Check className="h-4 w-4" />
                {completed.has(day.day) ? "Completed" : "Mark complete"}
              </button>

              <button
                onClick={() => setActive((a) => Math.min(days.length - 1, a + 1))}
                disabled={active === days.length - 1}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function OnboardingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16 w-full max-w-3xl" />
      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}
