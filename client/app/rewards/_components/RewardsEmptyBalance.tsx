import Link from "next/link";
import { Coins } from "lucide-react";
import { Button } from "@/components/ui";

type RewardsEmptyBalanceProps = {
  earnPointsPerHundredMinor: number;
};

export function RewardsEmptyBalance({ earnPointsPerHundredMinor }: RewardsEmptyBalanceProps) {
  return (
    <div className="fo-rewards__notice" role="status">
      <span className="fo-rewards__notice-icon" aria-hidden>
        <Coins className="h-4 w-4" />
      </span>
      <div>
        <p className="fo-rewards__notice-title">No points on your ledger yet</p>
        <p className="fo-rewards__notice-body">
          You earn {earnPointsPerHundredMinor} point
          {earnPointsPerHundredMinor === 1 ? "" : "s"} per 100 minor units after a booking is
          ticketed, active, or completed. Quoted or unpaid bookings do not credit points.
        </p>
        <div className="fo-rewards__notice-actions">
          <Link href="/#search">
            <Button size="sm">Search flights</Button>
          </Link>
          <Link href="/journey">
            <Button size="sm" variant="secondary">
              View my journey
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
