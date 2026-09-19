"use client";

import { Button } from "@/components/ui";
import { formatMinor, type PriceChangedDetails } from "@/lib/bookings/checkoutDisplay";

export function CheckoutPriceChangeAlert({
  priceChange,
  busy,
  accepting,
  onAccept,
}: {
  priceChange: PriceChangedDetails;
  busy: boolean;
  accepting: boolean;
  onAccept: () => void;
}) {
  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50/80 p-5 shadow-xs space-y-3" role="alert">
      <div className="flex items-center gap-2 text-amber-900 font-bold">
        <span className="text-[16px]">⚠️</span>
        <h3 className="text-[15px]">Price Updated by Airline / Supplier</h3>
      </div>
      <p className="text-[13px] text-amber-900/90 leading-relaxed">
        The authoritative server fare has updated from{" "}
        <strong className="text-amber-950 font-bold">{formatMinor(priceChange.previousAmountMinor, priceChange.currency)}</strong> to{" "}
        <strong className="text-amber-950 font-bold">{formatMinor(priceChange.newAmountMinor, priceChange.currency)}</strong>. You
        must accept the new price to proceed with reservation.
      </p>
      <Button
        type="button"
        className="bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-xs"
        disabled={busy}
        onClick={onAccept}
      >
        {accepting
          ? "Accepting Updated Fare…"
          : `Accept ${formatMinor(priceChange.newAmountMinor, priceChange.currency)} →`}
      </Button>
    </div>
  );
}
