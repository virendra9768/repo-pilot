import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AnalysisResult } from "@/engine/analyze";

// --- Mocks: keep the store off the network, the AI engine, KV, and disk. ---
const kvStore = new Map<string, unknown>();
// Key logs live in test-file scope so they survive vi.resetModules(), which the
// cache-key-order test needs in order to get a store with an empty memory Map.
const kvGetKeys: string[] = [];
const kvSetKeys: string[] = [];
vi.mock("@/lib/persistence/kv", () => ({
  kvGet: vi.fn(async (k: string) => {
    kvGetKeys.push(k);
    return kvStore.get(k);
  }),
  kvSet: vi.fn(async (k: string, v: unknown) => {
    kvSetKeys.push(k);
    kvStore.set(k, v);
  }),
}));
vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(async () => undefined),
  writeFile: vi.fn(async () => undefined),
  readFile: vi.fn(async () => {
    throw new Error("ENOENT");
  }),
}));
const analyzeRepository = vi.fn<() => Promise<AnalysisResult>>();
vi.mock("@/engine/analyze", () => ({ analyzeRepository: (...a: unknown[]) => analyzeRepository(...(a as [])) }));

import { computeId, inputFromId, getOrAnalyze } from "./store";
import { kvSet } from "@/lib/persistence/kv";
import { writeFile } from "node:fs/promises";
import { MAX_KV_BLOB_BYTES } from "@/lib/security/limits";

/** Minimal analysis result; only the fields the store reads matter. */
function result(source: "clone" | "demo", isPrivate = false): AnalysisResult {
  return {
    workspace: { displayName: "x", source, fileCount: 3, private: isPrivate },
    understandingMap: {} as AnalysisResult["understandingMap"],
    contextPack: {} as AnalysisResult["contextPack"],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  kvStore.clear();
  kvGetKeys.length = 0;
  kvSetKeys.length = 0;
});

describe("computeId", () => {
  it("maps demo aliases to their key", () => {
    expect(computeId({ kind: "demo", demo: "next" })).toBe("next-prisma-starter");
    expect(computeId({ kind: "demo", demo: "bogus" })).toBe("demo");
  });

  it("maps a URL to a lowercased gh__ id", () => {
    expect(computeId({ kind: "url", url: "https://github.com/Facebook/React" })).toBe(
      "gh__facebook__react",
    );
  });

  it("returns invalid-url for an unparseable URL", () => {
    expect(computeId({ kind: "url", url: "nonsense" })).toBe("invalid-url");
  });
});

describe("inputFromId round-trips with computeId", () => {
  it("reverses gh__ and demo ids", () => {
    for (const id of ["gh__facebook__react", "next-prisma-starter", "nest-starter"]) {
      const input = inputFromId(id);
      expect(input).not.toBeNull();
      expect(computeId(input!)).toBe(id);
    }
  });

  it("returns null for an unrecognizable id", () => {
    expect(inputFromId("just-nonsense")).toBeNull();
  });
});

