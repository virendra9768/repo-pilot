"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { ExecutionFlowResult } from "@/engine/prompts/executionFlow";
import { fetchJson } from "@/hooks/useAiResource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed },
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
      <div className="flex gap-2">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask how something works, e.g. “how does a quote get created?”"
          disabled={submitting}
          onKeyDown={(e) => {
            if (e.key === "Enter") ask(question);
          }}
        />
        <Button onClick={() => ask(question)} disabled={submitting || !question.trim()}>
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
            className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            {s}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error} onRetry={() => ask(question)} />}

      {result && (
        <p className="rounded-md bg-neutral-50 p-3 text-sm text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
          {result.summary}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="h-[560px] overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
          {submitting ? (
            <div className="flex h-full items-center justify-center text-sm text-neutral-500">
              Tracing the flow…
            </div>
          ) : result ? (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={(_, node) => setSelectedId(node.id)}
              nodeTypes={nodeTypes}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background />
              <Controls />
            </ReactFlow>
          ) : (
            <div className="flex h-full items-center justify-center px-8 text-center text-sm text-neutral-500">
              Ask a question above to see how the codebase handles it — as a
              clickable execution-flow diagram.
            </div>
          )}
        </div>

        <aside className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          {selected ? (
            <div className="space-y-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-neutral-400">
                  {selected.type}
                </div>
                <h3 className="text-sm font-semibold">{selected.title}</h3>
              </div>
              {selected.file && (
                <code className="block truncate rounded bg-neutral-100 px-1.5 py-1 text-xs dark:bg-neutral-800">
                  {selected.file}
                </code>
              )}
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {selected.explanation}
              </p>
              {selected.dependencies.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-neutral-500">Depends on</div>
                  <ul className="mt-1 space-y-1">
                    {selected.dependencies.map((dep) => (
                      <li key={dep} className="truncate text-xs text-neutral-500" title={dep}>
                        {dep}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-neutral-400">
              {result
                ? "Click a node to see its explanation, file, and dependencies."
                : "Node details appear here."}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
