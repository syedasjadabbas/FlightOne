"use client";

import { Plane } from "lucide-react";
import { FLIGHTONE_BRAND } from "@/lib/content/flightone";
import { formatMinor } from "@/lib/bookings/checkoutDisplay";
import {
  formatDuration,
  formatFlightNumber,
  formatTicketDate,
  type TicketDocument,
  type TicketSegment,
} from "@/lib/bookings/ticketDocument";

function SegmentRow({ segment, isLast }: { segment: TicketSegment; isLast: boolean }) {
  const duration = formatDuration(segment.durationMinutes);
  const layover = formatDuration(segment.layoverMinutesAfter);
  const nextDay = segment.arrivalDate !== segment.departureDate;

  return (
    <li className="fo-ticket__sector">
      <div className="fo-ticket__sector-flight">
        <span className="fo-ticket__sector-code">
          {formatFlightNumber(segment.carrier, segment.flightNumber)}
        </span>
        {segment.bookingClass ? (
          <span className="fo-ticket__sector-class">Class {segment.bookingClass}</span>
        ) : null}
      </div>

      <div className="fo-ticket__sector-leg">
        <div className="fo-ticket__stop">
          <span className="fo-ticket__stop-time">{segment.departTimeLocal}</span>
          <span className="fo-ticket__stop-code">{segment.originCode}</span>
          <span className="fo-ticket__stop-date">{formatTicketDate(segment.departureDate)}</span>
        </div>

        <div className="fo-ticket__leg-mid" aria-hidden>
          <span className="fo-ticket__leg-line" />
          <Plane className="fo-ticket__leg-icon" />
          {duration ? <span className="fo-ticket__leg-duration">{duration}</span> : null}
        </div>

        <div className="fo-ticket__stop fo-ticket__stop--end">
          <span className="fo-ticket__stop-time">
            {segment.arriveTimeLocal}
            {nextDay ? <sup className="fo-ticket__nextday">+1</sup> : null}
          </span>
          <span className="fo-ticket__stop-code">{segment.destinationCode}</span>
          <span className="fo-ticket__stop-date">{formatTicketDate(segment.arrivalDate)}</span>
        </div>
      </div>

      {!isLast && layover ? (
        <p className="fo-ticket__layover">
          {layover} connection in {segment.destinationCode}
        </p>
      ) : null}
    </li>
  );
}

function Bound({ label, segments }: { label: string; segments: TicketSegment[] }) {
  if (segments.length === 0) return null;
  return (
    <section className="fo-ticket__bound">
      <h3 className="fo-ticket__bound-title">{label}</h3>
      <ol className="fo-ticket__sectors">
        {segments.map((s, i) => (
          <SegmentRow
            key={`${s.carrier}${s.flightNumber}-${s.departureDate}-${i}`}
            segment={s}
            isLast={i === segments.length - 1}
          />
        ))}
      </ol>
    </section>
  );
}

export function TicketDocumentView({ doc }: { doc: TicketDocument }) {
  const hasSectors = doc.segments.length > 0 || doc.returnSegments.length > 0;

  return (
    <article className="fo-ticket" aria-label="Electronic ticket">
      <header className="fo-ticket__head">
        <div className="fo-ticket__brand">
          <span className="fo-ticket__brand-mark" aria-hidden>
            <Plane className="h-4 w-4" />
          </span>
          <span>
            <span className="fo-ticket__brand-name">{FLIGHTONE_BRAND.shortName}</span>
            <span className="fo-ticket__brand-sub">Electronic ticket</span>
          </span>
        </div>
        <dl className="fo-ticket__refs">
          <div>
            <dt>PNR</dt>
            <dd>{doc.pnr ?? "—"}</dd>
          </div>
          {doc.ticketNumbers.length > 0 ? (
            <div>
              <dt>{doc.ticketNumbers.length > 1 ? "Tickets" : "Ticket"}</dt>
              <dd>{doc.ticketNumbers.join(", ")}</dd>
            </div>
          ) : null}
        </dl>
      </header>

      {doc.demo ? (
        <p className="fo-ticket__demo" role="note">
          Demonstration ticket — not valid for travel. No reservation was made with a carrier.
        </p>
      ) : null}

      <div className="fo-ticket__body">
        <dl className="fo-ticket__meta">
          <div>
            <dt>Passenger</dt>
            <dd>{doc.passengerName}</dd>
          </div>
          <div>
            <dt>Route</dt>
            <dd>
              {doc.originCode ?? "—"} → {doc.destinationCode ?? "—"}
            </dd>
          </div>
          <div>
            <dt>Departure</dt>
            <dd>{formatTicketDate(doc.departureDate) ?? "—"}</dd>
          </div>
          <div>
            <dt>Cabin</dt>
            <dd className="capitalize">{doc.cabin ?? "—"}</dd>
          </div>
        </dl>

        {hasSectors ? (
          <>
            <Bound label="Outbound" segments={doc.segments} />
            <Bound label="Return" segments={doc.returnSegments} />
          </>
        ) : (
          <p className="fo-ticket__nosectors">
            Sector-level timings are not available for this booking. Your PNR above is valid for
            check-in.
          </p>
        )}

        <section className="fo-ticket__fare">
          <h3 className="fo-ticket__bound-title">Fare</h3>
          <dl className="fo-ticket__fare-rows">
            {doc.baseMinor != null ? (
              <div>
                <dt>Base fare</dt>
                <dd>{formatMinor(doc.baseMinor, doc.currency)}</dd>
              </div>
            ) : null}
            {doc.taxesMinor != null ? (
              <div>
                <dt>Taxes &amp; fees</dt>
                <dd>{formatMinor(doc.taxesMinor, doc.currency)}</dd>
              </div>
            ) : null}
            <div className="fo-ticket__fare-total">
              <dt>Total paid</dt>
              <dd>{formatMinor(doc.totalMinor, doc.currency)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <footer className="fo-ticket__foot">
        <span>
          {FLIGHTONE_BRAND.name} · {FLIGHTONE_BRAND.email} · {FLIGHTONE_BRAND.phoneDisplay}
        </span>
        <span>Booking {doc.bookingId}</span>
      </footer>
    </article>
  );
}
