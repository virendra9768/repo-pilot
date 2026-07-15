/** Central AI configuration read from the environment. */

export function getGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || undefined;
}

export function hasGeminiKey(): boolean {
  return Boolean(getGeminiApiKey());
}

/**
 * The model to use, overridable via `GEMINI_MODEL`. Defaults to the
 * `gemini-flash-lite-latest` alias: it's the flash model that's both fast and
 * consistently available for this account (the heavier `-latest`/`3.5` aliases
 * were returning 503 "high demand"). Transient errors are handled by retry in
 * the provider, so a single reliable model is preferred over a fallback chain.
 */
export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-flash-lite-latest";
}
