"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUp, FileCode2, Info, TerminalSquare } from "lucide-react";
import type { AskDeveloperResult, ChatMessage } from "@/engine/prompts/askDeveloper";
import { fetchJson } from "@/hooks/useAiResource";
import { fileUrl } from "@/lib/utils/github";
import { cn } from "@/lib/utils";

const STARTERS = [
  "What does this project do, in your words?",
  "How is the data layer structured?",
  "What's the deployment and CI setup?",
];

const CONF: Record<string, { label: string; cls: string }> = {
  high: { label: "High confidence", cls: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20" },
  medium: { label: "Medium confidence", cls: "text-amber-300 bg-amber-500/10 border-amber-500/20" },
  low: { label: "Low confidence", cls: "text-orange-300 bg-orange-500/10 border-orange-500/20" },
  insufficient: { label: "Not enough evidence", cls: "text-rose-300 bg-rose-500/10 border-rose-500/20" },
};

interface UiMessage {
  role: "user" | "developer";
  content: string;
  meta?: Pick<AskDeveloperResult, "confidence" | "references" | "caveat">;
  error?: boolean;
}

export function DeveloperChat({ id, repoName }: { id: string; repoName: string }) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || sending) return;
    const history: ChatMessage[] = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: "user", content: question }]);
    setInput("");
    setSending(true);
    try {
      const data = await fetchJson<{ answer: AskDeveloperResult }>("/api/ai/ask-developer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, question, history }),
      });
      setMessages((m) => [
        ...m,
        {
          role: "developer",
          content: data.answer.answer,
          meta: {
            confidence: data.answer.confidence,
            references: data.answer.references,
            caveat: data.answer.caveat,
          },
        },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "developer",
          content: e instanceof Error ? e.message : String(e),
          error: true,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-22rem)] min-h-[26rem] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card">
      {/* Persona header */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-accent-2 to-accent text-white shadow-[0_6px_16px_-6px_var(--accent-glow)]">
          <TerminalSquare className="h-5 w-5" />
        </span>
        <div>
          <div className="text-sm font-semibold">Lead engineer</div>
          <div className="text-xs text-muted-foreground">
            who built <span className="text-foreground">{repoName}</span> · answers only from the code
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {messages.length === 0 && !sending && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card text-accent-bright shadow-[0_0_40px_-12px_var(--accent-glow)]">
              <TerminalSquare className="h-6 w-6" />
            </span>
            <p className="max-w-xs text-sm text-muted-foreground">
              Ask the engineer who designed this repo. They&rsquo;ll tell you when the code
              doesn&rsquo;t hold the answer.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <Message key={i} id={id} message={m} />
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-tl-sm border border-border bg-bg/40 px-4 py-3">
              <TypingDots />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2 rounded-xl border border-border bg-bg/40 p-2 focus-within:border-accent/50">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about the architecture, a decision, a file…"
            rows={1}
            disabled={sending}
            className="max-h-32 min-h-[2rem] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-foreground placeholder:text-faint focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={sending || !input.trim()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground shadow-[0_6px_16px_-8px_var(--accent-glow)] transition-all hover:-translate-y-px disabled:opacity-40"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Message({ id, message }: { id: string; message: UiMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-accent px-4 py-2.5 text-sm text-accent-foreground">
          {message.content}
        </div>
      </div>
    );
  }

  const conf = message.meta ? CONF[message.meta.confidence] : null;
  const insufficient = message.meta?.confidence === "insufficient";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex justify-start"
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl rounded-tl-sm border px-4 py-3",
          message.error
            ? "border-red-500/20 bg-red-500/5"
            : insufficient
              ? "border-amber-500/25 bg-amber-500/[0.06]"
              : "border-border bg-bg/40",
        )}
      >
        <p className={cn("text-sm leading-relaxed", message.error ? "text-red-300" : "text-foreground")}>
          {message.content}
        </p>

        {message.meta && (
          <div className="mt-3 space-y-2">
            {conf && (
              <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", conf.cls)}>
                {insufficient && <Info className="h-3 w-3" />}
                {conf.label}
              </span>
            )}
            {message.meta.caveat && (
              <p className="text-xs italic text-muted-foreground">{message.meta.caveat}</p>
            )}
            {message.meta.references.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {message.meta.references.map((ref) => {
                  const url = fileUrl(id, ref);
                  const Wrapper = url ? "a" : "span";
                  return (
                    <Wrapper
                      key={ref}
                      {...(url ? { href: url, target: "_blank", rel: "noreferrer" } : {})}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <FileCode2 className="h-3 w-3" />
                      {ref}
                    </Wrapper>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  );
}
