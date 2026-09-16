"use client";

import Link from "next/link";
import { Button, Spinner } from "@/components/ui";
import {
  TravellerChip,
  TravellerPageHeader,
  TravellerSection,
  TravellerState,
} from "@/app/components/traveller";
import { useGetRefundCaseQuery } from "@/lib/api/refunds.api";
import { useAuthStore } from "@/store/auth.store";

function formatMinor(minor: number | undefined | null, currency?: string | null) {
  if (minor == null || !Number.isFinite(minor)) return "—";
  return `${(minor / 100).toFixed(2)} ${currency || ""}`.trim();
}

export function RefundCaseDetailClient({ id }: { id: string }) {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const skip = !hasHydrated || !accessToken;
  const { data, isLoading, isError, refetch, error } = useGetRefundCaseQuery(id, { skip });

  if (!hasHydrated) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }
  if (!accessToken) {
    return (
      <TravellerState title="Sign in required">
        <Link href="/login" className="text-[var(--sky)] underline-offset-2 hover:underline">
          Sign in
        </Link>
      </TravellerState>
    );
  }
  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <TravellerState
        variant="error"
        title={
          (error as { status?: number })?.status === 404
            ? "Case not found"
            : "Case unavailable"
        }
        action={
          <Button size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        }
      >
        {(error as { status?: number })?.status === 404
          ? "This case does not exist or belongs to another account."
          : "Could not load this refund case."}
      </TravellerState>
    );
  }

  const calc = data.calculation;

  return (
    <>
      <TravellerPageHeader
        backHref="/refunds"
        backLabel="Refunds"
        title={(data.kind || "REFUND").replaceAll("_", " ")}
        lede={`Case ${data.id}`}
        meta={<TravellerChip>{data.status}</TravellerChip>}
      />

      <TravellerSection title="Case">
        <dl className="fo-traveller__facts">
          <div className="fo-traveller__fact">
            <dt>Booking</dt>
            <dd className="font-mono text-[12px]">{data.bookingId}</dd>
          </div>
          {data.paymentRefundStatus ? (
            <div className="fo-traveller__fact">
              <dt>Payment refund</dt>
              <dd>{data.paymentRefundStatus}</dd>
            </div>
          ) : null}
        </dl>
        {data.supplierOperationNote ? (
          <p className="fo-traveller__row-body">Supplier: {data.supplierOperationNote}</p>
        ) : null}
        {data.failureReason ? (
          <p className="fo-traveller__row-body">Note: {data.failureReason}</p>
        ) : null}
        {data.status === "COMPLETED" ? (
          <p className="text-[14px] font-medium text-ink">
            Refund completed after payment confirmation.
          </p>
        ) : (
          <p className="fo-traveller__section-note">
            This case is not a completed payout unless status is COMPLETED and payment status
            confirms it.
          </p>
        )}
      </TravellerSection>

      {calc ? (
        <TravellerSection title="Calculation">
          <dl className="fo-traveller__facts">
            <div className="fo-traveller__fact">
              <dt>dataStatus</dt>
              <dd>{calc.dataStatus}</dd>
            </div>
            <div className="fo-traveller__fact">
              <dt>Gross paid</dt>
              <dd>{formatMinor(calc.grossPaidMinor, calc.currency)}</dd>
            </div>
            <div className="fo-traveller__fact">
              <dt>Supplier penalty</dt>
              <dd>{formatMinor(calc.supplierPenaltyMinor, calc.currency)}</dd>
            </div>
            <div className="fo-traveller__fact">
              <dt>Agency fee</dt>
              <dd>{formatMinor(calc.agencyFeeMinor, calc.currency)}</dd>
            </div>
            <div className="fo-traveller__fact">
              <dt>Refundable</dt>
              <dd>
                {formatMinor(calc.refundableMinor, calc.currency)}
                {calc.dataStatus === "OK" ? "" : " (unconfirmed)"}
              </dd>
            </div>
            <div className="fo-traveller__fact">
              <dt>Travel credit</dt>
              <dd>{formatMinor(calc.travelCreditMinor, calc.currency)}</dd>
            </div>
            <div className="fo-traveller__fact">
              <dt>Timeline</dt>
              <dd>
                {calc.processingTimelineStatus}
                {calc.processingTimelineNote ? ` — ${calc.processingTimelineNote}` : ""}
              </dd>
            </div>
          </dl>
        </TravellerSection>
      ) : null}
    </>
  );
}
