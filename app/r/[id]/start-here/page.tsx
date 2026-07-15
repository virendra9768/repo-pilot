import { StartHerePanel } from "@/features/onboarding/StartHerePanel";

export default async function StartHerePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StartHerePanel id={id} />;
}
