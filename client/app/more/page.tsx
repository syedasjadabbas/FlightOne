import { SiteNav } from "@/components/SiteNav";
import { TravellerShell } from "@/app/components/traveller";
import { MorePageClient } from "./MorePageClient";

export const metadata = {
  title: "Account & Platform Hub — FlightOne",
  description:
    "Explore all FlightOne travel services, specialized programs, operations tools, and account settings in one place.",
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
