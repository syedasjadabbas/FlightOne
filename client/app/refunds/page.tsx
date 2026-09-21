import { SiteNav } from "@/components/SiteNav";
import { TravellerShell } from "@/app/components/traveller";
import { RefundsPageClient } from "./RefundsPageClient";
import "./refunds.css";

export const metadata = { title: "Refunds & servicing — FlightOne" };

export default function RefundsPage() {
  return (
    <main className="fo-stage relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <TravellerShell>
        <RefundsPageClient />
      </TravellerShell>
    </main>
  );
}
