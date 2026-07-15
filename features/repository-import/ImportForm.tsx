"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CircleAlert, GitBranch, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ANALYSIS_STAGES, AnalysisProgress } from "./AnalysisProgress";

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
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

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
