import dynamic from "next/dynamic";
import { RouteChunkFallback } from "@/components/RouteChunkFallback";
import { SiteNav } from "@/components/SiteNav";
import { TravellerShell } from "@/app/components/traveller";

const JourneyPageClient = dynamic(
  () =>
    import("./JourneyPageClient").then((m) => ({
      default: m.JourneyPageClient,
    })),
  { loading: () => <RouteChunkFallback label="Loading journey…" /> },
);

export const metadata = { title: "My Journey — FlightOne" };

export default function JourneyPage() {
  return (
    <main className="fo-stage relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <TravellerShell width="wide">
        <JourneyPageClient />
      </TravellerShell>
    </main>
  );
}
