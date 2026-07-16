import { OnboardingJourney } from "@/features/onboarding/OnboardingJourney";

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OnboardingJourney id={id} />;
}
