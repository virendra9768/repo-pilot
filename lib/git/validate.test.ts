import { describe, it, expect } from "vitest";
import { validateGitHubUrl } from "./validate";

describe("validateGitHubUrl", () => {
  it("accepts owner/repo shorthand", () => {
    const r = validateGitHubUrl("facebook/react");
    expect(r.ok).toBe(true);
    expect(r.repo?.slug).toBe("facebook/react");
    expect(r.repo?.cloneUrl).toBe("https://github.com/facebook/react.git");
  });

  it("accepts a full https URL and strips a trailing .git", () => {
    const r = validateGitHubUrl("https://github.com/vercel/next.js.git");
    expect(r.ok).toBe(true);
    expect(r.repo?.owner).toBe("vercel");
    expect(r.repo?.repo).toBe("next.js");
  });

  it("accepts the www host", () => {
    expect(validateGitHubUrl("https://www.github.com/a/b").ok).toBe(true);
  });

  it("upgrades http to https", () => {
    const r = validateGitHubUrl("http://github.com/a/b");
    expect(r.ok).toBe(true);
    expect(r.repo?.cloneUrl).toBe("https://github.com/a/b.git");
  });

  it("normalizes scp-style git@ URLs", () => {
    const r = validateGitHubUrl("git@github.com:owner/repo.git");
    expect(r.ok).toBe(true);
    expect(r.repo?.slug).toBe("owner/repo");
  });

  it("rejects an empty input", () => {
    const r = validateGitHubUrl("");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/no repository url/i);
  });

  it("rejects a non-github host", () => {
    const r = validateGitHubUrl("https://gitlab.com/a/b");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/only github\.com/i);
  });

  it("rejects a URL missing the repository segment", () => {
    const r = validateGitHubUrl("https://github.com/owner");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/owner and repository/i);
  });

  it("rejects a plainly invalid URL", () => {
    expect(validateGitHubUrl("not a url at all").ok).toBe(false);
  });
});
