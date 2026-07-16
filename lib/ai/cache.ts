import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import type { AIProvider, GenerateJSONArgs } from "./types";
import { isDiskCacheEnabled } from "./config";

/** Writable cache dir (per-instance). Configurable for hosts with a specific writable path. */
const WRITE_DIR = process.env.AI_CACHE_DIR || join(process.cwd(), ".cache", "ai");
/** Read-only seed dir committed to the repo — warmed demo answers that ship with the deploy. */
const SEED_DIR = join(process.cwd(), "cache-seed", "ai");

/**
 * Wrap a provider with a layered response cache:
 *  - L1: in-memory Map (per process), keyed by the caller's cacheKey.
 *  - L2 (writable): disk fixtures under AI_CACHE_DIR / `.cache/ai/`, gated by
 *    AI_DISK_CACHE. Atomic writes (tmp + rename).
 *  - L3 (read-only seed): `cache-seed/ai/` committed to the repo — always read,
 *    so a fresh deploy (even on ephemeral disk) serves warmed demo answers with
 *    zero live calls.
 *
 * All layers are content-addressed by a hash of system+prompt and re-validated
 * against the current zod schema on read, so a changed prompt/schema just misses
 * and regenerates rather than serving a stale shape.
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
      const diskKey = hash(`${args.system ?? ""}\n${args.prompt}`);

      const cached = await readCached(diskKey, useDisk);
      if (cached !== undefined) {
        const parsed = args.schema.safeParse(cached);
        if (parsed.success) {
          memory.set(memKey, parsed.data);
          return parsed.data;
        }
        // Cached shape no longer matches the schema — regenerate.
      }

      const result = await provider.generateJSON(args);
      memory.set(memKey, result);
      if (useDisk) await writeDisk(diskKey, result);
      return result;
    },
  };
}

function hash(input: string): string {
  return createHash("sha1").update(input).digest("hex");
}

/** Read from the writable dir (if enabled), then the read-only seed dir. */
async function readCached(key: string, useDisk: boolean): Promise<unknown | undefined> {
  if (useDisk) {
    const w = await readJson(join(WRITE_DIR, `${key}.json`));
    if (w !== undefined) return w;
  }
  return readJson(join(SEED_DIR, `${key}.json`));
}

async function readJson(path: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return undefined;
  }
}

async function writeDisk(key: string, value: unknown): Promise<void> {
  try {
    await mkdir(WRITE_DIR, { recursive: true });
    // Atomic: write to a temp file then rename, so a crash can't leave a partial fixture.
    const tmp = join(WRITE_DIR, `${key}.${process.pid}.tmp`);
    const final = join(WRITE_DIR, `${key}.json`);
    await writeFile(tmp, JSON.stringify(value), "utf8");
    await rename(tmp, final);
  } catch {
    /* best-effort cache; ignore write failures */
  }
}
