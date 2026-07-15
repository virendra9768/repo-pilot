"use client";

import type { OverviewResult } from "@/engine/prompts/overview";
import { useAiResource, fetchJson } from "@/hooks/useAiResource";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/states";

export function OverviewPanel({ id }: { id: string }) {
  const { data, error, loading, reload } = useAiResource<OverviewResult>(
    () => fetchJson<{ overview: OverviewResult }>(`/api/ai/overview?id=${encodeURIComponent(id)}`).then((r) => r.overview),
    [id],
  );

  if (loading) return <OverviewSkeleton />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold">Purpose</h2>
        <p className="mt-1 text-neutral-700 dark:text-neutral-300">{data.purpose}</p>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Files" value={data.stats.fileCount} />
        <Stat label="Routes" value={data.stats.routeCount} />
        <Stat label="DB models" value={data.stats.modelCount} />
        <Stat label="Technologies" value={data.stats.technologyCount} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Architecture</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-neutral-700 dark:text-neutral-300">
          {data.architectureSummary}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tech stack</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.techStack.map((t) => (
            <div key={t.name} className="flex items-start gap-3 text-sm">
              <Badge className="mt-0.5 shrink-0">{t.name}</Badge>
              <span className="text-neutral-600 dark:text-neutral-400">{t.role}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Key folders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.folderExplanations.map((f) => (
              <div key={f.path} className="text-sm">
                <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs dark:bg-neutral-800">
                  {f.path}
                </code>
                <p className="mt-1 text-neutral-600 dark:text-neutral-400">{f.explanation}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Entry points</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.entryPointNotes.map((e) => (
              <div key={e.path} className="text-sm">
                <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs dark:bg-neutral-800">
                  {e.path}
                </code>
                <p className="mt-1 text-neutral-600 dark:text-neutral-400">{e.note}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-neutral-500">{label}</div>
      </CardContent>
    </Card>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16 w-full" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
