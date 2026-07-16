import { z } from "zod";
import type { OnboardingSlice } from "@/engine/context/slices";

export const onboardingSchema = z.object({
  overview: z.string().describe("one paragraph: what this onboarding journey covers"),
  days: z.array(
    z.object({
      day: z.number(),
      title: z.string(),
      objective: z.string().describe("what the learner will understand after this day"),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]),
      estimatedMinutes: z.number(),
      steps: z.array(
        z.object({
          path: z.string(),
          reason: z.string().describe("what to learn from this file"),
          readingTimeMinutes: z.number(),
        }),
      ),
    }),
  ),
});

export type OnboardingResult = z.infer<typeof onboardingSchema>;

const SYSTEM = `You are a staff engineer designing a structured, multi-day onboarding curriculum for a developer who just joined the team and has never seen this repository.
You are given a deterministic learning order, critical files, routes, models, and file line counts.
STRICT RULES:
- Organize the work into 3-5 "days", each a coherent theme (e.g. project setup & entry points, then routing/API, then data layer, then feature wiring).
- Only reference files from the provided learningOrder / criticalFiles. Never invent paths.
- Order days so difficulty escalates (beginner -> advanced).
- estimatedMinutes for a day is the sum of its steps; readingTimeMinutes ~ 1 minute per 40 lines (min 1), from the provided line counts.
- Each day should have 2-5 steps. Keep reasons to one sentence.`;

export function buildOnboardingPrompt(ctx: OnboardingSlice): {
  system: string;
  prompt: string;
} {
  const prompt = `Repository: ${ctx.name}

Deterministic analysis (JSON):
${JSON.stringify(ctx, null, 2)}

Produce a JSON onboarding journey:
- overview: what the journey covers and the shape of this codebase.
- days: 3-5 themed days, each with a title, objective, difficulty, estimatedMinutes, and 2-5 ordered file steps (path, reason, readingTimeMinutes). Cover the most important files first.`;
  return { system: SYSTEM, prompt };
}
