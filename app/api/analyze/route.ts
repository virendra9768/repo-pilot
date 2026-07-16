import { analyzeRepository } from "@/engine/analyze";
import { listDemos } from "@/engine/clone";

// The engine clones to disk and reads the filesystem — must run on Node.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const demo = searchParams.get("demo");
  const repo = searchParams.get("repo");

  if (!demo && !repo) {
    return Response.json(
      { ok: false, error: "Provide ?demo=<key> or ?repo=<github-url>", demos: listDemos() },
      { status: 400 },
    );
  }

  try {
    const result = demo
      ? await analyzeRepository({ kind: "demo", demo })
      : await analyzeRepository({ kind: "url", url: repo! });
    return Response.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
