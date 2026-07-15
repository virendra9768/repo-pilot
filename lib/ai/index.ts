import type { AIProvider } from "./types";
import { GeminiProvider } from "./gemini";
import { MockProvider } from "./mock";
import { withCache } from "./cache";
import { hasGeminiKey } from "./config";

let provider: AIProvider | undefined;

/**
 * Cached, singleton AI provider: live Gemini when a key is configured,
 * otherwise the mock provider for local dev. Wrapped with a response cache.
 * (Restart the server after adding a key — the singleton is built once.)
 */
export function getProvider(): AIProvider {
  if (!provider) {
    provider = withCache(hasGeminiKey() ? new GeminiProvider() : new MockProvider());
  }
  return provider;
}

export type { AIProvider, GenerateJSONArgs } from "./types";
