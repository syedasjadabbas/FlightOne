"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, Spinner } from "@/components/ui";
import {
  useEscalateJourneyMutation,
  useGetJourneyCapabilityQuery,
  useJourneyAlternativesMutation,
  useJourneyRebookHandoffMutation,
  useListJourneyWatchesQuery,
  usePollJourneyWatchMutation,
  type JourneyEvent,
  type JourneyWatch,
} from "@/lib/api/journey.api";
import { useAuthStore } from "@/store/auth.store";

function formatTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function phaseLabel(phase: string | undefined, fallbackStatus: string) {
  switch (phase) {
    case "IN_PROGRESS":
      return "In progress";
    case "UPCOMING":
      return "Upcoming";
    case "COMPLETED":
      return "Completed";
    case "PAUSED":
      return "Monitoring paused";
    default:
      return fallbackStatus;
  }
}

function eventTone(type: string, severity: number) {
  if (type === "CANCELLED" || severity >= 3) return "rose";
  if (type === "DELAY" || type === "GATE_CHANGE" || type === "TERMINAL_CHANGE" || type === "WEATHER") {
    return "amber";
  }
  return "slate";
}

export function JourneyPageClient() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const skip = !hasHydrated || !accessToken;

  const [page, setPage] = useState(1);
  const { data: capability } = useGetJourneyCapabilityQuery(undefined, { skip });
  const { data, isLoading, isError, refetch } = useListJourneyWatchesQuery(
    { page, pageSize: 20 },
    { skip },
  );

  const [poll, { isLoading: isPolling }] = usePollJourneyWatchMutation();
  const [escalate, { isLoading: isEscalating }] = useEscalateJourneyMutation();
  const [alternatives, { isLoading: isLoadingAlts }] = useJourneyAlternativesMutation();
  const [rebookHandoff, { isLoading: isRebooking }] = useJourneyRebookHandoffMutation();

  const [activeWatchId, setActiveWatchId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
  const [altsByWatch, setAltsByWatch] = useState<
    Record<
      string,
      {
        offers?: Array<{ supplierOfferSnapshotId?: string }>;
        note?: string;
        reason?: string;
      }
    >
  >({});

  const liveCap = capability?.flightStatus || capability;
  const canPollLive = Boolean(liveCap?.canPollLive);

  const { inProgress, upcoming, completed } = useMemo(() => {
    const items = data?.items || [];
    const inProg: JourneyWatch[] = [];
    const up: JourneyWatch[] = [];
    const done: JourneyWatch[] = [];
    for (const w of items) {
      if (w.phase === "COMPLETED" || w.status === "COMPLETED") done.push(w);
      else if (w.phase === "IN_PROGRESS") inProg.push(w);
      else up.push(w);
    }
    return { inProgress: inProg, upcoming: up, completed: done };
  }, [data?.items]);

  if (!hasHydrated) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading journey dashboard" />
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl font-[var(--font-sora)]">
          My Journey
        </h1>
        <p className="mt-3 text-base text-slate-600">
          Sign in to see ticketed itineraries you own. Live delays, gates, and cancellations appear
          only when a verified status feed returns them.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/login?redirect=/journey">
            <Button size="md" className="px-6">
              Log in
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="md" variant="secondary" className="px-6">
              Create account
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  function renderWatchCard(w: JourneyWatch) {
    const live = w.liveFlight;
    const snap = live?.confirmed ? live.snapshot : null;
    const flightLeg = (w.itinerary || []).find((i) => i.kind === "FLIGHT");
    const origin = flightLeg?.origin || null;
    const destination = flightLeg?.destination || null;
    const isCurrentBusy = activeWatchId === w.id;
    const events = w.events || [];
    const disruptions = w.disruptions || [];

    return (
      <div
        key={w.id}
        className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm"
      >
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-[#0b2438] px-6 py-5 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold tracking-wider text-cyan-300">
                {w.flightNumber || w.booking?.product || "ITINERARY"}
              </span>
              <span className="text-sm font-medium text-slate-300">
                {phaseLabel(w.phase, w.status)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {snap?.status ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200 border border-emerald-500/30">
                  Verified: {String(snap.status)}
                  {snap.minutesDelayed ? ` · +${snap.minutesDelayed}m` : ""}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">
                  Live status {live?.dataStatus || "unavailable"}
                </span>
              )}
              {snap?.gate ? (
                <span className="rounded-full bg-cyan-500/20 border border-cyan-500/30 px-3 py-1 text-xs font-semibold text-cyan-200">
                  Gate {String(snap.gate)}
                </span>
              ) : null}
              {snap?.terminal ? (
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">
                  Terminal {String(snap.terminal)}
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <div className="text-3xl sm:text-4xl font-extrabold tracking-tight font-[var(--font-sora)]">
                {origin || "—"}
              </div>
              <div className="text-sm text-cyan-300 font-semibold mt-2">{formatTime(w.departAt)}</div>
              <div className="text-xs text-slate-400">{formatDate(w.departAt)}</div>
            </div>
            <div className="flex flex-1 max-w-xs flex-col items-center justify-center px-4">
              <div className="h-[2px] w-full bg-slate-700" />
              <span className="mt-2 text-[11px] text-slate-400 font-medium">
                {origin && destination ? "Ticketed itinerary" : "Route not stored on this booking"}
              </span>
            </div>
            <div className="sm:text-right">
              <div className="text-3xl sm:text-4xl font-extrabold tracking-tight font-[var(--font-sora)]">
                {destination || "—"}
              </div>
              <div className="text-sm text-cyan-300 font-semibold mt-2">{formatTime(w.arriveAt)}</div>
              <div className="text-xs text-slate-400">{formatDate(w.arriveAt)}</div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {!live?.confirmed ? (
            <p className="text-xs text-slate-600 leading-relaxed">
              {live?.reason ||
                "Live delays, gates, and cancellations are not shown until a verified provider poll succeeds."}
            </p>
          ) : null}

          {(w.itinerary || []).length > 0 ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Itinerary</h3>
              <ul className="mt-2 space-y-2">
                {(w.itinerary || []).map((item, idx) => (
                  <li
                    key={`${item.kind}-${idx}`}
                    className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-800"
                  >
                    {item.kind === "FLIGHT" ? (
                      <>
                        Flight {item.flightNumber || "—"} · {item.origin || "—"} → {item.destination || "—"}
                      </>
                    ) : null}
                    {item.kind === "HOTEL" ? (
                      <>
                        Hotel check-in {formatDate(item.checkInDate)}
                        {item.confirmationRef ? ` · ref ${item.confirmationRef}` : ""}
                      </>
                    ) : null}
                    {item.kind === "TRANSFER" ? (
                      <>
                        Transfer{item.transferRef ? ` ${item.transferRef}` : ""}
                        {item.pickupAt ? ` · pickup ${formatDate(item.pickupAt)} ${formatTime(item.pickupAt)}` : ""}
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-slate-600">No attributed itinerary fields on this booking.</p>
          )}

          {disruptions.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-900">
                Recorded disruptions
              </p>
              <ul className="mt-2 space-y-1.5">
                {disruptions.map((ev) => (
                  <li key={ev.id} className="text-sm text-amber-950">
                    {ev.title}
                    <span className="block text-xs text-amber-800">{formatDate(ev.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {events.length > 0 ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Timeline</h3>
              <ol className="mt-2 space-y-2">
                {events.map((ev: JourneyEvent) => (
                  <li key={ev.id} className="flex gap-3 text-sm">
                    <span
                      className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                        eventTone(ev.type, ev.severity) === "rose"
                          ? "bg-rose-500"
                          : eventTone(ev.type, ev.severity) === "amber"
                            ? "bg-amber-500"
                            : "bg-slate-400"
                      }`}
                    />
                    <div>
                      <p className="font-medium text-slate-900">{ev.title}</p>
                      {ev.body ? <p className="text-xs text-slate-600">{ev.body}</p> : null}
                      <p className="text-[11px] text-slate-500">
                        {ev.type} · {new Date(ev.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <p className="text-xs text-slate-500">No monitoring events recorded yet.</p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
            <div className="text-xs text-slate-500 space-y-1">
              <div>
                Booking{" "}
                <Link
                  href={`/checkout/${w.bookingId}`}
                  className="font-mono font-semibold text-cyan-700 hover:underline"
                >
                  {w.booking?.ticketRef || w.bookingId}
                </Link>
                {w.booking?.status ? ` · ${w.booking.status}` : ""}
              </div>
              <div>
                Last poll:{" "}
                {w.lastPolledAt ? new Date(w.lastPolledAt).toLocaleString() : "Not polled yet"}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                size="sm"
                variant="secondary"
                disabled={(isPolling && isCurrentBusy) || w.status === "COMPLETED"}
                onClick={async () => {
                  setActiveWatchId(w.id);
                  setMsg(null);
                  try {
                    const r = await poll(w.id).unwrap();
                    setMsg({
                      text: r.isFact
                        ? `Verified status: ${r.dataStatus}.`
                        : `Poll finished (${r.dataStatus || "unavailable"}). No live status invented.`,
                      type: r.isFact ? "success" : "info",
                    });
                    refetch();
                  } catch {
                    setMsg({
                      text: "Could not poll this watch. Completed journeys cannot be polled.",
                      type: "error",
                    });
                  } finally {
                    setActiveWatchId(null);
                  }
                }}
              >
                {isPolling && isCurrentBusy ? "Polling…" : "Refresh status"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={isLoadingAlts && isCurrentBusy}
                onClick={async () => {
                  setActiveWatchId(w.id);
                  setMsg(null);
                  try {
                    const r = await alternatives(w.id).unwrap();
                    setAltsByWatch((prev) => ({
                      ...prev,
                      [w.id]: {
                        offers: Array.isArray(r.offers) ? r.offers : [],
                        note: r.note,
                        reason: r.reason,
                      },
                    }));
                    setMsg({
                      text: r.autoBooked
                        ? "Unexpected auto-book flag — FlightOne does not auto-rebook."
                        : r.note || r.reason || "Alternative search finished. Nothing was booked.",
                      type: "info",
                    });
                  } catch {
                    setMsg({ text: "Could not search alternatives.", type: "error" });
                  } finally {
                    setActiveWatchId(null);
                  }
                }}
              >
                {isLoadingAlts && isCurrentBusy ? "Searching…" : "Find alternatives"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={isEscalating && isCurrentBusy}
                onClick={async () => {
                  setActiveWatchId(w.id);
                  setMsg(null);
                  try {
                    const r = await escalate({
                      id: w.id,
                      reason: "Traveller requested help from My Journey",
                    }).unwrap();
                    setMsg({
                      text:
                        r.message ||
                        (r.auditOnly
                          ? "Help request recorded. Open chat with Ava to create a consultant ticket."
                          : "Disruption escalation recorded."),
                      type: "info",
                    });
                  } catch {
                    setMsg({ text: "Could not record a help request.", type: "error" });
                  } finally {
                    setActiveWatchId(null);
                  }
                }}
              >
                {isEscalating && isCurrentBusy ? "Sending…" : "Request assistance"}
              </Button>
              <Link href={`/refunds?bookingId=${encodeURIComponent(w.bookingId)}`}>
                <Button size="sm" variant="ghost">
                  Refund / cancel
                </Button>
              </Link>
              <Link href={`/checkout/${w.bookingId}`}>
                <Button size="sm" variant="ghost">
                  Booking
                </Button>
              </Link>
            </div>
          </div>

          {altsByWatch[w.id] ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Alternative inventory
              </p>
              <p className="mt-1 text-xs text-slate-600">
                {altsByWatch[w.id].note ||
                  altsByWatch[w.id].reason ||
                  "Selecting an option prepares a quote. It does not ticket or charge."}
              </p>
              {(altsByWatch[w.id].offers || []).length ? (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(altsByWatch[w.id].offers || []).slice(0, 3).map((offer, idx) => {
                    const snapId = offer.supplierOfferSnapshotId;
                    if (!snapId) return null;
                    return (
                      <div key={snapId} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="text-xs font-semibold text-slate-900">Option #{idx + 1}</div>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={isRebooking}
                          className="mt-2 text-xs"
                          onClick={async () => {
                            setMsg(null);
                            try {
                              const r = await rebookHandoff({
                                id: w.id,
                                supplierOfferSnapshotId: snapId,
                              }).unwrap();
                              setMsg({
                                text:
                                  r.message ||
                                  "Quote handoff prepared. FlightOne did not rebook or charge.",
                                type: "info",
                              });
                            } catch {
                              setMsg({ text: "Could not prepare quote handoff.", type: "error" });
                            }
                          }}
                        >
                          Prepare quote
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">No alternative offers returned.</p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const empty = inProgress.length === 0 && upcoming.length === 0 && completed.length === 0;

  return (
    <div className="w-full space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-700">Journey monitoring</p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-[var(--font-sora)]">
            My Journey
          </h1>
          <p className="mt-1.5 text-sm sm:text-base text-slate-600 max-w-2xl">
            Ticketed trips you own. Status, gates, and disruptions appear only from stored itinerary
            data or a verified provider poll.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto rounded-full border border-slate-200/80 bg-white px-3.5 py-1.5 text-xs text-slate-600 shadow-sm">
          <span className={`inline-block h-2 w-2 rounded-full ${canPollLive ? "bg-emerald-500" : "bg-slate-400"}`} />
          <span className="font-medium text-slate-700">
            {canPollLive ? "Live status feed configured" : "Live status feed unavailable"}
          </span>
        </div>
      </div>

      {msg ? (
        <div
          className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium ${
            msg.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-900"
              : msg.type === "error"
                ? "bg-rose-50 border border-rose-200 text-rose-900"
                : "bg-sky-50 border border-sky-200 text-sky-900"
          }`}
          role="status"
        >
          <span>{msg.text}</span>
          <button type="button" onClick={() => setMsg(null)} className="text-xs opacity-60 hover:opacity-100">
            Dismiss
          </button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner label="Loading your trips…" />
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-8 text-center">
          <p className="text-base font-semibold text-rose-900">Could not load your journeys</p>
          <p className="mt-1 text-sm text-rose-700">This is an error loading watches you own — not a flight status.</p>
          <Button size="sm" variant="secondary" onClick={() => refetch()} className="mt-4">
            Try again
          </Button>
        </div>
      ) : empty ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/70 p-10 sm:p-16 text-center">
          <h3 className="text-xl font-bold tracking-tight text-slate-900 font-[var(--font-sora)]">
            No monitored journeys
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
            Ticketed or active bookings you own appear here. Quoted carts and other travellers’ trips
            do not.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/chat">
              <Button size="md">Ask Ava</Button>
            </Link>
            <Link href="/vault">
              <Button size="md" variant="secondary">
                Travel vault
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          {inProgress.length > 0 ? (
            <section className="space-y-4">
              <h2 className="text-lg font-bold tracking-tight text-slate-900 font-[var(--font-sora)]">
                Active now ({inProgress.length})
              </h2>
              {inProgress.map(renderWatchCard)}
            </section>
          ) : null}
          {upcoming.length > 0 ? (
            <section className="space-y-4">
              <h2 className="text-lg font-bold tracking-tight text-slate-900 font-[var(--font-sora)]">
                Upcoming ({upcoming.length})
              </h2>
              {upcoming.map(renderWatchCard)}
            </section>
          ) : null}
          {completed.length > 0 ? (
            <section className="space-y-4 pt-4 border-t border-slate-200/80">
              <h2 className="text-lg font-bold tracking-tight text-slate-900 font-[var(--font-sora)]">
                Completed ({completed.length})
              </h2>
              {completed.map(renderWatchCard)}
            </section>
          ) : null}
          {data && data.total > 20 ? (
            <div className="flex justify-center gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Previous
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={page * 20 >= data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
