"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, FileCode2, Loader2, Navigation, Search } from "lucide-react";
import type { GpsResult } from "@/engine/prompts/gps";
import { fetchJson } from "@/hooks/useAiResource";
import { fileUrl } from "@/lib/utils/github";
import { ErrorState } from "@/components/shared/states";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Add a new field to the main data model",
  "Add a new API endpoint",
  "Add input validation to a route",
];

interface GpsResponse {
  gps: GpsResult;
  unknownFiles: string[];
}

export function RepositoryGPS({ id }: { id: string }) {
  const [task, setTask] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GpsResult | null>(null);
  const [unknown, setUnknown] = useState<Set<string>>(new Set());

  async function locate(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await fetchJson<GpsResponse>("/api/ai/gps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, task: trimmed }),
      });
      setResult(data.gps);
      setUnknown(new Set(data.unknownFiles));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResult(null);
    } finally {
      setSubmitting(false);
    }
  }

  const ranked = result ? [...result.files].sort((a, b) => b.likelihood - a.likelihood) : [];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-bright">
          <Navigation className="h-3.5 w-3.5" /> Repository GPS
        </span>
        <p className="mt-2 text-sm text-muted-foreground">
          Describe a change you want to make — get the files you&rsquo;ll most likely need to touch.
        </p>
      </div>

      <div className="group relative">
        <div className="absolute -inset-px rounded-2xl bg-linear-to-r from-accent-2/40 to-accent/40 opacity-0 blur transition-opacity duration-300 group-focus-within:opacity-100" />
        <div className="relative flex items-center gap-2 rounded-2xl border border-border bg-card p-2">
          <Search className="ml-2 h-4 w-4 shrink-0 text-faint" />
          <input
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="e.g. add a rating field to the Quote model"
            disabled={submitting}
            className="h-9 w-full bg-transparent text-sm text-foreground placeholder:text-faint focus:outline-none"
            onKeyDown={(e) => e.key === "Enter" && locate(task)}
          />
          <button
            onClick={() => locate(task)}
            disabled={submitting || !task.trim()}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm font-medium text-accent-foreground shadow-[0_8px_24px_-8px_var(--accent-glow)] transition-all hover:-translate-y-px disabled:opacity-40"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
            {submitting ? "Locating…" : "Locate"}
          </button>
        </div>
      </div>

      {!result && !submitting && (
        <div className="flex flex-wrap gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-faint">Try</span>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => (setTask(s), locate(s))}
              className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {error && <ErrorState message={error} onRetry={() => locate(task)} />}

      {submitting && !result && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-accent-bright" /> Pinpointing files…
        </div>
      )}

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-5 rounded-2xl border border-border bg-card p-5">
              <ConfidenceRing value={Math.round(result.confidence)} />
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-faint">
                  Confidence
                </div>
                <p className="mt-1 text-sm leading-relaxed text-foreground">{result.summary}</p>
              </div>
            </div>

            <div className="space-y-2">
              {ranked.map((f, i) => {
                const url = fileUrl(id, f.path);
                const Wrapper = url ? "a" : "div";
                const isUnknown = unknown.has(f.path);
                return (
                  <motion.div
                    key={`${f.path}-${i}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.04 }}
                  >
                    <Wrapper
                      {...(url ? { href: url, target: "_blank", rel: "noreferrer" } : {})}
                      className={cn(
                        "group block rounded-xl border border-border bg-card p-4 transition-colors",
                        url && "hover:border-border-strong",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <FileCode2 className="h-4 w-4 shrink-0 text-accent-bright/80" />
                          <code className="truncate font-mono text-xs text-foreground">{f.path}</code>
                          {isUnknown && (
                            <span className="shrink-0 rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-300">
                              unverified
                            </span>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-xs font-medium tabular-nums text-muted-foreground">
                            {Math.round(f.likelihood)}%
                          </span>
                          {url && (
                            <ArrowUpRight className="h-4 w-4 text-faint transition-colors group-hover:text-accent-bright" />
                          )}
                        </div>
                      </div>
                      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-linear-to-r from-accent-2 to-accent"
                          style={{ width: `${Math.max(4, Math.min(100, f.likelihood))}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{f.reason}</p>
                    </Wrapper>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ConfidenceRing({ value }: { value: number }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(100, value)) / 100);
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--muted)" strokeWidth="6" />
        <motion.circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">
        {value}%
      </div>
    </div>
  );
}
