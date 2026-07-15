import type { RepoFile, RepoMetadata, ImportLink } from "@/types/analysis";
import type { IntelligenceGraph } from "@/types/graph";
import type {
  UnderstandingMap,
  Technology,
  ImportantRoute,
  DatabaseModel,
  EntryPoint,
  CriticalFile,
  BusinessDomain,
  LearningStep,
} from "@/types/understanding-map";

const RESOLVE_EXTS = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const MAX_CRITICAL_FILES = 10;
const MAX_LEARNING_STEPS = 50;

export interface MapInputs {
  files: RepoFile[];
  metadata: RepoMetadata;
  technologies: Technology[];
  routes: ImportantRoute[];
  models: DatabaseModel[];
  importLinks: ImportLink[];
  graph: IntelligenceGraph;
}

/** Assemble the locked Understanding Map from all analyzer outputs. */
export function generateUnderstandingMap(input: MapInputs): UnderstandingMap {
  const fileSet = new Set(input.files.map((f) => f.relPath));

  const entryPoints = detectEntryPoints(input.metadata, fileSet);
  const inDegree = computeInDegree(input.importLinks);

  return {
    entryPoints,
    criticalFiles: detectCriticalFiles(input.files, inDegree, entryPoints),
    technologies: input.technologies,
    businessDomains: detectDomains(input.files),
    importantRoutes: input.routes,
    databaseModels: input.models,
    learningOrder: buildLearningOrder(input.importLinks, entryPoints, fileSet),
    graph: input.graph,
  };
}

// --- entry points ---------------------------------------------------------

