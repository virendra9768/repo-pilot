import { Readable, Transform } from "node:stream";
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
  opts: { timeoutMs?: number; token?: string; maxBytes?: number } = {},
): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const maxBytes = opts.maxBytes ?? MAX_TARBALL_BYTES;
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
      byteLimit(maxBytes),
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

/**
 * The ONLY size guard, and deliberately so: it measures bytes we actually pull.
 *
 * There used to be a pre-flight rejection on GitHub's reported repo size. That
 * field includes git history, so it does not predict download size at all —
 * measured ratios of reported-size to real tarball ran from 3x to 418x with no
 * relationship to repo size:
 *   nestjs/nest       474.6 MB reported ->  1.1 MB tarball  (418x)
 *   expressjs/express   9.6 MB reported ->  0.1 MB tarball   (96x)
 *   shadcn-ui/ui       66.0 MB reported -> 20.1 MB tarball    (3x)
 * No threshold discriminates, so any pre-flight ceiling falsely rejects repos
 * that would analyze fine — express at 0.1 MB, nest at 1.1 MB. It was removed.
 *
 * The byte-counting Transform below aborts the stream the instant this cap is
 * exceeded, so worst-case download is this number regardless of how large the
 * repo claims to be. That bounds the cost on its own.
 *
 * 20 MB covers express, axios, trpc, create-t3-app, vite, prisma, remix and
 * nest; it rejects shadcn-ui/ui (20.1 MB) and next.js (48.9 MB). Raising it
 * trades demo-day latency against coverage — the route budget is 60s total,
 * shared with AST parsing and a 10-20s AI call.
 */
export const MAX_TARBALL_BYTES = 50 * 1024 * 1024; // 50 MB

export interface RepoMeta {
  /**
   * Repository size in KB, as reported by GitHub. Includes git history, so it
   * is NOT a usable proxy for download size (see MAX_TARBALL_BYTES). Retained
   * for display only.
   */
  sizeKb: number;
  private: boolean;
  /** Primary language, or null when GitHub couldn't detect one. */
  language: string | null;
}

/**
 * Fetch lightweight repo metadata (`GET /repos/{owner}/{repo}`) so we can skip
 * repos the analyzer can't handle before downloading the tarball. Best-effort:
 * returns null on any error (e.g. a private repo with no/insufficient token, or
 * a rate limit), in which case the caller proceeds with the normal download.
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
    const json = (await res.json()) as {
      size?: number;
      private?: boolean;
      language?: string | null;
    };
    // Guard on `size` only. `language` is legitimately null for empty or
    // undetected repos, so it must never fail the whole lookup.
    if (typeof json.size !== "number") return null;
    return {
      sizeKb: json.size,
      private: Boolean(json.private),
      language: json.language ?? null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pass-through that aborts the pipeline once `max` bytes have flowed. Failing
 * mid-stream means `pipeline` rejects, and the caller's catch removes the
 * partially-extracted temp dir — same path as any other download failure.
 */
function byteLimit(max: number): Transform {
  let seen = 0;
  return new Transform({
    transform(chunk: Buffer, _enc, cb) {
      seen += chunk.length;
      if (seen > max) {
        cb(new Error(`Repository archive exceeds ${Math.round(max / 1024 / 1024)} MB limit`));
        return;
      }
      cb(null, chunk);
    },
  });
}

/** Best-effort recursive delete; never throws. Retries transient locks. */
export async function removeDir(dir: string): Promise<void> {
  try {
    await rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch {
    /* ignore cleanup errors */
  }
}
