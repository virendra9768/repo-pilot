import type { RepoFile, ImportLink } from "@/types/analysis";
import type { ImportantRoute, DatabaseModel } from "@/types/understanding-map";
import type { GraphNode, GraphEdge, IntelligenceGraph } from "@/types/graph";
import { MAX_GRAPH_NODES, MAX_GRAPH_EDGES } from "@/lib/security/limits";

const GRAPH_FILE_EXT = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".prisma",
]);

export interface GraphInput {
  files: RepoFile[];
  importLinks: ImportLink[];
  routes: ImportantRoute[];
  models: DatabaseModel[];
}

export interface GraphResult {
  graph: IntelligenceGraph;
  /** True when the file-node or import-edge cap dropped part of the repo. */
  capped: boolean;
}

/**
 * Assemble the Repository Intelligence Graph: file nodes + import edges, plus
 * derived route/model nodes linked to the files that declare them.
 * Plain arrays in memory — not a graph DB (see CLAUDE.md).
 *
 * The caps apply to the two unbounded terms only — file nodes and import edges.
 * Route and model nodes (and their `defines` edges) are few, derived, and the
 * most informative part of the graph, so they are appended afterwards and always
 * survive. `capped` is returned separately rather than stored on the graph
 * because `IntelligenceGraph` is part of the locked Understanding Map schema.
 */
export function buildGraph({ files, importLinks, routes, models }: GraphInput): GraphResult {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const fileNodeIds = new Set<string>();
  let edgeSeq = 0;
  let capped = false;

  for (const f of files) {
    if (!GRAPH_FILE_EXT.has(f.ext)) continue;
    // Files arrive in sorted path order, so which ones survive is deterministic.
    if (nodes.length >= MAX_GRAPH_NODES) {
      capped = true;
      break;
    }
    nodes.push({ id: f.relPath, type: "file", label: f.name, path: f.relPath });
    fileNodeIds.add(f.relPath);
  }

  for (const link of importLinks) {
    if (edges.length >= MAX_GRAPH_EDGES) {
      capped = true;
      break;
    }
    if (fileNodeIds.has(link.from) && fileNodeIds.has(link.to)) {
      edges.push({ id: `e${edgeSeq++}`, source: link.from, target: link.to, type: "imports" });
    }
  }

  for (const r of routes) {
    const id = `route:${r.framework}:${r.method}:${r.path}@${r.handlerFile}`;
    nodes.push({
      id,
      type: "route",
      label: `${r.method} ${r.path}`,
      path: r.handlerFile,
      meta: { method: r.method, path: r.path, framework: r.framework },
    });
    if (fileNodeIds.has(r.handlerFile)) {
      edges.push({ id: `e${edgeSeq++}`, source: r.handlerFile, target: id, type: "defines" });
    }
  }

  for (const m of models) {
    const id = `model:${m.name}@${m.file}`;
    nodes.push({
      id,
      type: "model",
      label: m.name,
      path: m.file,
      meta: { orm: m.orm },
    });
    if (fileNodeIds.has(m.file)) {
      edges.push({ id: `e${edgeSeq++}`, source: m.file, target: id, type: "defines" });
    }
  }

  return { graph: { nodes, edges }, capped };
}
