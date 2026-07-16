import { z } from "zod";
import type { GpsSlice } from "@/engine/context/slices";

export const gpsSchema = z.object({
  summary: z.string().describe("2-3 sentences: how you'd approach this change"),
  confidence: z.number().describe("overall confidence this plan is right, 0-100"),
  files: z.array(
    z.object({
      path: z.string(),
      likelihood: z.number().describe("chance this file needs editing, 0-100"),
      reason: z.string().describe("why this file is involved, one sentence"),
    }),
  ),
});

export type GpsResult = z.infer<typeof gpsSchema>;

const SYSTEM = `You are a senior engineer helping a teammate locate where to make a change in a codebase you know well.
You are given a real inventory of files, routes, models, import edges, and code snippets.
STRICT RULES:
- Identify the files most likely to need editing for the described change, ranked by likelihood (0-100).
- Every "path" MUST be a real path from the provided "files" inventory. Never invent paths.
- "confidence" (0-100) reflects how sure you are overall — lower it if the repo doesn't clearly support the change.
- Return 3-8 files, most likely first. Keep each reason to one sentence.`;

export function buildGpsPrompt(ctx: GpsSlice): { system: string; prompt: string } {
  const prompt = `Repository: ${ctx.name}
Desired change: ${ctx.task}

Inventory (JSON):
${JSON.stringify(ctx, null, 2)}

Return JSON (summary, confidence, files[]) locating exactly where to make this change, grounded strictly in the inventory.`;
  return { system: SYSTEM, prompt };
}
