import { RepositoryGPS } from "@/features/repository-gps/RepositoryGPS";

export default async function GpsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RepositoryGPS id={id} />;
}
