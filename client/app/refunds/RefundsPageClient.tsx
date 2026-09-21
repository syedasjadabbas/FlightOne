"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { PermissionGate } from "@/components/PermissionGate";
import {
  TravellerPageHeader,
  TravellerPagination,
  TravellerSection,
  TravellerState,
  TRAVELLER_PAGE_SIZE,
  paginateItems,
} from "@/app/components/traveller";
import {
  useCalculateExchangeMutation,
  useCalculateRefundMutation,
  useCreateRefundCaseMutation,
  useGetRefundEligibilityQuery,
  useListRefundableBookingsQuery,
  useListRefundCasesQuery,
  useListServicingRequestsQuery,
  useListTravelCreditsQuery,
  useRequestCancellationMutation,
  useRequestExchangeMutation,
  useScheduleChangeServicingMutation,
  useSubmitRefundCaseMutation,
} from "@/lib/api/refunds.api";
import { useAuthStore } from "@/store/auth.store";
import {
  formatMinor,
  RefundActionPanel,
  RefundBookingPicker,
  RefundCaseRow,
  RefundCreditsList,
  RefundServicingList,
  RefundsGuestGate,
  type EligibilityPreview,
} from "./_components";

export function RefundsPageClient() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const skip = !hasHydrated || !accessToken;

  const [bookingId, setBookingId] = useState("");
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [casesPage, setCasesPage] = useState(1);
  const [partialRatio, setPartialRatio] = useState("");
  const [cancellationReason, setCancellationReason] = useState("Customer voluntary cancellation");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromJourney = new URLSearchParams(window.location.search).get("bookingId");
    if (fromJourney) setBookingId(fromJourney);
  }, []);

  const { data: cases, isLoading, refetch } = useListRefundCasesQuery(undefined, { skip });
  const { data: refundableBookings, isLoading: bookingsLoading } = useListRefundableBookingsQuery(
    undefined,
    { skip },
  );
  const { data: credits } = useListTravelCreditsQuery(undefined, { skip });
  const { data: servicing } = useListServicingRequestsQuery(undefined, { skip });

  const activeBookingId = bookingId.trim();
  const { data: eligibility, isFetching: eligLoading } = useGetRefundEligibilityQuery(
    activeBookingId,
    { skip: skip || !activeBookingId },
  );

  const [calculate, calcState] = useCalculateRefundMutation();
  const [createCase, createState] = useCreateRefundCaseMutation();
  const [submitCase, submitState] = useSubmitRefundCaseMutation();
  const [requestCancel, cancelState] = useRequestCancellationMutation();
  const [calcExchange, exchCalcState] = useCalculateExchangeMutation();
  const [requestExchange, exchReqState] = useRequestExchangeMutation();
  const [scheduleChange, schedState] = useScheduleChangeServicingMutation();

  if (!hasHydrated) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="Loading refunds" />
      </div>
    );
  }

  if (!accessToken) {
    return <RefundsGuestGate />;
  }

  const preview = eligibility?.calculationPreview as EligibilityPreview | undefined;

  return (
    <div className="fo-refunds">
      <TravellerPageHeader
        title="Refunds & servicing"
        lede="Amounts appear only when stored fare rules confirm them. Completion requires a real payment or supplier result."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/chat">
              <Button
                size="sm"
                variant="ghost"
                icon={<MessageCircle size={14} strokeWidth={1.75} aria-hidden />}
              >
                Chat with Ava
              </Button>
            </Link>
            <PermissionGate anyOf={["refunds:write", "refunds:read"]}>
              <Link href="/ops/refunds">
                <Button size="sm" variant="secondary">
                  Operations queue
                </Button>
              </Link>
            </PermissionGate>
          </div>
        }
      />

      {msg ? (
        <div
          className={`fo-refunds__flash${msg.error ? " fo-refunds__flash--error" : ""}`}
          role="status"
        >
          <span>{msg.text}</span>
          <button type="button" className="fo-refunds__flash-dismiss" onClick={() => setMsg(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <RefundBookingPicker
        bookings={refundableBookings?.items ?? []}
        loading={bookingsLoading}
        eligibilityLoading={Boolean(activeBookingId) && eligLoading}
        bookingId={bookingId}
        onSelect={setBookingId}
        onBookingIdChange={setBookingId}
      >
        {eligibility ? (
          <RefundActionPanel
            eligibility={eligibility}
            preview={preview}
            eligLoading={eligLoading}
            cancellationReason={cancellationReason}
            onCancellationReasonChange={setCancellationReason}
            partialRatio={partialRatio}
            onPartialRatioChange={setPartialRatio}
            canAct={Boolean(activeBookingId)}
            busy={{
              calc: calcState.isLoading,
              create: createState.isLoading,
              submit: submitState.isLoading,
              cancel: cancelState.isLoading,
              exchange: exchCalcState.isLoading || exchReqState.isLoading,
              schedule: schedState.isLoading,
            }}
            onSubmitRefund={async () => {
              setMsg(null);
              try {
                const calc = await calculate({ bookingId: activeBookingId }).unwrap();
                const c = await createCase({
                  bookingId: activeBookingId,
                  calculationId: calc.id,
                  reason: cancellationReason,
                  idempotencyKey: `ui-refund:${activeBookingId}`,
                }).unwrap();
                const submitted = await submitCase(c.id).unwrap();
                setMsg({
                  text: `Refund case ${submitted.status}. ${
                    calc.dataStatus === "OK"
                      ? `Confirmed refundable ${formatMinor(calc.refundableMinor, calc.currency)}.`
                      : "Amount is not confirmed until fare/payment data is available — this may stay in manual review."
                  }`,
                });
                refetch();
              } catch {
                setMsg({
                  text: "Could not submit refund case. Please verify booking status.",
                  error: true,
                });
              }
            }}
            onRequestCancel={async () => {
              setMsg(null);
              try {
                const r = await requestCancel({
                  bookingId: activeBookingId,
                  reason: cancellationReason,
                }).unwrap();
                setMsg({
                  text: `Cancellation case #${r.refundCase.id.slice(0, 8)} registered (${r.refundCase.status}).`,
                });
                refetch();
              } catch {
                setMsg({ text: "Cancellation request failed.", error: true });
              }
            }}
            onPartialRefund={async () => {
              setMsg(null);
              const ratio = Number(partialRatio);
              if (!Number.isFinite(ratio) || ratio <= 0 || ratio >= 1) {
                setMsg({ text: "Partial ratio must be between 0.1 and 0.9.", error: true });
                return;
              }
              try {
                const calc = await calculate({
                  bookingId: activeBookingId,
                  partialRatio: ratio,
                }).unwrap();
                const c = await createCase({
                  bookingId: activeBookingId,
                  calculationId: calc.id,
                  partial: true,
                  idempotencyKey: `ui-partial:${activeBookingId}:${ratio}`,
                }).unwrap();
                const submitted = await submitCase(c.id).unwrap();
                setMsg({
                  text: `Partial refund case #${c.id.slice(0, 8)} ${submitted.status}. ${
                    calc.dataStatus === "OK"
                      ? `Confirmed refundable ${formatMinor(calc.refundableMinor, calc.currency)}.`
                      : "Amount unconfirmed — queued for review if data is missing."
                  }`,
                });
                refetch();
              } catch {
                setMsg({ text: "Partial refund request failed.", error: true });
              }
            }}
            onExchange={async () => {
              setMsg(null);
              try {
                const calc = await calcExchange({
                  bookingId: activeBookingId,
                  kind: "EXCHANGE",
                }).unwrap();
                const req = await requestExchange({
                  bookingId: activeBookingId,
                  servicingRequestId: calc.id,
                  reason: cancellationReason,
                }).unwrap();
                setMsg({
                  text: `Flight exchange request queued (${req.status}). Estimated customer due: ${formatMinor(Number(calc.customerDueMinor ?? 0), String(calc.currency || "USD"))}.`,
                });
                refetch();
              } catch {
                setMsg({
                  text: "Exchange calculation failed or airline fare is non-changeable.",
                  error: true,
                });
              }
            }}
            onScheduleChange={async () => {
              setMsg(null);
              try {
                const r = await scheduleChange({ bookingId: activeBookingId }).unwrap();
                setMsg({
                  text: `Involuntary schedule change case #${r.refundCase.id.slice(0, 8)} opened (${r.refundCase.status}).`,
                });
                refetch();
              } catch {
                setMsg({
                  text: "Schedule change servicing could not be initiated.",
                  error: true,
                });
              }
            }}
          />
        ) : null}
      </RefundBookingPicker>

      <RefundServicingList items={servicing?.items ?? []} />

      <TravellerSection title="Submitted cases">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner label="Loading cases" />
          </div>
        ) : !cases?.items?.length ? (
          <TravellerState title="No refund cases on file">
            Select a booking above to evaluate fare rules and open a refund or cancellation claim.
          </TravellerState>
        ) : (
          <>
            <ul className="fo-traveller__list">
              {paginateItems(cases.items, casesPage, TRAVELLER_PAGE_SIZE).map((c) => (
                <li key={c.id}>
                  <RefundCaseRow refundCase={c} />
                </li>
              ))}
            </ul>
            <TravellerPagination
              page={casesPage}
              total={cases.items.length}
              onPageChange={setCasesPage}
              label="Refund cases pages"
            />
          </>
        )}
      </TravellerSection>

      <RefundCreditsList items={credits?.items ?? []} />
    </div>
  );
}
