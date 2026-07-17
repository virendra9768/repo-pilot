import { join } from "node:path";
import { access } from "node:fs/promises";
import type { WorkspaceInfo } from "@/types/analysis";
import { validateGitHubUrl } from "@/lib/git/validate";
import {
  downloadRepoTarball,
  fetchRepoMeta,
  removeDir,
  MAX_REPO_SIZE_KB,
} from "@/lib/git/download";

/** Bundled demo repositories (see demo-repos/SOURCES.md). */
export const DEMOS = {
  "next-prisma-starter": {
    dir: "next-prisma-starter",
    label: "Next.js + Prisma Starter",
  },
  "nest-starter": {
    dir: "nest-starter",
    label: "NestJS Starter",
  },
} as const;

export type DemoKey = keyof typeof DEMOS;

/** Short aliases accepted from the API/UI. */
const DEMO_ALIASES: Record<string, DemoKey> = {
  next: "next-prisma-starter",
  "next-prisma-starter": "next-prisma-starter",
  nest: "nest-starter",
  "nest-starter": "nest-starter",
};

/** Demo used when a pasted URL is invalid or fails to clone. */
const DEFAULT_DEMO: DemoKey = "next-prisma-starter";

export type AnalyzeInput =
  | { kind: "demo"; demo: string }
  | { kind: "url"; url: string };

export interface AcquiredWorkspace {
  workspace: WorkspaceInfo;
  /** Removes the temp workspace (no-op for demo repos). */
  cleanup: () => Promise<void>;
}

export function listDemos(): { key: DemoKey; label: string }[] {
  return (Object.keys(DEMOS) as DemoKey[]).map((key) => ({
    key,
    label: DEMOS[key].label,
  }));
}

export function resolveDemoKey(input: string): DemoKey | undefined {
  return DEMO_ALIASES[input?.trim().toLowerCase()];
}

/** Turn a noisy fetch error into a short human hint. */
function cloneErrorHint(err: unknown): string {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (/not found|could not read|404/.test(msg)) {
    return "repository not found or is private";
  }
  if (/timeout|timed out|abort/.test(msg)) return "fetch timed out";
  if (/rate limit|429/.test(msg)) return "GitHub rate limit — try again later";
  if (/could not resolve host|network|getaddrinfo|fetch failed/.test(msg)) return "network error";
  if (/authentication|permission|access denied|403/.test(msg)) return "access denied / rate limit";
  return "fetch failed";
}

function demoDir(key: DemoKey): string {
  return join(process.cwd(), "demo-repos", DEMOS[key].dir);
}

async function demoWorkspace(
  key: DemoKey,
  fallbackReason?: string,
): Promise<AcquiredWorkspace> {
  const root = demoDir(key);
  await access(root); // throws if the vendored demo is missing
  return {
    workspace: {
      root,
      displayName: DEMOS[key].label,
      source: "demo",
      fallbackReason,
      isTemp: false,
    },
    cleanup: async () => {
      /* demo repos are permanent — nothing to clean up */
    },
  };
}

/**
 * Produce a ready-to-analyze workspace from a demo key or a GitHub URL.
 * On invalid URL or clone failure, falls back to the default demo repo so the
 * engine (and a live demo) never hard-fails.
 */
export async function acquireWorkspace(
  input: AnalyzeInput,
  opts: { token?: string } = {},
): Promise<AcquiredWorkspace> {
  if (input.kind === "demo") {
    const key = resolveDemoKey(input.demo) ?? DEFAULT_DEMO;
    return demoWorkspace(key);
  }

  const validation = validateGitHubUrl(input.url);
  if (!validation.ok || !validation.repo) {
    return demoWorkspace(
      DEFAULT_DEMO,
      `Invalid URL (${validation.error}) — analyzed the ${DEMOS[DEFAULT_DEMO].label} demo instead.`,
    );
  }

  const { owner, repo, slug } = validation.repo;

  // #1: reject oversized repos up front so we never burn the request budget
  // downloading + walking them. Best-effort — only rejects on a known size.
  const meta = await fetchRepoMeta(owner, repo, { token: opts.token });
  if (meta && meta.sizeKb > MAX_REPO_SIZE_KB) {
    return demoWorkspace(DEFAULT_DEMO, tooLargeReason(slug, meta.sizeKb));
  }

  const hadToken = Boolean(opts.token);
  let triedToken = false;
  try {
    // Public-first: only use the user's token if the public fetch is denied,
    // which also tells us the repo is private (for per-account cache namespacing).
    let dir: string;
    let isPrivate = false;
    try {
      dir = await downloadRepoTarball(owner, repo);
    } catch (err) {
      if (!opts.token || !isAccessError(err)) throw err;
      triedToken = true;
      dir = await downloadRepoTarball(owner, repo, { token: opts.token });
      isPrivate = true;
    }
    return {
      workspace: { root: dir, displayName: slug, source: "clone", isTemp: true, private: isPrivate },
      cleanup: () => removeDir(dir),
    };
  } catch (err) {
    return demoWorkspace(DEFAULT_DEMO, fallbackReason(slug, err, hadToken, triedToken));
  }
}

/**
 * Human-readable reason for falling back to a demo. Distinguishes the two
 * private-repo access cases so the failure is self-explaining:
 *  - a token was tried but GitHub still denied it (wrong app type / not installed / scope);
 *  - no token was available at all (the repo may be private — connect GitHub).
 */
export function fallbackReason(
  slug: string,
  err: unknown,
  hadToken: boolean,
  triedToken: boolean,
): string {
  const demo = DEMOS[DEFAULT_DEMO].label;
  if (isAccessError(err)) {
    if (triedToken) {
      return (
        `Connected, but GitHub denied access to ${slug}. If you registered a GitHub App, ` +
        `switch to an OAuth App (or install the app on this repo with Contents read access). ` +
        `Analyzed the ${demo} demo instead.`
      );
    }
    if (!hadToken) {
      return (
        `${slug} was not found or is private — connect GitHub at the top of the page to ` +
        `analyze private repos. Analyzed the ${demo} demo instead.`
      );
    }
  }
  return `Couldn't fetch ${slug} (${cloneErrorHint(err)}) — analyzed the ${demo} demo instead.`;
}

/** Message shown when a repo exceeds the size limit and we skip analyzing it. */
export function tooLargeReason(slug: string, sizeKb: number): string {
  const sizeMb = Math.round(sizeKb / 1024);
  const limitMb = Math.round(MAX_REPO_SIZE_KB / 1024);
  return (
    `${slug} is ~${sizeMb} MB, over the ${limitMb} MB limit for live analysis — ` +
    `try a smaller repo. Analyzed the ${DEMOS[DEFAULT_DEMO].label} demo instead.`
  );
}

export function isAccessError(err: unknown): boolean {
  const m = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return /\b(404|403)\b|not found|forbidden/.test(m);
}
