import { Wallet } from "lucide-react";
import type { RewardsSummary } from "@/lib/api/rewards.api";

type RewardsBalanceHeroProps = {
  summary: RewardsSummary;
};

export function RewardsBalanceHero({ summary }: RewardsBalanceHeroProps) {
  const policy = summary.policy;
  const progressPct = Math.round((summary.progress?.progressRatio ?? 0) * 100);
  const redeemable = summary.balance * (policy?.pointValueMinor ?? 1);

  return (
    <div className="fo-rewards__hero">
      <div>
        <p className="fo-rewards__balance-label">
          <Wallet className="h-3.5 w-3.5" aria-hidden />
          Active balance
        </p>
        <p className="fo-rewards__balance">
          {summary.balance}
          <span>pts</span>
        </p>
        <p className="fo-rewards__balance-meta">
          ≈ {redeemable} minor currency units redeemable at checkout. Credit expiry:{" "}
          {policy?.creditExpiryDays ?? "—"} days from issuance (ledger-enforced).
        </p>
      </div>

      <div className="fo-rewards__tier">
        <div className="fo-rewards__tier-row">
          <p className="fo-rewards__tier-name">{summary.tier}</p>
          <p className="fo-rewards__tier-life">{summary.lifetimeEarned} lifetime</p>
        </div>
        <p className="fo-rewards__tier-note">
          {summary.progress?.nextTier
            ? `${summary.progress.pointsToNext} points to ${summary.progress.nextTier}`
            : "Highest configured tier"}
        </p>
        {summary.progress?.nextTier ? (
          <div
            className="fo-rewards__progress"
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progress toward ${summary.progress.nextTier}`}
          >
            <span style={{ width: `${progressPct}%` }} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
