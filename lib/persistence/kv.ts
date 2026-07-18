import { Redis } from "@upstash/redis";
import { KV_USAGE_KEY_TTL_SECONDS } from "@/lib/security/limits";
import { isOverBudget, noteCommand, applyFlush, returnFlush, usageKey } from "./budget";

/**
 * Thin Upstash Redis wrapper for the durable cache layer. Fully optional:
 * when the env vars are unset, every call is a graceful no-op and the app falls
 * back to the in-memory + disk layers (so local dev is unaffected).
 *
 * That same no-op path doubles as the circuit breaker. Once the monthly command
 * budget is spent (see `budget.ts`), `getClient` reports "no client" and the app
 * degrades to memory + disk instead of failing — the behaviour local dev already
 * exercises every day.
 */
let client: Redis | null | undefined;

/** The client itself, ignoring the budget — used by the counter's own flush. */
function rawClient(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  client = url && token ? new Redis({ url, token }) : null;
  return client;
}

function getClient(): Redis | null {
  if (isOverBudget()) return null;
  return rawClient();
}

export function kvEnabled(): boolean {
  return getClient() !== null;
}

/**
 * Count one command and, when a batch is due, push it to the shared monthly
 * counter. Fire-and-forget: the caller must not wait on accounting, and a failed
 * flush returns the batch rather than losing it.
 */
function count(): void {
  const batch = noteCommand();
  if (batch === null) return;
  void flush(batch);
}

async function flush(batch: number): Promise<void> {
  const c = rawClient();
  if (!c) return;
  const key = usageKey();
  try {
    const total = await c.incrby(key, batch);
    // A reply equal to the batch means we just created the key, so this is the
    // month's first flush from any instance — give it an expiry. Counted as the
    // second command of this flush.
    if (total === batch) {
      await c.expire(key, KV_USAGE_KEY_TTL_SECONDS);
      applyFlush(total, 2);
    } else {
      applyFlush(total, 1);
    }
  } catch {
    returnFlush(batch);
  }
}

/** Upstash stores/returns JSON automatically. Returns undefined on miss/error. */
export async function kvGet<T>(key: string): Promise<T | undefined> {
  const c = getClient();
  if (!c) return undefined;
  count();
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
  count();
  try {
    if (ttlSeconds) await c.set(key, value, { ex: ttlSeconds });
    else await c.set(key, value);
  } catch {
    /* best-effort cache; ignore write failures */
  }
}
