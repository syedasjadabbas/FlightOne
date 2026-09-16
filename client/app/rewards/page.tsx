import { SiteNav } from "@/components/SiteNav";
import { TravellerShell } from "@/app/components/traveller";
import { RewardsPageClient } from "./RewardsPageClient";

export const metadata = {
  title: "Rewards — FlightOne",
};

export default function RewardsPage() {
  return (
    <main className="fo-stage relative flex min-h-[100dvh] flex-col">
      <SiteNav />
      <TravellerShell width="narrow">
        <RewardsPageClient />
      </TravellerShell>
    </main>
  );
}
