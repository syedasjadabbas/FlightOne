import { SiteNav } from "@/components/SiteNav";
import { TravellerShell } from "@/app/components/traveller";
import { ConciergePageClient } from "./ConciergePageClient";

export const metadata = {
  title: "Autonomous Concierge — FlightOne",
  description: "Pre-authorised travel rules for delays and disruptions. FlightOne never tickets without existing payment and approval gates.",
};

export default function ConciergePage() {
  return (
    <main className="fo-stage relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <TravellerShell width="wide">
        <ConciergePageClient />
      </TravellerShell>
    </main>
  );
}
