import { readdir, stat } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join, relative, extname, sep } from "node:path";
import type { RepoFile } from "@/types/analysis";
import {
  isIgnoredDir,
  isBinaryExtension,
  MAX_TEXT_FILE_BYTES,
  MAX_WALK_FILES,
} from "@/lib/security/ignore";

export interface WalkResult {
  files: RepoFile[];
  /** True when the file cap was hit and only the first N files were collected. */
  truncated: boolean;
}

/**
 * Recursively walk a repository root, honoring the ignore list and a hard file
 * cap (see {@link MAX_WALK_FILES}). Returns a flat `RepoFile[]`; file content is
 * read lazily and cached. `truncated` signals the cap was reached.
 */
export async function walkRepo(
  root: string,
  opts: { maxFiles?: number } = {},
): Promise<WalkResult> {
  const maxFiles = opts.maxFiles ?? MAX_WALK_FILES;
  const out: RepoFile[] = [];
  await walkDir(root, root, out, maxFiles);
  // Deterministic ordering makes downstream output stable.
  out.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return { files: out, truncated: out.length >= maxFiles };
}

async function walkDir(
  dir: string,
  root: string,
  out: RepoFile[],
  maxFiles: number,
): Promise<void> {
  if (out.length >= maxFiles) return; // cap reached — stop descending
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // unreadable dir — skip
  }
  for (const entry of entries) {
    if (out.length >= maxFiles) return;
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (isIgnoredDir(entry.name)) continue;
      await walkDir(abs, root, out, maxFiles);
    } else if (entry.isFile()) {
      const relPath = relative(root, abs).split(sep).join("/");
      const ext = extname(entry.name).toLowerCase();
      let size = 0;
      try {
        size = (await stat(abs)).size;
      } catch {
        /* ignore */
      }
      const isText = !isBinaryExtension(ext) && size <= MAX_TEXT_FILE_BYTES;
      out.push(makeRepoFile(abs, relPath, entry.name, ext, size, isText));
    }
    // symlinks and other entry types are intentionally skipped
  }
}

function makeRepoFile(
  absPath: string,
  relPath: string,
  name: string,
  ext: string,
  size: number,
  isText: boolean,
): RepoFile {
  let cache: string | null = null;
  return {
    absPath,
    relPath,
    name,
    ext,
    size,
    isText,
    read() {
      if (!isText) return "";
      if (cache === null) {
        try {
          cache = readFileSync(absPath, "utf8");
        } catch {
          cache = "";
        }
      }
      return cache;
    },
  };
}
