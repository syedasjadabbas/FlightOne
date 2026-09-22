import dynamic from "next/dynamic";
import { RouteChunkFallback } from "@/components/RouteChunkFallback";
import { SiteNav } from "@/components/SiteNav";
import { TravellerShell } from "@/app/components/traveller";

const GroupDetailClient = dynamic(
  () =>
    import("./GroupDetailClient").then((m) => ({
      default: m.GroupDetailClient,
    })),
  { loading: () => <RouteChunkFallback label="Loading group…" /> },
);

export const metadata = {
  title: "Group — FlightOne",
  description: "Trip group desk — members, itinerary, check-ins, and shared documents.",
};

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  return (
    <main className="fo-stage relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <TravellerShell width="wide">
        <GroupDetailClient groupId={groupId} />
      </TravellerShell>
    </main>
  );
}
