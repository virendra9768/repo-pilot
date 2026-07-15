"use client";

import {
  Database,
  DoorOpen,
  FileCode2,
  FolderTree,
  Layers,
  Route,
} from "lucide-react";
import type { OverviewResult } from "@/engine/prompts/overview";
import { useAiResource, fetchJson } from "@/hooks/useAiResource";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/states";

export function OverviewPanel({ id }: { id: string }) {
  const { data, error, loading, reload } = useAiResource<OverviewResult>(
    () =>
      fetchJson<{ overview: OverviewResult }>(
        `/api/ai/overview?id=${encodeURIComponent(id)}`,
      ).then((r) => r.overview),
    [id],
  );

  if (loading) return <OverviewSkeleton />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <Card className="border-l-4 border-l-accent">
        <CardContent className="p-5">
          <CardTitle className="mb-1.5">Purpose</CardTitle>
          <p className="text-[15px] leading-relaxed text-foreground">{data.purpose}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={FileCode2} label="Files" value={data.stats.fileCount} />
        <Stat icon={Route} label="Routes" value={data.stats.routeCount} />
        <Stat icon={Database} label="DB models" value={data.stats.modelCount} />
        <Stat icon={Layers} label="Technologies" value={data.stats.technologyCount} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Architecture</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed text-muted-foreground">
          {data.architectureSummary}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tech stack</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {data.techStack.map((t) => (
            <div key={t.name} className="flex items-start gap-3">
              <Badge variant="accent" className="mt-0.5 shrink-0">
                {t.name}
              </Badge>
              <span className="text-sm text-muted-foreground">{t.role}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderTree className="h-3.5 w-3.5" /> Key folders
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.folderExplanations.map((f) => (
              <FileNote key={f.path} path={f.path} text={f.explanation} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DoorOpen className="h-3.5 w-3.5" /> Entry points
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.entryPointNotes.map((e) => (
              <FileNote key={e.path} path={e.path} text={e.note} />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FileCode2;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-bold leading-none">{value}</div>
          <div className="mt-1 text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function FileNote({ path, text }: { path: string; text: string }) {
  return (
    <div>
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
        {path}
      </code>
      <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="w-full space-y-6">
      <Skeleton className="h-20 w-full" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[76px]" />
        ))}
      </div>
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-40 w-full" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    </div>
  );
}
