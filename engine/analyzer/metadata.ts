import type { RepoFile, RepoMetadata, PackageJson } from "@/types/analysis";

const LOCKFILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "npm-shrinkwrap.json",
]);

export interface MetadataResult {
  metadata: RepoMetadata;
  /** Import path aliases (prefix ending in "/" -> repo-relative dir prefix). */
  importAliases: Record<string, string>;
}

/** Extract package.json / README / tsconfig / lockfiles / dockerfiles / env example. */
export function analyzeMetadata(files: RepoFile[]): MetadataResult {
  const pkgFile = shallowest(files.filter((f) => f.name === "package.json"));
  let packageJson: PackageJson | undefined;
  if (pkgFile) {
    try {
      packageJson = JSON.parse(pkgFile.read()) as PackageJson;
    } catch {
      /* malformed package.json — leave undefined */
    }
  }

  const allDependencies: Record<string, string> = {
    ...(packageJson?.dependencies ?? {}),
    ...(packageJson?.devDependencies ?? {}),
  };

  const readme = shallowest(files.filter((f) => /^readme(\.|$)/i.test(f.name)));
  const tsconfig = shallowest(
    files.filter((f) => f.name === "tsconfig.json"),
  );
  const envExample = shallowest(
    files.filter((f) =>
      /^\.env\.(example|sample|template|dist)$/i.test(f.name),
    ),
  );

  const lockfiles = files
    .filter((f) => LOCKFILES.has(f.name))
    .map((f) => f.relPath);
  const dockerfiles = files
    .filter(
      (f) =>
        f.name.toLowerCase() === "dockerfile" ||
        /^dockerfile\./i.test(f.name) ||
        /\.dockerfile$/i.test(f.name),
    )
    .map((f) => f.relPath);

  const importAliases = parseAliases(tsconfig);

  return {
    metadata: {
      packageJson,
      packageJsonPath: pkgFile?.relPath,
      readmePath: readme?.relPath,
      tsconfigPath: tsconfig?.relPath,
      envExamplePath: envExample?.relPath,
      lockfiles,
      dockerfiles,
      allDependencies,
    },
    importAliases,
  };
}

/** Prefer the shallowest (closest to root), then alphabetical. */
function shallowest(candidates: RepoFile[]): RepoFile | undefined {
  return candidates
    .slice()
    .sort((a, b) => {
      const da = a.relPath.split("/").length;
      const db = b.relPath.split("/").length;
      return da - db || a.relPath.localeCompare(b.relPath);
    })[0];
}

/** Read `compilerOptions.paths` into a simple prefix->dir map (tolerant of comments). */
function parseAliases(tsconfig?: RepoFile): Record<string, string> {
  const aliases: Record<string, string> = {};
  if (!tsconfig) return aliases;
  let json: {
    compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> };
  };
  try {
    json = JSON.parse(stripJsonComments(tsconfig.read()));
  } catch {
    return aliases;
  }
  const opts = json.compilerOptions ?? {};
  const baseUrl = normalizeDir(opts.baseUrl ?? ".");
  const paths = opts.paths ?? {};
  for (const [key, targets] of Object.entries(paths)) {
    if (!Array.isArray(targets) || targets.length === 0) continue;
    const prefix = key.replace(/\*$/, ""); // "@/*" -> "@/"
    if (!prefix) continue;
    const target = targets[0].replace(/\*$/, "").replace(/^\.\//, "");
    aliases[prefix] = normalizeDir(joinPosix(baseUrl, target));
  }
  return aliases;
}

/** Normalize a repo-relative dir to "" (root) or "some/dir/" form. */
function normalizeDir(dir: string): string {
  const cleaned = dir.replace(/^\.\/?/, "").replace(/\/+$/, "");
  return cleaned === "" || cleaned === "." ? "" : cleaned + "/";
}

function joinPosix(a: string, b: string): string {
  const left = a.replace(/\/+$/, "");
  const right = b.replace(/^\/+/, "");
  return [left, right].filter(Boolean).join("/");
}

/**
 * Tolerant JSONC cleanup for tsconfig: strip `//` line comments and trailing
 * commas. Block comments are intentionally left alone — tsconfig path keys such
 * as `"@/*"` contain `/*`, and stripping to a later `*\/` could delete `paths`.
 * The `[^:]` guard avoids mangling `https://` URLs (e.g. `$schema`).
 */
export function stripJsonComments(input: string): string {
  return input
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/,(\s*[}\]])/g, "$1");
}
