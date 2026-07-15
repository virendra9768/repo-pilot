"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  MarkerType,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Loader2, MousePointerClick, Search, Sparkles } from "lucide-react";
import type { ExecutionFlowResult } from "@/engine/prompts/executionFlow";
import { fetchJson } from "@/hooks/useAiResource";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/states";
import { FlowNode } from "./FlowNode";
import { computeLayout } from "./layout";

const SUGGESTIONS = [
  "How does a typical request flow through the app?",
  "How is data read from or written to the database?",
  "What happens when the app starts up?",
];

interface FlowResponse {
  flow: ExecutionFlowResult;
  unknownFiles: string[];
}

const EDGE_OPTIONS = {
  type: "smoothstep" as const,
  animated: true,
  style: { stroke: "var(--accent)", strokeWidth: 1.5 },
  markerEnd: { type: MarkerType.ArrowClosed, color: "var(--accent)" },
};

export function ExecutionFlow({ id }: { id: string }) {
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExecutionFlowResult | null>(null);
  const [unknown, setUnknown] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const nodeTypes = useMemo(() => ({ flow: FlowNode }), []);

  useEffect(() => {
    if (!result) {
      setNodes([]);
      setEdges([]);
      return;
    }
    const layout = computeLayout(result.nodes, result.edges);
    const ids = new Set(result.nodes.map((n) => n.id));
    setNodes(
      result.nodes.map((n) => ({
        id: n.id,
        type: "flow",
        position: layout.get(n.id) ?? { x: 0, y: 0 },
        data: {
          title: n.title,
          kind: n.type,
          file: n.file,
          unknown: n.file !== "" && unknown.has(n.file),
        },
      })),
    );
    setEdges(
      result.edges
        .filter((e) => ids.has(e.source) && ids.has(e.target))
        .map((e, i) => ({
          id: `e${i}`,
          source: e.source,
          target: e.target,
          label: e.label || undefined,
          ...EDGE_OPTIONS,
        })),
    );
  }, [result, unknown, setNodes, setEdges]);

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    setSelectedId(null);
    try {
      const data = await fetchJson<FlowResponse>("/api/ai/execution-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, question: trimmed }),
      });
      setResult(data.flow);
      setUnknown(new Set(data.unknownFiles));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResult(null);
    } finally {
      setSubmitting(false);
    }
  }

  const selected = result?.nodes.find((n) => n.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask how something works, e.g. “how does a quote get created?”"
            disabled={submitting}
            className="h-11 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === "Enter") ask(question);
            }}
          />
        </div>
        <Button className="h-11" onClick={() => ask(question)} disabled={submitting || !question.trim()}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {submitting ? "Tracing…" : "Trace"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => {
              setQuestion(s);
              ask(s);
            }}
            disabled={submitting}
            className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error} onRetry={() => ask(question)} />}

      {result && (
        <div className="flex items-start gap-2 rounded-xl border border-accent/30 bg-accent/5 p-4">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p className="text-sm leading-relaxed text-foreground">{result.summary}</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="h-[560px] overflow-hidden rounded-xl border border-border bg-card">
          {submitting ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-accent" />
              Tracing the flow…
            </div>
          ) : result ? (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={(_, node) => setSelectedId(node.id)}
              onPaneClick={() => setSelectedId(null)}
              nodeTypes={nodeTypes}
              colorMode="system"
              fitView
              fitViewOptions={{ padding: 0.2 }}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
              <Controls showInteractive={false} />
              <MiniMap pannable zoomable className="!bg-muted" />
            </ReactFlow>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
              <Sparkles className="h-6 w-6 text-accent" />
              <p className="text-sm text-muted-foreground">
                Ask a question above to see how the codebase handles it — as a
                clickable execution-flow diagram.
              </p>
            </div>
          )}
        </div>

        <aside className="rounded-xl border border-border bg-card p-4 shadow-sm">
          {selected ? (
            <div className="space-y-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-accent">
                  {selected.type}
                </div>
                <h3 className="mt-0.5 text-sm font-semibold">{selected.title}</h3>
              </div>
              {selected.file && (
                <code className="block truncate rounded-md bg-muted px-2 py-1.5 font-mono text-xs">
                  {selected.file}
                </code>
              )}
              <p className="text-sm leading-relaxed text-muted-foreground">
                {selected.explanation}
              </p>
              {selected.dependencies.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-foreground">Depends on</div>
                  <ul className="mt-1.5 space-y-1">
                    {selected.dependencies.map((dep) => (
                      <li
                        key={dep}
                        className="truncate font-mono text-xs text-muted-foreground"
                        title={dep}
                      >
                        {dep}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center text-muted-foreground">
              <MousePointerClick className="h-5 w-5" />
              <p className="text-sm">
                {result
                  ? "Click a node to see its explanation, file, and dependencies."
                  : "Node details appear here."}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
