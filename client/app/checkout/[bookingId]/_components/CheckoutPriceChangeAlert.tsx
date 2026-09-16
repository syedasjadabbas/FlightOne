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
    <div className="fo-checkout__alert space-y-3" role="alert">
      <p className="text-[14px] font-medium text-[var(--navy)]">Price updated</p>
      <p className="text-[13px] text-ink-soft">
        The authoritative server price changed from{" "}
        <strong>{formatMinor(priceChange.previousAmountMinor, priceChange.currency)}</strong> to{" "}
        <strong>{formatMinor(priceChange.newAmountMinor, priceChange.currency)}</strong>. You
        must accept the new price before checkout can continue.
      </p>
      <Button type="button" disabled={busy} onClick={onAccept}>
        {accepting
          ? "Accepting…"
          : `Accept ${formatMinor(priceChange.newAmountMinor, priceChange.currency)}`}
      </Button>
    </div>
  );
}
