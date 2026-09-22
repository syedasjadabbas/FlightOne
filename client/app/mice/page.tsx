import dynamic from "next/dynamic";
import { RouteChunkFallback } from "@/components/RouteChunkFallback";
import { SiteNav } from "@/components/SiteNav";
import { TravellerShell } from "@/app/components/traveller";

const MicePageClient = dynamic(
  () =>
    import("./MicePageClient").then((m) => ({
      default: m.MicePageClient,
    })),
  { loading: () => <RouteChunkFallback label="Loading MICE…" /> },
);

export const metadata = {
  title: "MICE & Events — FlightOne",
  description:
    "Submit meetings, incentives, conferences, and exhibitions enquiries to the FlightOne MICE desk.",
};

export default function MicePage() {
  return (
    <main className="fo-stage relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <TravellerShell width="wide">
        <MicePageClient />
      </TravellerShell>
    </main>
  );
}
