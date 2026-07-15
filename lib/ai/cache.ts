import { createHash } from "node:crypto";
import type { AIProvider, GenerateJSONArgs } from "./types";

/** Wrap a provider with an in-memory response cache (per process). */
export function withCache(provider: AIProvider): AIProvider {
  const cache = new Map<string, unknown>();
  return {
    name: provider.name,
    async generateJSON<T>(args: GenerateJSONArgs<T>): Promise<T> {
      const key =
        args.cacheKey ??
        hash(`${provider.name}|${args.system ?? ""}|${args.prompt}`);
      if (cache.has(key)) return cache.get(key) as T;
      const result = await provider.generateJSON(args);
      cache.set(key, result);
      return result;
    },
  };
}

function hash(input: string): string {
  return createHash("sha1").update(input).digest("hex");
}
