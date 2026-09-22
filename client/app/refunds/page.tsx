import { Suspense } from "react";
import dynamic from "next/dynamic";
import { RouteChunkFallback } from "@/components/RouteChunkFallback";
import { SiteNav } from "@/components/SiteNav";
import { TravellerShell } from "@/app/components/traveller";

const RefundsPageClient = dynamic(
  () =>
    import("./RefundsPageClient").then((m) => ({
      default: m.RefundsPageClient,
    })),
  { loading: () => <RouteChunkFallback label="Loading refunds…" /> },
);

export const metadata = { title: "Refunds & servicing — FlightOne" };

export default function RefundsPage() {
  return (
    <main className="fo-stage relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <TravellerShell width="wide">
        <Suspense fallback={<RouteChunkFallback label="Loading refunds…" />}>
          <RefundsPageClient />
        </Suspense>
      </TravellerShell>
    </main>
  );
}
