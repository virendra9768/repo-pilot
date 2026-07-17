import { loadRepoForRequest, nsCacheKey } from "@/lib/auth/access";
import { getProvider } from "@/lib/ai";
import { executionFlowContext, knownFilePaths } from "@/engine/context/slices";
import {
  buildExecutionFlowPrompt,
  executionFlowSchema,
} from "@/engine/prompts/executionFlow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: { id?: string; question?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { id, question } = body ?? {};
  if (!id || !question?.trim()) {
    return Response.json({ error: "Provide 'id' and 'question'" }, { status: 400 });
  }

  const { repo, namespace } = await loadRepoForRequest(id);
  if (!repo) return Response.json({ error: "Repository not analyzed" }, { status: 404 });

  try {
    const ctx = executionFlowContext(repo, question.trim());
    const { system, prompt } = buildExecutionFlowPrompt(ctx);
    const flow = await getProvider().generateJSON({
      system,
      prompt,
      schema: executionFlowSchema,
      cacheKey: nsCacheKey(namespace, `flow:${id}:${question.trim()}`),
      namespace,
    });

    // Flag any AI-referenced files that aren't real paths (grounding check).
    const known = knownFilePaths(repo);
    const unknownFiles = [
      ...new Set(flow.nodes.map((n) => n.file).filter((f) => f && !known.has(f))),
    ];

    return Response.json({ flow, unknownFiles });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
