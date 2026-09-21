"use client";

import { AlertTriangle } from "lucide-react";
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
    <div
      className="fo-desk__panel space-y-3 border-[color-mix(in_oklab,var(--danger)_28%,var(--fo-desk-line))] bg-[color-mix(in_oklab,var(--danger)_5%,var(--white))]"
      role="alert"
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" aria-hidden />
        <div className="min-w-0 space-y-2">
          <h3 className="text-[14px] font-semibold text-[var(--navy)]">Fare updated by supplier</h3>
          <p className="text-[13px] leading-relaxed text-[var(--ink-soft)]">
            Server fare changed from{" "}
            <strong className="font-semibold text-[var(--navy)]">
              {formatMinor(priceChange.previousAmountMinor, priceChange.currency)}
            </strong>{" "}
            to{" "}
            <strong className="font-semibold text-[var(--navy)]">
              {formatMinor(priceChange.newAmountMinor, priceChange.currency)}
            </strong>
            . Accept the new amount to continue.
          </p>
          <Button type="button" disabled={busy} onClick={onAccept}>
            {accepting
              ? "Accepting…"
              : `Accept ${formatMinor(priceChange.newAmountMinor, priceChange.currency)}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
