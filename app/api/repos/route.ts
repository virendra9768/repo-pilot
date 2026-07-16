import { getOrAnalyze } from "@/lib/persistence/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: { demo?: string; url?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { demo, url } = body ?? {};
  if (!demo && !url) {
    return Response.json({ error: "Provide 'demo' or 'url'" }, { status: 400 });
  }

  try {
    const repo = await getOrAnalyze(
      demo ? { kind: "demo", demo } : { kind: "url", url: url! },
    );
    return Response.json({
      id: repo.id,
      workspace: repo.workspace,
      understandingMap: repo.understandingMap,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
