import { getRepo } from "@/lib/persistence/store";
import { getProvider } from "@/lib/ai";
import { startHereContext } from "@/engine/context/slices";
import { buildStartHerePrompt, startHereSchema } from "@/engine/prompts/startHere";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  const repo = await getRepo(id);
  if (!repo) return Response.json({ error: "Repository not analyzed" }, { status: 404 });

  try {
    const { system, prompt } = buildStartHerePrompt(startHereContext(repo));
    const startHere = await getProvider().generateJSON({
      system,
      prompt,
      schema: startHereSchema,
      cacheKey: `start-here:${id}`,
    });
    return Response.json({ startHere });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
