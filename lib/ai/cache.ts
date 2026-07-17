import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import type { AIProvider, GenerateJSONArgs } from "./types";
import { isDiskCacheEnabled } from "./config";
import { kvGet, kvSet } from "@/lib/persistence/kv";

/** Writable cache dir (per-instance). Configurable for hosts with a specific writable path. */
const WRITE_DIR = process.env.AI_CACHE_DIR || join(process.cwd(), ".cache", "ai");
/** Read-only seed dir committed to the repo — warmed public demo answers that ship. */
const SEED_DIR = join(process.cwd(), "cache-seed", "ai");
const AI_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * Wrap a provider with a layered response cache:
 *  - L1 memory (per process)
 *  - L2 Upstash KV (durable, cross-instance — optional)
 *  - L3 writable disk (`.cache/ai/`, per-instance)
 *  - L4 read-only seed (`cache-seed/ai/`, committed; public only)
 *
 * Keys are content-addressed by hash(system+prompt) and re-validated against the
 * zod schema on read. `namespace` (e.g. "priv:<userId>") scopes the persistent
 * keys so private-repo answers are per-account and never shared or seed-served.
 */
export function withCache(provider: AIProvider): AIProvider {
  const memory = new Map<string, unknown>();

  return {
    name: provider.name,
    async generateJSON<T>(args: GenerateJSONArgs<T>): Promise<T> {
      const memKey =
        args.cacheKey ?? hash(`${provider.name}|${args.system ?? ""}|${args.prompt}`);
      if (memory.has(memKey)) return memory.get(memKey) as T;

      const useDisk = isDiskCacheEnabled();
      const digest = hash(`${args.system ?? ""}\n${args.prompt}`);
      const ns = args.namespace ? `${args.namespace}:` : "";
      const kvKey = `${ns}ai:${digest}`;
      const diskFile = `${args.namespace ? safe(args.namespace) + "_" : ""}${digest}.json`;

      const cached = await readCached(kvKey, diskFile, useDisk, !args.namespace);
      if (cached !== undefined) {
        const parsed = args.schema.safeParse(cached);
        if (parsed.success) {
          memory.set(memKey, parsed.data);
          return parsed.data;
        }
        // stale shape — regenerate
      }

      const result = await provider.generateJSON(args);
      memory.set(memKey, result);
      await kvSet(kvKey, result, AI_TTL_SECONDS);
      if (useDisk) await writeDisk(diskFile, result);
      return result;
    },
  };
}

function hash(input: string): string {
  return createHash("sha1").update(input).digest("hex");
}

function safe(s: string): string {
  return s.replace(/[^a-z0-9]/gi, "_");
}

/** KV → writable disk → seed (public only). */
async function readCached(
  kvKey: string,
  diskFile: string,
  useDisk: boolean,
  allowSeed: boolean,
): Promise<unknown | undefined> {
  const fromKv = await kvGet<unknown>(kvKey);
  if (fromKv !== undefined) return fromKv;
  if (useDisk) {
    const w = await readJson(join(WRITE_DIR, diskFile));
    if (w !== undefined) return w;
  }
  if (allowSeed) return readJson(join(SEED_DIR, diskFile));
  return undefined;
}

async function readJson(path: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return undefined;
  }
}

async function writeDisk(fileName: string, value: unknown): Promise<void> {
  try {
    await mkdir(WRITE_DIR, { recursive: true });
    const tmp = join(WRITE_DIR, `${fileName}.${process.pid}.tmp`);
    const final = join(WRITE_DIR, fileName);
    await writeFile(tmp, JSON.stringify(value), "utf8");
    await rename(tmp, final);
  } catch {
    /* best-effort cache; ignore write failures */
  }
}
