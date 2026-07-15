import { z } from "zod";
import type { FlowSlice } from "@/engine/context/slices";

export const executionFlowSchema = z.object({
  summary: z.string().describe("2-3 sentences answering the question at a high level"),
  nodes: z.array(
    z.object({
      id: z.string().describe("short unique id, e.g. 'n1'"),
      title: z.string().describe("short step label"),
      type: z.enum(["entry", "route", "handler", "service", "model", "file", "external"]),
      file: z.string().describe("a real repo file path from the inventory, or '' if external"),
      explanation: z.string().describe("what happens at this step (1-2 sentences)"),
      dependencies: z
        .array(z.string())
        .describe("related real file paths from the inventory"),
    }),
  ),
  edges: z.array(
    z.object({
      source: z.string().describe("source node id"),
      target: z.string().describe("target node id"),
      label: z.string().describe("short edge label, may be empty"),
    }),
  ),
});

export type ExecutionFlowResult = z.infer<typeof executionFlowSchema>;

const SYSTEM = `You are a senior engineer explaining how a codebase handles a specific question, as an execution flow diagram.
You are given a real inventory of files, routes, models, import edges, and some file snippets.
STRICT RULES:
- Every node.file MUST be a path from the provided "files" inventory (or "" for a genuinely external step). Never invent paths.
- dependencies MUST be real paths from the inventory.
- Produce 4-8 nodes forming a connected, ordered flow (entry -> ... -> data/response).
- edges connect node ids and should reflect execution/data order.
- Ground the explanation in the provided routes/models/snippets; if the repo genuinely lacks the feature asked about, say so in the summary and produce the closest relevant flow.`;

export function buildExecutionFlowPrompt(ctx: FlowSlice): {
  system: string;
  prompt: string;
} {
  const prompt = `Repository: ${ctx.name}
Question: ${ctx.question}

Inventory (JSON):
${JSON.stringify(ctx, null, 2)}

Return a JSON execution flow (summary, nodes, edges) that answers the question, grounded strictly in the inventory above.`;
  return { system: SYSTEM, prompt };
}
