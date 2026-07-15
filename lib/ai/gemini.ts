import { GoogleGenAI } from "@google/genai";
import { z, type ZodType } from "zod";
import type { AIProvider, GenerateJSONArgs } from "./types";
import { getGeminiApiKey, getGeminiModel } from "./config";

/**
 * Live Gemini provider using structured JSON output. The zod schema is
 * converted to JSON Schema and passed as `responseJsonSchema`, then the parsed
 * response is validated with the same zod schema. One retry on parse/validate
 * failure before throwing.
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
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents,
        config: { responseMimeType: "application/json", responseJsonSchema },
      });
      const text = response.text;
      if (!text) {
        lastError = new Error("Empty response from Gemini");
        continue;
      }
      try {
        return schema.parse(JSON.parse(text));
      } catch (err) {
        lastError = err;
      }
    }
    throw new Error(`Gemini response failed validation: ${message(lastError)}`);
  }
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
