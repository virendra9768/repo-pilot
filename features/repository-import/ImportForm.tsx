"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DEMOS = [
  { key: "next-prisma-starter", label: "Next.js + Prisma" },
  { key: "nest-starter", label: "NestJS" },
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

  return (
    <div className="w-full max-w-xl">
      <div className="flex gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          disabled={loading !== null}
          onKeyDown={(e) => {
            if (e.key === "Enter" && url.trim()) importRepo({ url: url.trim() }, "url");
          }}
        />
        <Button
          onClick={() => url.trim() && importRepo({ url: url.trim() }, "url")}
          disabled={loading !== null || !url.trim()}
        >
          {loading === "url" ? "Analyzing…" : "Analyze"}
        </Button>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
          or try a demo repo
        </p>
        <div className="flex flex-wrap gap-2">
          {DEMOS.map((d) => (
            <Button
              key={d.key}
              variant="outline"
              onClick={() => importRepo({ demo: d.key }, d.key)}
              disabled={loading !== null}
            >
              {loading === d.key ? "Analyzing…" : d.label}
            </Button>
          ))}
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
