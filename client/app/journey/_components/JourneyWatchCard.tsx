"use client";

import Link from "next/link";
import {
  ArrowRight,
  DoorOpen,
  LifeBuoy,
  RefreshCw,
  Search,
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
  const flightLabel = w.flightNumber || w.booking?.product || "Itinerary";
  const completed = w.status === "COMPLETED" || w.phase === "COMPLETED";

  return (
    <article className="fo-journey__watch">
      <header className="fo-journey__watch-head">
        <div className="fo-journey__watch-identity">
          <p className="fo-journey__flight">{flightLabel}</p>
          <TravellerChip tone={phaseChipTone(w.phase)}>
            {phaseLabel(w.phase, w.status)}
          </TravellerChip>
        </div>
        <div className="fo-journey__watch-status">
          {snap?.status ? (
            <span className="fo-journey__fact">
              Verified {String(snap.status)}
              {snap.minutesDelayed ? ` · +${snap.minutesDelayed}m` : ""}
            </span>
          ) : (
            <span className="fo-journey__fact fo-journey__fact--muted">
              Live status {live?.dataStatus || "unavailable"}
            </span>
          )}
          {snap?.gate ? (
            <span className="fo-journey__fact">
              <DoorOpen size={12} strokeWidth={2} aria-hidden="true" />
              Gate {String(snap.gate)}
            </span>
          ) : null}
          {snap?.terminal ? (
            <span className="fo-journey__fact fo-journey__fact--muted">
              Terminal {String(snap.terminal)}
            </span>
          ) : null}
        </div>
      </header>

      <div className="fo-journey__route" aria-label="Route">
        <div className="fo-journey__endpoint">
          <p className="fo-journey__iata">{origin || "—"}</p>
          <p className="fo-journey__when">{formatTime(w.departAt)}</p>
          <p className="fo-journey__day">{formatDate(w.departAt)}</p>
        </div>
        <div className="fo-journey__route-mid" aria-hidden="true">
          <span className="fo-journey__route-line" />
          <ArrowRight size={14} strokeWidth={1.75} className="fo-journey__route-arrow" />
          <span className="fo-journey__route-line" />
        </div>
        <div className="fo-journey__endpoint fo-journey__endpoint--arrive">
          <p className="fo-journey__iata">{destination || "—"}</p>
          <p className="fo-journey__when">{formatTime(w.arriveAt)}</p>
          <p className="fo-journey__day">{formatDate(w.arriveAt)}</p>
        </div>
      </div>

      {!live?.confirmed ? (
        <p className="fo-journey__muted">
          {live?.reason ||
            "Live delays, gates, and cancellations appear only after a verified provider poll."}
        </p>
      ) : null}

      <div className="fo-journey__block">
        <h3 className="fo-journey__block-title">Itinerary</h3>
        <JourneyItinerary items={w.itinerary || []} />
      </div>

      {disruptions.length > 0 ? (
        <div className="fo-journey__block fo-journey__block--warn">
          <h3 className="fo-journey__block-title">Recorded disruptions</h3>
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
        <h3 className="fo-journey__block-title">Timeline</h3>
        <JourneyTimeline events={events} />
      </div>

      <footer className="fo-journey__watch-foot">
        <div className="fo-journey__booking-meta">
          <p>
            Booking{" "}
            <Link href={`/checkout/${w.bookingId}`} className="fo-journey__booking-link">
              {w.booking?.ticketRef || w.bookingId}
            </Link>
            {w.booking?.status ? ` · ${w.booking.status}` : ""}
          </p>
          <p>Last poll · {w.lastPolledAt ? formatDateTime(w.lastPolledAt) : "Not polled yet"}</p>
        </div>

        <div className="fo-journey__actions">
          <Button
            size="sm"
            variant="secondary"
            disabled={(isPolling && busy) || completed}
            onClick={onPoll}
            icon={<RefreshCw size={13} strokeWidth={2} aria-hidden="true" />}
          >
            {isPolling && busy ? "Polling…" : "Refresh status"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={isLoadingAlts && busy}
            onClick={onFindAlternatives}
            icon={<Search size={13} strokeWidth={2} aria-hidden="true" />}
          >
            {isLoadingAlts && busy ? "Searching…" : "Find alternatives"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={isEscalating && busy}
            onClick={onEscalate}
            icon={<LifeBuoy size={13} strokeWidth={2} aria-hidden="true" />}
          >
            {isEscalating && busy ? "Sending…" : "Request assistance"}
          </Button>
          <Link href={`/refunds?bookingId=${encodeURIComponent(w.bookingId)}`}>
            <Button size="sm" variant="ghost">
              Refund / cancel
            </Button>
          </Link>
          <Link href={`/checkout/${w.bookingId}`}>
            <Button
              size="sm"
              variant="ghost"
              icon={<Ticket size={13} strokeWidth={2} aria-hidden="true" />}
            >
              Booking
            </Button>
          </Link>
        </div>
      </footer>

      {alternatives ? (
        <div className="fo-journey__alts">
          <h3 className="fo-journey__block-title">Alternative inventory</h3>
          <p className="fo-journey__muted">
            {alternatives.note ||
              alternatives.reason ||
              "Selecting an option prepares a quote. It does not ticket or charge."}
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
                      variant="secondary"
                      disabled={isRebooking}
                      onClick={() => onPrepareQuote(snapId)}
                    >
                      Prepare quote
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="fo-journey__muted">No alternative offers returned.</p>
          )}
        </div>
      ) : null}
    </article>
  );
}
