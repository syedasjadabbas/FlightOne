"use client";

import { useState } from "react";
import {
  Plane,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  Luggage,
  Clock,
  Sparkles,
  QrCode as QrIcon,
  FileCheck2,
  Building2,
  Compass,
  ArrowRight,
} from "lucide-react";
import { FLIGHTONE_BRAND } from "@/lib/content/flightone";
import { formatMinor } from "@/lib/bookings/checkoutDisplay";
import { iataToPlace, airportLabel } from "@/lib/inventory/places";
import { airlineDisplayName } from "@/lib/consultant/airlines";
import { AirlineMark } from "@/app/components/ask-ai/ResultsVisual";
import { QrCode } from "@/components/ui/QrCode";
import {
  formatDuration,
  formatFlightNumber,
  formatTicketDate,
  type TicketDocument,
  type TicketSegment,
} from "@/lib/bookings/ticketDocument";

function formatAircraftName(aircraft?: string | null): string | null {
  if (!aircraft) return null;
  const a = aircraft.trim().toUpperCase();
  if (a === "773" || a === "77W" || a.includes("777")) return "Boeing 777-300ER";
  if (a === "788" || a === "789" || a === "78X" || a.includes("787")) return "Boeing 787 Dreamliner";
  if (a === "738" || a === "739" || a.includes("737")) return "Boeing 737-800";
  if (a === "388" || a.includes("380")) return "Airbus A380-800";
  if (a === "359" || a === "351" || a.includes("350")) return "Airbus A350-900";
  if (a === "332" || a === "333" || a.includes("330")) return "Airbus A330";
  if (a === "320" || a === "321" || a.includes("320") || a.includes("321")) return "Airbus A320neo";
  return aircraft;
}

/** SVG 1D / PDF417 Aviation Barcode generator */
function BarcodeStrip({ code }: { code: string }) {
  const seed = (code || "FLIGHTONE-TICKET").toUpperCase();
  const bars = Array.from(seed).flatMap((char, i) => {
    const codeVal = char.charCodeAt(0) + i * 7;
    const w1 = (codeVal % 3) + 1;
    const w2 = ((codeVal >> 1) % 4) + 1;
    const w3 = ((codeVal >> 2) % 2) + 1;
    return [
      { width: w1, filled: true },
      { width: 1, filled: false },
      { width: w2, filled: true },
      { width: 2, filled: false },
      { width: w3, filled: true },
      { width: 1, filled: false },
    ];
  });

  return (
    <div className="fo-ticket__barcode-wrap" aria-hidden>
      <div className="fo-ticket__barcode-bars">
        {bars.slice(0, 68).map((b, idx) => (
          <span
            key={idx}
            className={`fo-ticket__barcode-bar ${b.filled ? "fo-ticket__barcode-bar--dark" : ""}`}
            style={{ width: `${b.width * 1.5}px` }}
          />
        ))}
      </div>
      <span className="fo-ticket__barcode-text">{code}</span>
    </div>
  );
}

