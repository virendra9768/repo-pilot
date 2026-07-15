"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Clock,
  Crosshair,
  CornerDownLeft,
  ExternalLink,
  MousePointerClick,
  Search,
  Sparkles,
  Workflow,
} from "lucide-react";
import type { ExecutionFlowResult } from "@/engine/prompts/executionFlow";
import { fetchJson } from "@/hooks/useAiResource";
import { ErrorState } from "@/components/shared/states";
import { nodeCategory } from "@/components/shared/icons";
import { cn } from "@/lib/utils";
import type { FocusTarget } from "./FlowCanvas";

const FlowCanvas = dynamic(() => import("./FlowCanvas").then((m) => m.FlowCanvas), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
    </div>
  ),
});

const SUGGESTIONS = [
  "How does a typical request flow through the app?",
  "How is data read from or written to the database?",
  "What happens when the app starts up?",
];

const RECENTS_KEY = "repopilot:recent-prompts";

interface FlowResponse {
  flow: ExecutionFlowResult;
  unknownFiles: string[];
}

type FlowNode = ExecutionFlowResult["nodes"][number];

function githubFileUrl(id: string, file: string): string | null {
  if (file && id.startsWith("gh__")) {
    const [owner, repo] = id.slice(4).split("__");
    if (owner && repo) return `https://github.com/${owner}/${repo}/blob/HEAD/${file}`;
  }
  return null;
}

export function ExecutionFlow({ id }: { id: string }) {
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExecutionFlowResult | null>(null);
  const [unknown, setUnknown] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  const [recents, setRecents] = useState<string[]>([]);
  const nonce = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        const raw = localStorage.getItem(RECENTS_KEY);
        if (raw) setRecents(JSON.parse(raw));
      } catch {
        /* ignore */
      }
    })();
  }, []);

  function pushRecent(q: string) {
    setRecents((prev) => {
      const next = [q, ...prev.filter((x) => x !== q)].slice(0, 5);
      try {
        localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

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
      pushRecent(trimmed);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResult(null);
    } finally {
      setSubmitting(false);
    }
  }

  function focusNode(nodeId: string) {
    setSelectedId(nodeId);
    nonce.current += 1;
    setFocusTarget({ id: nodeId, nonce: nonce.current });
  }

  const selected = result?.nodes.find((n) => n.id === selectedId) ?? null;
  const incoming = result?.edges.filter((e) => e.target === selectedId) ?? [];
  const outgoing = result?.edges.filter((e) => e.source === selectedId) ?? [];
  const nodeById = (nid: string) => result?.nodes.find((n) => n.id === nid);
  const followUps = buildFollowUps(result);

  return (
    <div className="space-y-4">
      {/* AI search */}
      <div className="group relative">
        <div className="absolute -inset-px rounded-2xl bg-linear-to-r from-accent-2/40 to-accent/40 opacity-0 blur transition-opacity duration-300 group-focus-within:opacity-100" />
        <div className="relative rounded-2xl border border-border bg-card p-2">
          <div className="flex items-center gap-2">
            <Search className="ml-2 h-4 w-4 shrink-0 text-faint" />
            <input
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask how something works…"
              disabled={submitting}
              className="h-9 w-full bg-transparent text-sm text-foreground placeholder:text-faint focus:outline-none"
              onKeyDown={(e) => e.key === "Enter" && ask(question)}
            />
            <kbd className="hidden items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] text-faint sm:inline-flex">
              <CornerDownLeft className="h-3 w-3" /> trace
            </kbd>
            <button
              onClick={() => ask(question)}
              disabled={submitting || !question.trim()}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm font-medium text-accent-foreground shadow-[0_8px_24px_-8px_var(--accent-glow)] transition-all hover:-translate-y-px disabled:opacity-40"
            >
              {submitting ? (
                <ThinkingDots />
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Trace
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Suggestions / recents */}
      {!result && !submitting && (
        <div className="space-y-2">
          <ChipRow label="Try" items={SUGGESTIONS} onPick={(s) => (setQuestion(s), ask(s))} />
          {recents.length > 0 && (
            <ChipRow
              label="Recent"
              icon={<Clock className="h-3 w-3" />}
              items={recents}
              onPick={(s) => (setQuestion(s), ask(s))}
            />
          )}
        </div>
      )}

      {error && <ErrorState message={error} onRetry={() => ask(question)} />}

      {/* Summary + follow-ups */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-3"
          >
            <div className="flex items-start gap-2.5 rounded-2xl border border-accent/20 bg-accent/5 p-4">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent-bright" />
              <p className="text-sm leading-relaxed text-foreground">{result.summary}</p>
            </div>
            {followUps.length > 0 && (
              <ChipRow label="Follow up" items={followUps} onPick={(s) => (setQuestion(s), ask(s))} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Canvas + detail */}
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="relative h-[560px] overflow-hidden rounded-2xl border border-border bg-card">
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-40" />
          {submitting ? (
            <TracingState />
          ) : result ? (
            <FlowCanvas
              result={result}
              unknown={unknown}
              selectedId={selectedId}
              onSelect={setSelectedId}
              focusTarget={focusTarget}
            />
          ) : (
            <EmptyCanvas onPick={(s) => (setQuestion(s), ask(s))} />
          )}
        </div>

        <DetailPanel
          selected={selected}
          hasResult={!!result}
          incomingTitles={incoming.map((e) => nodeById(e.source)).filter(Boolean) as FlowNode[]}
          outgoingTitles={outgoing.map((e) => nodeById(e.target)).filter(Boolean) as FlowNode[]}
          fileUrl={selected ? githubFileUrl(id, selected.file) : null}
          onFocus={() => selected && focusNode(selected.id)}
          onJump={focusNode}
        />
      </div>
    </div>
  );
}

/* ---------------- pieces ---------------- */

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-current"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  );
}

function TracingState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="relative flex h-14 w-14 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-accent/20" />
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/15 text-accent-bright">
          <Workflow className="h-5 w-5" />
        </span>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        Tracing the execution flow <ThinkingDots />
      </div>
    </div>
  );
}

function EmptyCanvas({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card text-accent-bright shadow-[0_0_40px_-12px_var(--accent-glow)]">
        <Workflow className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">Trace how the code works</p>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          Ask a question and watch RepoPilot render a live, clickable execution map.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.slice(0, 2).map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
          >
            {s} <ArrowRight className="h-3 w-3" />
          </button>
        ))}
      </div>
    </div>
  );
}

