/**
 * Internal analysis types — the deterministic engine's working data.
 * These are NOT part of the locked Understanding Map schema.
 */

/** A single file discovered by the walker. Text is read lazily and cached. */
export interface RepoFile {
  /** Absolute path on disk. */
  absPath: string;
  /** Repo-root-relative, POSIX-style path (forward slashes). */
  relPath: string;
  /** Basename, e.g. "route.ts". */
  name: string;
  /** Lowercased extension including the dot, e.g. ".ts" ("" if none). */
  ext: string;
  /** Size in bytes. */
  size: number;
  /** False for binaries / oversized files (content not analyzed). */
  isText: boolean;
  /** Lazily read & cached UTF-8 content. Returns "" for non-text files. */
  read(): string;
}

export interface PackageJson {
  name?: string;
  version?: string;
  main?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  [key: string]: unknown;
}

export interface RepoMetadata {
  packageJson?: PackageJson;
  packageJsonPath?: string;
  readmePath?: string;
  tsconfigPath?: string;
  /** Detected lockfiles (repo-relative paths). */
  lockfiles: string[];
  /** Detected Dockerfiles (repo-relative paths). */
  dockerfiles: string[];
  envExamplePath?: string;
  /** Merged dependencies + devDependencies (name -> version range). */
  allDependencies: Record<string, string>;
}

/** Everything the analyzers operate on for one repository. */
export interface RepoContext {
  /** Absolute workspace root. */
  root: string;
  /** Display name used for graph labels / reporting. */
  displayName: string;
  files: RepoFile[];
  metadata: RepoMetadata;
  /** Import path aliases from tsconfig `paths` (e.g. "@/" -> ""). */
  importAliases: Record<string, string>;
}

/** A resolved file-to-file import relationship (repo-relative paths). */
export interface ImportLink {
  from: string;
  to: string;
}

/** How the repo workspace was obtained, for reporting/cleanup. */
export interface WorkspaceInfo {
  root: string;
  displayName: string;
  /** "clone" = cloned a URL to temp; "demo" = pointed at a bundled repo. */
  source: "clone" | "demo";
  /** Set when a demo fallback replaced a failed clone. */
  fallbackReason?: string;
  /** True when `root` is a temp dir the engine must clean up. */
  isTemp: boolean;
}
