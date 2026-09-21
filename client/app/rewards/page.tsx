import dynamic from "next/dynamic";
import { RouteChunkFallback } from "@/components/RouteChunkFallback";
import { SiteNav } from "@/components/SiteNav";
import { TravellerShell } from "@/app/components/traveller";
import "./rewards.css";

const RewardsPageClient = dynamic(
  () =>
    import("./RewardsPageClient").then((m) => ({
      default: m.RewardsPageClient,
    })),
  { loading: () => <RouteChunkFallback label="Loading rewards…" /> },
);

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
