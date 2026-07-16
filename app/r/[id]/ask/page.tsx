import { getRepoOrRehydrate } from "@/lib/persistence/store";
import { DeveloperChat } from "@/features/original-developer/DeveloperChat";

export default async function AskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repo = await getRepoOrRehydrate(id);
  return <DeveloperChat id={id} repoName={repo?.workspace.displayName ?? "this repo"} />;
}
