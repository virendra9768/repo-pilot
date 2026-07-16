import { getRepoOrRehydrate } from "@/lib/persistence/store";
import { getProvider } from "@/lib/ai";
import { askDeveloperContext, knownFilePaths } from "@/engine/context/slices";
import {
  buildAskDeveloperPrompt,
  askDeveloperSchema,
  type ChatMessage,
} from "@/engine/prompts/askDeveloper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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

  const repo = await getRepoOrRehydrate(id);
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
