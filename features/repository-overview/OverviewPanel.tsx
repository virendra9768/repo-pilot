"use client";

import {
  ChevronDown,
  Cloud,
  Database,
  DoorOpen,
  FileCode2,
  Folder,
  Layers,
  Route,
  Server,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { OverviewResult } from "@/engine/prompts/overview";
import { useAiResource, fetchJson } from "@/hooks/useAiResource";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/states";
import { techIcon } from "@/components/shared/icons";
import { Stagger, StaggerItem } from "@/components/ui/motion";

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
    <Stagger className="space-y-5">
      {/* Hero purpose */}
      <StaggerItem>
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-7">
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              background:
                "radial-gradient(70% 120% at 100% 0%, color-mix(in oklab, var(--accent) 12%, transparent), transparent 60%)",
            }}
          />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-bright">
              <Sparkles className="h-3.5 w-3.5" /> Purpose
            </span>
            <p className="mt-3 max-w-3xl text-xl font-medium leading-relaxed text-foreground sm:text-2xl">
              {data.purpose}
            </p>
          </div>
        </div>
      </StaggerItem>

      {/* Stats */}
      <StaggerItem>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat icon={FileCode2} label="Files" value={data.stats.fileCount} />
          <Stat icon={Route} label="Routes" value={data.stats.routeCount} />
          <Stat icon={Database} label="DB models" value={data.stats.modelCount} />
          <Stat icon={Layers} label="Technologies" value={data.stats.technologyCount} />
        </div>
      </StaggerItem>

      {/* Architecture + Tech stack */}
      <StaggerItem>
        <div className="grid gap-5 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardContent className="p-6">
              <SectionLabel icon={Layers}>Architecture</SectionLabel>
              <ArchitectureDiagram techStack={data.techStack} />
              <p className="mt-5 border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground">
                {data.architectureSummary}
              </p>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardContent className="p-6">
              <SectionLabel icon={Sparkles}>Tech stack</SectionLabel>
              <div className="mt-4 space-y-3">
                {data.techStack.map((t) => {
                  const Icon = techIcon(t.name);
                  return (
                    <div key={t.name} className="flex items-start gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent-bright">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground">{t.name}</div>
                        <div className="text-xs leading-relaxed text-muted-foreground">
                          {t.role}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </StaggerItem>

      {/* Folders + entry points */}
      <StaggerItem>
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardContent className="p-6">
              <SectionLabel icon={Folder}>Key folders</SectionLabel>
              <div className="mt-4 space-y-1">
                {data.folderExplanations.map((f) => (
                  <div
                    key={f.path}
                    className="group flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted"
                  >
                    <Folder className="mt-0.5 h-4 w-4 shrink-0 text-accent-bright/80" />
                    <div className="min-w-0">
                      <code className="font-mono text-xs text-foreground">{f.path}</code>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {f.explanation}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <SectionLabel icon={DoorOpen}>Entry points</SectionLabel>
              <div className="mt-4 space-y-2">
                {data.entryPointNotes.map((e) => (
                  <div
                    key={e.path}
                    className="rounded-xl border border-border bg-bg/40 p-3 transition-colors hover:border-border-strong"
                  >
                    <div className="flex items-center gap-2">
                      <FileCode2 className="h-3.5 w-3.5 text-accent-bright" />
                      <code className="font-mono text-xs text-foreground">{e.path}</code>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{e.note}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </StaggerItem>
    </Stagger>
  );
}

/* ---------- pieces ---------- */

function SectionLabel({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

function Stat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-colors hover:border-border-strong">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent-bright transition-transform group-hover:scale-105">
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

const LAYERS: { key: string; label: string; icon: LucideIcon; match: RegExp }[] = [
  { key: "interface", label: "Interface", icon: Layers, match: /next|react|tailwind|vue|svelte|angular/i },
  { key: "server", label: "Server", icon: Server, match: /express|nest|fastify|node|hono/i },
  { key: "data", label: "Data", icon: Database, match: /prisma|typeorm|mongoose|postgres|mongo|redis|sql|firebase/i },
  { key: "services", label: "Services", icon: Cloud, match: /stripe|auth|aws|s3|resend|email/i },
];

function ArchitectureDiagram({ techStack }: { techStack: { name: string; role: string }[] }) {
  const bands = LAYERS.map((layer) => ({
    ...layer,
    techs: techStack.filter((t) => layer.match.test(t.name)),
  })).filter((b) => b.techs.length > 0);

  if (bands.length === 0) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        No distinct architectural layers detected.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-1">
      {bands.map((band, i) => (
        <div key={band.key}>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-bg/40 p-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent-bright">
              <band.icon className="h-4 w-4" />
            </span>
            <span className="w-20 shrink-0 text-xs font-semibold text-foreground">{band.label}</span>
            <div className="flex flex-wrap gap-1.5">
              {band.techs.map((t) => (
                <span
                  key={t.name}
                  className="rounded-md border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {t.name}
                </span>
              ))}
            </div>
          </div>
          {i < bands.length - 1 && (
            <div className="flex justify-center py-0.5">
              <ChevronDown className="h-4 w-4 text-faint" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="w-full space-y-5">
      <Skeleton className="h-32 w-full" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-5">
        <Skeleton className="h-72 lg:col-span-3" />
        <Skeleton className="h-72 lg:col-span-2" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
