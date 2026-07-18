import { describe, it, expect } from "vitest";
import {
  resolveDemoKey,
  isAccessError,
  isArchiveTooLargeError,
  fallbackReason,
  notJsReason,
} from "./index";

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

  it("gives the download limit its own message, not a generic fetch failure", () => {
    const err = new Error("Repository archive exceeds 20 MB limit");
    const msg = fallbackReason("big/repo", err, false, false);
    expect(msg).toMatch(/over the 20 MB download limit/i);
    expect(msg).not.toMatch(/couldn't fetch/i);
  });
});

describe("isArchiveTooLargeError", () => {
  it("matches the stream guard's error", () => {
    expect(isArchiveTooLargeError(new Error("Repository archive exceeds 20 MB limit"))).toBe(true);
  });

  it("is false for unrelated failures", () => {
    expect(isArchiveTooLargeError(new Error("GitHub tarball 404 Not Found"))).toBe(false);
    expect(isArchiveTooLargeError(new Error("fetch timed out"))).toBe(false);
  });
});

describe("notJsReason", () => {
  it("names the detected language and frames it as scope, not failure", () => {
    const msg = notJsReason("django/django", "Python");
    expect(msg).toMatch(/looks like a Python project/i);
    expect(msg).toMatch(/analyzes JavaScript and TypeScript/i);
    expect(msg).toMatch(/Next\.js \+ Prisma Starter demo instead/i);
  });

  it("stays readable when the language is unknown", () => {
    const msg = notJsReason("acme/thing", null);
    expect(msg).toMatch(/isn't a JavaScript\/TypeScript project/i);
    expect(msg).not.toMatch(/null/);
  });
});
