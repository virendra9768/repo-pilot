import { getRepo } from "@/lib/persistence/store";
import { getProvider } from "@/lib/ai";
import { overviewContext } from "@/engine/context/slices";
import { buildOverviewPrompt, overviewSchema } from "@/engine/prompts/overview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  const repo = await getRepo(id);
  if (!repo) return Response.json({ error: "Repository not analyzed" }, { status: 404 });

  try {
    const { system, prompt } = buildOverviewPrompt(overviewContext(repo));
    const overview = await getProvider().generateJSON({
      system,
      prompt,
      schema: overviewSchema,
      cacheKey: `overview:${id}`,
    });
    return Response.json({ overview });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
