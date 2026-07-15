import { ExecutionFlow } from "@/features/execution-flow/ExecutionFlow";

export default async function FlowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ExecutionFlow id={id} />;
}
