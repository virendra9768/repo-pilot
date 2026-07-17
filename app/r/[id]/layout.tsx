import Link from "next/link";
import {
  ArrowLeft,
  Braces,
  Check,
  FileCode2,
  ExternalLink,
  Plus,
  TriangleAlert,
} from "lucide-react";
import { loadRepoForRequest } from "@/lib/auth/access";
import { DashboardNav } from "@/components/layout/DashboardNav";
import { Chip } from "@/components/ui/chip";
import { techIcon } from "@/components/shared/icons";
import { repoUrl } from "@/lib/utils/github";

export const maxDuration = 60;

export default async function RepoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { repo } = await loadRepoForRequest(id);

  if (!repo) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-32 text-center">
        <h1 className="text-lg font-semibold">Repository not analyzed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This analysis isn&rsquo;t in the cache (the server may have restarted).
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent-bright hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Import a repository
        </Link>
      </main>
    );
  }

  const { workspace, understandingMap } = repo;
  const techs = understandingMap.technologies;
  const language =
    techs.find((t) => /typescript|javascript/i.test(t.name))?.name ?? techs[0]?.name;
  const githubUrl = repoUrl(id);

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="glass sticky top-0 z-30 border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-sm font-semibold transition-opacity hover:opacity-80"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-br from-accent-2 to-accent text-white shadow-[0_6px_16px_-6px_var(--accent-glow)]">
              <FileCode2 className="h-4 w-4" />
            </span>
            RepoPilot
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> New
          </Link>
        </div>
      </header>

      {/* Repo header */}
      <div className="relative overflow-hidden border-b border-border">
        <div
          className="pointer-events-none absolute inset-0 -z-0 opacity-60"
          style={{
            background:
              "radial-gradient(60% 100% at 0% 0%, color-mix(in oklab, var(--accent) 10%, transparent), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6 py-8">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {workspace.displayName}
          </h1>

          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <Chip icon={Check} accent>
              {workspace.source === "demo" ? "Demo · analyzed" : "Cloned · analyzed"}
            </Chip>
            {language && <Chip icon={Braces}>{language}</Chip>}
            <Chip icon={FileCode2}>{workspace.fileCount} files</Chip>
            {githubUrl && (
              <a href={githubUrl} target="_blank" rel="noreferrer">
                <Chip icon={ExternalLink} className="transition-colors hover:border-border-strong hover:text-foreground">
                  GitHub
                </Chip>
              </a>
            )}
          </div>

          {workspace.fallbackReason && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-400/90">
              <TriangleAlert className="h-3.5 w-3.5" />
              {workspace.fallbackReason}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-1.5">
            {techs.map((t) => {
              const Icon = techIcon(t.name);
              return (
                <span
                  key={t.name}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/60 px-2.5 py-1 text-xs text-muted-foreground"
                >
                  <Icon className="h-3.5 w-3.5 text-accent-bright/80" />
                  {t.name}
                </span>
              );
            })}
          </div>

          <div className="mt-6">
            <DashboardNav id={id} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
    </div>
  );
}
