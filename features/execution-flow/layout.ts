import type { ExecutionFlowResult } from "@/engine/prompts/executionFlow";

// Nodes are 240px wide; keep generous column spacing so edge labels between
// two nodes have room to render without overlapping either node.
const COL_WIDTH = 400;
const ROW_HEIGHT = 150;

/**
 * Deterministic layered layout: x by BFS depth from roots (no incoming edge),
 * y by index within a depth. First-seen depth so it terminates even with cycles.
 * No dagre dependency.
 */
export function computeLayout(
  nodes: ExecutionFlowResult["nodes"],
  edges: ExecutionFlowResult["edges"],
): Map<string, { x: number; y: number }> {
  const ids = new Set(nodes.map((n) => n.id));
  const indeg = new Map(nodes.map((n) => [n.id, 0]));
  const adj = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
  for (const e of edges) {
    if (ids.has(e.source) && ids.has(e.target)) {
      adj.get(e.source)!.push(e.target);
      indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
    }
  }

  const depth = new Map<string, number>();
  const queue: string[] = [];
  for (const n of nodes) {
    if ((indeg.get(n.id) ?? 0) === 0) {
      depth.set(n.id, 0);
      queue.push(n.id);
    }
  }
  if (queue.length === 0 && nodes.length) {
    depth.set(nodes[0].id, 0);
    queue.push(nodes[0].id);
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
  for (const n of nodes) if (!depth.has(n.id)) depth.set(n.id, 0);

  const byDepth = new Map<number, string[]>();
  for (const n of nodes) {
    const d = depth.get(n.id)!;
    const list = byDepth.get(d) ?? [];
    list.push(n.id);
    byDepth.set(d, list);
  }

  const pos = new Map<string, { x: number; y: number }>();
  for (const [d, list] of byDepth) {
    list.forEach((id, i) => pos.set(id, { x: d * COL_WIDTH, y: i * ROW_HEIGHT }));
  }
  return pos;
}
