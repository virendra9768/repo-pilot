import { describe, it, expect, beforeEach, vi } from "vitest";

const { getSessionMock, oauthConfiguredMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  oauthConfiguredMock: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  getSession: getSessionMock,
  oauthConfigured: oauthConfiguredMock,
}));

import { GET } from "./route";

beforeEach(() => vi.clearAllMocks());

describe("GET /api/auth/me", () => {
  it("reports not-configured / disconnected", async () => {
    oauthConfiguredMock.mockReturnValue(false);
    getSessionMock.mockResolvedValue(null);
    expect(await (await GET()).json()).toEqual({
      configured: false,
      connected: false,
      login: null,
    });
  });

  it("reports connected with the login but never the token", async () => {
    oauthConfiguredMock.mockReturnValue(true);
    getSessionMock.mockResolvedValue({ userId: "7", token: "gho_secret", login: "octocat" });
    const body = await (await GET()).json();
    expect(body).toEqual({ configured: true, connected: true, login: "octocat" });
    expect(JSON.stringify(body)).not.toContain("gho_secret");
  });
});
