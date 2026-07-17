import { describe, it, expect } from "vitest";
import { resolveDemoKey, isAccessError, fallbackReason } from "./index";

describe("resolveDemoKey", () => {
  it("resolves aliases (case/space-insensitive)", () => {
    expect(resolveDemoKey("next")).toBe("next-prisma-starter");
    expect(resolveDemoKey("nest")).toBe("nest-starter");
    expect(resolveDemoKey("  NEST-STARTER ")).toBe("nest-starter");
  });

  it("returns undefined for an unknown key", () => {
    expect(resolveDemoKey("nope")).toBeUndefined();
    expect(resolveDemoKey("")).toBeUndefined();
  });
});

describe("isAccessError", () => {
  it("is true for 404/403/not-found/forbidden", () => {
    expect(isAccessError(new Error("GitHub tarball 404 Not Found"))).toBe(true);
    expect(isAccessError(new Error("403 Forbidden"))).toBe(true);
  });

  it("is false for transient/network errors", () => {
    expect(isAccessError(new Error("fetch timed out"))).toBe(false);
    expect(isAccessError(new Error("could not resolve host"))).toBe(false);
  });
});

describe("fallbackReason", () => {
  const notFound = new Error("GitHub tarball 404 Not Found");

  it("nudges anonymous users to connect when the repo looks private", () => {
    const msg = fallbackReason("acme/secret", notFound, /*hadToken*/ false, /*triedToken*/ false);
    expect(msg).toMatch(/not found or is private/i);
    expect(msg).toMatch(/connect github/i);
  });

  it("explains an access failure when a token was tried (GitHub App vs OAuth App)", () => {
    const msg = fallbackReason("acme/secret", notFound, true, true);
    expect(msg).toMatch(/connected, but/i);
    expect(msg).toMatch(/github app/i);
    expect(msg).toMatch(/oauth app/i);
  });

  it("falls back to the generic hint for non-access errors", () => {
    const msg = fallbackReason("acme/secret", new Error("fetch timed out"), false, false);
    expect(msg).toMatch(/couldn't fetch acme\/secret/i);
    expect(msg).toMatch(/timed out/i);
  });
});
