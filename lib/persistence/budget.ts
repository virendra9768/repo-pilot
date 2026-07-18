import {
  KV_SOFT_LIMIT,
  KV_COUNTER_FLUSH_EVERY,
  KV_MONTHLY_COMMAND_BUDGET,
} from "@/lib/security/limits";

/**
 * Command accounting for the Upstash free tier (250k commands/month).
 *
 * Pure bookkeeping — this module never talks to Redis. `kv.ts` owns the client
 * and performs the actual INCRBY when `noteCommand` says a flush is due; keeping
 * the two apart avoids an import cycle and makes the arithmetic testable on its
 * own.
 *
 * The total is learned from the INCRBY reply rather than a separate GET: INCRBY
 * returns the new value, so tracking usage costs one command per batch instead
 * of two. A cold instance therefore starts at zero and spends up to
 * KV_COUNTER_FLUSH_EVERY commands before it learns the real total — which is
 * what the headroom between KV_SOFT_LIMIT and the real budget absorbs.
 */

/** Commands counted locally but not yet flushed to the shared counter. */
let pending = 0;
/** Last total observed from an INCRBY reply. Zero until the first flush. */
let knownTotal = 0;

/** Monthly counter key, e.g. `usage:v1:cmds:2026-07`. */
export function usageKey(now: Date = new Date()): string {
  return `usage:v1:cmds:${now.toISOString().slice(0, 7)}`;
}

/**
 * True once the observed usage passes the soft limit. `kv.ts` treats this as
 * "no client", so every call becomes the same no-op it already performs when
 * the Upstash env vars are unset — the app falls back to memory + disk.
 */
export function isOverBudget(): boolean {
  return knownTotal + pending >= KV_SOFT_LIMIT;
}

/**
 * Record one command. Returns the batch size to flush when the threshold is
 * reached (resetting the local counter), or null when nothing is due yet.
 */
export function noteCommand(): number | null {
  pending++;
  if (pending < KV_COUNTER_FLUSH_EVERY) return null;
  const batch = pending;
  pending = 0;
  return batch;
}

/**
 * Record the INCRBY reply. The flush itself costs a command, so it is counted
 * into the next batch rather than being lost.
 */
export function applyFlush(newTotal: number, extraCommands = 1): void {
  knownTotal = newTotal;
  pending += extraCommands;
}

/** Put a failed batch back so the count isn't silently lost. */
export function returnFlush(batch: number): void {
  pending += batch;
}

export function usageSnapshot(): {
  total: number;
  pending: number;
  softLimit: number;
  budget: number;
  overBudget: boolean;
} {
  return {
    total: knownTotal,
    pending,
    softLimit: KV_SOFT_LIMIT,
    budget: KV_MONTHLY_COMMAND_BUDGET,
    overBudget: isOverBudget(),
  };
}

/** Test seam — resets module state between cases. */
export function __resetBudget(): void {
  pending = 0;
  knownTotal = 0;
}
