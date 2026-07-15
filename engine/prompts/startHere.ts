import { z } from "zod";
import type { StartHereSlice } from "@/engine/context/slices";

export const startHereSchema = z.object({
  intro: z
    .string()
    .describe("one sentence framing: how to approach reading this repo"),
  steps: z.array(
    z.object({
      path: z.string(),
      reason: z.string().describe("why read this now, in one sentence"),
      readingTimeMinutes: z
        .number()
        .describe("estimated minutes to read/understand this file"),
    }),
  ),
});

export type StartHereResult = z.infer<typeof startHereSchema>;

const SYSTEM = `You are a staff engineer creating a "if you joined this company today, read these in order" guide for a new developer.
You are given a deterministic learning order and file line counts.
STRICT RULES:
- Only include files from the provided learningOrder / criticalFiles. Never invent paths.
- Preserve a sensible reading order (roughly follow the given order; entry points first).
- Estimate readingTimeMinutes from the provided line counts: about 1 minute per 40 lines, minimum 1, rounded up.`;

export function buildStartHerePrompt(ctx: StartHereSlice): {
  system: string;
  prompt: string;
} {
  const prompt = `Repository: ${ctx.name}

Deterministic learning order + context (JSON):
${JSON.stringify(ctx, null, 2)}

Produce a JSON onboarding reading list:
- intro: one sentence on how to approach this codebase.
- steps: ordered list; for each file give a one-sentence reason to read it now and a readingTimeMinutes estimate from its line count. Include the most important 6-12 files.`;
  return { system: SYSTEM, prompt };
}
