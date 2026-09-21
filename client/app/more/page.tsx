import { SiteNav } from "@/components/SiteNav";
import { TravellerShell } from "@/app/components/traveller";
import { MorePageClient } from "./MorePageClient";
import "./more.css";

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
