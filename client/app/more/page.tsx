import dynamic from "next/dynamic";
import { RouteChunkFallback } from "@/components/RouteChunkFallback";
import { SiteNav } from "@/components/SiteNav";
import { TravellerShell } from "@/app/components/traveller";
import "./more.css";

const MorePageClient = dynamic(
  () =>
    import("./MorePageClient").then((m) => ({
      default: m.MorePageClient,
    })),
  { loading: () => <RouteChunkFallback label="Loading…" /> },
);

export const metadata = {
  title: "More — FlightOne",
  description: "Desks and tools for trips, documents, account, and operations.",
};

export default function MorePage() {
  return (
    <main className="fo-stage relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <TravellerShell width="wide">
        <MorePageClient />
      </TravellerShell>
    </main>
  );
}
