/** Central AI configuration read from the environment. */

export function getOpenRouterApiKey(): string | undefined {
  return process.env.OPENROUTER_API_KEY || undefined;
}

export function hasOpenRouterKey(): boolean {
  return Boolean(getOpenRouterApiKey());
}

/**
 * Ordered OpenRouter model candidates. The provider tries them in order,
 * falling back on transient overload / rate-limit / not-found.
 *  - primary: a fast, JSON-reliable free model (benchmarked ~sub-second),
 *    overridable via `OPENROUTER_MODEL`.
 *  - fallback: `openrouter/free`, the auto-router that self-selects a free model
 *    supporting structured output — resilient to the primary being deprecated.
 */
export function getOpenRouterModels(): string[] {
  const primary = process.env.OPENROUTER_MODEL?.trim() || "nvidia/nemotron-3-super-120b-a12b:free";
  return [...new Set([primary, "openrouter/free"])];
}

/**
 * Optional hard override of which provider to use ("openrouter" | "mock").
 * When unset, selection auto-detects (OpenRouter if a key is set, else Mock).
 */
export function getProviderOverride(): string | undefined {
  return process.env.AI_PROVIDER?.trim().toLowerCase() || undefined;
}

/** Whether the disk (L2) cache is enabled. Default on; set AI_DISK_CACHE=0 to disable. */
export function isDiskCacheEnabled(): boolean {
  return process.env.AI_DISK_CACHE?.trim() !== "0";
}
