import { getSession } from "@/lib/auth/session";
import { getRepoOrRehydrate, getOrAnalyze, type AnalyzedRepo, type SessionCtx } from "@/lib/persistence/store";
import type { AnalyzeInput } from "@/engine/analyze";

/** Session context (or undefined) from the encrypted cookie, for the store. */
export async function sessionCtx(): Promise<SessionCtx | undefined> {
  const s = await getSession();
  return s ? { userId: s.userId, token: s.token } : undefined;
}

/**
 * Load a repo for a feature route: resolves the session, re-hydrates (with the
 * user's token for private repos), and returns the private cache namespace so
 * AI calls stay per-account.
 */
export async function loadRepoForRequest(
  id: string,
): Promise<{ repo?: AnalyzedRepo; namespace?: string }> {
  const repo = await getRepoOrRehydrate(id, await sessionCtx());
  const namespace = repo?.private && repo.ownerUserId ? `priv:${repo.ownerUserId}` : undefined;
  return { repo, namespace };
}

/** Import (analyze) an input with the current session (enables private repos). */
export async function analyzeForRequest(input: AnalyzeInput): Promise<AnalyzedRepo> {
  return getOrAnalyze(input, await sessionCtx());
}

/** Prefix a base cache key with the private namespace so memory keys don't collide. */
export function nsCacheKey(namespace: string | undefined, base: string): string {
  return namespace ? `${namespace}:${base}` : base;
}
