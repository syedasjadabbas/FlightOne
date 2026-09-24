import { Car, Clock, Hotel, Plane } from "lucide-react";
import type { JourneyItineraryItem, JourneySegment } from "@/lib/api/journey.api";
import { airlineDisplayName } from "@/lib/consultant/airlines";
import { iataToPlace } from "@/lib/inventory/places";
import {
  formatDuration,
  formatFlightNumber,
  formatTicketDate,
} from "@/lib/bookings/ticketDocument";
import { formatDate, formatTime } from "./journeyFormat";

function legIcon(kind: string) {
  if (kind === "HOTEL") return Hotel;
  if (kind === "TRANSFER") return Car;
  return Plane;
}

function cabinText(cabin?: string | null): string | null {
  if (!cabin) return null;
  const c = cabin.toLowerCase();
  if (c.includes("business")) return "Business";
  if (c.includes("prem")) return "Premium Economy";
  if (c.includes("first")) return "First";
  return "Economy";
}

function SegmentRow({ segment, isLast }: { segment: JourneySegment; isLast: boolean }) {
  const layover = !isLast ? formatDuration(segment.layoverMinutesAfter) : null;
  const nextDay =
    segment.arriveDate && segment.departDate && segment.arriveDate !== segment.departDate;
  return (
    <li className="fo-journey__seg">
      <div className="fo-journey__seg-main">
        <div className="fo-journey__seg-left">
          <span className="fo-journey__seg-flight">
            {segment.carrier
              ? formatFlightNumber(segment.carrier, segment.flightNumber ?? "")
              : (segment.flightNumber ?? "—")}
          </span>
          <span className="fo-journey__seg-times tabular-nums">
            <strong>{segment.departTimeLocal ?? "—"}</strong> {segment.originCode}
            <span className="fo-journey__leg-sep" aria-hidden>
              →
            </span>
            <strong>{segment.arriveTimeLocal ?? "—"}</strong>
            {nextDay ? <sup className="fo-journey__seg-nextday">+1</sup> : null}{" "}
            {segment.destinationCode}
          </span>
        </div>
        <div className="fo-journey__seg-right">
          <span className="fo-journey__seg-meta">
            {[formatDuration(segment.durationMinutes), segment.aircraft].filter(Boolean).join(" · ")}
          </span>
        </div>
      </div>
      {layover ? (
        <div className="fo-journey__seg-layover">
          <Clock size={11} strokeWidth={2.2} className="text-amber-700 shrink-0" aria-hidden />
          <span>
            {layover} connection in {iataToPlace(segment.destinationCode)}
          </span>
        </div>
      ) : null}
    </li>
  );
}

