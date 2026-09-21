import dynamic from "next/dynamic";
import { RouteChunkFallback } from "@/components/RouteChunkFallback";
import { SiteNav } from "@/components/SiteNav";
import { TravellerShell } from "@/app/components/traveller";
import "./visa.css";

const VisaPageClient = dynamic(
  () =>
    import("./VisaPageClient").then((m) => ({
      default: m.VisaPageClient,
    })),
  { loading: () => <RouteChunkFallback label="Loading visa…" /> },
);

export const metadata = {
  title: "Visa — FlightOne",
  description: "Attributed passport × destination visa advisory for FlightOne travellers.",
};

export default function VisaPage() {
  return (
    <main className="fo-stage relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <TravellerShell width="narrow">
        <VisaPageClient />
      </TravellerShell>
    </main>
  );
}
