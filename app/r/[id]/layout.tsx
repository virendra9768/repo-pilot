import Link from "next/link";
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
      <main className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-lg font-semibold">Repository not analyzed</h1>
        <p className="mt-2 text-sm text-neutral-500">
          This analysis isn&rsquo;t in the cache (the server may have restarted).
        </p>
        <Link href="/" className="mt-4 inline-block text-sm underline">
          ← Import a repository
        </Link>
      </main>
    );
  }

  const { workspace, understandingMap } = repo;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link href="/" className="text-xs text-neutral-400 hover:underline">
              ← RepoPilot
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">{workspace.displayName}</h1>
          </div>
          <span className="text-xs text-neutral-400">
            {workspace.source === "demo" ? "demo repo" : "cloned"} ·{" "}
            {workspace.fileCount} files
          </span>
        </div>
        {workspace.fallbackReason && (
          <p className="mt-2 text-xs text-amber-600">⚠ {workspace.fallbackReason}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {understandingMap.technologies.map((t) => (
            <Badge key={t.name}>{t.name}</Badge>
          ))}
        </div>
      </header>

      <DashboardNav id={id} />
      <div className="py-6">{children}</div>
    </div>
  );
}
