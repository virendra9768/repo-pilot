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

/**
 * Hard ceiling on how many files the walk collects. Bounds memory + analysis
 * time for huge monorepos; normal repos fall well under it. When hit, analysis
 * runs on the first N files and flags the result as truncated.
 */
export const MAX_WALK_FILES = 5000;

/**
 * Parse budget for the AST layer. These bound heap, not just time: the walk
 * admits up to MAX_WALK_FILES * MAX_TEXT_FILE_BYTES (~2.5 GB) of source, and a
 * TypeScript AST runs ~10-20x its source size. The parse cache holds every tree
 * at once, so without a ceiling a pathological repo would ask for tens of GB.
 *
 * MAX_PARSE_TOTAL_BYTES is the one that actually caps the heap (~8 MB source ->
 * ~80-160 MB of AST, always). The other two are cheap early-outs; the per-file
 * cap also keeps checked-in minified bundles — worst AST-per-byte, least
 * informative — out of the cache. Files are visited in sorted path order, so
 * which ones get dropped is deterministic.
 */
export const MAX_PARSE_FILES = 2000;
export const MAX_PARSE_FILE_BYTES = 256 * 1024; // 256 KB
export const MAX_PARSE_TOTAL_BYTES = 5 * 1024 * 1024; // 5 MB

export function isIgnoredDir(name: string): boolean {
  return IGNORED_DIRS.has(name);
}

export function isBinaryExtension(ext: string): boolean {
  return BINARY_EXTENSIONS.has(ext.toLowerCase());
}
