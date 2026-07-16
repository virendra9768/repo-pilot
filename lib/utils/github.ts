/**
 * Reconstruct GitHub URLs from a repo id.
 * - Cloned repos have id `gh__owner__repo`.
 * - The two bundled demos map to their real source repos (with the vendored
 *   subfolder prefix so file links resolve correctly).
 */

interface DemoSource {
  repo: string;
  branch: string;
  /** Path prefix of the vendored subfolder within the source repo. */
  prefix: string;
}

const DEMO_SOURCE: Record<string, DemoSource> = {
  "next-prisma-starter": {
    repo: "prisma/prisma-examples",
    branch: "latest",
    prefix: "accelerate/nextjs-starter/",
  },
  "nest-starter": {
    repo: "nestjs/typescript-starter",
    branch: "master",
    prefix: "",
  },
};

function parseGh(id: string): { owner: string; repo: string } | null {
  if (id.startsWith("gh__")) {
    const [owner, repo] = id.slice(4).split("__");
    if (owner && repo) return { owner, repo };
  }
  return null;
}

/** URL to the repository's GitHub page, or null if unknown. */
export function repoUrl(id: string): string | null {
  const gh = parseGh(id);
  if (gh) return `https://github.com/${gh.owner}/${gh.repo}`;
  const demo = DEMO_SOURCE[id];
  return demo ? `https://github.com/${demo.repo}` : null;
}

/** URL to a specific file on GitHub, or null if it can't be constructed. */
export function fileUrl(id: string, path: string): string | null {
  if (!path) return null;
  const gh = parseGh(id);
  if (gh) return `https://github.com/${gh.owner}/${gh.repo}/blob/HEAD/${path}`;
  const demo = DEMO_SOURCE[id];
  if (demo) return `https://github.com/${demo.repo}/blob/${demo.branch}/${demo.prefix}${path}`;
  return null;
}
