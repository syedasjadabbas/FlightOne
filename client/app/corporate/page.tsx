import dynamic from "next/dynamic";
import { RouteChunkFallback } from "@/components/RouteChunkFallback";
import { SiteNav } from "@/components/SiteNav";
import { TravellerShell } from "@/app/components/traveller";

const CorporatePageClient = dynamic(
  () =>
    import("./CorporatePageClient").then((m) => ({
      default: m.CorporatePageClient,
    })),
  { loading: () => <RouteChunkFallback label="Loading corporate…" /> },
);

export const metadata = { title: "Corporate travel — FlightOne" };

export default function CorporatePage() {
  return (
    <main className="fo-stage relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <TravellerShell width="wide">
        <CorporatePageClient />
      </TravellerShell>
    </main>
  );
}
