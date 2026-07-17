import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/** In-memory cookie jar the mocked `next/headers` reads from. */
let jar = new Map<string, { value: string }>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => jar.get(name),
  }),
}));

import {
  SESSION_COOKIE,
  oauthConfigured,
  encryptSession,
  getSession,
} from "./session";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  jar = new Map();
  process.env.SESSION_SECRET = "unit-test-secret-please-ignore";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("oauthConfigured", () => {
  it("is true only when all three OAuth env vars are set", () => {
    process.env.GITHUB_OAUTH_CLIENT_ID = "id";
    process.env.GITHUB_OAUTH_CLIENT_SECRET = "secret";
    expect(oauthConfigured()).toBe(true);

    delete process.env.GITHUB_OAUTH_CLIENT_SECRET;
    expect(oauthConfigured()).toBe(false);
  });
});

describe("session encryption round-trip", () => {
  const data = { token: "gho_secrettoken", userId: "42", login: "octocat" };

  it("encrypts then reads back the original session", async () => {
    const jwe = await encryptSession(data);
    expect(jwe).toBeTruthy();
    jar.set(SESSION_COOKIE, { value: jwe! });

    const s = await getSession();
    expect(s).toEqual(data);
  });

  it("returns null when no session cookie is present", async () => {
    expect(await getSession()).toBeNull();
  });

  it("returns null for a tampered/garbage cookie", async () => {
    jar.set(SESSION_COOKIE, { value: "not-a-real-jwe" });
    expect(await getSession()).toBeNull();
  });

  it("cannot encrypt or decrypt without SESSION_SECRET", async () => {
    const jwe = await encryptSession(data);
    jar.set(SESSION_COOKIE, { value: jwe! });
    delete process.env.SESSION_SECRET;

    expect(await encryptSession(data)).toBeNull();
    expect(await getSession()).toBeNull();
  });
});