function ChipRow({
  label,
  items,
  onPick,
  icon,
}: {
  label: string;
  items: string[];
  onPick: (s: string) => void;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-faint">
        {icon}
        {label}
      </span>
      {items.map((s) => (
        <button
          key={s}
          onClick={() => onPick(s)}
          className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function DetailPanel({
  selected,
  hasResult,
  incomingTitles,
  outgoingTitles,
  fileUrl,
  onFocus,
  onJump,
}: {
  selected: FlowNode | null;
  hasResult: boolean;
  incomingTitles: FlowNode[];
  outgoingTitles: FlowNode[];
  fileUrl: string | null;
  onFocus: () => void;
  onJump: (id: string) => void;
}) {
  if (!selected) {
    return (
      <aside className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-6 text-center">
        <MousePointerClick className="h-5 w-5 text-faint" />
        <p className="mt-2 text-sm text-muted-foreground">
          {hasResult
            ? "Select a node to inspect its role, files, and connections."
            : "Node details appear here."}
        </p>
      </aside>
    );
  }

  const cat = nodeCategory(selected.type, selected.file);
  const Icon = cat.Icon;

  return (
    <motion.aside
      key={selected.id}
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col gap-4 overflow-y-auto rounded-2xl border border-border bg-card p-5"
    >
      <div>
        <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide", cat.color)}>
          <Icon className="h-3.5 w-3.5" /> {cat.label}
        </span>
        <h3 className="mt-1.5 text-base font-semibold leading-snug">{selected.title}</h3>
      </div>

      {selected.file && (
        <code className="block truncate rounded-lg bg-muted px-2.5 py-2 font-mono text-xs text-foreground">
          {selected.file}
        </code>
      )}

      <div>
        <PanelLabel>Responsibility</PanelLabel>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{selected.explanation}</p>
      </div>

      {outgoingTitles.length > 0 && (
        <NodeList label="Leads to" nodes={outgoingTitles} onJump={onJump} />
      )}
      {incomingTitles.length > 0 && (
        <NodeList label="Called by" nodes={incomingTitles} onJump={onJump} />
      )}

      {selected.dependencies.length > 0 && (
        <div>
          <PanelLabel>Related files</PanelLabel>
          <ul className="mt-1.5 space-y-1">
            {selected.dependencies.map((dep) => (
              <li key={dep} className="truncate font-mono text-xs text-muted-foreground" title={dep}>
                {dep}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-2">
        <button
          onClick={onFocus}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
        >
          <Crosshair className="h-3.5 w-3.5" /> Focus
        </button>
        {fileUrl && (
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open file
          </a>
        )}
      </div>
    </motion.aside>
  );
}

function NodeList({
  label,
  nodes,
  onJump,
}: {
  label: string;
  nodes: FlowNode[];
  onJump: (id: string) => void;
}) {
  return (
    <div>
      <PanelLabel>{label}</PanelLabel>
      <div className="mt-1.5 space-y-1">
        {nodes.map((n) => (
          <button
            key={n.id}
            onClick={() => onJump(n.id)}
            className="group flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-bg/40 px-2.5 py-1.5 text-left text-xs text-foreground transition-colors hover:border-border-strong"
          >
            <span className="truncate">{n.title}</span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-faint transition-colors group-hover:text-accent-bright" />
          </button>
        ))}
      </div>
    </div>
  );
}

function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">
      {children}
    </span>
  );
}

function buildFollowUps(result: ExecutionFlowResult | null): string[] {
  if (!result) return [];
  const out: string[] = [];
  const model = result.nodes.find((n) => n.type === "model");
  const route = result.nodes.find((n) => n.type === "route");
  if (model) out.push(`How is the ${model.title} data used elsewhere?`);
  if (route) out.push(`What validates input for ${route.title}?`);
  out.push("Where is error handling in this flow?");
  return [...new Set(out)].slice(0, 3);
}
