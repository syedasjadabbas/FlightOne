import dynamic from "next/dynamic";
import { RouteChunkFallback } from "@/components/RouteChunkFallback";
import { SiteNav } from "@/components/SiteNav";
import { TravellerShell } from "@/app/components/traveller";
import "./support.css";

const SupportPageClient = dynamic(
  () =>
    import("./SupportPageClient").then((m) => ({
      default: m.SupportPageClient,
    })),
  { loading: () => <RouteChunkFallback label="Loading support…" /> },
);

export const metadata = {
  title: "Support — FlightOne",
  description: "Help for bookings, payments, refunds, visas, and consultant cases.",
};

export default function SupportPage() {
  return (
    <main className="fo-stage relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <TravellerShell>
        <SupportPageClient />
      </TravellerShell>
    </main>
  );
}
