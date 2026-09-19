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
    <div className="rounded-2xl border border-emerald-200/80 bg-white p-5 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[16px]">🎁</span>
          <h3 className="text-[14px] font-bold text-slate-900">FlightOne Rewards</h3>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200">
          {balance.toLocaleString()} pts available
        </span>
      </div>

      <p className="text-[12px] text-slate-500 leading-relaxed">
        Redeem reward points directly as checkout credits to reduce your total fare.{" "}
        <Link href="/rewards" className="text-blue-600 underline hover:text-blue-700">
          View rewards balance
        </Link>
      </p>

      <div className="flex flex-wrap items-end gap-2 pt-1">
        <div className="flex-1 min-w-[140px]">
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
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2.5 h-[42px]"
          disabled={busy || !rewardPoints}
          onClick={onApply}
        >
          Apply Credits
        </Button>
      </div>
    </div>
  );
}
