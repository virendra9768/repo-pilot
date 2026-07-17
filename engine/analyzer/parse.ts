import { Project, ScriptKind, ScriptTarget, type SourceFile } from "ts-morph";
import type { RepoFile } from "@/types/analysis";
import {
  MAX_PARSE_FILES,
  MAX_PARSE_FILE_BYTES,
  MAX_PARSE_TOTAL_BYTES,
} from "@/lib/security/ignore";

/**
 * Shared ts-morph parse cache — every code file is parsed exactly once and the
 * tree is handed to routes / database / dependencies, which previously each
 * re-scanned the same text independently.
 *
 * PARSE ONLY. This must never construct a Program or a type checker: ts-morph
 * builds them lazily, so the constraint is a discipline, not a flag.
 * `createSourceFile` alone builds nothing. Do not call, or use anything that
 * reaches:
 *
 *   project.getProgram() · project.getTypeChecker() · getPreEmitDiagnostics()
 *   sourceFile.getExportedDeclarations() · getReferencingSourceFiles() · emit()
 *   node.getType() · getSymbol() · getContextualType() · getDefinitions()
 *   node.findReferences() · importDecl.getModuleSpecifierSourceFile()
 *   sourceFile.getImportStringLiterals()   <- reads ts.SourceFile.imports, which
 *                                             the BINDER populates, not the parser
 *
 * Everything we need (imports, decorators, classes, call expressions) is
 * syntactic and available straight off the tree.
 */

const CODE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

/**
 * Explicit, not inferred. `.js` must NOT be parsed as JSX — `foo<Bar>(x)` parses
 * differently under JSX rules than under JS rules.
 */
const SCRIPT_KIND: Record<string, ScriptKind> = {
  ".ts": ScriptKind.TS,
  ".tsx": ScriptKind.TSX,
  ".js": ScriptKind.JS,
  ".jsx": ScriptKind.JSX,
  ".mjs": ScriptKind.JS,
  ".cjs": ScriptKind.JS,
};

export interface ParseStats {
  parsed: number;
  /** Not text, not code, a .d.ts, or over the per-file cap. */
  skipped: number;
  /** createSourceFile threw outright. */
  failed: number;
  /** True when a global cap stopped further parsing. */
  capped: boolean;
}

export interface ParseCache {
  /** The tree for a code file, or null if it was skipped/failed/capped. Never throws. */
  get(file: RepoFile): SourceFile | null;
  /** Run `fn`, forgetting the ts-morph wrapper nodes it creates. */
  scoped<T>(fn: () => T): T;
  readonly stats: ParseStats;
  /** Drop every tree. Idempotent. */
  dispose(): void;
}

export interface ParseOptions {
  maxFiles?: number;
  maxFileBytes?: number;
  maxTotalBytes?: number;
}

export function createParseCache(
  files: RepoFile[],
  opts: ParseOptions = {},
): ParseCache {
  const maxFiles = opts.maxFiles ?? MAX_PARSE_FILES;
  const maxFileBytes = opts.maxFileBytes ?? MAX_PARSE_FILE_BYTES;
  const maxTotalBytes = opts.maxTotalBytes ?? MAX_PARSE_TOTAL_BYTES;

  const project = new Project({
    // Never touch disk. Mutually exclusive with `fileSystem` (ts-morph throws).
    useInMemoryFileSystem: true,
    // Guard in case anyone later switches to addSourceFileAtPath, which would
    // otherwise pull in referenced files. Moot for createSourceFile.
    skipFileDependencyResolution: true,
    // Without this, useInMemoryFileSystem copies the whole lib.*.d.ts set into
    // the memory FS on every run. Throws if combined with libFolderPath.
    skipLoadingLibFiles: true,
    // NB: no tsConfigFilePath — omitting it is what prevents tsconfig resolution.
    compilerOptions: {
      target: ScriptTarget.Latest,
      allowJs: true,
      experimentalDecorators: true,
    },
  });

  const stats: ParseStats = { parsed: 0, skipped: 0, failed: 0, capped: false };
  const cache = new Map<string, SourceFile | null>();
  let totalBytes = 0;
  let disposed = false;

  // `files` arrives sorted by relPath (walk.ts), so cap behavior is deterministic.
  for (const file of files) {
    if (!isParseable(file, maxFileBytes)) {
      cache.set(file.relPath, null);
      stats.skipped++;
      continue;
    }
    if (stats.parsed >= maxFiles || totalBytes + file.size > maxTotalBytes) {
      cache.set(file.relPath, null);
      stats.capped = true;
      stats.skipped++;
      continue;
    }
    const sf = parseOne(project, file);
    cache.set(file.relPath, sf);
    if (sf) {
      stats.parsed++;
      totalBytes += file.size;
    } else {
      stats.failed++;
    }
  }

  return {
    get(file) {
      return cache.get(file.relPath) ?? null;
    },
    scoped(fn) {
      // Frees the per-node wrapper objects ts-morph memoizes during traversal.
      // Callers MUST return plain data — a Node escaping this block throws on
      // next use ("attempted to get information from a node that was forgotten").
      return project.forgetNodesCreatedInBlock(() => fn());
    },
    stats,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const sf of cache.values()) {
        if (sf) {
          try {
            project.removeSourceFile(sf);
          } catch {
            /* already gone; nothing to release */
          }
        }
      }
      cache.clear();
    },
  };
}

function isParseable(file: RepoFile, maxFileBytes: number): boolean {
  // isText is false for binaries and for files over MAX_TEXT_FILE_BYTES, whose
  // read() returns "" — parsing that yields a valid-but-empty tree, pure waste.
  if (!file.isText) return false;
  if (!CODE_EXT.has(file.ext)) return false;
  // Declaration files hold no routes and no models, and their imports are
  // ambient. Skipping them is the biggest memory win on repos vendoring typings.
  if (file.name.endsWith(".d.ts")) return false;
  if (file.size > maxFileBytes) return false;
  return true;
}

function parseOne(project: Project, file: RepoFile): SourceFile | null {
  try {
    return project.createSourceFile(`/${file.relPath}`, file.read(), {
      overwrite: true,
      scriptKind: SCRIPT_KIND[file.ext],
    });
  } catch {
    // The TS parser is error-tolerant by design — it returns a best-effort tree
    // for malformed input rather than throwing. So this only catches genuine
    // exceptions (encoding blowups, internal invariants), which aren't
    // actionable mid-request. Partial results still beat the old regex here.
    return null;
  }
}
