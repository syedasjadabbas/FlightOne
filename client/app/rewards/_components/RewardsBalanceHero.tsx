import { Star, TrendingUp, Wallet } from "lucide-react";
import type { RewardsSummary } from "@/lib/api/rewards.api";

type RewardsBalanceHeroProps = {
  summary: RewardsSummary;
};

export function RewardsBalanceHero({ summary }: RewardsBalanceHeroProps) {
  const policy = summary.policy;
  const progressPct = Math.round((summary.progress?.progressRatio ?? 0) * 100);
  const redeemable = summary.balance * (policy?.pointValueMinor ?? 1);

  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (progressPct / 100) * circumference;

  return (
    <div className="fo-rewards__hero-showcase">
      <div className="fo-rewards__hero-left">
        <div className="fo-rewards__hero-eyebrow">
          <Star size={13} strokeWidth={2.2} className="text-sky" />
          <span>LOYALTY LEDGER · {summary.tier}</span>
        </div>

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

      <div className="fo-rewards__hero-right">
        <div className="fo-rewards__dial-widget">
          <div className="fo-rewards__dial-head">
            <span className="fo-rewards__dial-label">TIER PROGRESS</span>
            <TrendingUp size={13} strokeWidth={2.2} className="text-sky" />
          </div>

          <div className="fo-rewards__dial-circle-wrap">
            <svg className="fo-rewards__dial-svg" viewBox="0 0 96 96">
              <circle cx="48" cy="48" r={radius} className="fo-rewards__dial-track" strokeWidth="6" />
              <circle
                cx="48"
                cy="48"
                r={radius}
                className="fo-rewards__dial-progress"
                strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
                strokeLinecap="round"
                transform="rotate(-90 48 48)"
              />
            </svg>
            <div className="fo-rewards__dial-value">
              <span className="fo-rewards__dial-number">{progressPct}</span>
              <span className="fo-rewards__dial-percent">%</span>
            </div>
          </div>

          <p className="fo-rewards__dial-caption">
            {summary.progress?.nextTier
              ? `${summary.progress.pointsToNext} pts to ${summary.progress.nextTier}`
              : "Highest configured tier"}
          </p>
          <p className="fo-rewards__dial-caption fo-rewards__dial-caption--faint">
            {summary.lifetimeEarned} lifetime pts earned
          </p>
        </div>
      </div>
    </div>
  );
}
