import { loadRepoForRequest } from "@/lib/auth/access";
import { getProvider } from "@/lib/ai";
import { askDeveloperContext, knownFilePaths } from "@/engine/context/slices";
import { enforceRateLimit, AI_LIMIT } from "@/lib/security/rate-limit";
import {
  buildAskDeveloperPrompt,
  askDeveloperSchema,
  type ChatMessage,
} from "@/engine/prompts/askDeveloper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "ai", AI_LIMIT);
  if (limited) return limited;

  let body: { id?: string; question?: string; history?: ChatMessage[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { id, question, history = [] } = body ?? {};
  if (!id || !question?.trim()) {
    return Response.json({ error: "Provide 'id' and 'question'" }, { status: 400 });
  }

  const { repo, namespace } = await loadRepoForRequest(id);
  if (!repo) return Response.json({ error: "Repository not analyzed" }, { status: 404 });

  try {
    const { system, prompt } = buildAskDeveloperPrompt(
      askDeveloperContext(repo),
      question.trim(),
      history.slice(-6),
    );
    const answer = await getProvider().generateJSON({
      system,
      prompt,
      schema: askDeveloperSchema,
      namespace,
    });
    // Keep only references that are real files.
    const known = knownFilePaths(repo);
    const references = answer.references.filter((r) => known.has(r));
    return Response.json({ answer: { ...answer, references } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
