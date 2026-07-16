import type { ZodType } from "zod";

export interface GenerateJSONArgs<T> {
  /** System / role instruction (prepended to the prompt). */
  system?: string;
  /** The user prompt. */
  prompt: string;
  /** Zod schema — used both to steer the provider's JSON output and to validate it. */
  schema: ZodType<T>;
  /** Optional stable cache key; falls back to a hash of the prompt. */
  cacheKey?: string;
}

export interface AIProvider {
  readonly name: string;
  generateJSON<T>(args: GenerateJSONArgs<T>): Promise<T>;
}
