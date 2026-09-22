import dynamic from "next/dynamic";
import { RouteChunkFallback } from "@/components/RouteChunkFallback";
import { SiteNav } from "@/components/SiteNav";
import { TravellerShell } from "@/app/components/traveller";

const FlightsPageClient = dynamic(
  () =>
    import("./FlightsPageClient").then((m) => ({
      default: m.FlightsPageClient,
    })),
  { loading: () => <RouteChunkFallback label="Loading flights…" /> },
);

export const metadata = {
  title: "Flights — FlightOne",
  description: "Search live fares to 1,000+ destinations. Ava finds nonstop and connecting flights, handles seat selection, and books when you confirm.",
};

export default function FlightsPage() {
  return (
    <main className="fo-stage relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <TravellerShell width="wide">
        <FlightsPageClient />
      </TravellerShell>
    </main>
  );
}
