import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fetchRepoMeta } from "./download";

const ok = (body: unknown) => ({ ok: true, json: async () => body }) as Response;

beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
afterEach(() => vi.unstubAllGlobals());

describe("fetchRepoMeta", () => {
  it("parses size (KB) and private flag", async () => {
    vi.mocked(fetch).mockResolvedValue(ok({ size: 1234, private: true }));
    expect(await fetchRepoMeta("o", "r")).toEqual({ sizeKb: 1234, private: true });
  });

  it("returns null on a non-OK response", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, json: async () => ({}) } as Response);
    expect(await fetchRepoMeta("o", "r")).toBeNull();
  });

  it("returns null on a network error", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("boom"));
    expect(await fetchRepoMeta("o", "r")).toBeNull();
  });

  it("returns null when size is absent", async () => {
    vi.mocked(fetch).mockResolvedValue(ok({ private: false }));
    expect(await fetchRepoMeta("o", "r")).toBeNull();
  });

  it("sends the token as a Bearer credential when provided", async () => {
    vi.mocked(fetch).mockResolvedValue(ok({ size: 1 }));
    await fetchRepoMeta("o", "r", { token: "gho_abc" });
    const headers = vi.mocked(fetch).mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer gho_abc");
  });
});
