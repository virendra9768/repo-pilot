import type { AIProvider } from "./types";
import { OpenRouterProvider } from "./openrouter";
import { MockProvider } from "./mock";
import { withCache } from "./cache";
import { hasOpenRouterKey, getProviderOverride } from "./config";

let provider: AIProvider | undefined;

function selectBase(): AIProvider {
  const override = getProviderOverride();
  if (override === "openrouter") return new OpenRouterProvider();
  if (override === "mock") return new MockProvider();

  // Auto-detect: OpenRouter if a key is configured, else the keyless Mock.
  return hasOpenRouterKey() ? new OpenRouterProvider() : new MockProvider();
}

/**
 * Cached, singleton AI provider wrapped with a memory + disk response cache.
 * Selection: AI_PROVIDER override, else OpenRouter key, else Mock.
 * (Restart the server after changing keys — the singleton is built once.)
 */
export function getProvider(): AIProvider {
  if (!provider) provider = withCache(selectBase());
  return provider;
}

export type { AIProvider, GenerateJSONArgs } from "./types";
