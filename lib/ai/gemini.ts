import { GoogleGenAI } from "@google/genai";
import { z, type ZodType } from "zod";
import type { AIProvider, GenerateJSONArgs } from "./types";
import { getGeminiApiKey, getGeminiModel } from "./config";

const MAX_ATTEMPTS = 4;

/**
 * Live Gemini provider using structured JSON output. The zod schema is
 * converted to JSON Schema and passed as `responseJsonSchema`, then the parsed
 * response is validated with the same zod schema.
 *
 * Uses a single, reliable model and retries with exponential backoff on
 * transient overload/rate-limit errors (503/429) or an empty/invalid response.
 */
export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  private client: GoogleGenAI;
  private model: string;

  constructor() {
    const apiKey = getGeminiApiKey();
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    this.client = new GoogleGenAI({ apiKey });
    this.model = getGeminiModel();
  }

  async generateJSON<T>({ system, prompt, schema }: GenerateJSONArgs<T>): Promise<T> {
    const responseJsonSchema = toGeminiSchema(schema);
    const contents = system ? `${system}\n\n${prompt}` : prompt;

    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      let text: string | undefined;
      try {
        const response = await this.client.models.generateContent({
          model: this.model,
          contents,
          config: { responseMimeType: "application/json", responseJsonSchema },
        });
        text = response.text;
      } catch (err) {
        lastError = err;
        if (isTransient(err) && attempt < MAX_ATTEMPTS - 1) {
          await sleep(500 * 2 ** attempt); // 0.5s, 1s, 2s
          continue;
        }
        throw new Error(`Gemini request failed: ${message(err)}`);
      }

      if (!text) {
        lastError = new Error("Empty response from Gemini");
        continue;
      }
      try {
        return schema.parse(JSON.parse(text));
      } catch (err) {
        lastError = err; // malformed/invalid JSON — try again
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
