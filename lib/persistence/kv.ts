import { Redis } from "@upstash/redis";

/**
 * Thin Upstash Redis wrapper for the durable cache layer. Fully optional:
 * when the env vars are unset, every call is a graceful no-op and the app falls
 * back to the in-memory + disk layers (so local dev is unaffected).
 */
let client: Redis | null | undefined;

function getClient(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  client = url && token ? new Redis({ url, token }) : null;
  return client;
}

export function kvEnabled(): boolean {
  return getClient() !== null;
}

/** Upstash stores/returns JSON automatically. Returns undefined on miss/error. */
export async function kvGet<T>(key: string): Promise<T | undefined> {
  const c = getClient();
  if (!c) return undefined;
  try {
    const value = await c.get<T>(key);
    return value ?? undefined;
  } catch {
    return undefined;
  }
}

export async function kvSet(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  const c = getClient();
  if (!c) return;
  try {
    if (ttlSeconds) await c.set(key, value, { ex: ttlSeconds });
    else await c.set(key, value);
  } catch {
    /* best-effort cache; ignore write failures */
  }
}
