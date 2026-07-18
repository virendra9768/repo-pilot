"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Boxes, FolderGit2, Lock, Search, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { timeAgo } from "@/lib/utils/time";
import { MAX_REPO_SIZE_KB } from "@/lib/security/limits";

export interface GithubRepo {
  fullName: string;
  name: string;
  owner: string;
  private: boolean;
  description: string | null;
  language: string | null;
  pushedAt: number;
  url: string;
  /** Size in KB from GitHub. 0 when unknown (older cached entries). */
  sizeKb?: number;
}

interface Props {
  onSelect: (repo: GithubRepo) => void;
  disabled?: boolean;
}

/** Lists the connected user's GitHub repos under the search bar for one-click analysis. */
export function GithubRepoPicker({ onSelect, disabled }: Props) {
  const [repos, setRepos] = useState<GithubRepo[] | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/github/repos");
        if (!res.ok) throw new Error();
        const data = await res.json();
        setRepos((data.repos ?? []) as GithubRepo[]);
      } catch {
        setError(true);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!repos) return [];
    const q = filter.trim().toLowerCase();
    return q ? repos.filter((r) => r.fullName.toLowerCase().includes(q)) : repos;
  }, [repos, filter]);

  // Nothing to show if the fetch failed and returned no repos (keeps the form clean).
  if (error && !repos) return null;
  if (repos && repos.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-4"
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <FolderGit2 className="h-3.5 w-3.5" /> Your repositories
        </h2>
        {repos && repos.length > 0 && (
          <div className="relative w-40">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter"
              className="h-8 w-full rounded-lg border border-border bg-card pl-7 pr-2 text-xs text-foreground placeholder:text-faint focus:border-accent/60 focus:outline-none"
            />
          </div>
        )}
      </div>

      <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-xl border border-border bg-card/50 p-1.5">
        {repos === null ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))
        ) : filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-faint">No repositories found</div>
        ) : (
          filtered.map((r) => {
            // Known-oversized repos would fall back to the demo on submit, so
            // say so here instead of letting the user find out afterwards.
            const tooLarge = (r.sizeKb ?? 0) > MAX_REPO_SIZE_KB;
            return (
            <button
              key={r.fullName}
              type="button"
              disabled={disabled || tooLarge}
              onClick={() => onSelect(r)}
              title={
                tooLarge
                  ? `~${Math.round((r.sizeKb ?? 0) / 1024)} MB — over the ${Math.round(
                      MAX_REPO_SIZE_KB / 1024,
                    )} MB limit for live analysis`
                  : undefined
              }
              className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent-bright">
                <Boxes className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{r.name}</span>
                  {r.private && (
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      <Lock className="h-2.5 w-2.5" /> Private
                    </Badge>
                  )}
                  {tooLarge && (
                    <Badge variant="outline" className="shrink-0 text-[10px] text-amber-400/90">
                      <TriangleAlert className="h-2.5 w-2.5" /> Too large
                    </Badge>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-faint">
                  <span className="truncate">{r.owner}</span>
                  {r.language && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="shrink-0">{r.language}</span>
                    </>
                  )}
                  {r.pushedAt > 0 && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="shrink-0">{timeAgo(r.pushedAt)}</span>
                    </>
                  )}
                </div>
              </div>
            </button>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
