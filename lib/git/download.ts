import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extract } from "tar";

/**
 * Fetch a public GitHub repo as a tarball and extract it to a temp dir — pure
 * HTTP, no `git` binary required (so it works on serverless too). Equivalent to
 * the previous shallow clone: default branch, no history.
 *
 * Uses the GitHub API tarball endpoint (302-redirects to codeload, which fetch
 * follows). `GITHUB_TOKEN` is optional and only raises the rate limit.
 */
export async function downloadRepoTarball(
  owner: string,
  repo: string,
  opts: { timeoutMs?: number; token?: string } = {},
): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const dir = await mkdtemp(join(tmpdir(), "repopilot-"));

  const headers: Record<string, string> = { "User-Agent": "RepoPilot" };
  // Per-call token (for private repos) overrides the optional env token.
  const token = opts.token ?? process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/tarball`;
    const res = await fetch(url, { headers, redirect: "follow", signal: controller.signal });
    if (!res.ok || !res.body) {
      throw new Error(`GitHub tarball ${res.status} ${res.statusText || ""}`.trim());
    }
    // Extract straight from the response stream. tar auto-detects gzip; strip:1
    // removes the top-level "<owner>-<repo>-<sha>/" wrapper so files land in `dir`.
    await pipeline(
      Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]),
      extract({ cwd: dir, strip: 1 }),
    );
    return dir;
  } catch (err) {
    await removeDir(dir);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** GitHub's reported repo size ceiling (in KB). Larger repos are rejected up
 *  front so we never spend the request budget downloading + walking them. */
export const MAX_REPO_SIZE_KB = 150 * 1024; // ~150 MB

export interface RepoMeta {
  /** Repository size in KB, as reported by GitHub. */
  sizeKb: number;
  private: boolean;
}

/**
 * Fetch lightweight repo metadata (`GET /repos/{owner}/{repo}`) so we can reject
 * oversized repos before downloading the tarball. Best-effort: returns null on
 * any error (e.g. a private repo with no/insufficient token), in which case the
 * caller proceeds with the normal download flow.
 */
export async function fetchRepoMeta(
  owner: string,
  repo: string,
  opts: { token?: string; timeoutMs?: number } = {},
): Promise<RepoMeta | null> {
  const headers: Record<string, string> = {
    "User-Agent": "RepoPilot",
    Accept: "application/vnd.github+json",
  };
  const token = opts.token ?? process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15_000);
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers,
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { size?: number; private?: boolean };
    if (typeof json.size !== "number") return null;
    return { sizeKb: json.size, private: Boolean(json.private) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Best-effort recursive delete; never throws. Retries transient locks. */
export async function removeDir(dir: string): Promise<void> {
  try {
    await rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch {
    /* ignore cleanup errors */
  }
}