describe("getOrAnalyze caching & isolation", () => {
  it("caches a public repo under repo:v<engine>:<id> on KV + disk", async () => {
    analyzeRepository.mockResolvedValue(result("clone", false));
    const repo = await getOrAnalyze({ kind: "url", url: "https://github.com/pub/one" });

    expect(repo.private).toBeFalsy();
    // The version segment is what stops a pre-AST map being served forever.
    expect(vi.mocked(kvSet)).toHaveBeenCalledWith(
      expect.stringMatching(/^repo:v\d+:gh__pub__one$/),
      expect.anything(),
      expect.anything(),
    );
    expect(vi.mocked(writeFile)).toHaveBeenCalled(); // disk write for public
  });

  it("caches a private repo per-account and never on disk", async () => {
    analyzeRepository.mockResolvedValue(result("clone", true));
    const repo = await getOrAnalyze(
      { kind: "url", url: "https://github.com/priv/two" },
      { userId: "7", token: "t" },
    );

    expect(repo.private).toBe(true);
    expect(repo.ownerUserId).toBe("7");
    expect(vi.mocked(kvSet)).toHaveBeenCalledWith(
      expect.stringMatching(/^priv:v\d+:7:gh__priv__two$/),
      expect.anything(),
      expect.anything(),
    );
    // Not under the shared public key, and never written to disk.
    const keys = vi.mocked(kvSet).mock.calls.map((c) => c[0]);
    expect(keys.some((k) => /^repo:v\d+:gh__priv__two$/.test(k))).toBe(false);
    expect(vi.mocked(writeFile)).not.toHaveBeenCalled();
  });

  it("does NOT cache a URL that fell back to a demo (no poisoning)", async () => {
    analyzeRepository.mockResolvedValue(result("demo", false));
    const repo = await getOrAnalyze({ kind: "url", url: "https://github.com/gone/three" });

    expect(repo.workspace.source).toBe("demo");
    expect(vi.mocked(kvSet)).not.toHaveBeenCalled();
    expect(vi.mocked(writeFile)).not.toHaveBeenCalled();
  });

  it("serves the owner's private cache on re-request but re-analyzes for anonymous", async () => {
    analyzeRepository.mockResolvedValue(result("clone", true));
    const session = { userId: "9", token: "t" };
    const input = { kind: "url", url: "https://github.com/priv/four" } as const;

    await getOrAnalyze(input, session); // analyze #1 (cached under priv:9)
    await getOrAnalyze(input, session); // cache hit — no new analysis
    expect(analyzeRepository).toHaveBeenCalledTimes(1);

    // Anonymous cannot see the private key → misses and analyzes again.
    analyzeRepository.mockResolvedValue(result("demo", false)); // anon would fall back
    await getOrAnalyze(input);
    expect(analyzeRepository).toHaveBeenCalledTimes(2);
  });
});

describe("KV blob size guard", () => {
  /** A result whose contextPack alone blows past the blob ceiling. */
  function oversized(): AnalysisResult {
    const r = result("clone", false);
    return {
      ...r,
      contextPack: {
        snippets: { big: "x".repeat(MAX_KV_BLOB_BYTES + 1024) },
      } as unknown as AnalysisResult["contextPack"],
    };
  }

  it("skips the KV write for an oversized blob but still returns and writes disk", async () => {
    analyzeRepository.mockResolvedValue(oversized());
    const repo = await getOrAnalyze({ kind: "url", url: "https://github.com/big/one" });

    // The analysis is still served — only the durable cache write is skipped.
    expect(repo.workspace.source).toBe("clone");
    expect(kvSetKeys).toHaveLength(0);
    expect(vi.mocked(writeFile)).toHaveBeenCalled();
  });

  it("still writes a normal-sized blob to KV", async () => {
    analyzeRepository.mockResolvedValue(result("clone", false));
    await getOrAnalyze({ kind: "url", url: "https://github.com/small/one" });

    expect(kvSetKeys).toHaveLength(1);
  });
});

describe("cache key ordering", () => {
  it("checks the public key first, so a signed-in hit on a public repo costs one GET", async () => {
    analyzeRepository.mockResolvedValue(result("clone", false));
    const input = { kind: "url", url: "https://github.com/pub/order" } as const;
    const session = { userId: "42", token: "t" };

    await getOrAnalyze(input, session); // populates KV under the public key

    // A fresh module gets an empty memory Map, forcing the next read through KV.
    vi.resetModules();
    kvGetKeys.length = 0;
    analyzeRepository.mockClear();
    const fresh = await import("./store");
    await fresh.getOrAnalyze(input, session);

    expect(analyzeRepository).not.toHaveBeenCalled();
    // The point of the ordering: no wasted priv: lookup on the hit path.
    expect(kvGetKeys).toHaveLength(1);
    expect(kvGetKeys[0]).toMatch(/^repo:v\d+:gh__pub__order$/);
  });

  it("still falls back to the private key when the public one misses", async () => {
    analyzeRepository.mockResolvedValue(result("clone", true));
    const input = { kind: "url", url: "https://github.com/priv/order" } as const;
    const session = { userId: "42", token: "t" };

    await getOrAnalyze(input, session); // cached under priv:42

    vi.resetModules();
    kvGetKeys.length = 0;
    analyzeRepository.mockClear();
    const fresh = await import("./store");
    await fresh.getOrAnalyze(input, session);

    expect(analyzeRepository).not.toHaveBeenCalled();
    expect(kvGetKeys).toHaveLength(2);
    expect(kvGetKeys[0]).toMatch(/^repo:v\d+:gh__priv__order$/);
    expect(kvGetKeys[1]).toMatch(/^priv:v\d+:42:gh__priv__order$/);
  });
});
