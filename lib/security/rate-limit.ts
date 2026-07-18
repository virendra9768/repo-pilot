/**
 * Per-IP fixed-window rate limiting, held in process memory.
 *
 * Deliberately NOT Redis-backed: a shared limiter would spend the exact command
 * budget it exists to protect. The real safety net is the circuit breaker in
 * `lib/persistence/budget.ts`; this is a speed bump in front of the expensive
 * routes (analysis and AI generation) so one script can't drain the budget or
 * the LLM quota in a burst.
 *
 * Known limitation: state is per-instance, so on serverless the effective limit
 * scales with the number of warm lambdas. That is accepted — it still stops the
 * naive case, which is the one that actually happens.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

/** Keep the map from growing without bound on a long-lived instance. */
const PRUNE_EVERY = 500;
let sincePrune = 0;

function prune(now: number): void {
  for (const [key, w] of windows) {
    if (w.resetAt <= now) windows.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the window resets. Only meaningful when `ok` is false. */
  retryAfter: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (++sincePrune >= PRUNE_EVERY) {
    sincePrune = 0;
    prune(now);
  }

  const existing = windows.get(key);
  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  existing.count++;
  if (existing.count > limit) {
    return { ok: false, retryAfter: Math.ceil((existing.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

/**
 * Best-effort client identity. Behind a proxy the left-most x-forwarded-for
 * entry is the client; falls back to a shared bucket when no header is present,
 * which is strictly safer (over-limits rather than under-limits).
 */
export function clientKey(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** Budget presets, tuned to what each route actually costs downstream. */
export const IMPORT_LIMIT = { limit: 10, windowMs: 60_000 };
export const AI_LIMIT = { limit: 30, windowMs: 60_000 };

/**
 * Returns a 429 Response when the caller is over budget, or null to proceed.
 * Route handlers call this first and early-return the result if non-null.
 */
export function enforceRateLimit(
  request: Request,
  scope: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): Response | null {
  const { ok, retryAfter } = rateLimit(`${scope}:${clientKey(request)}`, limit, windowMs);
  if (ok) return null;
  return Response.json(
    { error: "Too many requests — slow down and try again shortly." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

/** Test seam — clears all windows between cases. */
export function __resetRateLimit(): void {
  windows.clear();
  sincePrune = 0;
}
