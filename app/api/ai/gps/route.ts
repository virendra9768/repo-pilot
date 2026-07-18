import { loadRepoForRequest, nsCacheKey } from "@/lib/auth/access";
import { getProvider } from "@/lib/ai";
import { gpsContext, knownFilePaths } from "@/engine/context/slices";
import { enforceRateLimit, AI_LIMIT } from "@/lib/security/rate-limit";
import { buildGpsPrompt, gpsSchema } from "@/engine/prompts/gps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "ai", AI_LIMIT);
  if (limited) return limited;

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

  const { repo, namespace } = await loadRepoForRequest(id);
  if (!repo) return Response.json({ error: "Repository not analyzed" }, { status: 404 });

  try {
    const { system, prompt } = buildGpsPrompt(gpsContext(repo, task.trim()));
    const gps = await getProvider().generateJSON({
      system,
      prompt,
      schema: gpsSchema,
      cacheKey: nsCacheKey(namespace, `gps:${id}:${task.trim()}`),
      namespace,
    });
    const known = knownFilePaths(repo);
    const unknownFiles = [...new Set(gps.files.map((f) => f.path).filter((p) => !known.has(p)))];
    return Response.json({ gps, unknownFiles });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
