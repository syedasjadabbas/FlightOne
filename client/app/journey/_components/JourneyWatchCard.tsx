"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  DoorOpen,
  Hotel,
  LifeBuoy,
  Plane,
  RefreshCw,
  Search,
  Sparkles,
  Ticket,
} from "lucide-react";
import { airlineDisplayName } from "@/lib/consultant/airlines";
import { iataToPlace } from "@/lib/inventory/places";
import { formatMinor } from "@/lib/bookings/checkoutDisplay";
import { formatTicketDate } from "@/lib/bookings/ticketDocument";
import { Button } from "@/components/ui";
import { TravellerChip } from "@/app/components/traveller";
import type { JourneyWatch } from "@/lib/api/journey.api";
import { JourneyItinerary } from "./JourneyItinerary";
import { JourneyTimeline } from "./JourneyTimeline";
import {
  formatDate,
  formatDateTime,
  formatTime,
  phaseChipTone,
  phaseLabel,
} from "./journeyFormat";

export type JourneyAlts = {
  offers?: Array<{ supplierOfferSnapshotId?: string }>;
  note?: string;
  reason?: string;
};

export type JourneyWatchCardProps = {
  watch: JourneyWatch;
  isExpanded: boolean;
  onToggleExpand: () => void;
  busy: boolean;
  isPolling: boolean;
  isLoadingAlts: boolean;
  isEscalating: boolean;
  isRebooking: boolean;
  alternatives?: JourneyAlts;
  onPoll: () => void;
  onFindAlternatives: () => void;
  onEscalate: () => void;
  onPrepareQuote: (supplierOfferSnapshotId: string) => void;
};

function cabinFact(cabin: string): string {
  const c = cabin.toLowerCase();
  if (c.includes("business")) return "Business";
  if (c.includes("prem")) return "Premium Economy";
  if (c.includes("first")) return "First";
  return "Economy";
}

