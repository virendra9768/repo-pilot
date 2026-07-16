import { getRepoOrRehydrate } from "@/lib/persistence/store";
import { getProvider } from "@/lib/ai";
import { gpsContext, knownFilePaths } from "@/engine/context/slices";
import { buildGpsPrompt, gpsSchema } from "@/engine/prompts/gps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { id?: string; task?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { id, task } = body ?? {};
  if (!id || !task?.trim()) {
    return Response.json({ error: "Provide 'id' and 'task'" }, { status: 400 });
  }

  const repo = await getRepoOrRehydrate(id);
  if (!repo) return Response.json({ error: "Repository not analyzed" }, { status: 404 });

  try {
    const { system, prompt } = buildGpsPrompt(gpsContext(repo, task.trim()));
    const gps = await getProvider().generateJSON({
      system,
      prompt,
      schema: gpsSchema,
      cacheKey: `gps:${id}:${task.trim()}`,
    });
    const known = knownFilePaths(repo);
    const unknownFiles = [...new Set(gps.files.map((f) => f.path).filter((p) => !known.has(p)))];
    return Response.json({ gps, unknownFiles });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
