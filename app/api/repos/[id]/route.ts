import { loadRepoForRequest } from "@/lib/auth/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { repo } = await loadRepoForRequest(id);
  if (!repo) {
    return Response.json({ error: "Repository not analyzed" }, { status: 404 });
  }
  return Response.json({
    id: repo.id,
    workspace: repo.workspace,
    understandingMap: repo.understandingMap,
  });
}
