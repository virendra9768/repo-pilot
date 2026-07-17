"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Boxes, History, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils/time";
import {
  readLocalRecents,
  removeLocalRecent,
  clearLocalRecents,
  type RecentRepo,
} from "./recents";

export function RecentRepos() {
  const [recents, setRecents] = useState<RecentRepo[] | null>(null);

  useEffect(() => {
    void (async () => {
      const local = readLocalRecents();
      let account: RecentRepo[] = [];
      try {
        const res = await fetch("/api/recents");
        if (res.ok) account = (await res.json()).recents ?? [];
      } catch {
        /* anonymous or KV unset — local only */
      }
      // Merge by id, keeping the newest timestamp; newest first.
      const byId = new Map<string, RecentRepo>();
      for (const r of [...account, ...local]) {
        const prev = byId.get(r.id);
        if (!prev || r.at > prev.at) byId.set(r.id, r);
      }
      setRecents([...byId.values()].sort((a, b) => b.at - a.at).slice(0, 12));
    })();
  }, []);

  if (!recents || recents.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mt-16 w-full max-w-4xl"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <History className="h-3.5 w-3.5" /> Recently analyzed
        </h2>
        <button
          onClick={() => {
            clearLocalRecents();
            setRecents([]);
          }}
          className="text-xs text-faint transition-colors hover:text-foreground"
        >
          Clear
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {recents.map((r) => (
          <div key={r.id} className="group relative">
            <Link
              href={`/r/${r.id}`}
              className="block rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-border-strong"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent-bright">
                  <Boxes className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">{r.name}</div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {r.source === "demo" ? "demo" : "cloned"}
                    </Badge>
                    <span className="text-[11px] text-faint">{timeAgo(r.at)}</span>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-faint transition-opacity group-hover:opacity-0" />
              </div>
            </Link>
            <button
              onClick={(e) => {
                e.preventDefault();
                removeLocalRecent(r.id);
                setRecents((prev) => (prev ?? []).filter((x) => x.id !== r.id));
              }}
              aria-label="Remove"
              className="absolute right-3 top-3 hidden h-6 w-6 items-center justify-center rounded-md text-faint transition-colors hover:bg-muted hover:text-foreground group-hover:flex"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
