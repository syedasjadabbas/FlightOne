"use client";

import Link from "next/link";
import { Button, Input } from "@/components/ui";

export function CheckoutRewardsSection({
  balance,
  rewardPoints,
  setRewardPoints,
  busy,
  onApply,
}: {
  balance: number;
  rewardPoints: string;
  setRewardPoints: (v: string) => void;
  busy: boolean;
  onApply: () => void;
}) {
  if (balance <= 0) return null;

  return (
    <div className="fo-desk__panel fo-desk__stack" style={{ gap: "0.5rem" }}>
      <p className="fo-desk__section-label">Rewards · {balance} pts available</p>
      <p className="fo-checkout__note">
        Credits reduce what you pay — not the supplier net.{" "}
        <Link href="/rewards" className="text-[var(--cyan)] underline-offset-2 hover:underline">
          View rewards
        </Link>
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <Input
          label="Points to redeem"
          value={rewardPoints}
          onChange={(e) => setRewardPoints(e.target.value.replace(/\D/g, ""))}
          placeholder="0"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy || !rewardPoints}
          onClick={onApply}
        >
          Apply
        </Button>
      </div>
    </div>
  );
}
