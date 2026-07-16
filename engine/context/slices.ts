import type { AnalyzedRepo } from "@/lib/persistence/store";

/**
 * Compact, token-bounded context slices derived from the Understanding Map +
 * context pack. Each feature gets only what it needs, with arrays capped.
 */

const MAX_FILES = 200;
const MAX_EDGES = 200;
const MAX_FIELDS = 12;

export interface OverviewSlice {
  name: string;
  source: string;
  fileCount: number;
  technologies: { name: string; category: string }[];
  entryPoints: { path: string; reason: string }[];
  criticalFiles: { path: string; reason: string }[];
  importantRoutes: { method: string; path: string; framework: string }[];
  databaseModels: { name: string; orm: string; fields: string[] }[];
  businessDomains: string[];
  folderTree: string[];
  readmeExcerpt?: string;
}

export function overviewContext(repo: AnalyzedRepo): OverviewSlice {
  const m = repo.understandingMap;
  return {
    name: repo.workspace.displayName,
    source: repo.workspace.source,
    fileCount: repo.workspace.fileCount,
    technologies: m.technologies.map((t) => ({ name: t.name, category: t.category })),
    entryPoints: m.entryPoints,
    criticalFiles: m.criticalFiles.map((c) => ({ path: c.path, reason: c.reason })),
    importantRoutes: m.importantRoutes.map((r) => ({
      method: r.method,
      path: r.path,
      framework: r.framework,
    })),
    databaseModels: m.databaseModels.map((d) => ({
      name: d.name,
      orm: d.orm,
      fields: d.fields.slice(0, MAX_FIELDS).map((f) => `${f.name}: ${f.type}`),
    })),
    businessDomains: m.businessDomains.map((b) => b.name),
    folderTree: repo.contextPack.folderTree,
    readmeExcerpt: repo.contextPack.readmeExcerpt,
  };
}

export interface StartHereSlice {
  name: string;
  learningOrder: { path: string; order: number; reason: string }[];
  criticalFiles: { path: string; reason: string }[];
  fileLines: Record<string, number>;
}

export function startHereContext(repo: AnalyzedRepo): StartHereSlice {
  const m = repo.understandingMap;
  const paths = new Set(m.learningOrder.map((s) => s.path));
  const fileLines: Record<string, number> = {};
  for (const p of paths) {
    if (repo.contextPack.fileLines[p] != null) fileLines[p] = repo.contextPack.fileLines[p];
  }
  return {
    name: repo.workspace.displayName,
    learningOrder: m.learningOrder,
    criticalFiles: m.criticalFiles.map((c) => ({ path: c.path, reason: c.reason })),
    fileLines,
  };
}

export interface FlowSlice {
  name: string;
  question: string;
  files: string[];
  routes: { method: string; path: string; handlerFile: string; framework: string }[];
  models: { name: string; orm: string; file: string }[];
  importEdges: { from: string; to: string }[];
  entryPoints: string[];
  snippets: Record<string, string>;
}

export function executionFlowContext(repo: AnalyzedRepo, question: string): FlowSlice {
  const m = repo.understandingMap;
  const files = m.graph.nodes
    .filter((n) => n.type === "file")
    .map((n) => n.path)
    .slice(0, MAX_FILES);
  const importEdges = m.graph.edges
    .filter((e) => e.type === "imports")
    .slice(0, MAX_EDGES)
    .map((e) => ({ from: e.source, to: e.target }));
  return {
    name: repo.workspace.displayName,
    question,
    files,
    routes: m.importantRoutes.map((r) => ({
      method: r.method,
      path: r.path,
      handlerFile: r.handlerFile,
      framework: r.framework,
    })),
    models: m.databaseModels.map((d) => ({ name: d.name, orm: d.orm, file: d.file })),
    importEdges,
    entryPoints: m.entryPoints.map((e) => e.path),
    snippets: repo.contextPack.snippets,
  };
}

