import { SiteNav } from "@/components/SiteNav";
import { TravellerShell } from "@/app/components/traveller";
import { EscalationsPageClient } from "./EscalationsPageClient";

export const metadata = {
  title: "Support — FlightOne",
};

export default function EscalationsPage() {
  return (
    <main className="fo-stage relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <TravellerShell>
        <EscalationsPageClient />
      </TravellerShell>
    </main>
  );
}
