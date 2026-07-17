import { describe, it, expect, beforeEach, vi } from "vitest";

const { getSessionMock, kvGetMock, kvSetMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  kvGetMock: vi.fn(),
  kvSetMock: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ getSession: getSessionMock }));
vi.mock("@/lib/persistence/kv", () => ({ kvGet: kvGetMock, kvSet: kvSetMock }));

import { GET } from "./route";

const SESSION = { userId: "7", token: "gho_x", login: "octocat" };

function ghResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
  kvGetMock.mockResolvedValue(undefined);
  kvSetMock.mockResolvedValue(undefined);
  vi.stubGlobal("fetch", vi.fn());
});

describe("GET /api/github/repos", () => {
  it("returns an empty list for anonymous users (no GitHub call)", async () => {
    getSessionMock.mockResolvedValue(null);
    const res = await GET();
    expect(await res.json()).toEqual({ repos: [] });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("maps GitHub repos to the minimal picker shape", async () => {
    getSessionMock.mockResolvedValue(SESSION);
    vi.mocked(fetch).mockResolvedValue(
      ghResponse([
        {
          name: "floorplan-manager",
          full_name: "virendra9768/floorplan-manager",
          owner: { login: "virendra9768" },
          private: true,
          description: "d",
          language: "TypeScript",
          pushed_at: "2026-07-01T00:00:00Z",
          html_url: "https://github.com/virendra9768/floorplan-manager",
        },
      ]),
    );

    const { repos } = await (await GET()).json();
    expect(repos).toHaveLength(1);
    expect(repos[0]).toMatchObject({
      fullName: "virendra9768/floorplan-manager",
      owner: "virendra9768",
      private: true,
      language: "TypeScript",
      url: "https://github.com/virendra9768/floorplan-manager",
    });
    expect(repos[0].pushedAt).toBe(Date.parse("2026-07-01T00:00:00Z"));
    // The token must never be leaked into the payload.
    expect(JSON.stringify(repos)).not.toContain("gho_x");
  });

  it("degrades to an empty list on a non-OK GitHub response", async () => {
    getSessionMock.mockResolvedValue(SESSION);
    vi.mocked(fetch).mockResolvedValue(ghResponse({ message: "Bad credentials" }, false));
    expect(await (await GET()).json()).toEqual({ repos: [] });
  });

  it("serves the KV cache without calling GitHub", async () => {
    getSessionMock.mockResolvedValue(SESSION);
    kvGetMock.mockResolvedValue([{ fullName: "a/b" }]);
    const { repos } = await (await GET()).json();
    expect(repos).toEqual([{ fullName: "a/b" }]);
    expect(fetch).not.toHaveBeenCalled();
  });
});
