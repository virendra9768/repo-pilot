import { loadRepoForRequest, nsCacheKey } from "@/lib/auth/access";
import { getProvider } from "@/lib/ai";
import { onboardingContext } from "@/engine/context/slices";
import { enforceRateLimit, AI_LIMIT } from "@/lib/security/rate-limit";
import { buildOnboardingPrompt, onboardingSchema } from "@/engine/prompts/onboarding";

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
    const { system, prompt } = buildOnboardingPrompt(onboardingContext(repo));
    const onboarding = await getProvider().generateJSON({
      system,
      prompt,
      schema: onboardingSchema,
      cacheKey: nsCacheKey(namespace, `onboarding:${id}`),
      namespace,
    });
    return Response.json({ onboarding });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
