/**
 * Ignore rules for repository walking. Keeps the analyzer off dependency trees,
 * build output, VCS internals, and binary blobs — both for speed and safety.
 */

/** Directory names skipped entirely during the walk. */
export const IGNORED_DIRS = new Set<string>([
  "node_modules",
  ".git",
  ".hg",
  ".svn",
  "dist",
  "build",
  "coverage",
  ".next",
  "out",
  ".turbo",
  ".cache",
  ".parcel-cache",
  ".vercel",
  ".idea",
  ".vscode",
  ".yarn",
  ".pnp",
  "generated", // e.g. prisma client output
]);

/** Extensions treated as binary/non-analyzable (content is not read). */
export const BINARY_EXTENSIONS = new Set<string>([
  // images
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".webp", ".avif", ".bmp", ".tiff", ".svg",
  // fonts
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  // media
  ".mp3", ".mp4", ".wav", ".ogg", ".webm", ".mov", ".avi", ".flac",
  // archives / binaries
  ".zip", ".gz", ".tar", ".tgz", ".rar", ".7z", ".bz2",
  ".pdf", ".exe", ".dll", ".so", ".dylib", ".bin", ".wasm", ".node",
  ".class", ".jar", ".pyc", ".o", ".a",
  // misc noise
  ".map", ".lock",
]);

/** Files above this size are recorded but not read for content analysis. */
export const MAX_TEXT_FILE_BYTES = 512 * 1024; // 512 KB

export function isIgnoredDir(name: string): boolean {
  return IGNORED_DIRS.has(name);
}

export function isBinaryExtension(ext: string): boolean {
  return BINARY_EXTENSIONS.has(ext.toLowerCase());
}
