import { Coins, Gift, Share2 } from "lucide-react";
import type { RewardsPolicy } from "@/lib/api/rewards.api";

type RewardsEarnStepsProps = {
  policy: RewardsPolicy;
};

export function RewardsEarnSteps({ policy }: RewardsEarnStepsProps) {
  const steps = [
    {
      icon: Coins,
      title: "Earn on ticketed trips",
      body: `${policy.earnPointsPerHundredMinor} point${
        policy.earnPointsPerHundredMinor === 1 ? "" : "s"
      } per 100 minor units on ticketed, active, or completed bookings. Quotes and unpaid searches do not earn.`,
    },
    {
      icon: Gift,
      title: "Apply at checkout",
      body: "Redeem on a quoted booking to reduce the amount you pay. There is no cash payout.",
    },
    {
      icon: Share2,
      title: "Referrals",
      body: `Share your referral code after you sign in. A bonus of ${policy.referralBonusPoints} points credits when the referred traveller earns on their first ticketed booking.`,
    },
  ] as const;

  return (
    <div className="fo-rewards__steps" aria-label="How rewards work">
      {steps.map(({ icon: Icon, title, body }) => (
        <div key={title} className="fo-rewards__step">
          <span className="fo-rewards__step-icon" aria-hidden>
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <p className="fo-rewards__step-title">{title}</p>
            <p className="fo-rewards__step-body">{body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
