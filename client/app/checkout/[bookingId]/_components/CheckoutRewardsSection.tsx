"use client";

import Link from "next/link";
import { Gift } from "lucide-react";
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
    <div className="fo-desk__panel space-y-3">
      <div className="fo-desk__panel-head mb-0">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-[var(--cyan)]" aria-hidden />
          <h3 className="m-0 text-[14px] font-semibold text-[var(--navy)]">Rewards credit</h3>
        </div>
        <span className="fo-desk__status fo-desk__status--ok">
          {balance.toLocaleString()} pts
        </span>
      </div>

      <p className="m-0 text-[12px] leading-relaxed text-[var(--ink-soft)]">
        Apply points as checkout credit.{" "}
        <Link
          href="/rewards"
          className="font-medium text-[var(--cyan)] underline-offset-2 hover:underline"
        >
          View balance
        </Link>
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[140px] flex-1">
          <Input
            label="Points to redeem"
            value={rewardPoints}
            onChange={(e) => setRewardPoints(e.target.value.replace(/\D/g, ""))}
            placeholder="0"
          />
        </div>
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
