import { z } from "zod";
import type { AIProvider, GenerateJSONArgs } from "./types";
import { getOpenRouterApiKey, getOpenRouterModels } from "./config";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/**
 * LLM provider using OpenRouter's OpenAI-compatible chat completions with JSON
 * mode. The zod schema is emitted as JSON Schema into the system message to
 * steer the shape, and the response is validated with the same zod schema.
 *
 * Resilience: tries several models in order (a fast free model, then the
 * `openrouter/free` auto-router), falling back to the next on transient
 * overload / rate-limit / not-found; per model, one retry on empty/invalid JSON.
 */
export class OpenRouterProvider implements AIProvider {
  readonly name = "openrouter";
  private apiKey: string;
  private models: string[];

  constructor() {
    const key = getOpenRouterApiKey();
    if (!key) throw new Error("OPENROUTER_API_KEY is not set");
    this.apiKey = key;
    this.models = getOpenRouterModels();
  }

  async generateJSON<T>({ system, prompt, schema }: GenerateJSONArgs<T>): Promise<T> {
    const jsonSchema = JSON.stringify(z.toJSONSchema(schema));
    const systemMessage = `${system ?? ""}

Respond with ONLY a single JSON object that conforms to this JSON Schema. No markdown, no code fences, no commentary:
${jsonSchema}`;

    let lastError: unknown;
    for (const model of this.models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        let content: string | undefined;
        try {
          const res = await fetch(ENDPOINT, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              "Content-Type": "application/json",
              "X-Title": "RepoPilot",
            },
            body: JSON.stringify({
              model,
              temperature: 0.3,
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: systemMessage },
                { role: "user", content: prompt },
              ],
            }),
          });
          if (!res.ok) {
            const text = await res.text();
            lastError = new Error(`OpenRouter ${res.status} (${model}): ${text.slice(0, 160)}`);
            // Retry same model once on transient errors, else fall to next model.
            if ((res.status === 429 || res.status >= 500) && attempt < 1) {
              await sleep(600);
              continue;
            }
            break;
          }
          const data = await res.json();
          content = data?.choices?.[0]?.message?.content;
        } catch (err) {
          lastError = err;
          if (attempt < 1) {
            await sleep(500);
            continue;
          }
          break; // network error — try next model
        }

        if (!content) {
          lastError = new Error("Empty response from OpenRouter");
          continue; // retry same model once
        }
        try {
          return schema.parse(JSON.parse(stripFences(content)));
        } catch (err) {
          lastError = err; // malformed/invalid JSON — retry same model once, then next
        }
      }
    }
    throw new Error(`OpenRouter response failed: ${message(lastError)}`);
  }
}

/** Some free models wrap JSON in ```code fences``` despite json_object mode. */
function stripFences(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  return trimmed;
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
