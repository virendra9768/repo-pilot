import { z } from "zod";
import type { OverviewSlice } from "@/engine/context/slices";

export const overviewSchema = z.object({
  purpose: z.string().describe("1-2 sentences: what this project is and does"),
  architectureSummary: z
    .string()
    .describe("short paragraph on how the pieces fit together"),
  techStack: z.array(
    z.object({
      name: z.string(),
      role: z.string().describe("what this technology is used for here"),
    }),
  ),
  folderExplanations: z.array(
    z.object({ path: z.string(), explanation: z.string() }),
  ),
  entryPointNotes: z.array(z.object({ path: z.string(), note: z.string() })),
  stats: z.object({
    fileCount: z.number(),
    routeCount: z.number(),
    modelCount: z.number(),
    technologyCount: z.number(),
  }),
});

export type OverviewResult = z.infer<typeof overviewSchema>;

const SYSTEM = `You are a senior engineer writing an onboarding overview for a developer who just joined and has never seen this repository.
You are given the output of a deterministic static analysis. Be concise, concrete, and accurate.
STRICT RULES:
- Only use facts present in the provided analysis. Never invent files, folders, routes, or technologies.
- Reference real paths exactly as given.
- Keep each explanation to 1-2 sentences.`;

export function buildOverviewPrompt(ctx: OverviewSlice): {
  system: string;
  prompt: string;
} {
  const prompt = `Repository: ${ctx.name}

Deterministic analysis (JSON):
${JSON.stringify(ctx, null, 2)}

Write an onboarding overview as JSON:
- purpose: what the project is and does (infer from README excerpt, routes, models, tech).
- architectureSummary: how the main pieces connect.
- techStack: each detected technology and the role it plays here.
- folderExplanations: explain the most important top-level folders (from folderTree), what lives in each.
- entryPointNotes: for each provided entry point, what it does / why start there.
- stats: fill from the analysis (fileCount, number of routes, models, technologies).`;
  return { system: SYSTEM, prompt };
}
