import dynamic from "next/dynamic";
import { RouteChunkFallback } from "@/components/RouteChunkFallback";
import { DeskShell } from "@/components/DeskShell";
import { SiteNav } from "@/components/SiteNav";

const ManagementDashboardClient = dynamic(
  () =>
    import("./ManagementDashboardClient").then((m) => ({
      default: m.ManagementDashboardClient,
    })),
  { loading: () => <RouteChunkFallback label="Loading dashboard…" /> },
);

export const metadata = { title: "Management dashboard — FlightOne" };

export default function ManagementDashboardPage() {
  return (
    <main className="fo-stage fo-stage--desk relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <DeskShell wide>
        <ManagementDashboardClient />
      </DeskShell>
    </main>
  );
}
