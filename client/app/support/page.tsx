import { SiteNav } from "@/components/SiteNav";
import { TravellerShell } from "@/app/components/traveller";
import { SupportPageClient } from "./SupportPageClient";
import "./support.css";

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
