"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Input, Spinner } from "@/components/ui";
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
  useListRefundCasesQuery,
  useListServicingRequestsQuery,
  useListTravelCreditsQuery,
  useRequestCancellationMutation,
  useRequestExchangeMutation,
  useScheduleChangeServicingMutation,
  useSubmitRefundCaseMutation,
} from "@/lib/api/refunds.api";
import { useAuthStore } from "@/store/auth.store";

function formatMinor(minor: number | undefined, currency?: string) {
  if (minor == null || !Number.isFinite(minor)) return "—";
  return `${(minor / 100).toFixed(2)} ${currency || ""}`.trim();
}

export function RefundsPageClient() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const skip = !hasHydrated || !accessToken;
  const [bookingId, setBookingId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [casesPage, setCasesPage] = useState(1);

  const { data: cases, isLoading, refetch } = useListRefundCasesQuery(undefined, { skip });
  const { data: credits } = useListTravelCreditsQuery(undefined, { skip });

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
  const [partialRatio, setPartialRatio] = useState("");
  const { data: servicing } = useListServicingRequestsQuery(undefined, { skip });

  if (!hasHydrated) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (!accessToken) {
    return (
      <TravellerPageHeader
        title="Refunds & servicing"
        lede="Sign in to view refund eligibility and cases."
        actions={
          <Link href="/login">
            <Button size="sm">Sign in</Button>
          </Link>
        }
      />
    );
  }

  const preview = eligibility?.calculationPreview as
    | {
        dataStatus?: string;
        refundableMinor?: number;
        supplierPenaltyMinor?: number;
        agencyFeeMinor?: number;
        travelCreditMinor?: number;
        processingTimelineStatus?: string;
        processingTimelineNote?: string | null;
        confirmed?: boolean;
        formula?: { rule?: string };
      }
    | undefined;

  return (
    <>
      <TravellerPageHeader
        title="Refunds & servicing"
        lede="Amounts come only from stored fare rules and confirmed payment/supplier operations — never estimates presented as confirmed payouts."
        actions={
          <PermissionGate anyOf={["refunds:write", "refunds:read"]}>
            <Link href="/ops/refunds">
              <Button size="sm" variant="secondary">
                Operations queue
              </Button>
            </Link>
          </PermissionGate>
        }
      />

      <TravellerSection title="Check a booking" panel>
        <Input
          value={bookingId}
          onChange={(e) => setBookingId(e.target.value)}
          placeholder="Booking id"
        />
        {eligLoading ? <Spinner /> : null}
        {eligibility ? (
          <div className="space-y-2 text-[14px]">
            <p>
              Status: <span className="font-medium">{eligibility.status}</span>
              {eligibility.eligible ? " · eligible to request" : ""}
            </p>
            {preview ? (
              <dl className="fo-traveller__facts">
                <div className="fo-traveller__fact">
                  <dt>dataStatus</dt>
                  <dd>{preview.dataStatus}</dd>
                </div>
                <div className="fo-traveller__fact">
                  <dt>Rule</dt>
                  <dd>{preview.formula?.rule || "—"}</dd>
                </div>
                <div className="fo-traveller__fact">
                  <dt>Supplier penalty</dt>
                  <dd>{formatMinor(preview.supplierPenaltyMinor, eligibility.currency)}</dd>
                </div>
                <div className="fo-traveller__fact">
                  <dt>Agency fee</dt>
                  <dd>{formatMinor(preview.agencyFeeMinor, eligibility.currency)}</dd>
                </div>
                <div className="fo-traveller__fact">
                  <dt>Refundable</dt>
                  <dd>
                    {formatMinor(preview.refundableMinor, eligibility.currency)}
                    {preview.confirmed ? "" : " (not confirmed)"}
                  </dd>
                </div>
                <div className="fo-traveller__fact">
                  <dt>Travel credit</dt>
                  <dd>{formatMinor(preview.travelCreditMinor, eligibility.currency)}</dd>
                </div>
                <div className="fo-traveller__fact">
                  <dt>Timeline</dt>
                  <dd>
                    {preview.processingTimelineStatus}
                    {preview.processingTimelineNote
                      ? ` — ${preview.processingTimelineNote}`
                      : ""}
                  </dd>
                </div>
              </dl>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                disabled={calcState.isLoading || !activeBookingId}
                onClick={async () => {
                  setMsg(null);
                  try {
                    const calc = await calculate({ bookingId: activeBookingId }).unwrap();
                    const c = await createCase({
                      bookingId: activeBookingId,
                      calculationId: calc.id,
                      idempotencyKey: `ui-refund:${activeBookingId}`,
                    }).unwrap();
                    await submitCase(c.id).unwrap();
                    setMsg(
                      `Case ${c.id.slice(0, 8)}… submitted (${c.status}). dataStatus=${calc.dataStatus}`,
                    );
                    refetch();
                  } catch (e) {
                    setMsg("Could not create/submit refund case.");
                  }
                }}
              >
                Calculate & request refund
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={cancelState.isLoading || !activeBookingId}
                onClick={async () => {
                  setMsg(null);
                  try {
                    const r = await requestCancel({
                      bookingId: activeBookingId,
                      reason: "Customer cancellation from UI",
                    }).unwrap();
                    setMsg(
                      `Cancellation case ${r.refundCase.id.slice(0, 8)}… (${r.refundCase.status})`,
                    );
                    refetch();
                  } catch {
                    setMsg("Cancellation request failed.");
                  }
                }}
              >
                Request cancellation
              </Button>
            </div>
            <div className="space-y-2 border-t border-line/60 pt-3">
              <p className="fo-traveller__section-title">Partial / exchange / schedule change</p>
              <Input
                label="Partial ratio (0–1, optional)"
                value={partialRatio}
                onChange={(e) => setPartialRatio(e.target.value)}
                placeholder="e.g. 0.5"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={calcState.isLoading || !activeBookingId || !partialRatio}
                  onClick={async () => {
                    setMsg(null);
                    const ratio = Number(partialRatio);
                    if (!Number.isFinite(ratio) || ratio <= 0 || ratio > 1) {
                      setMsg("Partial ratio must be between 0 and 1.");
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
                      await submitCase(c.id).unwrap();
                      setMsg(
                        `Partial case ${c.id.slice(0, 8)}… (${c.status}) · refundable ${formatMinor(calc.refundableMinor, calc.currency)}`,
                      );
                      refetch();
                    } catch {
                      setMsg("Partial refund request failed.");
                    }
                  }}
                >
                  Request partial refund
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={exchCalcState.isLoading || exchReqState.isLoading || !activeBookingId}
                  onClick={async () => {
                    setMsg(null);
                    try {
                      const calc = await calcExchange({
                        bookingId: activeBookingId,
                        kind: "EXCHANGE",
                      }).unwrap();
                      const req = await requestExchange({
                        bookingId: activeBookingId,
                        servicingRequestId: calc.id,
                        reason: "Customer exchange request from UI",
                      }).unwrap();
                      setMsg(
                        `Exchange queued for human servicing · ${req.status} · no ticket mutated · due ${formatMinor(Number(calc.customerDueMinor ?? 0), String(calc.currency || "USD"))}`,
                      );
                      refetch();
                    } catch {
                      setMsg("Exchange request failed (may be DATA_UNAVAILABLE).");
                    }
                  }}
                >
                  Request exchange
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={exchCalcState.isLoading || exchReqState.isLoading || !activeBookingId}
                  onClick={async () => {
                    setMsg(null);
                    try {
                      const calc = await calcExchange({
                        bookingId: activeBookingId,
                        kind: "REISSUE",
                      }).unwrap();
                      const req = await requestExchange({
                        bookingId: activeBookingId,
                        servicingRequestId: calc.id,
                        reason: "Customer reissue request from UI",
                      }).unwrap();
                      setMsg(
                        `Reissue queued for human servicing · ${req.status} · no ticket mutated · due ${formatMinor(Number(calc.customerDueMinor ?? 0), String(calc.currency || "USD"))}`,
                      );
                      refetch();
                    } catch {
                      setMsg("Reissue request failed (may be DATA_UNAVAILABLE).");
                    }
                  }}
                >
                  Request reissue
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={schedState.isLoading || !activeBookingId}
                  onClick={async () => {
                    setMsg(null);
                    try {
                      const r = await scheduleChange({ bookingId: activeBookingId }).unwrap();
                      setMsg(
                        `Schedule-change case ${r.refundCase.id.slice(0, 8)}… (${r.refundCase.status})`,
                      );
                      refetch();
                    } catch {
                      setMsg("Schedule-change servicing failed.");
                    }
                  }}
                >
                  Schedule change
                </Button>
              </div>
            </div>
            {createState.isLoading || submitState.isLoading ? <Spinner /> : null}
          </div>
        ) : null}
        {msg ? <p className="text-[13px] text-ink-soft">{msg}</p> : null}
      </TravellerSection>

      {servicing?.items?.length ? (
        <TravellerSection title="Servicing requests">
          <ul className="fo-traveller__list">
            {servicing.items.map((s) => (
              <li key={s.id} className="fo-traveller__row">
                <p className="fo-traveller__row-title">
                  {s.kind} · {s.status} · {s.dataStatus}
                </p>
                <p className="fo-traveller__row-meta">
                  {s.status === "REQUIRES_HUMAN"
                    ? "Human servicing required (no live ticket mutation)"
                    : null}
                  {s.message ? ` — ${s.message}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </TravellerSection>
      ) : null}

      <TravellerSection title="Your cases">
        {isLoading ? (
          <Spinner />
        ) : !cases?.items?.length ? (
          <TravellerState title="No refund cases">
            Enter a booking id above to check eligibility and open a case.
          </TravellerState>
        ) : (
          <>
            <ul className="fo-traveller__list">
              {paginateItems(cases.items, casesPage, TRAVELLER_PAGE_SIZE).map((c) => (
                <li key={c.id}>
                  <Link href={`/refunds/${c.id}`} className="fo-traveller__row-link">
                    <div className="fo-traveller__row-top">
                      <span className="fo-traveller__row-title">
                        {(c.kind || "REFUND").replaceAll("_", " ")}
                      </span>
                      <span className="fo-traveller__row-meta">{c.status}</span>
                    </div>
                    <p className="fo-traveller__row-meta">
                      {c.id.slice(0, 10)}… · {new Date(c.createdAt).toLocaleString()}
                    </p>
                  </Link>
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

      {credits?.items?.length ? (
        <TravellerSection title="Travel credits">
          <ul className="fo-traveller__list">
            {credits.items.map((t) => (
              <li key={String(t.id)} className="fo-traveller__row">
                <p className="fo-traveller__row-title">
                  {formatMinor(Number(t.remainingMinor), String(t.currency))} remaining
                </p>
                <p className="fo-traveller__row-meta">{String(t.status)}</p>
              </li>
            ))}
          </ul>
        </TravellerSection>
      ) : null}
    </>
  );
}
