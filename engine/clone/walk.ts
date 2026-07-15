import { readdir, stat } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join, relative, extname, sep } from "node:path";
import type { RepoFile } from "@/types/analysis";
import {
  isIgnoredDir,
  isBinaryExtension,
  MAX_TEXT_FILE_BYTES,
} from "@/lib/security/ignore";

/**
 * Recursively walk a repository root, honoring the ignore list.
 * Returns a flat `RepoFile[]`; file content is read lazily and cached.
 */
export async function walkRepo(root: string): Promise<RepoFile[]> {
  const out: RepoFile[] = [];
  await walkDir(root, root, out);
  // Deterministic ordering makes downstream output stable.
  out.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return out;
}

async function walkDir(dir: string, root: string, out: RepoFile[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // unreadable dir — skip
  }
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (isIgnoredDir(entry.name)) continue;
      await walkDir(abs, root, out);
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
