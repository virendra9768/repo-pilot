"use client";

import type { StartHereResult } from "@/engine/prompts/startHere";
import { useAiResource, fetchJson } from "@/hooks/useAiResource";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="space-y-5">
      <p className="text-neutral-700 dark:text-neutral-300">{data.intro}</p>
      <ol className="space-y-3">
        {data.steps.map((step, i) => (
          <li key={`${step.path}-${i}`}>
            <Card>
              <CardContent className="flex gap-4 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-sm font-semibold text-white dark:bg-white dark:text-neutral-900">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <code className="truncate rounded bg-neutral-100 px-1.5 py-0.5 text-xs dark:bg-neutral-800">
                      {step.path}
                    </code>
                    <span className="shrink-0 text-xs text-neutral-500">
                      ~{step.readingTimeMinutes} min
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-400">
                    {step.reason}
                  </p>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StartHereSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-6 w-2/3" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  );
}
