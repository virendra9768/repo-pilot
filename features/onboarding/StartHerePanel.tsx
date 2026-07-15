"use client";

import { Clock } from "lucide-react";
import type { StartHereResult } from "@/engine/prompts/startHere";
import { useAiResource, fetchJson } from "@/hooks/useAiResource";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/states";

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

  return (
    <div className="w-full max-w-3xl space-y-6">
      <p className="text-[15px] leading-relaxed text-muted-foreground">{data.intro}</p>

      <ol className="relative space-y-4 before:absolute before:left-4 before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-border">
        {data.steps.map((step, i) => (
          <li key={`${step.path}-${i}`} className="relative flex gap-4">
            <div className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground shadow-sm">
              {i + 1}
            </div>
            <div className="min-w-0 flex-1 rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <code className="truncate font-mono text-xs text-foreground">
                  {step.path}
                </code>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />~{step.readingTimeMinutes} min
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{step.reason}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StartHereSkeleton() {
  return (
    <div className="w-full max-w-3xl space-y-4">
      <Skeleton className="h-5 w-2/3" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <Skeleton className="h-20 flex-1" />
        </div>
      ))}
    </div>
  );
}
