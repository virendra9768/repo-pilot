import { acquireWorkspace, type AnalyzeInput } from "./clone";
import { walkRepo } from "./clone/walk";
import { analyzeMetadata } from "./analyzer/metadata";
import { analyzeTechnologies } from "./analyzer/technology";
import { analyzeRoutes } from "./analyzer/routes";
import { analyzeDatabase } from "./analyzer/database";
import { analyzeDependencies } from "./analyzer/dependencies";
import { buildGraph } from "./graph/build";
import { generateUnderstandingMap } from "./context/understanding-map";
import { buildContextPack } from "./context/context-pack";
import type { UnderstandingMap } from "@/types/understanding-map";
import type { RepoContextPack } from "@/types/analysis";

export type { AnalyzeInput } from "./clone";

export interface AnalysisResult {
  workspace: {
    displayName: string;
    source: "clone" | "demo";
    fallbackReason?: string;
    fileCount: number;
    private?: boolean;
    /** True when the file cap was hit — analysis ran on the first N files only. */
    truncated?: boolean;
  };
  understandingMap: UnderstandingMap;
  /** Extra detail captured before workspace cleanup (server-side use). */
  contextPack: RepoContextPack;
}

/**
 * End-to-end deterministic analysis: acquire a workspace (clone or demo),
 * walk it, run every detector, build the graph, and assemble the Understanding
 * Map. The temp workspace is always cleaned up, even on error.
 */
export async function analyzeRepository(
  input: AnalyzeInput,
  opts: { token?: string } = {},
): Promise<AnalysisResult> {
  const { workspace, cleanup } = await acquireWorkspace(input, { token: opts.token });
  try {
    const { files, truncated } = await walkRepo(workspace.root);
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

    // Capture extra detail while the files are still on disk.
    const contextPack = buildContextPack(files, metadata, understandingMap);

    return {
      workspace: {
        displayName: workspace.displayName,
        source: workspace.source,
        fallbackReason: workspace.fallbackReason,
        fileCount: files.length,
        private: workspace.private,
        truncated,
      },
      understandingMap,
      contextPack,
    };
  } finally {
    await cleanup();
  }
}
