import dynamic from "next/dynamic";
import { RouteChunkFallback } from "@/components/RouteChunkFallback";
import { DeskShell } from "@/components/DeskShell";
import { SiteNav } from "@/components/SiteNav";

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
    <main className="fo-stage fo-stage--desk relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <DeskShell canvas canvasWide>
        <GroupDetailClient groupId={groupId} />
      </DeskShell>
    </main>
  );
}
