import { SiteNav } from "@/components/SiteNav";
import { TravellerShell } from "@/app/components/traveller";
import { RewardsPageClient } from "./RewardsPageClient";
import "./rewards.css";

export const metadata = {
  title: "Rewards — FlightOne",
  description: "Ledger-based loyalty points from ticketed bookings. View balance, tiers, referrals, and history.",
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
