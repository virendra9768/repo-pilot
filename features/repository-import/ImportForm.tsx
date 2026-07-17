"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CircleAlert, GitBranch, Lock, LogOut, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ANALYSIS_STAGES, AnalysisProgress } from "./AnalysisProgress";
import { GithubRepoPicker } from "./GithubRepoPicker";
import { pushLocalRecent } from "./recents";

interface AuthState {
  configured: boolean;
  connected: boolean;
  login: string | null;
}

const DEMOS = [
  { key: "next-prisma-starter", label: "Next.js + Prisma" },
  { key: "nest-starter", label: "NestJS API" },
];

export function ImportForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<"idle" | "running" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState("");
  const [stageIndex, setStageIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [auth, setAuth] = useState<AuthState | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/auth/me");
        setAuth(await res.json());
      } catch {
        /* ignore */
      }
    })();
  }, []);

  async function disconnect() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setAuth((a) => (a ? { ...a, connected: false, login: null } : a));
    } catch {
      /* ignore */
    }
  }

  function startStageTicker() {
    setStageIndex(0);
    setDone(false);
    timer.current = setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, ANALYSIS_STAGES.length - 2));
    }, 850);
  }

  function stopTicker() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }

  async function importRepo(body: { url: string } | { demo: string }, label: string) {
    setPhase("running");
    setError(null);
    setTarget(label);
    startStageTicker();
    const started = Date.now();
    try {
      const res = await fetch("/api/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      const recent = {
        id: data.id,
        name: data.workspace?.displayName ?? label,
        source: data.workspace?.source ?? "clone",
      };
      pushLocalRecent(recent);
      // Sync to the account list too (no-op server-side if not logged in).
      void fetch("/api/recents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(recent),
      }).catch(() => {});
      // Keep the staged animation visible for a beat even on fast responses.
      const wait = Math.max(0, 1100 - (Date.now() - started));
      setTimeout(() => {
        stopTicker();
        setDone(true);
        setTimeout(() => router.push(`/r/${data.id}`), 550);
      }, wait);
    } catch (err) {
      stopTicker();
      setPhase("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const cleanTarget = (u: string) => u.replace(/^https?:\/\//, "").replace(/\.git$/, "");

  return (
    <div className="flex w-full flex-col items-center">
      <AnimatePresence mode="wait">
        {phase === "running" ? (
          <AnalysisProgress key="progress" target={target} stageIndex={stageIndex} done={done} />
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-xl"
          >
            {auth?.configured && (
              <div className="mb-2 flex items-center justify-end gap-2 text-xs">
                {auth.connected ? (
                  <>
                    <span className="text-muted-foreground">
                      Connected as <span className="text-foreground">{auth.login}</span>
                    </span>
                    <button
                      onClick={disconnect}
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-faint transition-colors hover:text-foreground"
                    >
                      <LogOut className="h-3 w-3" /> Disconnect
                    </button>
                  </>
                ) : (
                  <a
                    href="/api/auth/github"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                  >
                    <Lock className="h-3 w-3" /> Connect GitHub for private repos
                  </a>
                )}
              </div>
            )}
            <div className="group relative">
              <div className="absolute -inset-px rounded-2xl bg-linear-to-r from-accent-2/40 to-accent/40 opacity-0 blur transition-opacity duration-300 group-focus-within:opacity-100" />
              <div className="relative flex flex-col gap-2 rounded-2xl border border-border bg-card p-2 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <GitBranch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="github.com/owner/repo"
                    className="h-11 w-full rounded-xl bg-transparent pl-9 pr-3 text-sm text-foreground placeholder:text-faint focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && url.trim())
                        importRepo({ url: url.trim() }, cleanTarget(url.trim()));
                    }}
                  />
                </div>
                <Button
                  size="lg"
                  className="h-11 shrink-0"
                  onClick={() =>
                    url.trim() && importRepo({ url: url.trim() }, cleanTarget(url.trim()))
                  }
                  disabled={!url.trim()}
                >
                  <Sparkles className="h-4 w-4" />
                  Generate Guide
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {auth?.connected && (
              <GithubRepoPicker onSelect={(r) => importRepo({ url: r.url }, r.fullName)} />
            )}

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs text-faint">or explore a demo</span>
              {DEMOS.map((d) => (
                <button
                  key={d.key}
                  onClick={() => importRepo({ demo: d.key }, d.label)}
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:-translate-y-px hover:border-border-strong hover:text-foreground"
                >
                  {d.label}
                </button>
              ))}
            </div>

            {error && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
                <CircleAlert className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
