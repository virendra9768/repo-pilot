import { acquireWorkspace, type AnalyzeInput } from "./clone";
import { walkRepo } from "./clone/walk";
import { analyzeMetadata } from "./analyzer/metadata";
import { analyzeTechnologies } from "./analyzer/technology";
import { analyzeRoutes } from "./analyzer/routes";
import { analyzeDatabase } from "./analyzer/database";
import { analyzeDependencies } from "./analyzer/dependencies";
import { buildGraph } from "./graph/build";
import { generateUnderstandingMap } from "./context/understanding-map";
import type { UnderstandingMap } from "@/types/understanding-map";

export type { AnalyzeInput } from "./clone";

export interface AnalysisResult {
  workspace: {
    displayName: string;
    source: "clone" | "demo";
    fallbackReason?: string;
    fileCount: number;
  };
  understandingMap: UnderstandingMap;
}

/**
 * End-to-end deterministic analysis: acquire a workspace (clone or demo),
 * walk it, run every detector, build the graph, and assemble the Understanding
 * Map. The temp workspace is always cleaned up, even on error.
 */
export async function analyzeRepository(input: AnalyzeInput): Promise<AnalysisResult> {
  const { workspace, cleanup } = await acquireWorkspace(input);
  try {
    const files = await walkRepo(workspace.root);
    const { metadata, importAliases } = analyzeMetadata(files);

    const technologies = analyzeTechnologies(metadata.allDependencies);
    const routes = analyzeRoutes(files, metadata.allDependencies);
    const models = analyzeDatabase(files);
    const importLinks = analyzeDependencies(files, importAliases);
    const graph = buildGraph({ files, importLinks, routes, models });

    const understandingMap = generateUnderstandingMap({
      files,
      metadata,
      technologies,
      routes,
      models,
      importLinks,
      graph,
    });

    return {
      workspace: {
        displayName: workspace.displayName,
        source: workspace.source,
        fallbackReason: workspace.fallbackReason,
        fileCount: files.length,
      },
      understandingMap,
    };
  } finally {
    await cleanup();
  }
}
