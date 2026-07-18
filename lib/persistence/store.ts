import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  analyzeRepository,
  type AnalyzeInput,
  type AnalysisResult,
} from "@/engine/analyze";
import { resolveDemoKey } from "@/engine/clone";
import { validateGitHubUrl } from "@/lib/git/validate";
import { kvGet, kvSet } from "@/lib/persistence/kv";
import { MAX_KV_BLOB_BYTES } from "@/lib/security/limits";

export interface AnalyzedRepo {
  id: string;
  input: AnalyzeInput;
  workspace: AnalysisResult["workspace"];
  understandingMap: AnalysisResult["understandingMap"];
  contextPack: AnalysisResult["contextPack"];
  /** True for private repos (fetched with a user token) — cached per account. */
  private?: boolean;
  /** GitHub user id that owns a private analysis (namespace guard). */
  ownerUserId?: string;
}

/** Minimal session context threaded from the OAuth cookie. */
export interface SessionCtx {
  userId: string;
  token: string;
}

/** Memory cache keyed by the FULL cache key (public `repo:<id>` or `priv:<user>:<id>`). */
const store = new Map<string, AnalyzedRepo>();
const CACHE_DIR = join(process.cwd(), ".cache", "repopilot");
const REPO_TTL_SECONDS = 60 * 60 * 24 * 7; // public: 7 days
const PRIV_TTL_SECONDS = 60 * 60 * 24 * 2; // private: 2 days

/**
 * Bump when the deterministic engine's output changes. Cached maps are returned
 * before `analyzeRepository` ever runs, and nothing else expires the disk cache,
 * so without this an engine improvement is invisible forever on any instance
 * that has already analyzed a repo. Old entries are simply never read again.
 *
 * 2 — AST-based analyzers (ts-morph / prisma-ast) replaced the regex ones.
 */
const ENGINE_VERSION = 2;

const pubKey = (id: string) => `repo:v${ENGINE_VERSION}:${id}`;
const privKey = (userId: string, id: string) =>
  `priv:v${ENGINE_VERSION}:${userId}:${id}`;
const diskFile = (id: string) => `${id}.v${ENGINE_VERSION}.json`;

/** Stable, filename-safe id for an import request. */
export function computeId(input: AnalyzeInput): string {
  if (input.kind === "demo") return resolveDemoKey(input.demo) ?? "demo";
  const v = validateGitHubUrl(input.url);
  if (v.ok && v.repo) return `gh__${v.repo.owner}__${v.repo.repo}`.toLowerCase();
  return "invalid-url";
}

/** Read one cache key: memory → KV → (public only) disk. */
async function readByKey(
  fullKey: string,
  diskId: string | null,
): Promise<AnalyzedRepo | undefined> {
  const mem = store.get(fullKey);
  if (mem) return mem;
  const fromKv = await kvGet<AnalyzedRepo>(fullKey);
  if (fromKv) {
    store.set(fullKey, fromKv);
    return fromKv;
  }
  if (diskId) {
    const onDisk = await readDisk(diskId);
    if (onDisk) {
      store.set(fullKey, onDisk);
      return onDisk;
    }
  }
  return undefined;
}

/**
 * Look up a cached analysis by id: public shared key first, then the private
 * (owner-scoped) one.
 *
 * Public-first is a deliberate command-budget choice. Most repos are public, and
 * trying `priv:` first made every signed-in request pay a guaranteed-miss GET.
 * This is safe because `getOrAnalyze` never writes a private repo under the
 * public key, and URL-fallbacks are never cached at all — so a public hit can
 * only ever be a genuinely public analysis.
 *
 * Accepted tradeoff: a repo that was analyzed while public and later made
 * private keeps serving the public blob until its TTL expires.
 */
async function readCachedRepo(id: string, session?: SessionCtx): Promise<AnalyzedRepo | undefined> {
  const pub = await readByKey(pubKey(id), id);
  if (pub) return pub;
  if (session) return readByKey(privKey(session.userId, id), null); // never on disk
  return undefined;
}

/** Reconstruct the analyze input from an id (for cache-miss re-hydration). */
export function inputFromId(id: string): AnalyzeInput | null {
  const demo = resolveDemoKey(id);
  if (demo) return { kind: "demo", demo };
  if (id.startsWith("gh__")) {
    const [owner, repo] = id.slice(4).split("__");
    if (owner && repo) return { kind: "url", url: `https://github.com/${owner}/${repo}` };
  }
  return null;
}

/**
 * Return a cached analysis for an id, or re-analyze on a miss. With a session,
 * private repos are re-fetched with the user's token and cached per account.
 */
export async function getRepoOrRehydrate(
  id: string,
  session?: SessionCtx,
): Promise<AnalyzedRepo | undefined> {
  const cached = await readCachedRepo(id, session);
  if (cached) return cached;
  const input = inputFromId(id);
  if (!input) return undefined;
  try {
    return await getOrAnalyze(input, session);
  } catch {
    return undefined;
  }
}

/** Return cached analysis for an input, or run the engine and cache it. */
export async function getOrAnalyze(
  input: AnalyzeInput,
  session?: SessionCtx,
): Promise<AnalyzedRepo> {
  const id = computeId(input);
  const cached = await readCachedRepo(id, session);
  if (cached) return cached;

  const result = await analyzeRepository(input, { token: session?.token });
  const isPrivate = Boolean(result.workspace.private);
  const repo: AnalyzedRepo = {
    id,
    input,
    ...result,
    private: isPrivate,
    ownerUserId: isPrivate ? session?.userId : undefined,
  };

  // A URL that fell back to a demo is request-specific (it depends on whether the
  // caller had access). Never cache it under the URL's id — otherwise it would
  // shadow the owner's later private analysis of the same repo.
  const isUrlFallback = input.kind === "url" && result.workspace.source === "demo";
  if (isUrlFallback) return repo;

  // Private → per-account key, memory + KV only (never the shared disk/key).
  // Public → shared key, memory + KV + disk.
  const fullKey = isPrivate && session ? privKey(session.userId, id) : pubKey(id);
  store.set(fullKey, repo);

  // Serialize once: the same string measures the blob and writes the disk copy.
  const payload = JSON.stringify(repo);
  const bytes = Buffer.byteLength(payload, "utf8");
  if (bytes <= MAX_KV_BLOB_BYTES) {
    await kvSet(fullKey, repo, isPrivate ? PRIV_TTL_SECONDS : REPO_TTL_SECONDS);
  } else {
    // Upstash rejects oversized values and kvSet swallows the failure, so an
    // unguarded write would look fine while re-analyzing on every request.
    // Memory + disk still cover it; this is worth seeing in the logs.
    console.warn(
      `[store] ${id}: ${Math.round(bytes / 1024)} KB exceeds the ${Math.round(
        MAX_KV_BLOB_BYTES / 1024,
      )} KB cache limit — skipping the KV write (memory + disk only).`,
    );
  }

  if (!isPrivate) await writeDisk(id, payload);
  return repo;
}

async function readDisk(id: string): Promise<AnalyzedRepo | undefined> {
  try {
    const raw = await readFile(join(CACHE_DIR, diskFile(id)), "utf8");
    return JSON.parse(raw) as AnalyzedRepo;
  } catch {
    return undefined;
  }
}

/** `payload` is the already-serialized repo, reused from the KV size check. */
async function writeDisk(id: string, payload: string): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(join(CACHE_DIR, diskFile(id)), payload, "utf8");
  } catch {
    /* best-effort cache; ignore write failures */
  }
}
