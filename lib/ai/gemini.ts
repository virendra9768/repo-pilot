import { GoogleGenAI } from "@google/genai";
import { z, type ZodType } from "zod";
import type { AIProvider, GenerateJSONArgs } from "./types";
import { getGeminiApiKey, getGeminiModels } from "./config";

/**
 * Live Gemini provider using structured JSON output. The zod schema is
 * converted to JSON Schema and passed as `responseJsonSchema`, then the parsed
 * response is validated with the same zod schema.
 *
 * Resilience: tries several models in order, falling back to the next on
 * transient overload/rate-limit/not-found; per model, one retry on an
 * empty/invalid response.
 */
export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  private client: GoogleGenAI;
  private models: string[];

  constructor() {
    const apiKey = getGeminiApiKey();
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    this.client = new GoogleGenAI({ apiKey });
    this.models = getGeminiModels();
  }

  async generateJSON<T>({ system, prompt, schema }: GenerateJSONArgs<T>): Promise<T> {
    const responseJsonSchema = toGeminiSchema(schema);
    const contents = system ? `${system}\n\n${prompt}` : prompt;

    let lastError: unknown;
    for (const model of this.models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        let text: string | undefined;
        try {
          const response = await this.client.models.generateContent({
            model,
            contents,
            config: { responseMimeType: "application/json", responseJsonSchema },
          });
          text = response.text;
        } catch (err) {
          lastError = err;
          if (isTransient(err)) {
            await sleep(400);
            break; // fall back to the next model
          }
          throw new Error(`Gemini request failed: ${message(err)}`);
        }

        if (!text) {
          lastError = new Error("Empty response from Gemini");
          continue; // retry same model once
        }
        try {
          return schema.parse(JSON.parse(text));
        } catch (err) {
          lastError = err; // malformed/invalid JSON — retry same model once
        }
      }
    }
    throw new Error(`Gemini response failed: ${message(lastError)}`);
  }
}

function isTransient(err: unknown): boolean {
  const m = message(err).toLowerCase();
  return /\b(429|500|503)\b|unavailable|overloaded|high demand|try again|deadline|rate limit/.test(m);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** zod -> JSON Schema, stripped of meta keys Gemini's schema path rejects. */
function toGeminiSchema(schema: ZodType): unknown {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json["$schema"];
  return json;
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
