import { z } from "zod";

/**
 * STUB — Day 3 deliverable (Guided Onboarding journey).
 * Kept as a placeholder so the prompt library has one file per feature.
 * Not wired into any route or UI today.
 */
export const onboardingSchema = z.object({
  todo: z.string(),
});

export type OnboardingResult = z.infer<typeof onboardingSchema>;

export function buildOnboardingPrompt(): { system: string; prompt: string } {
  return {
    system: "",
    prompt: "Guided Onboarding journey is implemented on Day 3.",
  };
}
