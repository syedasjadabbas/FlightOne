"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  DoorOpen,
  LifeBuoy,
  Plane,
  RefreshCw,
  Search,
  Sparkles,
  Ticket,
} from "lucide-react";
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

export function JourneyWatchCard({
  watch: w,
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
  const flightLeg = (w.itinerary || []).find((i) => i.kind === "FLIGHT");
  const origin = flightLeg?.origin || null;
  const destination = flightLeg?.destination || null;
  const events = w.events || [];
  const disruptions = w.disruptions || [];
  const flightLabel = w.flightNumber || w.booking?.product || "Flight Itinerary";
  const completed = w.status === "COMPLETED" || w.phase === "COMPLETED";

  return (
    <article className="fo-journey__watch">
      {/* ── Card Header ────────────────────────────────────────────── */}
      <header className="fo-journey__watch-head">
        <div className="fo-journey__watch-identity">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky/10 text-sky">
              <Plane size={15} strokeWidth={2.2} />
            </span>
            <p className="fo-journey__flight">{flightLabel}</p>
          </div>
          <TravellerChip tone={phaseChipTone(w.phase)}>
            {phaseLabel(w.phase, w.status)}
          </TravellerChip>
        </div>

        <div className="fo-journey__watch-status">
          {snap?.status ? (
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
      </header>

      {/* ── Route Arc Banner (Big IATA Codes) ──────────────────────── */}
      <div className="fo-journey__route" aria-label="Flight Route">
        <div className="fo-journey__endpoint">
          <p className="fo-journey__iata">{origin || "DEP"}</p>
          <p className="fo-journey__when">{formatTime(w.departAt)}</p>
          <p className="fo-journey__day">{formatDate(w.departAt)}</p>
        </div>

        <div className="fo-journey__route-mid" aria-hidden="true">
          <span className="fo-journey__route-line" />
          <span className="fo-journey__route-plane">
            <Plane size={14} strokeWidth={2.2} className="rotate-90" />
          </span>
          <span className="fo-journey__route-line" />
        </div>

        <div className="fo-journey__endpoint fo-journey__endpoint--arrive">
          <p className="fo-journey__iata">{destination || "ARR"}</p>
          <p className="fo-journey__when">{formatTime(w.arriveAt)}</p>
          <p className="fo-journey__day">{formatDate(w.arriveAt)}</p>
        </div>
      </div>

      {!live?.confirmed ? (
        <p className="fo-journey__muted">
          {live?.reason ||
            "Live delays, gates, and cancellations are verified automatically via real-time satellite telemetry."}
        </p>
      ) : null}

      {/* ── Itinerary Section ───────────────────────────────────────── */}
      <div className="fo-journey__block">
        <h3 className="fo-journey__block-title">
          <Plane size={12} strokeWidth={2.2} className="text-sky" />
          <span>Flight &amp; Stay Itinerary</span>
        </h3>
        <JourneyItinerary items={w.itinerary || []} />
      </div>

      {/* ── Disruptions Notice ──────────────────────────────────────── */}
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

      {/* ── Timeline Section ────────────────────────────────────────── */}
      <div className="fo-journey__block">
        <h3 className="fo-journey__block-title">
          <Clock size={12} strokeWidth={2.2} className="text-sky" />
          <span>Live Telemetry &amp; Gate Timeline</span>
        </h3>
        <JourneyTimeline events={events} />
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
          <Button
            size="sm"
            variant="secondary"
            disabled={(isPolling && busy) || completed}
            onClick={onPoll}
            icon={<RefreshCw size={13} strokeWidth={2} className={isPolling && busy ? "animate-spin" : ""} />}
          >
            {isPolling && busy ? "Polling Radar…" : "Refresh Radar"}
          </Button>
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

      {/* ── Alternatives Drawer ─────────────────────────────────────── */}
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
    </article>
  );
}
