import type { RepoFile, RepoMetadata, RepoContextPack } from "@/types/analysis";
import type { UnderstandingMap } from "@/types/understanding-map";
import { MAX_FILE_LINES_ENTRIES } from "@/lib/security/limits";

const README_MAX = 2000;
const SNIPPET_LINES = 40;
const SNIPPET_FILES = 8;
const CODE_EXT = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".prisma", ".css", ".md",
]);

export interface ContextPackResult {
  pack: RepoContextPack;
  /** True when the `fileLines` cap dropped entries. */
  capped: boolean;
}

/**
 * Capture the extra repo detail the AI layer needs, BEFORE the temp workspace
 * is cleaned up. Everything here is derived from RepoFile content while it's
 * still on disk.
 */
export function buildContextPack(
  files: RepoFile[],
  metadata: RepoMetadata,
  map: UnderstandingMap,
): ContextPackResult {
  const byPath = new Map(files.map((f) => [f.relPath, f]));

  let readmeExcerpt: string | undefined;
  if (metadata.readmePath) {
    const readme = byPath.get(metadata.readmePath);
    if (readme) readmeExcerpt = readme.read().slice(0, README_MAX);
  }

  // Critical files first, so the paths most likely to be referenced survive the
  // cap; the rest follow in walk order.
  const criticalPaths = new Set(map.criticalFiles.map((cf) => cf.path));
  const ordered = [
    ...files.filter((f) => criticalPaths.has(f.relPath)),
    ...files.filter((f) => !criticalPaths.has(f.relPath)),
  ];

  const fileLines: Record<string, number> = {};
  let lineEntries = 0;
  let capped = false;
  for (const f of ordered) {
    if (!f.isText || !CODE_EXT.has(f.ext)) continue;
    if (lineEntries >= MAX_FILE_LINES_ENTRIES) {
      capped = true;
      break;
    }
    fileLines[f.relPath] = countLines(f.read());
    lineEntries++;
  }

  const snippets: Record<string, string> = {};
  for (const cf of map.criticalFiles.slice(0, SNIPPET_FILES)) {
    const f = byPath.get(cf.path);
    if (f?.isText) {
      snippets[cf.path] = f.read().split("\n").slice(0, SNIPPET_LINES).join("\n");
    }
  }

  return {
    pack: { readmeExcerpt, fileLines, snippets, folderTree: buildFolderTree(files) },
    capped,
  };
}

function countLines(content: string): number {
  if (!content) return 0;
  let n = 1;
  for (let i = 0; i < content.length; i++) if (content[i] === "\n") n++;
  return n;
}

function buildFolderTree(files: RepoFile[]): string[] {
  const counts = new Map<string, number>();
  for (const f of files) {
    const seg = f.relPath.includes("/") ? f.relPath.split("/")[0] + "/" : "(root)";
    counts.set(seg, (counts.get(seg) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([dir, n]) => `${dir} (${n} file${n === 1 ? "" : "s"})`);
}
