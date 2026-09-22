import dynamic from "next/dynamic";
import { RouteChunkFallback } from "@/components/RouteChunkFallback";
import { SiteNav } from "@/components/SiteNav";
import { TravellerShell } from "@/app/components/traveller";

const GroupsPageClient = dynamic(
  () =>
    import("./GroupsPageClient").then((m) => ({
      default: m.GroupsPageClient,
    })),
  { loading: () => <RouteChunkFallback label="Loading groups…" /> },
);

export const metadata = {
  title: "Groups — FlightOne",
};

export default function GroupsPage() {
  return (
    <main className="fo-stage relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <TravellerShell width="wide">
        <GroupsPageClient />
      </TravellerShell>
    </main>
  );
}
