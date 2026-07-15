"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, GitBranch, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const DEMOS = [
  { key: "next-prisma-starter", label: "Next.js + Prisma" },
  { key: "nest-starter", label: "NestJS API" },
];

export function ImportForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function importRepo(body: { url: string } | { demo: string }, tag: string) {
    setLoading(tag);
    setError(null);
    try {
      const res = await fetch("/api/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      router.push(`/r/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(null);
    }
  }

  const busy = loading !== null;

  return (
    <div className="w-full max-w-xl">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <GitBranch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="github.com/owner/repo"
            disabled={busy}
            className="h-11 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === "Enter" && url.trim()) importRepo({ url: url.trim() }, "url");
            }}
          />
        </div>
        <Button
          size="lg"
          onClick={() => url.trim() && importRepo({ url: url.trim() }, "url")}
          disabled={busy || !url.trim()}
          className="h-11"
        >
          {loading === "url" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Analyzing…
            </>
          ) : (
            <>
              Analyze <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">or try a demo:</span>
        {DEMOS.map((d) => (
          <Button
            key={d.key}
            variant="outline"
            size="sm"
            onClick={() => importRepo({ demo: d.key }, d.key)}
            disabled={busy}
          >
            {loading === d.key ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing…
              </>
            ) : (
              d.label
            )}
          </Button>
        ))}
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
