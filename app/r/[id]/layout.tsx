import Link from "next/link";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { getRepo } from "@/lib/persistence/store";
import { DashboardNav } from "@/components/layout/DashboardNav";
import { Badge } from "@/components/ui/badge";

export default async function RepoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repo = await getRepo(id);

  if (!repo) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="text-lg font-semibold">Repository not analyzed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This analysis isn&rsquo;t in the cache (the server may have restarted).
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Import a repository
        </Link>
      </main>
    );
  }

  const { workspace, understandingMap } = repo;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            RepoPilot
          </Link>
          <Badge variant="outline">
            {workspace.source === "demo" ? "demo repo" : "cloned"} ·{" "}
            {workspace.fileCount} files
          </Badge>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">{workspace.displayName}</h1>
          {workspace.fallbackReason && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500">
              <TriangleAlert className="h-3.5 w-3.5" />
              {workspace.fallbackReason}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {understandingMap.technologies.map((t) => (
              <Badge key={t.name} variant="accent">
                {t.name}
              </Badge>
            ))}
          </div>
        </div>

        <DashboardNav id={id} />
        <div className="py-8">{children}</div>
      </div>
    </div>
  );
}
