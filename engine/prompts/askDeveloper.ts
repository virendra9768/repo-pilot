import { z } from "zod";
import type { AskDeveloperSlice } from "@/engine/context/slices";

export interface ChatMessage {
  role: "user" | "developer";
  content: string;
}

export const askDeveloperSchema = z.object({
  answer: z.string(),
  confidence: z.enum(["high", "medium", "low", "insufficient"]),
  references: z.array(z.string()).describe("real file paths the answer relied on"),
  caveat: z.string().describe("anything uncertain or missing; may be empty"),
});

export type AskDeveloperResult = z.infer<typeof askDeveloperSchema>;

const SYSTEM = `You are the lead engineer who originally designed and built this repository. A new teammate is asking you questions to understand it. Answer in the first person, like a senior engineer doing a knowledge handoff: concise, concrete, direct, no fluff.

You are given a factual analysis of the repo (technologies, entry points, key files, routes, models, a folder tree, and code snippets from the most important files).

STRICT RULES — this matters more than sounding helpful:
- Base every claim ONLY on the provided evidence. Do NOT invent behavior, files, or intentions that aren't supported.
- If the evidence doesn't let you answer confidently, set "confidence": "insufficient", and say so plainly in the answer (e.g. "I can't tell you that from the code alone — there's nothing in the repo that shows it."). Never guess to fill the gap.
- confidence levels: "high" = directly supported by the evidence; "medium" = a reasonable inference; "low" = weak/partial support; "insufficient" = not answerable from the repo.
- "references": the real file paths you relied on (from the provided analysis). Empty if none.
- "caveat": note anything you're unsure about or that the code doesn't cover. Empty string if nothing to add.`;

export function buildAskDeveloperPrompt(
  ctx: AskDeveloperSlice,
  question: string,
  history: ChatMessage[],
): { system: string; prompt: string } {
  const convo =
    history.length > 0
      ? history
          .map((m) => `${m.role === "user" ? "Teammate" : "You"}: ${m.content}`)
          .join("\n")
      : "(none)";

  const prompt = `Repository analysis (JSON):
${JSON.stringify(ctx, null, 2)}

Conversation so far:
${convo}

The teammate now asks:
"${question}"

Answer as the lead engineer, as JSON (answer, confidence, references, caveat). Remember: if the repo doesn't give you enough to answer, say so and set confidence to "insufficient".`;
  return { system: SYSTEM, prompt };
}
