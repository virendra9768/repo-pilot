import { join } from "node:path";
import { access } from "node:fs/promises";
import type { WorkspaceInfo } from "@/types/analysis";
import { validateGitHubUrl } from "@/lib/git/validate";
import { downloadRepoTarball, removeDir } from "@/lib/git/download";

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

  try {
    const dir = await downloadRepoTarball(validation.repo.owner, validation.repo.repo);
    return {
      workspace: {
        root: dir,
        displayName: validation.repo.slug,
        source: "clone",
        isTemp: true,
      },
      cleanup: () => removeDir(dir),
    };
  } catch (err) {
    return demoWorkspace(
      DEFAULT_DEMO,
      `Couldn't fetch ${validation.repo.slug} (${cloneErrorHint(err)}) — analyzed the ${DEMOS[DEFAULT_DEMO].label} demo instead.`,
    );
  }
}
