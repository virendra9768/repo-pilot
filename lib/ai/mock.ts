import { z } from "zod";
import type { AIProvider, GenerateJSONArgs } from "./types";

/**
 * Offline/dev provider used only when no GEMINI_API_KEY is set. Synthesizes a
 * schema-valid placeholder so the UI renders without a key. Never used once a
 * key is configured.
 */
export class MockProvider implements AIProvider {
  readonly name = "mock";

  async generateJSON<T>({ schema }: GenerateJSONArgs<T>): Promise<T> {
    const json = z.toJSONSchema(schema) as JsonSchema;
    const skeleton = fake(json, 0);
    try {
      return schema.parse(skeleton);
    } catch {
      return skeleton as T;
    }
  }
}

interface JsonSchema {
  type?: string | string[];
  enum?: unknown[];
  const?: unknown;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
}

function fake(schema: JsonSchema, depth: number): unknown {
  if (depth > 6) return null;
  if (schema.const !== undefined) return schema.const;
  if (schema.enum?.length) return schema.enum[0];
  if (schema.anyOf?.length) return fake(schema.anyOf[0], depth + 1);
  if (schema.oneOf?.length) return fake(schema.oneOf[0], depth + 1);

  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  switch (type) {
    case "string":
      return "[mock] sample text";
    case "number":
    case "integer":
      return 1;
    case "boolean":
      return true;
    case "array":
      return schema.items ? [fake(schema.items, depth + 1)] : [];
    case "object": {
      const out: Record<string, unknown> = {};
      for (const [key, prop] of Object.entries(schema.properties ?? {})) {
        out[key] = fake(prop, depth + 1);
      }
      return out;
    }
    default:
      return null;
  }
}
