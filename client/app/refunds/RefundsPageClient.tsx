"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Input, Spinner } from "@/components/ui";
import { PermissionGate } from "@/components/PermissionGate";
import {
  TravellerChip,
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
import { useListJourneyWatchesQuery } from "@/lib/api/journey.api";
import { useAuthStore } from "@/store/auth.store";

function formatMinor(minor: number | undefined, currency?: string) {
  if (minor == null || !Number.isFinite(minor)) return "—";
  return `${(minor / 100).toFixed(2)} ${currency || ""}`.trim();
}

function statusTone(status: string): "default" | "warn" | "muted" {
  switch (status) {
    case "COMPLETED":
    case "REFUNDED":
    case "APPROVED":
      return "default";
    case "SUBMITTED":
    case "PROCESSING":
    case "REQUIRES_HUMAN":
    case "ELIGIBLE":
      return "warn";
    default:
      return "muted";
  }
}

export function RefundsPageClient() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const skip = !hasHydrated || !accessToken;

  const [bookingId, setBookingId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [casesPage, setCasesPage] = useState(1);
  const [partialRatio, setPartialRatio] = useState("");
  const [cancellationReason, setCancellationReason] = useState("Customer voluntary cancellation");

  const { data: cases, isLoading, refetch } = useListRefundCasesQuery(undefined, { skip });
  const { data: credits } = useListTravelCreditsQuery(undefined, { skip });
  const { data: servicing } = useListServicingRequestsQuery(undefined, { skip });
  const { data: watches } = useListJourneyWatchesQuery(undefined, { skip });

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
        <Spinner />
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="space-y-8">
        <TravellerPageHeader
          title="Refunds, Cancellations & Servicing"
          lede="Evaluate fare rule cancellation terms, calculate net refundable amounts, and manage airline travel credits."
          actions={
            <div className="flex gap-2">
              <Link href="/login?redirect=%2Frefunds">
                <Button size="sm">Sign in to check bookings</Button>
              </Link>
              <Link href="/chat">
                <Button size="sm" variant="secondary">Assistance with Ava</Button>
              </Link>
            </div>
          }
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200/80 bg-white/80 p-4 shadow-2xs">
            <div className="text-lg mb-2">📜</div>
            <p className="text-sm font-semibold text-slate-900">Deterministic Fare Rules</p>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Refund estimates are evaluated directly from airline fare rules and GDS contracts — never speculative estimates.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white/80 p-4 shadow-2xs">
            <div className="text-lg mb-2">⚡</div>
            <p className="text-sm font-semibold text-slate-900">Involuntary Protection</p>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Airline cancellations or schedule modifications exceeding 60 minutes entitle passengers to full involuntary refunds.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white/80 p-4 shadow-2xs">
            <div className="text-lg mb-2">💳</div>
            <p className="text-sm font-semibold text-slate-900">Fast Settlement</p>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Approved refunds settle directly back to the original payment source or are issued as instant FlightOne Travel Credits.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
          <h2 className="text-base font-semibold text-slate-900">Manage Your Refund Claims</h2>
          <p className="mt-1 text-xs text-slate-600">
            Sign in to select your confirmed flight bookings, calculate cancellation charges, and submit verified refund requests.
          </p>
          <div className="mt-4 flex gap-3">
            <Link href="/login?redirect=%2Frefunds">
              <Button size="sm">Log In</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" variant="ghost">Create Account</Button>
            </Link>
          </div>
        </div>
      </div>
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

  const recentBookingIds = Array.from(
    new Set([
      ...(watches?.items || []).map((w) => w.bookingId).filter(Boolean),
      ...(cases?.items || []).map((c) => c.bookingId).filter(Boolean),
    ]),
  );

  return (
    <>
      <TravellerPageHeader
        title="Refunds, Cancellations & Servicing"
        lede="Amounts are computed strictly from stored airline fare rules and confirmed supplier settlements — never estimated without verified policy data."
        actions={
          <div className="flex gap-2">
            <Link href="/chat">
              <Button size="sm" variant="ghost">
                Consult with Ava
              </Button>
            </Link>
            <PermissionGate anyOf={["refunds:write", "refunds:read"]}>
              <Link href="/ops/refunds">
                <Button size="sm" variant="secondary">
                  Operations Queue
                </Button>
              </Link>
            </PermissionGate>
          </div>
        }
      />

      <TravellerSection title="Check Booking Eligibility" panel>
        <div className="space-y-3">
          <div>
            <Input
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              placeholder="Enter Booking ID (e.g. bk_12345678)"
            />
            {recentBookingIds.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-500 mr-1">Your recent bookings:</span>
                {recentBookingIds.slice(0, 4).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setBookingId(id)}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-mono font-medium transition-colors ${
                      bookingId === id
                        ? "bg-sky-600 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {id.slice(0, 12)}…
                  </button>
                ))}
              </div>
            )}
          </div>

          {eligLoading ? <Spinner /> : null}

          {eligibility ? (
            <div className="space-y-3 text-[14px] rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-900">
                  Booking Status: <span className="text-sky-600">{eligibility.status}</span>
                </p>
                <span
                  className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                    eligibility.eligible
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {eligibility.eligible ? "Eligible for Servicing" : "Restricted / Ineligible"}
                </span>
              </div>

              {preview ? (
                <dl className="fo-traveller__facts">
                  <div className="fo-traveller__fact">
                    <dt>Data Status</dt>
                    <dd>{preview.dataStatus}</dd>
                  </div>
                  <div className="fo-traveller__fact">
                    <dt>Applied Rule</dt>
                    <dd>{preview.formula?.rule || "Standard Carrier Policy"}</dd>
                  </div>
                  <div className="fo-traveller__fact">
                    <dt>Supplier Penalty</dt>
                    <dd>{formatMinor(preview.supplierPenaltyMinor, eligibility.currency)}</dd>
                  </div>
                  <div className="fo-traveller__fact">
                    <dt>Agency Servicing Fee</dt>
                    <dd>{formatMinor(preview.agencyFeeMinor, eligibility.currency)}</dd>
                  </div>
                  <div className="fo-traveller__fact">
                    <dt>Net Refundable</dt>
                    <dd className="font-semibold text-emerald-700">
                      {formatMinor(preview.refundableMinor, eligibility.currency)}
                      {preview.confirmed ? " (Confirmed)" : " (Subject to review)"}
                    </dd>
                  </div>
                  <div className="fo-traveller__fact">
                    <dt>Travel Credit Option</dt>
                    <dd>{formatMinor(preview.travelCreditMinor, eligibility.currency)}</dd>
                  </div>
                  <div className="fo-traveller__fact">
                    <dt>Processing Timeline</dt>
                    <dd>
                      {preview.processingTimelineStatus}
                      {preview.processingTimelineNote
                        ? ` — ${preview.processingTimelineNote}`
                        : " (5–10 business days)"}
                    </dd>
                  </div>
                </dl>
              ) : null}

              <div className="space-y-3 pt-2">
                <Input
                  label="Cancellation Reason / Details"
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="e.g. Schedule conflict, medical emergency, voluntary change"
                />

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={calcState.isLoading || createState.isLoading || submitState.isLoading || !activeBookingId}
                    onClick={async () => {
                      setMsg(null);
                      try {
                        const calc = await calculate({ bookingId: activeBookingId }).unwrap();
                        const c = await createCase({
                          bookingId: activeBookingId,
                          calculationId: calc.id,
                          reason: cancellationReason,
                          idempotencyKey: `ui-refund:${activeBookingId}:${Date.now()}`,
                        }).unwrap();
                        await submitCase(c.id).unwrap();
                        setMsg(
                          `Refund case #${c.id.slice(0, 8)} submitted successfully (${c.status}). Net refundable: ${formatMinor(calc.refundableMinor, calc.currency)}.`,
                        );
                        refetch();
                      } catch {
                        setMsg("Could not submit refund case. Please verify booking status.");
                      }
                    }}
                  >
                    Calculate & Submit Refund Request
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
                          reason: cancellationReason,
                        }).unwrap();
                        setMsg(
                          `Cancellation case #${r.refundCase.id.slice(0, 8)} registered (${r.refundCase.status}).`,
                        );
                        refetch();
                      } catch {
                        setMsg("Cancellation request failed.");
                      }
                    }}
                  >
                    Request Voluntary Cancellation
                  </Button>
                </div>
              </div>

              {/* Partial / Exchange / Schedule Change Options */}
              <div className="space-y-2 border-t border-slate-200/80 pt-3 mt-3">
                <p className="text-xs font-semibold text-slate-800">Advanced Servicing & Exchanges</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    label="Partial Refund Ratio (0.1 to 0.9, e.g. return leg only)"
                    value={partialRatio}
                    onChange={(e) => setPartialRatio(e.target.value)}
                    placeholder="e.g. 0.5"
                  />
                  <div className="flex items-end gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={calcState.isLoading || !activeBookingId || !partialRatio}
                      onClick={async () => {
                        setMsg(null);
                        const ratio = Number(partialRatio);
                        if (!Number.isFinite(ratio) || ratio <= 0 || ratio >= 1) {
                          setMsg("Partial ratio must be between 0.1 and 0.9.");
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
                            `Partial refund case #${c.id.slice(0, 8)} submitted. Refundable: ${formatMinor(calc.refundableMinor, calc.currency)}.`,
                          );
                          refetch();
                        } catch {
                          setMsg("Partial refund request failed.");
                        }
                      }}
                    >
                      Request Partial Leg Refund
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="ghost"
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
                          reason: cancellationReason,
                        }).unwrap();
                        setMsg(
                          `Flight exchange request queued (${req.status}). Estimated customer due: ${formatMinor(Number(calc.customerDueMinor ?? 0), String(calc.currency || "USD"))}.`,
                        );
                        refetch();
                      } catch {
                        setMsg("Exchange calculation failed or airline fare is non-changeable.");
                      }
                    }}
                  >
                    Request Flight Exchange
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={schedState.isLoading || !activeBookingId}
                    onClick={async () => {
                      setMsg(null);
                      try {
                        const r = await scheduleChange({ bookingId: activeBookingId }).unwrap();
                        setMsg(
                          `Involuntary schedule change case #${r.refundCase.id.slice(0, 8)} opened (${r.refundCase.status}).`,
                        );
                        refetch();
                      } catch {
                        setMsg("Schedule change servicing could not be initiated.");
                      }
                    }}
                  >
                    Airline Schedule Change Claim
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {msg ? <p className="text-[13px] font-medium text-sky-700">{msg}</p> : null}
        </div>
      </TravellerSection>

      {servicing?.items?.length ? (
        <TravellerSection title="Active Servicing Requests">
          <ul className="fo-traveller__list">
            {servicing.items.map((s) => (
              <li key={s.id} className="fo-traveller__row">
                <div className="flex items-center justify-between">
                  <p className="fo-traveller__row-title">
                    {s.kind} Request · Booking {s.bookingId.slice(0, 10)}…
                  </p>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                    {s.status}
                  </span>
                </div>
                <p className="fo-traveller__row-meta">
                  {s.status === "REQUIRES_HUMAN"
                    ? "Queued for human consultant servicing (no live ticket mutation without confirmation)"
                    : null}
                  {s.message ? ` — ${s.message}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </TravellerSection>
      ) : null}

      <TravellerSection title="Your Submitted Refund & Servicing Cases">
        {isLoading ? (
          <Spinner />
        ) : !cases?.items?.length ? (
          <TravellerState title="No refund cases on file">
            Enter a booking ID above to evaluate fare rules and open a refund or cancellation claim.
          </TravellerState>
        ) : (
          <>
            <ul className="fo-traveller__list">
              {paginateItems(cases.items, casesPage, TRAVELLER_PAGE_SIZE).map((c) => (
                <li key={c.id}>
                  <Link href={`/refunds/${c.id}`} className="fo-traveller__row-link">
                    <div className="fo-traveller__row-top">
                      <span className="fo-traveller__row-title">
                        {(c.kind || "REFUND").replaceAll("_", " ")} Case #{c.id.slice(0, 8)}
                      </span>
                      <TravellerChip tone={statusTone(c.status)}>{c.status}</TravellerChip>
                    </div>
                    <p className="fo-traveller__row-body">
                      Booking: {c.bookingId} {c.reason ? ` · Reason: ${c.reason}` : ""}
                    </p>
                    <p className="fo-traveller__row-meta">
                      Submitted on {new Date(c.createdAt).toLocaleString()}
                      {c.paymentRefundStatus ? ` · Payment refund: ${c.paymentRefundStatus}` : ""}
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
        <TravellerSection title="Active Travel Credit Vouchers">
          <ul className="fo-traveller__list">
            {credits.items.map((t) => (
              <li key={String(t.id)} className="fo-traveller__row">
                <div className="flex items-center justify-between">
                  <p className="fo-traveller__row-title font-semibold text-emerald-700">
                    {formatMinor(Number(t.remainingMinor), String(t.currency))} Active Credit
                  </p>
                  <TravellerChip tone="default">{String(t.status)}</TravellerChip>
                </div>
                <p className="fo-traveller__row-meta">
                  Voucher ID: {String(t.id).slice(0, 10)}… · Redeemable towards future flight or hotel checkout
                </p>
              </li>
            ))}
          </ul>
        </TravellerSection>
      ) : null}
    </>
  );
}
