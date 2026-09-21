import dynamic from "next/dynamic";
import { RouteChunkFallback } from "@/components/RouteChunkFallback";
import { DeskShell } from "@/components/DeskShell";
import { SiteNav } from "@/components/SiteNav";

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
    <main className="fo-stage fo-stage--desk relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <DeskShell canvas canvasWide>
        <GroupsPageClient />
      </DeskShell>
    </main>
  );
}
