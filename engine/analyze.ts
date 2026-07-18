import { acquireWorkspace, type AnalyzeInput } from "./clone";
import { walkRepo } from "./clone/walk";
import { analyzeMetadata } from "./analyzer/metadata";
import { analyzeTechnologies } from "./analyzer/technology";
import { analyzeRoutes } from "./analyzer/routes";
import { analyzeDatabase } from "./analyzer/database";
import { analyzeDependencies } from "./analyzer/dependencies";
import { createParseCache } from "./analyzer/parse";
import { buildGraph } from "./graph/build";
import { generateUnderstandingMap } from "./context/understanding-map";
import { buildContextPack } from "./context/context-pack";
import type {
  UnderstandingMap,
  ImportantRoute,
  DatabaseModel,
} from "@/types/understanding-map";
import type { RepoContextPack, ImportLink } from "@/types/analysis";

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
    /**
     * True when a downstream budget dropped detail the walk had already
     * collected: the AST parse cache, the graph, or the context pack. Distinct
     * from `truncated`, which is about the walk itself. Optional so blobs cached
     * before this field existed still read cleanly.
     */
    analysisCapped?: boolean;
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

    // Pure dependency-table lookup — no files touched, so keep it outside the
    // parse window.
    const technologies = analyzeTechnologies(metadata.allDependencies);

    // Parse every code file once and share the trees; these three analyzers
    // used to re-scan the same text independently.
    const parsed = createParseCache(files);
    let routes: ImportantRoute[];
    let models: DatabaseModel[];
    let importLinks: ImportLink[];
    let parseCapped = false;
    try {
      routes = analyzeRoutes(files, metadata.allDependencies, parsed);
      models = analyzeDatabase(files, parsed);
      importLinks = analyzeDependencies(files, importAliases, parsed);
      parseCapped = parsed.stats.capped;
    } finally {
      // An analyzer throwing must not leak every tree for the rest of the request.
      parsed.dispose();
    }

    const { graph, capped: graphCapped } = buildGraph({ files, importLinks, routes, models });

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
    const { pack: contextPack, capped: contextCapped } = buildContextPack(
      files,
      metadata,
      understandingMap,
    );

    return {
      workspace: {
        displayName: workspace.displayName,
        source: workspace.source,
        fallbackReason: workspace.fallbackReason,
        fileCount: files.length,
        private: workspace.private,
        truncated,
        analysisCapped: parseCapped || graphCapped || contextCapped,
      },
      understandingMap,
      contextPack,
    };
  } finally {
    await cleanup();
  }
}
