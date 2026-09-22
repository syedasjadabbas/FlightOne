import dynamic from "next/dynamic";
import { RouteChunkFallback } from "@/components/RouteChunkFallback";
import { SiteNav } from "@/components/SiteNav";
import { TravellerShell } from "@/app/components/traveller";

const CarsPageClient = dynamic(
  () =>
    import("./CarsPageClient").then((m) => ({
      default: m.CarsPageClient,
    })),
  { loading: () => <RouteChunkFallback label="Loading cars…" /> },
);

export const metadata = {
  title: "Cars — FlightOne",
  description: "Car hire at 1,000+ destinations. Tell Ava your pick-up city and dates to get started.",
};

export default function CarsPage() {
  return (
    <main className="fo-stage relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <TravellerShell width="wide">
        <CarsPageClient />
      </TravellerShell>
    </main>
  );
}
