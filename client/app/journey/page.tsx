import { SiteNav } from "@/components/SiteNav";
import { TravellerShell } from "@/app/components/traveller";
import { JourneyPageClient } from "./JourneyPageClient";

export const metadata = { title: "Journey watches — FlightOne" };

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
