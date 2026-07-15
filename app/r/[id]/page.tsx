import { OverviewPanel } from "@/features/repository-overview/OverviewPanel";

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OverviewPanel id={id} />;
}
