import dynamic from "next/dynamic";
import { RouteChunkFallback } from "@/components/RouteChunkFallback";
import { SiteNav } from "@/components/SiteNav";
import { TravellerShell } from "@/app/components/traveller";

const EscalationsPageClient = dynamic(
  () =>
    import("./EscalationsPageClient").then((m) => ({
      default: m.EscalationsPageClient,
    })),
  { loading: () => <RouteChunkFallback label="Loading support…" /> },
);

export const metadata = {
  title: "Support — FlightOne",
};

export default function EscalationsPage() {
  return (
    <main className="fo-stage relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <TravellerShell width="wide">
        <EscalationsPageClient />
      </TravellerShell>
    </main>
  );
}
