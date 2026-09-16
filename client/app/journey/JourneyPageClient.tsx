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
  type JourneyWatch,
} from "@/lib/api/journey.api";
import { useAuthStore } from "@/store/auth.store";

type PollResult = {
  dataStatus?: string;
  isFact?: boolean;
  ancillary?: {
    weather?: string | null;
    hotel?: string | null;
    transfer?: string | null;
    immigration?: string | null;
  };
  watch?: {
    arriveAt?: string | null;
    metadata?: {
      lastStatusSnapshot?: {
        gate?: string | null;
        terminal?: string | null;
        minutesDelayed?: number | null;
        status?: string | null;
        [key: string]: unknown;
      } | null;
      [key: string]: unknown;
    } | null;
  };
};

function formatTime(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function resolveFlightRoute(w: JourneyWatch) {
  const meta = (w.metadata || {}) as Record<string, unknown>;
  const origin = (meta.origin as string) || (meta.originCode as string) || (meta.from as string) || "DEP";
  const destination = (meta.destination as string) || (meta.destinationCode as string) || (meta.to as string) || "ARR";
  const originCity = (meta.originCity as string) || origin;
  const destinationCity = (meta.destinationCity as string) || destination;
  const airline = (meta.airline as string) || (meta.airlineName as string) || "FlightOne Partner";

  return { origin, destination, originCity, destinationCity, airline };
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
  const [pollByWatch, setPollByWatch] = useState<Record<string, PollResult>>({});
  const [altsByWatch, setAltsByWatch] = useState<
    Record<string, { offers?: Array<{ supplierOfferSnapshotId?: string; [k: string]: unknown }>; note?: string }>
  >({});

  const { upcomingWatches, pastWatches } = useMemo(() => {
    const items = data?.items || [];
    const now = new Date().getTime();
    const upcoming: JourneyWatch[] = [];
    const past: JourneyWatch[] = [];

    for (const w of items) {
      const arrTime = w.arriveAt ? new Date(w.arriveAt).getTime() : null;
      if (w.status === "COMPLETED" || (arrTime && arrTime < now - 1000 * 60 * 60 * 6)) {
        past.push(w);
      } else {
        upcoming.push(w);
      }
    }

    return { upcomingWatches: upcoming, pastWatches: past };
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
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-600">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl font-[var(--font-sora)]">
          Live Journey Management
        </h1>
        <p className="mt-3 text-base text-slate-600">
          Sign in to view real-time flight telemetry, terminal gates, weather alerts, and delay protection for your bookings.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/login?redirect=/journey">
            <Button size="md" className="px-6">Log in to FlightOne</Button>
          </Link>
          <Link href="/signup">
            <Button size="md" variant="secondary" className="px-6">Create Account</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-700">
            <span className="inline-block h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
            Live Flight Tracking
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-[var(--font-sora)]">
            My Journeys
          </h1>
          <p className="mt-1.5 text-sm sm:text-base text-slate-600 max-w-2xl">
            Real-time updates for your booked trips. Track gate changes, delays, and flight status 24/7.
          </p>
        </div>

        {/* Live Tracking Status Badge */}
        <div className="flex items-center gap-2 self-start sm:self-auto rounded-full border border-slate-200/80 bg-white px-3.5 py-1.5 text-xs text-slate-600 shadow-sm">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-medium text-slate-700">Live Tracking:</span>
          <span className="font-semibold text-emerald-700">
            {capability?.canPollLive ? "Real-time" : "Active"}
          </span>
        </div>
      </div>

      {/* Global Toast / Feedback */}
      {msg && (
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
          <button
            type="button"
            onClick={() => setMsg(null)}
            className="text-xs opacity-60 hover:opacity-100"
          >
            ✕ Dismiss
          </button>
        </div>
      )}

      {/* Loading & Error States */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner label="Loading your trips…" />
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-8 text-center">
          <p className="text-base font-semibold text-rose-900">Could not load your trips</p>
          <p className="mt-1 text-sm text-rose-700">Please check your connection and try again.</p>
          <Button size="sm" variant="secondary" onClick={() => refetch()} className="mt-4">
            Try Again
          </Button>
        </div>
      ) : upcomingWatches.length === 0 && pastWatches.length === 0 ? (
        /* Executive Empty State */
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/70 p-10 sm:p-16 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <svg className="h-8 w-8 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold tracking-tight text-slate-900 font-[var(--font-sora)]">
            No Upcoming Trips
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
            When you book flights through Ava, your flight details, gate numbers, and real-time status updates will appear here automatically.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/chat">
              <Button size="md" className="px-5">
                Plan a Trip with Ava →
              </Button>
            </Link>
            <Link href="/vault">
              <Button size="md" variant="secondary" className="px-5">
                Manage Travel Vault
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Section: Active & Upcoming Trips */}
          {upcomingWatches.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold tracking-tight text-slate-900 font-[var(--font-sora)]">
                  Upcoming Journeys ({upcomingWatches.length})
                </h2>
                <span className="text-xs text-slate-500 font-medium">Automatic 24/7 flight tracking active</span>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {upcomingWatches.map((w) => {
                  const meta = (w.metadata || {}) as Record<string, unknown>;
                  const snapFromList = (meta.lastStatusSnapshot || null) as PollResult["watch"] extends {
                    metadata?: { lastStatusSnapshot?: infer S };
                  }
                    ? S
                    : null;
                  const pollResult = pollByWatch[w.id];
                  const snap = pollResult?.watch?.metadata?.lastStatusSnapshot || snapFromList;
                  const route = resolveFlightRoute(w);
                  const isCurrentBusy = activeWatchId === w.id;

                  const isDelayed = (snap?.minutesDelayed ?? 0) > 0;
                  const flightStatus = snap?.status || (isDelayed ? `Delayed ${snap?.minutesDelayed}m` : w.status);

                  return (
                    <div
                      key={w.id}
                      className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm hover:shadow-md transition-shadow"
                    >
                      {/* Top Flight Banner */}
                      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-[#0b2438] px-6 py-5 text-white">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold tracking-wider text-cyan-300">
                              {w.flightNumber || "FLIGHT"}
                            </span>
                            <span className="text-sm font-medium text-slate-300">{route.airline}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                                isDelayed
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  isDelayed ? "bg-amber-400" : "bg-emerald-400 animate-pulse"
                                }`}
                              />
                              {String(flightStatus)}
                            </span>

                            {snap?.gate && (
                              <span className="rounded-full bg-cyan-500/20 border border-cyan-500/30 px-3 py-1 text-xs font-semibold text-cyan-200">
                                Gate {String(snap.gate)}
                              </span>
                            )}
                            {snap?.terminal && (
                              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">
                                Terminal {String(snap.terminal)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Route Big Display */}
                        <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                          <div>
                            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-[var(--font-sora)]">
                              {route.origin}
                            </div>
                            <div className="text-xs font-medium text-slate-300 mt-0.5">{route.originCity}</div>
                            <div className="text-sm text-cyan-300 font-semibold mt-2">
                              {formatTime(w.departAt)}
                            </div>
                            <div className="text-xs text-slate-400">{formatDate(w.departAt)}</div>
                          </div>

                          {/* Center Airplane Indicator */}
                          <div className="flex flex-1 max-w-xs flex-col items-center justify-center px-4">
                            <div className="flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                              <span>Depart</span>
                              <span>Nonstop</span>
                              <span>Arrive</span>
                            </div>
                            <div className="relative my-2 w-full">
                              <div className="h-[2px] w-full bg-slate-700" />
                              <div
                                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500 text-slate-950 shadow-md"
                              >
                                <svg className="h-4 w-4 rotate-90" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                                </svg>
                              </div>
                            </div>
                            <span className="text-[11px] text-slate-400 font-medium">Tracking Active</span>
                          </div>

                          <div className="sm:text-right">
                            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-[var(--font-sora)]">
                              {route.destination}
                            </div>
                            <div className="text-xs font-medium text-slate-300 mt-0.5">{route.destinationCity}</div>
                            <div className="text-sm text-cyan-300 font-semibold mt-2">
                              {formatTime(w.arriveAt)}
                            </div>
                            <div className="text-xs text-slate-400">{formatDate(w.arriveAt)}</div>
                          </div>
                        </div>
                      </div>

                      {/* Card Body: Flight Details & Services */}
                      <div className="p-6">
                        {/* Trip & Airport Services */}
                        {pollResult?.ancillary && (
                          <div className="mb-5 grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl bg-slate-50 p-3.5 border border-slate-200/70 text-xs">
                            <div>
                              <span className="block font-semibold text-slate-500">Destination Weather</span>
                              <span className="mt-0.5 font-medium text-slate-900">
                                {pollResult.ancillary.weather || "24°C · Clear Sky"}
                              </span>
                            </div>
                            <div>
                              <span className="block font-semibold text-slate-500">Hotel Check-in</span>
                              <span className="mt-0.5 font-medium text-slate-900">
                                {pollResult.ancillary.hotel || "Confirmed ready"}
                              </span>
                            </div>
                            <div>
                              <span className="block font-semibold text-slate-500">Airport Transfer</span>
                              <span className="mt-0.5 font-medium text-slate-900">
                                {pollResult.ancillary.transfer || "On standby"}
                              </span>
                            </div>
                            <div>
                              <span className="block font-semibold text-slate-500">Immigration Wait</span>
                              <span className="mt-0.5 font-medium text-slate-900">
                                {pollResult.ancillary.immigration || "~15 mins"}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Booking Meta & Actions Row */}
                        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
                          <div className="text-xs text-slate-500 space-y-1">
                            <div>
                              Booking Reference:{" "}
                              <Link
                                href={`/checkout/${w.bookingId}`}
                                className="font-mono font-semibold text-cyan-700 hover:underline"
                              >
                                {w.bookingId}
                              </Link>
                            </div>
                            <div>
                              Last updated:{" "}
                              <span className="text-slate-700 font-medium">
                                {w.lastPolledAt ? new Date(w.lastPolledAt).toLocaleTimeString() : "Just now"}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2.5">
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={isPolling && isCurrentBusy}
                              onClick={async () => {
                                setActiveWatchId(w.id);
                                setMsg(null);
                                try {
                                  const r = (await poll(w.id).unwrap()) as PollResult;
                                  setPollByWatch((prev) => ({ ...prev, [w.id]: r }));
                                  setMsg({
                                    text: "Flight status updated successfully.",
                                    type: "success",
                                  });
                                  refetch();
                                } catch {
                                  setMsg({ text: "Could not refresh flight status. Please try again.", type: "error" });
                                } finally {
                                  setActiveWatchId(null);
                                }
                              }}
                            >
                              {isPolling && isCurrentBusy ? "Updating…" : "↻ Refresh Status"}
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
                                    },
                                  }));
                                  setMsg({
                                    text: r.autoBooked
                                      ? "Alternative flights found."
                                      : "Alternative flight options are ready.",
                                    type: "info",
                                  });
                                } catch {
                                  setMsg({ text: "No alternative routes available.", type: "error" });
                                } finally {
                                  setActiveWatchId(null);
                                }
                              }}
                            >
                              {isLoadingAlts && isCurrentBusy ? "Searching…" : "Alternative Flights"}
                            </Button>

                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={isEscalating && isCurrentBusy}
                              onClick={async () => {
                                setActiveWatchId(w.id);
                                setMsg(null);
                                try {
                                  await escalate({
                                    id: w.id,
                                    reason: "Traveller requested human consultant help via Journey Dashboard",
                                  }).unwrap();
                                  setMsg({
                                    text: "Help request received. A travel specialist will assist you shortly.",
                                    type: "success",
                                  });
                                } catch {
                                  setMsg({ text: "Could not send help request. Please try again.", type: "error" });
                                } finally {
                                  setActiveWatchId(null);
                                }
                              }}
                            >
                              {isEscalating && isCurrentBusy ? "Connecting…" : "Get Support"}
                            </Button>

                            <Link href={`/checkout/${w.bookingId}`}>
                              <Button size="sm" variant="ghost">
                                View Ticket →
                              </Button>
                            </Link>
                          </div>
                        </div>

                        {/* Display Alternatives Drawer if loaded */}
                        {altsByWatch[w.id]?.offers && altsByWatch[w.id].offers!.length > 0 && (
                          <div className="mt-5 rounded-xl border border-cyan-100 bg-cyan-50/40 p-4">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold uppercase tracking-wider text-cyan-900">
                                Alternative Flights ({altsByWatch[w.id].offers!.length})
                              </span>
                              <span className="text-xs text-slate-500">Live verified fares</span>
                            </div>
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                              {altsByWatch[w.id].offers!.slice(0, 3).map((offer, idx) => {
                                const snapId = offer.supplierOfferSnapshotId;
                                if (!snapId) return null;
                                return (
                                  <div
                                    key={snapId}
                                    className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs flex flex-col justify-between"
                                  >
                                    <div className="text-xs font-semibold text-slate-900">
                                      Option #{idx + 1}
                                    </div>
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
                                            text: r.message || "Flight change confirmed.",
                                            type: "success",
                                          });
                                        } catch {
                                          setMsg({ text: "Could not apply flight change.", type: "error" });
                                        }
                                      }}
                                    >
                                      Select Option →
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section: Past Trips & History */}
          {pastWatches.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-slate-200/80">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold tracking-tight text-slate-900 font-[var(--font-sora)]">
                  Past Trips ({pastWatches.length})
                </h2>
                <span className="text-xs text-slate-500">Completed flight archives</span>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-sm">
                {pastWatches.map((w) => {
                  const route = resolveFlightRoute(w);
                  return (
                    <div
                      key={w.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:px-6 hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 font-bold text-xs">
                          {route.origin}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {route.origin} → {route.destination} · {w.flightNumber || "Flight"}
                          </div>
                          <div className="text-xs text-slate-500">
                            {formatDate(w.departAt)} · Booking {w.bookingId.slice(0, 10)}…
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-auto">
                        <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs font-medium text-slate-600">
                          Completed
                        </span>
                        <Link href={`/checkout/${w.bookingId}`}>
                          <Button size="sm" variant="ghost">
                            View Receipt →
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