/** All real file paths known for a repo — used to validate AI-referenced files. */
export function knownFilePaths(repo: AnalyzedRepo): Set<string> {
  return new Set(
    repo.understandingMap.graph.nodes.filter((n) => n.type === "file").map((n) => n.path),
  );
}

/* ---------------- Day 3 slices ---------------- */

export interface OnboardingSlice {
  name: string;
  technologies: string[];
  learningOrder: { path: string; order: number; reason: string }[];
  criticalFiles: { path: string; reason: string }[];
  routes: { method: string; path: string }[];
  models: { name: string }[];
  fileLines: Record<string, number>;
}

export function onboardingContext(repo: AnalyzedRepo): OnboardingSlice {
  const m = repo.understandingMap;
  const paths = new Set(m.learningOrder.map((s) => s.path));
  m.criticalFiles.forEach((c) => paths.add(c.path));
  const fileLines: Record<string, number> = {};
  for (const p of paths) {
    if (repo.contextPack.fileLines[p] != null) fileLines[p] = repo.contextPack.fileLines[p];
  }
  return {
    name: repo.workspace.displayName,
    technologies: m.technologies.map((t) => t.name),
    learningOrder: m.learningOrder,
    criticalFiles: m.criticalFiles.map((c) => ({ path: c.path, reason: c.reason })),
    routes: m.importantRoutes.map((r) => ({ method: r.method, path: r.path })),
    models: m.databaseModels.map((d) => ({ name: d.name })),
    fileLines,
  };
}

export interface AskDeveloperSlice {
  name: string;
  technologies: { name: string; category: string }[];
  entryPoints: string[];
  criticalFiles: { path: string; reason: string }[];
  routes: { method: string; path: string; framework: string }[];
  models: { name: string; orm: string; fields: string[] }[];
  folderTree: string[];
  readmeExcerpt?: string;
  snippets: Record<string, string>;
}

export function askDeveloperContext(repo: AnalyzedRepo): AskDeveloperSlice {
  const m = repo.understandingMap;
  return {
    name: repo.workspace.displayName,
    technologies: m.technologies.map((t) => ({ name: t.name, category: t.category })),
    entryPoints: m.entryPoints.map((e) => e.path),
    criticalFiles: m.criticalFiles.map((c) => ({ path: c.path, reason: c.reason })),
    routes: m.importantRoutes.map((r) => ({
      method: r.method,
      path: r.path,
      framework: r.framework,
    })),
    models: m.databaseModels.map((d) => ({
      name: d.name,
      orm: d.orm,
      fields: d.fields.slice(0, MAX_FIELDS).map((f) => `${f.name}: ${f.type}`),
    })),
    folderTree: repo.contextPack.folderTree,
    readmeExcerpt: repo.contextPack.readmeExcerpt,
    snippets: repo.contextPack.snippets,
  };
}

export interface GpsSlice {
  name: string;
  task: string;
  files: string[];
  routes: { method: string; path: string; handlerFile: string }[];
  models: { name: string; file: string }[];
  importEdges: { from: string; to: string }[];
  technologies: string[];
  snippets: Record<string, string>;
}

export function gpsContext(repo: AnalyzedRepo, task: string): GpsSlice {
  const m = repo.understandingMap;
  const files = m.graph.nodes
    .filter((n) => n.type === "file")
    .map((n) => n.path)
    .slice(0, MAX_FILES);
  const importEdges = m.graph.edges
    .filter((e) => e.type === "imports")
    .slice(0, MAX_EDGES)
    .map((e) => ({ from: e.source, to: e.target }));
  return {
    name: repo.workspace.displayName,
    task,
    files,
    routes: m.importantRoutes.map((r) => ({
      method: r.method,
      path: r.path,
      handlerFile: r.handlerFile,
    })),
    models: m.databaseModels.map((d) => ({ name: d.name, file: d.file })),
    importEdges,
    technologies: m.technologies.map((t) => t.name),
    snippets: repo.contextPack.snippets,
  };
}