function FlightLeg({ item }: { item: JourneyItineraryItem }) {
  const segments = item.segments ?? [];
  const facts = [
    formatTicketDate(item.departDate ?? null),
    formatDuration(item.durationMinutes),
    typeof item.stops === "number"
      ? item.stops === 0
        ? "Non-stop"
        : `${item.stops} stop${item.stops > 1 ? "s" : ""}`
      : null,
    cabinText(item.cabin),
    item.carrier ? airlineDisplayName(item.carrier) : null,
  ].filter(Boolean);

  return (
    <div className="fo-journey__leg-body">
      <div className="fo-journey__leg-head">
        {item.label ? <span className="fo-journey__leg-label">{item.label}</span> : null}
        <span className="fo-journey__leg-route">
          {item.origin || "—"} → {item.destination || "—"}
        </span>
        {item.origin && item.destination ? (
          <span className="fo-journey__leg-cities">
            {iataToPlace(item.origin)} to {iataToPlace(item.destination)}
          </span>
        ) : null}
      </div>
      {facts.length > 0 ? (
        <div className="fo-journey__leg-facts-row">
          {facts.map((fact, idx) => (
            <span key={idx} className="fo-journey__leg-fact-pill">
              {fact}
            </span>
          ))}
        </div>
      ) : null}
      {segments.length > 0 ? (
        <ol className="fo-journey__segs">
          {segments.map((s, i) => (
            <SegmentRow
              key={`${s.flightNumber}-${s.originCode}-${i}`}
              segment={s}
              isLast={i === segments.length - 1}
            />
          ))}
        </ol>
      ) : item.flightNumber || item.departTimeLocal ? (
        // No sector breakdown stored for this leg — show what is known on one
        // line rather than a sector row that would imply it is non-stop.
        <div className="fo-journey__seg-main">
          <div className="fo-journey__seg-left">
            <span className="fo-journey__seg-flight">{item.flightNumber ?? "—"}</span>
            <span className="fo-journey__seg-times tabular-nums">
              <strong>{item.departTimeLocal ?? "—"}</strong> {item.origin}
              <span className="fo-journey__leg-sep" aria-hidden>
                →
              </span>
              <strong>{item.arriveTimeLocal ?? "—"}</strong> {item.destination}
            </span>
          </div>
          <div className="fo-journey__seg-right">
            <span className="fo-journey__seg-meta">{formatDuration(item.durationMinutes) ?? ""}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HotelStay({ item }: { item: JourneyItineraryItem }) {
  const nights =
    typeof item.nights === "number" ? `${item.nights} night${item.nights === 1 ? "" : "s"}` : null;
  return (
    <div className="fo-journey__leg-body">
      <div className="fo-journey__leg-head">
        <span className="fo-journey__leg-route">{item.hotelName || "Hotel stay"}</span>
        {item.city ? <span className="fo-journey__leg-cities">{item.city}</span> : null}
      </div>
      <div className="fo-journey__leg-facts-row">
        {[
          item.checkInDate ? `Check-in ${formatTicketDate(item.checkInDate.slice(0, 10))}` : null,
          item.checkOutDate ? `Check-out ${formatTicketDate(item.checkOutDate.slice(0, 10))}` : null,
          nights,
        ]
          .filter((f): f is string => Boolean(f))
          .map((fact, idx) => (
            <span key={idx} className="fo-journey__leg-fact-pill">
              {fact}
            </span>
          ))}
      </div>
      {item.roomType || item.boardType || item.confirmationRef ? (
        <p className="fo-journey__leg-facts">
          {[item.roomType, item.boardType].filter(Boolean).join(" · ")}
          {item.confirmationRef ? (
            <span className="fo-journey__ref">ref {item.confirmationRef}</span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

function TransferLeg({ item }: { item: JourneyItineraryItem }) {
  return (
    <div className="fo-journey__leg-body">
      <div className="fo-journey__leg-head">
        <span className="fo-journey__leg-route">Transfer</span>
        {item.transferRef ? <span className="fo-journey__ref">{item.transferRef}</span> : null}
      </div>
      {item.pickupAt ? (
        <p className="fo-journey__leg-facts">
          Pickup {formatDate(item.pickupAt)} at {formatTime(item.pickupAt)}
        </p>
      ) : null}
    </div>
  );
}

export function JourneyItinerary({ items }: { items: JourneyItineraryItem[] }) {
  if (items.length === 0) {
    return <p className="fo-journey__muted">No attributed itinerary on this booking.</p>;
  }

  return (
    <ul className="fo-journey__legs" aria-label="Itinerary">
      {items.map((item, idx) => {
        const Icon = legIcon(item.kind);
        return (
          <li key={`${item.kind}-${idx}`} className="fo-journey__leg">
            <span className="fo-journey__leg-icon" aria-hidden="true">
              <Icon size={14} strokeWidth={2} />
            </span>
            {item.kind === "HOTEL" ? (
              <HotelStay item={item} />
            ) : item.kind === "TRANSFER" ? (
              <TransferLeg item={item} />
            ) : item.kind === "FLIGHT" ? (
              <FlightLeg item={item} />
            ) : (
              <span className="fo-journey__leg-text">{item.kind}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

