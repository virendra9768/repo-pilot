/**
 * Repository Intelligence Graph — plain `Node[] / Edge[]` held in memory.
 * NOT a graph database (deliberate scope decision, see CLAUDE.md).
 */

export type GraphNodeType = "file" | "route" | "model";

export interface GraphNode {
  /** Stable unique id. For files this is the repo-relative path. */
  id: string;
  type: GraphNodeType;
  /** Human-readable label for rendering. */
  label: string;
  /** Repo-relative path of the file this node lives in / is derived from. */
  path: string;
  /** Optional type-specific extras (e.g. route method, model orm). */
  meta?: Record<string, unknown>;
}

export type GraphEdgeType = "imports" | "defines";

export interface GraphEdge {
  id: string;
  /** Source node id. */
  source: string;
  /** Target node id. */
  target: string;
  type: GraphEdgeType;
}

export interface IntelligenceGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
