import dynamic from "next/dynamic";
import { RouteChunkFallback } from "@/components/RouteChunkFallback";
import { SiteNav } from "@/components/SiteNav";
import { TravellerShell } from "@/app/components/traveller";

const StaysPageClient = dynamic(
  () =>
    import("./StaysPageClient").then((m) => ({
      default: m.StaysPageClient,
    })),
  { loading: () => <RouteChunkFallback label="Loading stays…" /> },
);

export const metadata = {
  title: "Stays — FlightOne",
  description: "Hotels, luxury villas, and resorts worldwide. Ava searches live availability and books once you confirm.",
};

export default function StaysPage() {
  return (
    <main className="fo-stage relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <TravellerShell width="wide">
        <StaysPageClient />
      </TravellerShell>
    </main>
  );
}
