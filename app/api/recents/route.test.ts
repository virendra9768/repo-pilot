import { describe, it, expect, beforeEach, vi } from "vitest";

const { getSessionMock, kvGetMock, kvSetMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  kvGetMock: vi.fn(),
  kvSetMock: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ getSession: getSessionMock }));
vi.mock("@/lib/persistence/kv", () => ({ kvGet: kvGetMock, kvSet: kvSetMock }));

import { GET, POST } from "./route";

const SESSION = { userId: "7", token: "t", login: "octocat" };
const req = (body: unknown) =>
  new Request("http://localhost/api/recents", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  kvGetMock.mockResolvedValue(undefined);
  kvSetMock.mockResolvedValue(undefined);
});

describe("/api/recents", () => {
  it("GET returns an empty list when anonymous", async () => {
    getSessionMock.mockResolvedValue(null);
    expect(await (await GET()).json()).toEqual({ recents: [] });
  });

  it("POST is a no-op when anonymous", async () => {
    getSessionMock.mockResolvedValue(null);
    expect(await (await POST(req({ id: "x", name: "X" }))).json()).toEqual({ ok: false });
    expect(kvSetMock).not.toHaveBeenCalled();
  });

  it("POST prepends, dedupes by id, and keeps newest first", async () => {
    getSessionMock.mockResolvedValue(SESSION);
    kvGetMock.mockResolvedValue([
      { id: "old", name: "Old", source: "clone", at: 1 },
      { id: "dup", name: "Dup", source: "clone", at: 2 },
    ]);

    const res = await POST(req({ id: "dup", name: "Dup v2", source: "demo" }));
    const { recents } = await res.json();

    expect(recents[0]).toMatchObject({ id: "dup", name: "Dup v2" }); // moved to front, updated
    expect(recents.filter((r: { id: string }) => r.id === "dup")).toHaveLength(1); // deduped
    expect(recents.map((r: { id: string }) => r.id)).toEqual(["dup", "old"]);
    expect(kvSetMock).toHaveBeenCalled();
  });

  it("POST rejects a body missing id/name", async () => {
    getSessionMock.mockResolvedValue(SESSION);
    const res = await POST(req({ name: "no id" }));
    expect(res.status).toBe(400);
  });
});
