import { loadRepoForRequest, nsCacheKey } from "@/lib/auth/access";
import { getProvider } from "@/lib/ai";
import { overviewContext } from "@/engine/context/slices";
import { buildOverviewPrompt, overviewSchema } from "@/engine/prompts/overview";
import { enforceRateLimit, AI_LIMIT } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const limited = enforceRateLimit(request, "ai", AI_LIMIT);
  if (limited) return limited;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  const { repo, namespace } = await loadRepoForRequest(id);
  if (!repo) return Response.json({ error: "Repository not analyzed" }, { status: 404 });

  try {
    const { system, prompt } = buildOverviewPrompt(overviewContext(repo));
    const overview = await getProvider().generateJSON({
      system,
      prompt,
      schema: overviewSchema,
      cacheKey: nsCacheKey(namespace, `overview:${id}`),
      namespace,
    });
    return Response.json({ overview });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
