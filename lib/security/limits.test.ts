import { describe, it, expect } from "vitest";
import {
  MAX_GRAPH_NODES,
  MAX_GRAPH_EDGES,
  MAX_FILE_LINES_ENTRIES,
  MAX_KV_BLOB_BYTES,
  KV_SOFT_LIMIT,
  KV_MONTHLY_COMMAND_BUDGET,
  isAnalyzableLanguage,
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

describe("isAnalyzableLanguage", () => {
  it("accepts JS/TS", () => {
    expect(isAnalyzableLanguage("JavaScript")).toBe(true);
    expect(isAnalyzableLanguage("TypeScript")).toBe(true);
  });

  it("accepts the frontend languages a JS project can report as", () => {
    // Verified against the real API: vuejs/core and withastro/astro report
    // TypeScript, sveltejs/svelte reports JavaScript. These are listed for the
    // cases where a repo's mix tips the other way.
    for (const lang of ["Vue", "Svelte", "Astro", "MDX", "HTML", "CSS"]) {
      expect(isAnalyzableLanguage(lang)).toBe(true);
    }
  });

  it("rejects languages the analyzer cannot parse", () => {
    for (const lang of ["Python", "Go", "Rust", "Java", "C#", "Ruby", "PHP", "C++"]) {
      expect(isAnalyzableLanguage(lang)).toBe(false);
    }
  });

  it("allows unknown/empty through — the gate must never be why a repo is refused", () => {
    expect(isAnalyzableLanguage(null)).toBe(true);
    expect(isAnalyzableLanguage(undefined)).toBe(true);
    expect(isAnalyzableLanguage("")).toBe(true);
  });

  it("is case-sensitive, matching GitHub's exact casing", () => {
    // GitHub always returns "TypeScript"/"JavaScript"; a lowercase value would
    // mean we're reading something else, so failing closed is correct.
    expect(isAnalyzableLanguage("typescript")).toBe(false);
  });
});
