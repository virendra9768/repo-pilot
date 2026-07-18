import { describe, it, expect } from "vitest";
import {
  MAX_GRAPH_NODES,
  MAX_GRAPH_EDGES,
  MAX_FILE_LINES_ENTRIES,
  MAX_KV_BLOB_BYTES,
  KV_SOFT_LIMIT,
  KV_MONTHLY_COMMAND_BUDGET,
} from "./limits";
import { buildGraph } from "@/engine/graph/build";
import { buildContextPack } from "@/engine/context/context-pack";
import { fakeFile } from "@/engine/analyzer/__fixtures__/helpers";
import type { RepoMetadata } from "@/types/analysis";
import type { UnderstandingMap } from "@/types/understanding-map";
import type { ImportLink } from "@/types/analysis";

/**
 * The caps and the blob ceiling are one design, not two: if a repo can max out
 * the caps and still exceed MAX_KV_BLOB_BYTES, it becomes permanently
 * uncacheable and re-analyzes on every request — the exact failure the guard
 * exists to prevent. This test pins that relationship so raising a cap without
 * rechecking the ceiling fails loudly.
 */
describe("capped worst case fits the KV blob ceiling", () => {
  it("stays under MAX_KV_BLOB_BYTES with realistic path lengths", () => {
    // Deliberately long, monorepo-shaped paths — the dominant cost in a node is
    // the repo-relative path, which a file node stores twice (id and path).
    const n = MAX_GRAPH_NODES + 500;
    const files = Array.from({ length: n }, (_, i) =>
      fakeFile(
        `packages/workspace-package-${i % 20}/src/components/nested/Component${String(i).padStart(5, "0")}.ts`,
        "a\nb\nc",
      ),
    );
    const importLinks: ImportLink[] = [];
    for (let i = 0; i + 1 < n; i++) {
      importLinks.push({ from: files[i].relPath, to: files[i + 1].relPath });
    }

    const { graph, capped: graphCapped } = buildGraph({
      files,
      importLinks,
      routes: [],
      models: [],
    });
    const { pack, capped: packCapped } = buildContextPack(
      files,
      { allDependencies: {} } as RepoMetadata,
      { criticalFiles: [] } as unknown as UnderstandingMap,
    );

    // Sanity: this input really does max out the caps.
    expect(graphCapped).toBe(true);
    expect(packCapped).toBe(true);
    expect(graph.nodes).toHaveLength(MAX_GRAPH_NODES);
    expect(graph.edges).toHaveLength(MAX_GRAPH_EDGES);
    expect(Object.keys(pack.fileLines)).toHaveLength(MAX_FILE_LINES_ENTRIES);

    const bytes = Buffer.byteLength(JSON.stringify({ graph, ...pack }), "utf8");
    expect(bytes).toBeLessThan(MAX_KV_BLOB_BYTES);
  });
});

describe("command budget constants", () => {
  it("leaves headroom between the soft limit and the real budget", () => {
    expect(KV_SOFT_LIMIT).toBeLessThan(KV_MONTHLY_COMMAND_BUDGET);
  });
});