export function JourneyWatchCard({
  watch: w,
  isExpanded,
  onToggleExpand,
  busy,
  isPolling,
  isLoadingAlts,
  isEscalating,
  isRebooking,
  alternatives,
  onPoll,
  onFindAlternatives,
  onEscalate,
  onPrepareQuote,
}: JourneyWatchCardProps) {
  const live = w.liveFlight;
  const snap = live?.confirmed ? live.snapshot : null;
  const itinerary = w.itinerary || [];
  const summary = w.summary;
  const flights = itinerary.filter((i) => i.kind === "FLIGHT");
  const stay = itinerary.find((i) => i.kind === "HOTEL") ?? null;
  // A hotel-only booking has no flight to track: no radar, no DEP/ARR banner.
  const isStay = flights.length === 0 && stay != null;
  const firstFlight = flights[0];
  const lastFlight = flights[flights.length - 1];
  const origin = firstFlight?.origin || null;
  const destination =
    summary?.tripType === "round_trip" ? firstFlight?.destination : lastFlight?.destination || null;
  const events = w.events || [];
  const disruptions = w.disruptions || [];
  const completed = w.status === "COMPLETED" || w.phase === "COMPLETED";

  const headline = isStay
    ? stay?.hotelName || "Hotel stay"
    : summary?.tripType === "multi_city"
      ? `Multi-city · ${flights.length} flights`
      : w.flightNumber || firstFlight?.flightNumber || "Flight";
  const carrierName = summary?.carrier ? airlineDisplayName(summary.carrier) : null;

  // Airport-local times from the ticketed sectors beat the watch instants
  const departTime = firstFlight?.departTimeLocal ?? formatTime(w.departAt);
  const departDay = firstFlight?.departDate
    ? formatTicketDate(firstFlight.departDate)
    : formatDate(w.departAt);
  const arriveLeg = summary?.tripType === "round_trip" ? firstFlight : lastFlight;
  const arriveTime = arriveLeg?.arriveTimeLocal ?? formatTime(w.arriveAt);
  const arriveDay = arriveLeg?.arriveDate
    ? formatTicketDate(arriveLeg.arriveDate)
    : formatDate(w.arriveAt);

  const tripTypeLabel: Record<string, string> = {
    one_way: "One way",
    round_trip: "Round trip",
    multi_city: "Multi-city",
    stay: "Hotel stay",
  };
  const facts = [
    summary?.tripType ? tripTypeLabel[summary.tripType] : null,
    summary?.cabin ? cabinFact(summary.cabin) : null,
    summary?.amountMinor != null && summary.currency
      ? `Paid ${formatMinor(summary.amountMinor, summary.currency)}`
      : null,
  ].filter((f): f is string => Boolean(f));

  // ── Compact Summary Card (Collapsed State) ─────────────────────────
  if (!isExpanded) {
    return (
      <article className="fo-journey__compact-card">
        <div className="fo-journey__compact-main">
          {/* Top Line: Airline/Headline, Carrier, Status chip, Radar pill */}
          <div className="fo-journey__compact-top">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sky/10 text-sky">
                {isStay ? <Hotel size={13} strokeWidth={2.2} /> : <Plane size={13} strokeWidth={2.2} />}
              </span>
              <p className="fo-journey__compact-headline">{headline}</p>
              {carrierName && !isStay ? (
                <span className="fo-journey__carrier text-xs">{carrierName}</span>
              ) : null}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <TravellerChip tone={phaseChipTone(w.phase)}>
                {phaseLabel(w.phase, w.status)}
              </TravellerChip>
              {isStay ? null : snap?.status ? (
                <span className="fo-journey__fact fo-journey__fact--live text-xs">
                  <CheckCircle2 size={11} strokeWidth={2.2} />
                  Verified {String(snap.status)}
                </span>
              ) : (
                <span className="fo-journey__fact fo-journey__fact--muted text-xs">
                  {live?.dataStatus || "Standby"}
                </span>
              )}
            </div>
          </div>

          {/* Middle Line: Route + Times + Date */}
          <div className="fo-journey__compact-route-row">
            <div className="fo-journey__compact-route">
              {isStay && stay ? (
                <span>
                  {stay.cityCode || stay.city || "Stay"} ({stay.nights ? `${stay.nights}N` : "Stay"}) · {stay.checkInDate ? formatTicketDate(stay.checkInDate.slice(0, 10)) : ""}
                </span>
              ) : (
                <>
                  <span className="font-bold text-navy">
                    {summary?.tripType === "multi_city" && summary.stops.length > 2
                      ? summary.stops.join(" → ")
                      : `${origin || "—"} → ${destination || "—"}`}
                  </span>
                  <span className="text-ink-faint">·</span>
                  <span className="font-semibold text-sky-solid tabular-nums">
                    {departTime} → {arriveTime}
                  </span>
                  <span className="text-ink-faint">·</span>
                  <span className="text-ink-soft text-xs">{departDay}</span>
                </>
              )}
            </div>

            {/* Badges + Booking Ref */}
            <div className="fo-journey__compact-meta">
              {facts.slice(0, 2).map((f) => (
                <span key={f} className="fo-journey__fact-pill text-xs">
                  {f}
                </span>
              ))}
              <span className="fo-journey__compact-ref">
                Booking{" "}
                <Link href={`/checkout/${w.bookingId}`} className="fo-journey__booking-link">
                  {w.booking?.ticketRef || w.bookingId}
                </Link>
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="fo-journey__compact-actions">
          <Button
            size="sm"
            variant="secondary"
            className="h-8 text-xs font-semibold px-3"
            onClick={onToggleExpand}
            icon={<ChevronDown size={14} strokeWidth={2.2} />}
          >
            View Details
          </Button>
          <Link href={`/checkout/${w.bookingId}`}>
            <Button size="sm" variant="ghost" className="h-8 text-xs px-2.5" icon={<Ticket size={13} strokeWidth={2} />}>
              Ticket
            </Button>
          </Link>
        </div>
      </article>
    );
  }

  // ── Full Detailed Card (Expanded State) ─────────────────────────────
  return (
    <article className="fo-journey__watch fo-journey__watch--expanded">
      {/* ── Card Header ────────────────────────────────────────────── */}
      <header className="fo-journey__watch-head">
        <div className="fo-journey__watch-identity">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky/10 text-sky">
              {isStay ? <Hotel size={15} strokeWidth={2.2} /> : <Plane size={15} strokeWidth={2.2} />}
            </span>
            <p className="fo-journey__flight">{headline}</p>
            {carrierName && !isStay ? (
              <span className="fo-journey__carrier">{carrierName}</span>
            ) : null}
          </div>
          <TravellerChip tone={phaseChipTone(w.phase)}>
            {phaseLabel(w.phase, w.status)}
          </TravellerChip>
        </div>

        <div className="flex items-center gap-2">
          <div className="fo-journey__watch-status">
            {isStay ? null : snap?.status ? (
              <span className="fo-journey__fact fo-journey__fact--live">
                <CheckCircle2 size={12} strokeWidth={2.2} />
                Verified {String(snap.status)}
                {snap.minutesDelayed ? (
                  <span className="font-bold text-amber-700">· +{snap.minutesDelayed}m delay</span>
                ) : (
                  <span className="text-emerald font-semibold">· On Time</span>
                )}
              </span>
            ) : (
              <span className="fo-journey__fact fo-journey__fact--muted">
                Live status: {live?.dataStatus || "radar standby"}
              </span>
            )}

            {snap?.gate ? (
              <span className="fo-journey__fact">
                <DoorOpen size={12} strokeWidth={2.2} className="text-sky" />
                <span>Gate {String(snap.gate)}</span>
              </span>
            ) : null}

            {snap?.terminal ? (
              <span className="fo-journey__fact fo-journey__fact--muted">
                Terminal {String(snap.terminal)}
              </span>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onToggleExpand}
            className="fo-journey__close-btn"
            title="Collapse journey details"
          >
            <span>Hide Details</span>
            <ChevronDown size={14} strokeWidth={2.2} className="rotate-180" />
          </button>
        </div>
      </header>

      {/* ── Route / stay banner ─────────────────────────────────────── */}
      {isStay && stay ? (
        <div className="fo-journey__route" aria-label="Stay">
          <div className="fo-journey__endpoint">
            <div className="flex items-baseline gap-2">
              <span className="fo-journey__iata">{stay.cityCode || stay.city || "Stay"}</span>
              <span className="fo-journey__when">Check-in</span>
            </div>
            <p className="fo-journey__day">
              {stay.checkInDate ? formatTicketDate(stay.checkInDate.slice(0, 10)) : "—"}
            </p>
          </div>
          <div className="fo-journey__route-mid" aria-hidden="true">
            <span className="fo-journey__route-line" />
            <span className="fo-journey__route-plane">
              <Hotel size={13} strokeWidth={2.2} />
            </span>
            <span className="fo-journey__route-line" />
          </div>
          <div className="fo-journey__endpoint fo-journey__endpoint--arrive">
            <div className="flex items-baseline justify-end gap-2">
              <span className="fo-journey__when">Check-out</span>
              <span className="fo-journey__iata">
                {typeof stay.nights === "number" ? `${stay.nights}N` : "—"}
              </span>
            </div>
            <p className="fo-journey__day">
              {stay.checkOutDate ? formatTicketDate(stay.checkOutDate.slice(0, 10)) : "—"}
            </p>
          </div>
        </div>
      ) : (
        <div className="fo-journey__route" aria-label="Flight route">
          <div className="fo-journey__endpoint">
            <div className="flex items-baseline gap-2">
              <span className="fo-journey__iata">{origin || "—"}</span>
              <span className="fo-journey__when">{departTime}</span>
            </div>
            <p className="fo-journey__day">
              {[origin ? iataToPlace(origin) : null, departDay].filter(Boolean).join(" · ")}
            </p>
          </div>

          <div className="fo-journey__route-mid" aria-hidden="true">
            <span className="fo-journey__route-line" />
            <span className="fo-journey__route-plane">
              <Plane size={13} strokeWidth={2.2} className="rotate-90" />
            </span>
            <span className="fo-journey__route-line" />
          </div>

          <div className="fo-journey__endpoint fo-journey__endpoint--arrive">
            <div className="flex items-baseline justify-end gap-2">
              <span className="fo-journey__when">{arriveTime}</span>
              <span className="fo-journey__iata">{destination || "—"}</span>
            </div>
            <p className="fo-journey__day">
              {[destination ? iataToPlace(destination) : null, arriveDay]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
      )}

      {/* ── Compact Summary Bar (Route Chain + Key Facts) ─────────── */}
      <div className="fo-journey__summary-bar">
        {summary?.tripType === "multi_city" && summary.stops.length > 2 ? (
          <span className="fo-journey__route-chain">
            <strong>Route:</strong> {summary.stops.join(" → ")}
          </span>
        ) : null}
        {facts.map((f) => (
          <span key={f} className="fo-journey__fact-pill">
            {f}
          </span>
        ))}
        {!isStay && !live?.confirmed && live?.reason ? (
          <span className="fo-journey__notice-pill">{live.reason}</span>
        ) : null}
      </div>

      {/* ── Collapsible Details (Split 2-Column Grid on Desktop) ─────── */}
      <div className="fo-journey__details-grid">
        {/* Left Column: Itinerary */}
        <div className="fo-journey__details-col">
          <div className="fo-journey__block">
            <h3 className="fo-journey__block-title">
              {isStay ? (
                <Hotel size={12} strokeWidth={2.2} className="text-sky" />
              ) : (
                <Plane size={12} strokeWidth={2.2} className="text-sky" />
              )}
              <span>{isStay ? "Stay details" : "Flight itinerary"}</span>
            </h3>
            <JourneyItinerary items={itinerary} />
          </div>
        </div>

        {/* Right Column: Disruptions, Live Timeline & Rebooking Alts */}
        <div className="fo-journey__details-col">
          {disruptions.length > 0 ? (
            <div className="fo-journey__block fo-journey__block--warn">
              <h3 className="fo-journey__block-title">
                <AlertTriangle size={12} strokeWidth={2.2} className="text-amber-600" />
                <span>Recorded Flight Disruptions</span>
              </h3>
              <ul className="fo-journey__disruptions">
                {disruptions.map((ev) => (
                  <li key={ev.id}>
                    <span>{ev.title}</span>
                    <span className="fo-journey__day">{formatDate(ev.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="fo-journey__block">
            <h3 className="fo-journey__block-title">
              <Clock size={12} strokeWidth={2.2} className="text-sky" />
              <span>{isStay ? "Stay updates" : "Live Telemetry & Gate Timeline"}</span>
            </h3>
            <JourneyTimeline events={events} />
          </div>

          {/* Alternatives Drawer */}
          {alternatives ? (
            <div className="fo-journey__alts">
              <h3 className="fo-journey__block-title">
                <Sparkles size={12} strokeWidth={2.2} className="text-sky" />
                <span>AI Rebooking &amp; Alternative Inventory</span>
              </h3>
              <p className="fo-journey__muted">
                {alternatives.note ||
                  alternatives.reason ||
                  "Selecting an alternative option prepares a guaranteed quote. No charges apply until confirmed."}
              </p>
              {(alternatives.offers || []).length ? (
                <ul className="fo-journey__alt-list">
                  {(alternatives.offers || []).slice(0, 3).map((offer, idx) => {
                    const snapId = offer.supplierOfferSnapshotId;
                    if (!snapId) return null;
                    return (
                      <li key={snapId} className="fo-journey__alt">
                        <span className="fo-journey__alt-label">Option {idx + 1}</span>
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={isRebooking}
                          onClick={() => onPrepareQuote(snapId)}
                        >
                          Prepare Quote
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="fo-journey__muted">No alternate flights match the route right now.</p>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Action Footer ───────────────────────────────────────────── */}
      <footer className="fo-journey__watch-foot">
        <div className="fo-journey__booking-meta">
          <p>
            Booking{" "}
            <Link href={`/checkout/${w.bookingId}`} className="fo-journey__booking-link">
              {w.booking?.ticketRef || w.bookingId}
            </Link>
            {w.booking?.status ? ` · ${w.booking.status}` : ""}
          </p>
          <p>Last radar poll · {w.lastPolledAt ? formatDateTime(w.lastPolledAt) : "Awaiting first poll"}</p>
        </div>

        <div className="fo-journey__actions">
          {isStay ? null : (
            <Button
              size="sm"
              variant="secondary"
              disabled={(isPolling && busy) || completed}
              onClick={onPoll}
              icon={<RefreshCw size={13} strokeWidth={2} className={isPolling && busy ? "animate-spin" : ""} />}
            >
              {isPolling && busy ? "Polling Radar…" : "Refresh Radar"}
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            disabled={isLoadingAlts && busy}
            onClick={onFindAlternatives}
            icon={<Search size={13} strokeWidth={2} />}
          >
            {isLoadingAlts && busy ? "Searching…" : "Find Alternatives"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={isEscalating && busy}
            onClick={onEscalate}
            icon={<LifeBuoy size={13} strokeWidth={2} />}
          >
            {isEscalating && busy ? "Connecting…" : "Disruption Assist"}
          </Button>
          <Link href={`/refunds?bookingId=${encodeURIComponent(w.bookingId)}`}>
            <Button size="sm" variant="ghost">
              Refund / Cancel
            </Button>
          </Link>
          <Link href={`/checkout/${w.bookingId}`}>
            <Button
              size="sm"
              variant="ghost"
              icon={<Ticket size={13} strokeWidth={2} />}
            >
              Ticket
            </Button>
          </Link>
        </div>
      </footer>
    </article>
  );
}


