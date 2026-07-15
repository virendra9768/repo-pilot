/** Central AI configuration read from the environment. */

export function getGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || undefined;
}

export function hasGeminiKey(): boolean {
  return Boolean(getGeminiApiKey());
}

/** Model id, overridable via env. Flash keeps the demo fast. */
export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL || "gemini-2.5-flash";
}