function detectEntryPoints(
  metadata: RepoMetadata,
  fileSet: Set<string>,
): EntryPoint[] {
  const out: EntryPoint[] = [];
  const seen = new Set<string>();
  const add = (path: string, reason: string) => {
    if (!seen.has(path)) {
      seen.add(path);
      out.push({ path, reason });
    }
  };

  const main = metadata.packageJson?.main;
  if (main) {
    const resolved = resolveInSet(main.replace(/^\.\//, ""), fileSet);
    if (resolved) add(resolved, 'package.json "main"');
  }

  const conventions: { path: string; reason: string }[] = [
    { path: "app/layout.tsx", reason: "Next.js App Router root layout" },
    { path: "src/app/layout.tsx", reason: "Next.js App Router root layout" },
    { path: "app/page.tsx", reason: "Next.js App Router home page" },
    { path: "src/main.ts", reason: "NestJS application bootstrap" },
    { path: "src/index.ts", reason: "source entry point" },
    { path: "src/server.ts", reason: "server bootstrap" },
    { path: "index.ts", reason: "entry point" },
    { path: "index.js", reason: "entry point" },
    { path: "server.js", reason: "server bootstrap" },
  ];
  for (const c of conventions) {
    if (fileSet.has(c.path)) add(c.path, c.reason);
  }
  return out;
}

// --- critical files -------------------------------------------------------

const CONFIG_FILES = new Set([
  "package.json", "tsconfig.json", "nest-cli.json", "prisma.config.ts",
]);
const CONFIG_PATTERNS = [
  /(^|\/)next\.config\.[mc]?[jt]s$/,
  /(^|\/)tailwind\.config\.[mc]?[jt]s$/,
  /(^|\/)schema\.prisma$/,
];

function computeInDegree(links: ImportLink[]): Map<string, number> {
  const deg = new Map<string, number>();
  for (const l of links) deg.set(l.to, (deg.get(l.to) ?? 0) + 1);
  return deg;
}

function detectCriticalFiles(
  files: RepoFile[],
  inDegree: Map<string, number>,
  entryPoints: EntryPoint[],
): CriticalFile[] {
  const entrySet = new Set(entryPoints.map((e) => e.path));
  const scored: CriticalFile[] = [];

  for (const f of files) {
    const deg = inDegree.get(f.relPath) ?? 0;
    const isEntry = entrySet.has(f.relPath);
    const isConfig =
      CONFIG_FILES.has(f.name) || CONFIG_PATTERNS.some((re) => re.test(f.relPath));
    if (deg === 0 && !isEntry && !isConfig) continue;

    const score = deg * 2 + (isEntry ? 4 : 0) + (isConfig ? 2 : 0);
    const reasons: string[] = [];
    if (isEntry) reasons.push("entry point");
    if (deg > 0) reasons.push(`imported by ${deg} file${deg === 1 ? "" : "s"}`);
    if (isConfig) reasons.push("configuration file");
    scored.push({ path: f.relPath, reason: reasons.join("; "), score });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, MAX_CRITICAL_FILES);
}

// --- business domains -----------------------------------------------------

const DOMAIN_ROOTS = ["features", "src/features", "modules", "src/modules"];

function detectDomains(files: RepoFile[]): BusinessDomain[] {
  for (const root of DOMAIN_ROOTS) {
    const grouped = groupByImmediateSubdir(files, root);
    if (grouped.length) return grouped;
  }
  return [];
}

function groupByImmediateSubdir(files: RepoFile[], root: string): BusinessDomain[] {
  const prefix = root + "/";
  const byDomain = new Map<string, string[]>();
  for (const f of files) {
    if (!f.relPath.startsWith(prefix)) continue;
    const rest = f.relPath.slice(prefix.length);
    const name = rest.split("/")[0];
    if (!name) continue;
    const list = byDomain.get(name) ?? [];
    if (list.length < 20) list.push(f.relPath);
    byDomain.set(name, list);
  }
  return [...byDomain.entries()]
    .map(([name, paths]) => ({ name, paths }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// --- learning order (BFS from entry points) -------------------------------

function buildLearningOrder(
  links: ImportLink[],
  entryPoints: EntryPoint[],
  fileSet: Set<string>,
): LearningStep[] {
  const adj = new Map<string, string[]>();
  for (const l of links) {
    const list = adj.get(l.from) ?? [];
    list.push(l.to);
    adj.set(l.from, list);
  }

  const depth = new Map<string, number>();
  const queue: string[] = [];
  for (const e of entryPoints) {
    if (!depth.has(e.path)) {
      depth.set(e.path, 0);
      queue.push(e.path);
    }
  }
  while (queue.length) {
    const cur = queue.shift()!;
    const d = depth.get(cur)!;
    for (const next of adj.get(cur) ?? []) {
      if (!depth.has(next)) {
        depth.set(next, d + 1);
        queue.push(next);
      }
    }
  }

  const reached = [...depth.entries()].sort(
    (a, b) => a[1] - b[1] || a[0].localeCompare(b[0]),
  );

  const steps: LearningStep[] = reached
    .slice(0, MAX_LEARNING_STEPS)
    .map(([path, d], i) => ({
      path,
      order: i + 1,
      reason:
        d === 0
          ? "start here — application entry point"
          : `dependency reached ${d} step${d === 1 ? "" : "s"} from an entry point`,
    }));

  // If there were no entry points / import edges, fall back to a stable
  // path-ordered walk so learningOrder is never empty for a non-empty repo.
  if (steps.length === 0) {
    return [...fileSet]
      .filter((p) => /\.(t|j)sx?$/.test(p))
      .sort()
      .slice(0, MAX_LEARNING_STEPS)
      .map((path, i) => ({ path, order: i + 1, reason: "source file" }));
  }
  return steps;
}

// --- shared ---------------------------------------------------------------

function resolveInSet(base: string, fileSet: Set<string>): string | null {
  for (const ext of RESOLVE_EXTS) {
    if (fileSet.has(base + ext)) return base + ext;
  }
  for (const idx of ["/index.ts", "/index.js"]) {
    if (fileSet.has(base + idx)) return base + idx;
  }
  return null;
}