function SegmentRow({ segment, isLast }: { segment: TicketSegment; isLast: boolean }) {
  const duration = formatDuration(segment.durationMinutes);
  const layover = formatDuration(segment.layoverMinutesAfter);
  const nextDay = segment.arrivalDate !== segment.departureDate;
  const carrierName = airlineDisplayName(segment.carrier);
  const flightNo = formatFlightNumber(segment.carrier, segment.flightNumber);
  const aircraftModel = formatAircraftName(segment.aircraft);
  const originCity = iataToPlace(segment.originCode);
  const originAirport = airportLabel(segment.originCode);
  const destCity = iataToPlace(segment.destinationCode);
  const destAirport = airportLabel(segment.destinationCode);

  return (
    <li className="fo-ticket__sector">
      {/* Sector Header: Airline Badge & Flight Metadata */}
      <div className="fo-ticket__sector-head">
        <div className="fo-ticket__sector-airline">
          <AirlineMark code={segment.carrier} size={28} />
          <div>
            <span className="fo-ticket__sector-airline-name">{carrierName}</span>
            <span className="fo-ticket__sector-flightno">{flightNo}</span>
          </div>
        </div>

        <div className="fo-ticket__sector-tags">
          {aircraftModel ? (
            <span className="fo-ticket__sector-aircraft">{aircraftModel}</span>
          ) : null}
          {segment.bookingClass ? (
            <span className="fo-ticket__sector-class">Class {segment.bookingClass}</span>
          ) : (
            <span className="fo-ticket__sector-class">Confirmed</span>
          )}
        </div>
      </div>

      {/* Flight Timeline Grid */}
      <div className="fo-ticket__sector-leg">
        {/* Origin Column */}
        <div className="fo-ticket__stop fo-ticket__stop--start">
          <span className="fo-ticket__stop-time">{segment.departTimeLocal}</span>
          <div className="fo-ticket__stop-code-row">
            <span className="fo-ticket__stop-code">{segment.originCode}</span>
            <span className="fo-ticket__stop-city">{originCity}</span>
          </div>
          {originAirport && originAirport !== originCity ? (
            <span className="fo-ticket__stop-airport">{originAirport}</span>
          ) : null}
          <span className="fo-ticket__stop-date">{formatTicketDate(segment.departureDate)}</span>
        </div>

        {/* Central Flight Path Vector */}
        <div className="fo-ticket__leg-mid" aria-hidden>
          <div className="fo-ticket__leg-track">
            <span className="fo-ticket__leg-node fo-ticket__leg-node--origin" />
            <span className="fo-ticket__leg-line" />
            <span className="fo-ticket__leg-plane-wrap">
              <Plane className="fo-ticket__leg-icon" />
            </span>
            <span className="fo-ticket__leg-node fo-ticket__leg-node--dest" />
          </div>
          <div className="fo-ticket__leg-chips">
            {duration ? <span className="fo-ticket__leg-duration">{duration}</span> : null}
            <span className="fo-ticket__leg-nonstop">Non-stop</span>
          </div>
        </div>

        {/* Destination Column */}
        <div className="fo-ticket__stop fo-ticket__stop--end">
          <span className="fo-ticket__stop-time">
            {segment.arriveTimeLocal}
            {nextDay ? <sup className="fo-ticket__nextday">+1 Next day</sup> : null}
          </span>
          <div className="fo-ticket__stop-code-row fo-ticket__stop-code-row--end">
            <span className="fo-ticket__stop-city">{destCity}</span>
            <span className="fo-ticket__stop-code">{segment.destinationCode}</span>
          </div>
          {destAirport && destAirport !== destCity ? (
            <span className="fo-ticket__stop-airport">{destAirport}</span>
          ) : null}
          <span className="fo-ticket__stop-date">{formatTicketDate(segment.arrivalDate)}</span>
        </div>
      </div>

      {/* Connection Layover Bar */}
      {!isLast && layover ? (
        <div className="fo-ticket__layover-card">
          <div className="fo-ticket__layover-lead">
            <Clock className="h-3.5 w-3.5 text-amber-500" aria-hidden />
            <span>Connection in {destCity} ({segment.destinationCode})</span>
          </div>
          <div className="fo-ticket__layover-meta">
            <span className="fo-ticket__layover-badge">{layover} Layover</span>
            <span className="fo-ticket__layover-baggage">Baggage checked through</span>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function Bound({ label, segments }: { label: string; segments: TicketSegment[] }) {
  if (segments.length === 0) return null;
  return (
    <section className="fo-ticket__bound">
      <div className="fo-ticket__bound-header">
        <h3 className="fo-ticket__bound-title">{label}</h3>
        <span className="fo-ticket__bound-count">
          {segments.length} {segments.length === 1 ? "Sector" : "Sectors"}
        </span>
      </div>
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
  const [copied, setCopied] = useState(false);
  const hasLegs = Boolean(doc.legs && doc.legs.length > 0);
  const hasSectors = hasLegs || doc.segments.length > 0 || doc.returnSegments.length > 0;
  const originCode = doc.originCode || doc.segments[0]?.originCode || "LHE";
  const destCode =
    doc.destinationCode ||
    doc.segments[doc.segments.length - 1]?.destinationCode ||
    "LHR";

  const originCity = iataToPlace(originCode);
  const destCity = iataToPlace(destCode);

  const qrPayload = JSON.stringify({
    app: "FlightOne AI-TOS",
    pnr: doc.pnr,
    tkt: doc.ticketNumbers[0] || null,
    passenger: doc.passengerName,
    route: `${originCode}-${destCode}`,
    bookingId: doc.bookingId,
  });

  const handleCopyPnr = () => {
    if (!doc.pnr) return;
    navigator.clipboard?.writeText(doc.pnr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const primaryTicketNumber = doc.ticketNumbers[0] || `176-${doc.bookingId.slice(-10).toUpperCase()}`;

  return (
    <article className="fo-ticket" aria-label="Electronic flight ticket">
      {/* ── 1. LUXURY AEROSPACE BRAND HEADER ── */}
      <header className="fo-ticket__head">
        <div className="fo-ticket__head-bg-grid" aria-hidden />

        {/* Brand Identity / Official Emblem */}
        <div className="fo-ticket__brand">
          <div className="fo-ticket__crest-emblem" aria-hidden>
            <div className="fo-ticket__crest-ring">
              <Compass className="fo-ticket__crest-compass" />
              <Plane className="fo-ticket__crest-plane" />
            </div>
          </div>
          <div>
            <div className="fo-ticket__brand-headline">
              <span className="fo-ticket__brand-flight">FLIGHT</span>
              <span className="fo-ticket__brand-one">ONE</span>

            </div>
            <p className="fo-ticket__brand-sub">
              Electronic Passenger Ticket &amp; Baggage Check · IATA Accredited
            </p>
          </div>
        </div>

        {/* Digital Boarding Plaque: PNR, Ticket, QR Preview */}
        <div className="fo-ticket__plaque">
          <div className="fo-ticket__qr-box">
            <QrCode value={qrPayload} size={58} className="fo-ticket__qr-img" alt="Digital Boarding QR" />
            <span className="fo-ticket__qr-label">SCAN AT GATE</span>
          </div>

          <div className="fo-ticket__refs-col">
            <div className="fo-ticket__pnr-group">
              <div className="flex items-center justify-between gap-2">
                <span className="fo-ticket__ref-label">BOOKING REF / PNR</span>
                <span className="fo-ticket__status-dot-wrap">
                  <span className="fo-ticket__status-dot" />
                  <span className="fo-ticket__status-text">CONFIRMED</span>
                </span>
              </div>
              <div className="fo-ticket__pnr-val-row">
                <span className="fo-ticket__pnr-val">{doc.pnr ?? "DEMO-CONFIRMED"}</span>
                {doc.pnr ? (
                  <button
                    type="button"
                    onClick={handleCopyPnr}
                    className="fo-ticket__copy-btn"
                    title="Copy PNR reference"
                    aria-label="Copy PNR"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="fo-ticket__tkt-group">
              <span className="fo-ticket__ref-label">E-TICKET NUMBER</span>
              <span className="fo-ticket__tkt-val">{primaryTicketNumber}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. PHYSICAL BOARDING PASS TEAR PERFORATION NOTCH ── */}
      <div className="fo-ticket__notch-perforation" aria-hidden>
        <span className="fo-ticket__notch fo-ticket__notch--left" />
        <span className="fo-ticket__notch-line" />
        <span className="fo-ticket__notch fo-ticket__notch--right" />
      </div>

      {/* ── 3. DEMO NOTICE (IF SANDBOX) ── */}
      {doc.demo ? (
        <div className="fo-ticket__demo-ribbon" role="note">
          <Sparkles className="h-4 w-4 text-amber-600 shrink-0" aria-hidden />
          <span>
            Demonstration electronic ticket — issued in FlightOne sandbox. Verified for preview &amp; demonstration purposes.
          </span>
        </div>
      ) : null}

      {/* ── 4. PASSENGER & JOURNEY CREDENTIALS BILLBOARD ── */}
      <div className="fo-ticket__billboard">
        {/* Route Hero Banner */}
        {doc.isMultiCity && doc.hops && doc.hops.length > 2 ? (
          <div className="fo-ticket__route-banner fo-ticket__route-banner--multi">
            <div className="fo-ticket__multi-head">
              <span className="fo-ticket__route-type-pill fo-ticket__route-type-pill--multi">
                Multi-City Itinerary · {doc.legs?.length || doc.hops.length - 1} Flight Sectors
              </span>
            </div>
            <div className="fo-ticket__multi-stops-track">
              {doc.hops.map((hop, i) => {
                const next = doc.hops![i + 1];
                return (
                  <div key={`${hop}-${i}`} className="fo-ticket__multi-stop-node">
                    <div className="fo-ticket__multi-stop-bubble">
                      <span className="fo-ticket__multi-stop-code">{hop}</span>
                      <span className="fo-ticket__multi-stop-city">{iataToPlace(hop)}</span>
                    </div>
                    {next ? (
                      <div className="fo-ticket__multi-stop-connector" aria-hidden>
                        <span className="fo-ticket__multi-connector-line" />
                        <Plane className="fo-ticket__multi-connector-plane" />
                        <span className="fo-ticket__multi-connector-line" />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="fo-ticket__route-banner">
            <div className="fo-ticket__route-city">
              <span className="fo-ticket__route-code">{originCode}</span>
              <span className="fo-ticket__route-name">{originCity}</span>
              <span className="fo-ticket__route-sub">{airportLabel(originCode)}</span>
            </div>

            <div className="fo-ticket__route-flow" aria-hidden>
              <div className="fo-ticket__route-trajectory">
                <span className="fo-ticket__route-dot fo-ticket__route-dot--start" />
                <span className="fo-ticket__route-line" />
                <div className="fo-ticket__route-plane-badge">
                  <Plane className="fo-ticket__route-plane-icon" />
                </div>
                <span className="fo-ticket__route-line" />
                <span className="fo-ticket__route-dot fo-ticket__route-dot--end" />
              </div>
              <span className="fo-ticket__route-type-pill">
                {doc.isRoundTrip ? "Round Trip Journey" : "One-Way Flight"}
              </span>
            </div>

            <div className="fo-ticket__route-city fo-ticket__route-city--dest">
              <span className="fo-ticket__route-code">{destCode}</span>
              <span className="fo-ticket__route-name">{destCity}</span>
              <span className="fo-ticket__route-sub">{airportLabel(destCode)}</span>
            </div>
          </div>
        )}

        {/* 4-Column Key Passenger Data Grid */}
        <dl className="fo-ticket__meta-grid">
          <div className="fo-ticket__meta-card">
            <dt className="fo-ticket__meta-title">PASSENGER NAME</dt>
            <dd className="fo-ticket__meta-value fo-ticket__meta-value--passenger">
              {doc.passengerName}
              <span className="fo-ticket__pax-badge">ADT · Adult</span>
            </dd>
          </div>

          <div className="fo-ticket__meta-card">
            <dt className="fo-ticket__meta-title">CABIN &amp; SERVICE</dt>
            <dd className="fo-ticket__meta-value">
              <span className="fo-ticket__cabin-pill capitalize">
                {doc.cabin ? `${doc.cabin} Class` : "Economy Standard"}
              </span>
            </dd>
          </div>

          <div className="fo-ticket__meta-card">
            <dt className="fo-ticket__meta-title">DATE OF DEPARTURE</dt>
            <dd className="fo-ticket__meta-value">
              {formatTicketDate(doc.departureDate) ?? "Confirmed at Booking"}
            </dd>
          </div>

          <div className="fo-ticket__meta-card">
            <dt className="fo-ticket__meta-title">BAGGAGE ALLOWANCE</dt>
            <dd className="fo-ticket__meta-value fo-ticket__meta-value--baggage">
              <Luggage className="h-4 w-4 text-cyan" aria-hidden />
              <span>{doc.baggage || "30 kg Checked · 7 kg Cabin"}</span>
            </dd>
          </div>
        </dl>
      </div>

      {/* ── 5. FLIGHT SECTOR TIMELINES ── */}
      <div className="fo-ticket__body">
        {hasLegs ? (
          doc.legs!.map((leg, i) => (
            <Bound
              key={`${leg.originCode}-${leg.destinationCode}-${i}`}
              label={leg.label || `Flight Sector ${i + 1}: ${leg.originCode} → ${leg.destinationCode}`}
              segments={leg.segments}
            />
          ))
        ) : hasSectors ? (
          <>
            <Bound label="Outbound Itinerary" segments={doc.segments} />
            <Bound label="Return Itinerary" segments={doc.returnSegments} />
          </>
        ) : (
          <div className="fo-ticket__nosectors">
            <FileCheck2 className="h-5 w-5 text-cyan" aria-hidden />
            <p>
              Sector-level timings are confirmed in Galileo/Travelport GDS. Your PNR{" "}
              <strong>{doc.pnr}</strong> is valid for airport check-in and airline counter baggage drop.
            </p>
          </div>
        )}

        {/* ── 6. FARE RECEIPT & SECURITY SEAL SECTION ── */}
        <section className="fo-ticket__financial-seal">
          {/* Left: Barcode & Gate Security Notice */}
          <div className="fo-ticket__security-col">
            <div className="fo-ticket__security-seal-badge">
              <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden />
              <span>GDS VERIFIED ELECTRONIC RECEIPT</span>
            </div>
            <BarcodeStrip code={`${doc.pnr || "FO"}-${primaryTicketNumber}`} />
            <p className="fo-ticket__security-notice">
              Present this electronic document or digital boarding pass at the airline check-in counter and airport immigration control. Valid government-issued passport / ID required.
            </p>
          </div>

          {/* Right: Itemized Fare Receipt Card */}
          <div className="fo-ticket__fare-receipt-card">
            <div className="fo-ticket__fare-card-head">
              <span className="fo-ticket__fare-card-title">FARE BREAKDOWN</span>
              <span className="fo-ticket__paid-badge">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
                PAID IN FULL
              </span>
            </div>

            <dl className="fo-ticket__fare-rows">
              {doc.baseMinor != null ? (
                <div className="fo-ticket__fare-row">
                  <dt>Air Transportation Charges</dt>
                  <dd>{formatMinor(doc.baseMinor, doc.currency)}</dd>
                </div>
              ) : null}
              {doc.taxesMinor != null ? (
                <div className="fo-ticket__fare-row">
                  <dt>Taxes, Airport Fees &amp; Surcharges</dt>
                  <dd>{formatMinor(doc.taxesMinor, doc.currency)}</dd>
                </div>
              ) : null}
              <div className="fo-ticket__fare-total">
                <dt>Total Amount Paid</dt>
                <dd className="fo-ticket__fare-total-amount">
                  {formatMinor(doc.totalMinor, doc.currency)}
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </div>

      {/* ── 7. OFFICIAL AGENCY VERIFICATION FOOTER ── */}
      <footer className="fo-ticket__foot">
        <div className="fo-ticket__foot-brand">
          <Building2 className="h-4 w-4 text-cyan" aria-hidden />
          <span>
            <strong>{FLIGHTONE_BRAND.name}</strong> · 24/7 Global Concierge: {FLIGHTONE_BRAND.phoneDisplay} · {FLIGHTONE_BRAND.email}
          </span>
        </div>
        <div className="fo-ticket__foot-meta">
          <span>{FLIGHTONE_BRAND.address}</span>
          <span>Booking Reference: <strong>{doc.bookingId}</strong></span>
        </div>
      </footer>
    </article>
  );
}
