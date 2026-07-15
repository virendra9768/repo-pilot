/** Central AI configuration read from the environment. */

export function getGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || undefined;
}

export function hasGeminiKey(): boolean {
  return Boolean(getGeminiApiKey());
}

/**
 * Ordered model candidates. The provider tries them in order, falling back to
 * the next on transient overload/rate-limit/not-found. `GEMINI_MODEL` (if set)
 * is tried first. Defaults chosen from what this account can actually reach:
 * a quality flash model, then lighter/stable aliases for resilience.
 */
export function getGeminiModels(): string[] {
  const defaults = [
    "gemini-flash-lite-latest",
    "gemini-3-flash-preview",
    "gemini-flash-latest",
  ];
  const primary = process.env.GEMINI_MODEL?.trim();
  return [...new Set(primary ? [primary, ...defaults] : defaults)];
}
