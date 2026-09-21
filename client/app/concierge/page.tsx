import dynamic from "next/dynamic";
import { RouteChunkFallback } from "@/components/RouteChunkFallback";
import { SiteNav } from "@/components/SiteNav";
import { TravellerShell } from "@/app/components/traveller";

const ConciergePageClient = dynamic(
  () =>
    import("./ConciergePageClient").then((m) => ({
      default: m.ConciergePageClient,
    })),
  { loading: () => <RouteChunkFallback label="Loading concierge…" /> },
);

export const metadata = {
  title: "Travel Concierge — FlightOne",
  description:
    "Pre-authorised delay and disruption rules. FlightOne never tickets without payment and approval gates.",
};

export default function ConciergePage() {
  return (
    <main className="fo-stage relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <TravellerShell width="narrow">
        <ConciergePageClient />
      </TravellerShell>
    </main>
  );
}
