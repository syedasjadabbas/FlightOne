import { SiteNav } from "@/components/SiteNav";
import { TravellerShell } from "@/app/components/traveller";
import { VisaPageClient } from "./VisaPageClient";

export const metadata = {
  title: "Visa — FlightOne",
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
