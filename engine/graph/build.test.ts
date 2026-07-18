import { describe, it, expect } from "vitest";
import { buildGraph } from "./build";
import { fakeFile } from "../analyzer/__fixtures__/helpers";
import { MAX_GRAPH_NODES, MAX_GRAPH_EDGES } from "@/lib/security/limits";
import type { ImportLink } from "@/types/analysis";
import type { ImportantRoute, DatabaseModel } from "@/types/understanding-map";

/** N .ts files in sorted path order, plus a chain of imports between them. */
function chain(n: number) {
  const files = Array.from({ length: n }, (_, i) =>
    fakeFile(`src/f${String(i).padStart(5, "0")}.ts`, "export const x = 1;"),
  );
  const importLinks: ImportLink[] = [];
  for (let i = 0; i + 1 < n; i++) {
    importLinks.push({ from: files[i].relPath, to: files[i + 1].relPath });
  }
  return { files, importLinks };
}

const route: ImportantRoute = {
  method: "GET",
  path: "/health",
  handlerFile: "src/f00000.ts",
  framework: "next",
} as ImportantRoute;

const model: DatabaseModel = {
  name: "User",
  file: "src/f00000.ts",
  orm: "prisma",
} as DatabaseModel;

describe("buildGraph budget caps", () => {
  it("stays under both caps and reports capped on an oversized repo", () => {
    const { files, importLinks } = chain(MAX_GRAPH_NODES + 500);
    const { graph, capped } = buildGraph({ files, importLinks, routes: [], models: [] });

    expect(capped).toBe(true);
    expect(graph.nodes.length).toBe(MAX_GRAPH_NODES);
    expect(graph.edges.length).toBe(MAX_GRAPH_EDGES);
  });

  it("leaves a normal repo untouched and reports capped=false", () => {
    const { files, importLinks } = chain(50);
    const { graph, capped } = buildGraph({ files, importLinks, routes: [], models: [] });

    expect(capped).toBe(false);
    expect(graph.nodes.length).toBe(50);
    expect(graph.edges.length).toBe(49);
  });

  it("is deterministic — the same input truncates to the same graph", () => {
    const a = buildGraph({ ...chain(MAX_GRAPH_NODES + 500), routes: [], models: [] });
    const b = buildGraph({ ...chain(MAX_GRAPH_NODES + 500), routes: [], models: [] });

    expect(a.graph.nodes.map((n) => n.id)).toEqual(b.graph.nodes.map((n) => n.id));
    expect(a.graph.edges.map((e) => `${e.source}->${e.target}`)).toEqual(
      b.graph.edges.map((e) => `${e.source}->${e.target}`),
    );
  });

  it("keeps route and model nodes even when the file cap is hit", () => {
    const { files, importLinks } = chain(MAX_GRAPH_NODES + 500);
    const { graph } = buildGraph({ files, importLinks, routes: [route], models: [model] });

    // Derived nodes are appended after the capped file nodes, so they survive.
    expect(graph.nodes.filter((n) => n.type === "route")).toHaveLength(1);
    expect(graph.nodes.filter((n) => n.type === "model")).toHaveLength(1);
    expect(graph.edges.filter((e) => e.type === "defines")).toHaveLength(2);
  });
});
