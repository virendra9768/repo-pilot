import { describe, it, expect, beforeEach, vi } from "vitest";
import { z } from "zod";
import type { AIProvider } from "./types";

const { kvGetMock, kvSetMock, readFileMock } = vi.hoisted(() => ({
  kvGetMock: vi.fn(),
  kvSetMock: vi.fn(),
  readFileMock: vi.fn(),
}));

vi.mock("@/lib/persistence/kv", () => ({ kvGet: kvGetMock, kvSet: kvSetMock }));
vi.mock("./config", () => ({ isDiskCacheEnabled: () => false }));
vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(async () => undefined),
  writeFile: vi.fn(async () => undefined),
  rename: vi.fn(async () => undefined),
  readFile: readFileMock,
}));

import { withCache } from "./cache";

const schema = z.object({ ok: z.boolean() });

function fakeProvider(): AIProvider & { calls: number } {
  const p = {
    name: "fake",
    calls: 0,
    async generateJSON() {
      p.calls++;
      return { ok: true } as never;
    },
  };
  return p;
}

const args = (over: Partial<Parameters<AIProvider["generateJSON"]>[0]> = {}) => ({
  system: "sys",
  prompt: "hello world",
  schema,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  kvGetMock.mockResolvedValue(undefined); // KV miss by default
  kvSetMock.mockResolvedValue(undefined);
  readFileMock.mockRejectedValue(new Error("ENOENT")); // disk/seed miss
});

describe("withCache", () => {
  it("serves the second identical call from L1 memory (provider hit once)", async () => {
    const provider = fakeProvider();
    const cached = withCache(provider);
    const a = await cached.generateJSON(args());
    const b = await cached.generateJSON(args());
    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
    expect(provider.calls).toBe(1);
  });

  it("scopes a private (namespaced) answer and never reads the public seed", async () => {
    const cached = withCache(fakeProvider());
    await cached.generateJSON(args({ namespace: "priv:1", prompt: "private" }));

    const key = kvSetMock.mock.calls[0][0] as string;
    expect(key).toMatch(/^priv:1:ai:/);
    // allowSeed = !namespace → false, so the committed seed file is never read.
    expect(readFileMock).not.toHaveBeenCalled();
  });

  it("uses an unprefixed key and consults the seed for a public answer", async () => {
    const cached = withCache(fakeProvider());
    await cached.generateJSON(args({ prompt: "public" }));

    const key = kvSetMock.mock.calls[0][0] as string;
    expect(key).toMatch(/^ai:/);
    expect(key).not.toMatch(/^priv:/);
    expect(readFileMock).toHaveBeenCalled(); // seed lookup attempted
  });

  it("regenerates when a cached blob fails schema validation", async () => {
    kvGetMock.mockResolvedValue({ garbage: true }); // stale shape in KV
    const provider = fakeProvider();
    const result = await withCache(provider).generateJSON(args({ prompt: "stale" }));

    expect(result).toEqual({ ok: true }); // fresh, valid value
    expect(provider.calls).toBe(1); // had to regenerate
    expect(kvSetMock).toHaveBeenCalled(); // and rewrote the cache
  });
});
