import { loadRepoForRequest } from "@/lib/auth/access";
import { DeveloperChat } from "@/features/original-developer/DeveloperChat";

export default async function AskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Must go through loadRepoForRequest so the session is threaded: without it a
  // private repo misses its owner-scoped key and triggers a full re-analysis.
  const { repo } = await loadRepoForRequest(id);
  return <DeveloperChat id={id} repoName={repo?.workspace.displayName ?? "this repo"} />;
}
