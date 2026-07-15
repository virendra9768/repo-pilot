"use client";

import { useState } from "react";
import type { AnalysisResult } from "@/engine/analyze";

const DEMOS = [
  { key: "next-prisma-starter", label: "Next.js + Prisma Starter" },
  { key: "nest-starter", label: "NestJS Starter" },
];

type ApiResponse = ({ ok: true } & AnalysisResult) | { ok: false; error: string };

export default function DebugPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);

  async function run(query: string) {
    setLoading(true);
    setData(null);
    try {
      const res = await fetch(`/api/analyze?${query}`);
      setData(await res.json());
    } catch (err) {
      setData({ ok: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  }

  const map = data && data.ok ? data.understandingMap : null;

  return (
    <main className="mx-auto max-w-5xl p-6 font-mono text-sm">
      <h1 className="mb-1 text-lg font-bold">RepoPilot — Analysis Engine Debug</h1>
      <p className="mb-4 text-neutral-500">
        Day 1: deterministic Understanding Map. No AI, no dashboard.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {DEMOS.map((d) => (
          <button
            key={d.key}
            onClick={() => run(`demo=${d.key}`)}
            disabled={loading}
            className="rounded border border-neutral-400 px-3 py-1.5 hover:bg-neutral-100 disabled:opacity-50 dark:hover:bg-neutral-800"
          >
            Run demo: {d.label}
          </button>
        ))}
      </div>

      <div className="mb-6 flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          className="flex-1 rounded border border-neutral-400 px-3 py-1.5 bg-transparent"
          onKeyDown={(e) => {
            if (e.key === "Enter" && url.trim()) run(`repo=${encodeURIComponent(url.trim())}`);
          }}
        />
        <button
          onClick={() => url.trim() && run(`repo=${encodeURIComponent(url.trim())}`)}
          disabled={loading || !url.trim()}
          className="rounded border border-neutral-400 px-3 py-1.5 hover:bg-neutral-100 disabled:opacity-50 dark:hover:bg-neutral-800"
        >
          Analyze URL
        </button>
      </div>

      {loading && <p className="text-neutral-500">Analyzing…</p>}

      {data && !data.ok && (
        <p className="text-red-600">Error: {data.error}</p>
      )}

      {data && data.ok && (
        <div className="space-y-4">
          <section className="rounded border border-neutral-300 p-3 dark:border-neutral-700">
            <div>
              <b>Source:</b> {data.workspace.source} — {data.workspace.displayName} (
              {data.workspace.fileCount} files)
            </div>
            {data.workspace.fallbackReason && (
              <div className="text-amber-600">⚠ {data.workspace.fallbackReason}</div>
            )}
            {map && (
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-neutral-600 dark:text-neutral-300 sm:grid-cols-4">
                <span>entryPoints: {map.entryPoints.length}</span>
                <span>criticalFiles: {map.criticalFiles.length}</span>
                <span>technologies: {map.technologies.length}</span>
                <span>businessDomains: {map.businessDomains.length}</span>
                <span>importantRoutes: {map.importantRoutes.length}</span>
                <span>databaseModels: {map.databaseModels.length}</span>
                <span>learningOrder: {map.learningOrder.length}</span>
                <span>
                  graph: {map.graph.nodes.length}n / {map.graph.edges.length}e
                </span>
              </div>
            )}
          </section>

          <pre className="overflow-x-auto rounded border border-neutral-300 bg-neutral-50 p-3 text-xs leading-relaxed dark:border-neutral-700 dark:bg-neutral-900">
            {JSON.stringify(map, null, 2)}
          </pre>
        </div>
      )}
    </main>
  );
}
