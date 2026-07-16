"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, Clock, Gauge, MapPin } from "lucide-react";
import type { StartHereResult } from "@/engine/prompts/startHere";
import { useAiResource, fetchJson } from "@/hooks/useAiResource";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/states";
import { cn } from "@/lib/utils";
import { fileUrl } from "@/lib/utils/github";

function difficulty(minutes: number) {
  if (minutes <= 1) return { label: "Easy", cls: "text-emerald-300 border-emerald-500/20 bg-emerald-500/10" };
  if (minutes <= 3) return { label: "Medium", cls: "text-amber-300 border-amber-500/20 bg-amber-500/10" };
  return { label: "Advanced", cls: "text-rose-300 border-rose-500/20 bg-rose-500/10" };
}

export function StartHerePanel({ id }: { id: string }) {
  const { data, error, loading, reload } = useAiResource<StartHereResult>(
    () =>
      fetchJson<{ startHere: StartHereResult }>(
        `/api/ai/start-here?id=${encodeURIComponent(id)}`,
      ).then((r) => r.startHere),
    [id],
  );

  if (loading) return <StartHereSkeleton />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const totalMin = data.steps.reduce((s, x) => s + (x.readingTimeMinutes || 0), 0);

  return (
    <div className="w-full max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-bright">
          <MapPin className="h-3.5 w-3.5" /> Learning path
        </span>
        <p className="mt-3 text-lg leading-relaxed text-foreground">{data.intro}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1">
            {data.steps.length} stops
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1">
            <Clock className="h-3.5 w-3.5" /> ~{totalMin} min total
          </span>
        </div>
      </motion.div>

      <ol className="relative mt-8 space-y-3 pl-2">
        <div className="absolute left-[19px] top-2 bottom-2 w-px bg-linear-to-b from-accent/50 via-border to-transparent" />
        {data.steps.map((step, i) => {
          const diff = difficulty(step.readingTimeMinutes);
          const url = fileUrl(id, step.path);
          const Wrapper = url ? "a" : "div";
          return (
            <motion.li
              key={`${step.path}-${i}`}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex gap-4"
            >
              <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-card text-sm font-semibold text-accent-bright shadow-[0_0_0_4px_var(--bg)]">
                {i + 1}
              </div>
              <Wrapper
                {...(url ? { href: url, target: "_blank", rel: "noreferrer" } : {})}
                className={cn(
                  "group min-w-0 flex-1 rounded-2xl border border-border bg-card p-4 transition-all",
                  url && "hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[0_16px_40px_-24px_rgba(0,0,0,0.9)]",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <code className="truncate font-mono text-xs text-foreground">{step.path}</code>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", diff.cls)}>
                      <Gauge className="h-3 w-3" /> {diff.label}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" /> ~{step.readingTimeMinutes}m
                    </span>
                    {url && (
                      <ArrowUpRight className="h-4 w-4 text-faint transition-colors group-hover:text-accent-bright" />
                    )}
                  </div>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.reason}</p>
              </Wrapper>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}

function StartHereSkeleton() {
  return (
    <div className="w-full max-w-3xl space-y-4">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <Skeleton className="h-20 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}
