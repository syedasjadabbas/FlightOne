"use client";

import Link from "next/link";
import {
  Plane,
  CreditCard,
  Info,
  MessageCircle,
  ArrowRight,
  Check,
} from "lucide-react";
import { buttonClassName } from "@/components/ui";
import { formatMinor } from "@/lib/bookings/checkoutDisplay";

type BookingLike = {
  id: string;
  status: string;
  product: string;
  supplierCode?: string | null;
  amountMinor: number;
  netMinor?: number;
  currency: string;
  externalRef?: string | null;
  metadata?: unknown;
  supplierBookingRefs?: unknown;
};

/** Minutes → "13h 54m"; null for unknown so callers can fall back. */
function formatMinutes(minutes: unknown): string | null {
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const AIRPORT_CITIES: Record<string, string> = {
  LHE: "Lahore",
  DXB: "Dubai",
  KHI: "Karachi",
  ISB: "Islamabad",
  JED: "Jeddah",
  RUH: "Riyadh",
  DOH: "Doha",
  IST: "Istanbul",
  LHR: "London",
  LGW: "London Gatwick",
  JFK: "New York",
  ORD: "Chicago",
  BKK: "Bangkok",
  PVG: "Shanghai",
  PEK: "Beijing",
  SIN: "Singapore",
  YYZ: "Toronto",
  MAN: "Manchester",
  AUH: "Abu Dhabi",
  MCO: "Orlando",
  SFO: "San Francisco",
};

const AIRLINE_NAMES: Record<string, string> = {
  EK: "Emirates",
  PK: "Pakistan International Airlines",
  PIA: "Pakistan International Airlines",
  QR: "Qatar Airways",
  FZ: "flydubai",
  SV: "Saudia",
  TK: "Turkish Airlines",
  BA: "British Airways",
  EY: "Etihad Airways",
  PA: "Airblue",
  ER: "SereneAir",
  PF: "AirSial",
  GF: "Gulf Air",
  WY: "Oman Air",
  KU: "Kuwait Airways",
};

function getCityName(code?: string | null): string {
  if (!code) return "—";
  const clean = code.toUpperCase().trim();
  return AIRPORT_CITIES[clean] || clean;
}

function getAirlineName(code?: string | null): string {
  if (!code) return "—";
  const clean = code.toUpperCase().trim();
  return AIRLINE_NAMES[clean] || clean;
}

function formatCabin(cabin?: string | null): string | null {
  if (!cabin) return null;
  const lower = cabin.toLowerCase();
  if (lower.includes("biz") || lower.includes("business")) return "Business";
  if (lower.includes("prem")) return "Premium Economy";
  if (lower.includes("first")) return "First Class";
  return "Economy";
}

function formatDisplayDate(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function metaString(meta: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = meta[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export function CheckoutBookingSummary({
  booking,
  tickets = [],
  vouchers = [],
}: {
  booking: BookingLike;
  tickets?: string[];
  vouchers?: string[];
}) {
  const meta = (
    booking.metadata && typeof booking.metadata === "object" ? booking.metadata : {}
  ) as Record<string, any>;
  const pricingMeta = meta.pricing || {};
  const pricingInput = pricingMeta.input || {};

  // Flight detail lives on `supplierBookingRefs.itinerary` (persisted from the
  // supplier snapshot), NOT in `metadata` — reading only metadata is why the
  // trip card showed an origin/destination pair with "—" for every time.
  const refs = (
    booking.supplierBookingRefs && typeof booking.supplierBookingRefs === "object"
      ? booking.supplierBookingRefs
      : {}
  ) as Record<string, any>;
  const itin = (refs.itinerary && typeof refs.itinerary === "object" ? refs.itinerary : {}) as
    Record<string, any>;
  const outSegs: Record<string, any>[] = Array.isArray(itin.segments) ? itin.segments : [];
  const retSegs: Record<string, any>[] = Array.isArray(itin.returnSegments)
    ? itin.returnSegments
    : [];
  const firstOut = outSegs[0] ?? {};
  const lastOut = outSegs[outSegs.length - 1] ?? {};
  const firstRet = retSegs[0] ?? {};
  const lastRet = retSegs[retSegs.length - 1] ?? {};

  const routeString = meta.route || pricingInput.route || null;
  const routeParts =
    typeof routeString === "string"
      ? routeString.split("-").map((s: string) => s.trim().toUpperCase()).filter(Boolean)
      : [];
  const originCode =
    metaString(meta, "origin", "originCode") ||
    itin.origin ||
    firstOut.originCode ||
    routeParts[0] ||
    null;
  const destCode =
    metaString(meta, "destination", "destinationCode") ||
    itin.destination ||
    lastOut.destinationCode ||
    routeParts[1] ||
    null;
  const hasReturnLeg = Boolean(
    meta.returnDate ||
      itin.returnDate ||
      retSegs.length > 0 ||
      routeParts.length > 2 ||
      meta.isRoundTrip ||
      meta.legs?.length > 1,
  );

  // `supplierCode` is a last resort — GALILEO_DEMO is not an airline.
  const airlineCode =
    metaString(meta, "airlineCode", "airline") ||
    itin.carrier ||
    firstOut.carrier ||
    booking.supplierCode ||
    null;
  const airlineTitle =
    metaString(meta, "airlineName") || getAirlineName(airlineCode);
  const flightNum =
    metaString(meta, "flightNumber") || itin.flightNumber || firstOut.flightNumber || null;
  const cabinText = formatCabin(meta.cabin || pricingInput.cabin || itin.cabin);

  const outboundDate = formatDisplayDate(
    meta.departureDate || meta.departAt || itin.departureDate || firstOut.departureDate || null,
  );
  const returnDate = formatDisplayDate(
    meta.returnDate || itin.returnDate || firstRet.departureDate || null,
  );
  const departTime =
    metaString(meta, "departTime") || itin.departTimeLocal || firstOut.departTimeLocal || null;
  const arriveTime =
    metaString(meta, "arriveTime") || itin.arriveTimeLocal || lastOut.arriveTimeLocal || null;
  const duration = metaString(meta, "duration") || formatMinutes(itin.durationMinutes);
  const returnDepartTime =
    metaString(meta, "returnDepartTime") || firstRet.departTimeLocal || null;
  const returnArriveTime =
    metaString(meta, "returnArriveTime") || lastRet.arriveTimeLocal || null;
  const returnDuration =
    metaString(meta, "returnDuration") || formatMinutes(itin.returnDurationMinutes);
  const returnFlightNum = metaString(meta, "returnFlightNumber") || firstRet.flightNumber || null;

  const totalAmountMinor = booking.amountMinor;
  const hasNet =
    typeof booking.netMinor === "number" &&
    booking.netMinor > 0 &&
    booking.netMinor < totalAmountMinor;
  const netMinor = hasNet ? booking.netMinor! : null;
  const taxesMinor =
    hasNet && netMinor != null ? totalAmountMinor - netMinor : null;

  const rewardCredit = meta.rewardCredit as
    | { creditMinor?: number; points?: number }
    | undefined;

  const multiCityLegs: Record<string, any>[] = Array.isArray(meta.tripLegs)
    ? meta.tripLegs
    : Array.isArray(meta.legs) && meta.legs.length > 1
      ? meta.legs
      : Array.isArray(itin.legs) && itin.legs.length > 1
        ? itin.legs
        : [];

  const hasRoute = Boolean(originCode && destCode) || multiCityLegs.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <section className="fo-desk__panel">
        <div className="fo-desk__panel-head">
          <div className="flex items-center gap-2">
            <Plane className="h-4 w-4 text-[var(--cyan)]" aria-hidden />
            <h2 className="m-0 text-[14px] font-semibold text-[var(--navy)]">Trip</h2>
          </div>
          <Link
            href="/chat"
            className="text-[12px] font-medium text-[var(--cyan)] underline-offset-2 hover:underline"
          >
            Edit search
          </Link>
        </div>

        {multiCityLegs.length > 1 ? (
          <div className="space-y-3">
            {multiCityLegs.map((leg, i) => {
              const legOrigin = leg.originCode || originCode || "—";
              const legDest = leg.destinationCode || destCode || "—";
              const legAirlineCode = leg.airlineCode || airlineCode;
              const legAirlineTitle =
                metaString(leg, "airlineName") || getAirlineName(legAirlineCode);
              const legFlightNum = leg.flightNumber || (i === 0 ? flightNum : null);
              const legDepart =
                leg.departTime || leg.departTimeLocal || (i === 0 ? departTime : null);
              const legArrive =
                leg.arriveTime || leg.arriveTimeLocal || (i === 0 ? arriveTime : null);
              const legDate = formatDisplayDate(
                leg.departureDate || (i === 0 ? meta.departureDate : null),
              );
              const legDur =
                metaString(leg, "duration") ||
                formatMinutes(leg.durationMinutes) ||
                (i === 0 ? duration : null);
              return (
                <FlightLeg
                  key={`${legOrigin}-${legDest}-${i}`}
                  originCode={legOrigin}
                  destCode={legDest}
                  airlineCode={legAirlineCode}
                  airlineTitle={legAirlineTitle}
                  flightNum={legFlightNum}
                  cabinText={cabinText}
                  departTime={legDepart}
                  arriveTime={legArrive}
                  dateLabel={legDate}
                  duration={legDur}
                />
              );
            })}
          </div>
        ) : hasRoute ? (
          <div className="space-y-3">
            <FlightLeg
              originCode={originCode!}
              destCode={destCode!}
              airlineCode={airlineCode}
              airlineTitle={airlineTitle}
              flightNum={flightNum}
              cabinText={cabinText}
              departTime={departTime}
              arriveTime={arriveTime}
              dateLabel={outboundDate}
              duration={duration}
            />

            {hasReturnLeg ? (
              <FlightLeg
                originCode={destCode!}
                destCode={originCode!}
                airlineCode={airlineCode}
                airlineTitle={airlineTitle}
                flightNum={returnFlightNum}
                cabinText={cabinText}
                departTime={returnDepartTime}
                arriveTime={returnArriveTime}
                dateLabel={returnDate}
                duration={returnDuration}
              />
            ) : null}
          </div>
        ) : (
          <p className="m-0 text-[13px] text-[var(--ink-soft)]">
            Route details will appear when available on this booking.
          </p>
        )}

        {booking.externalRef || tickets.length > 0 || vouchers.length > 0 ? (
          <dl className="fo-checkout__dl mt-4 border-t border-[var(--fo-desk-line)] pt-3">
            {booking.externalRef ? (
              <div>
                <dt>PNR</dt>
                <dd className="font-mono">{booking.externalRef}</dd>
              </div>
            ) : null}
            {tickets.length > 0 ? (
              <div>
                <dt>Tickets</dt>
                <dd className="font-mono">{tickets.join(", ")}</dd>
              </div>
            ) : null}
            {vouchers.length > 0 ? (
              <div>
                <dt>Vouchers</dt>
                <dd className="font-mono">{vouchers.join(", ")}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </section>

      <section className="fo-desk__panel">
        <div className="fo-desk__panel-head">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-[var(--cyan)]" aria-hidden />
            <h2 className="m-0 text-[14px] font-semibold text-[var(--navy)]">Price</h2>
          </div>
        </div>

        <dl className="fo-checkout__dl">
          {netMinor != null ? (
            <div>
              <dt>Base fare</dt>
              <dd>{formatMinor(netMinor, booking.currency)}</dd>
            </div>
          ) : null}
          {taxesMinor != null ? (
            <div>
              <dt>Taxes & fees</dt>
              <dd>{formatMinor(taxesMinor, booking.currency)}</dd>
            </div>
          ) : null}
          {rewardCredit?.creditMinor ? (
            <div>
              <dt>Reward credit ({rewardCredit.points ?? 0} pts)</dt>
              <dd>−{formatMinor(rewardCredit.creditMinor, booking.currency)}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-[var(--fo-desk-line)] pt-3">
          <div>
            <p className="m-0 text-[13px] font-semibold text-[var(--navy)]">Total</p>
            <p className="mt-1 flex items-center gap-1 text-[12px] text-[var(--ink-soft)]">
              <Check className="h-3 w-3 text-[var(--cyan)]" aria-hidden />
              Taxes included where shown
            </p>
          </div>
          <p className="fo-checkout__amount m-0 text-[1.35rem]">
            {formatMinor(totalAmountMinor, booking.currency)}
          </p>
        </div>
      </section>

      <section className="fo-desk__panel">
        <div className="mb-2.5 flex items-center gap-2">
          <Info className="h-3.5 w-3.5 text-[var(--ink-soft)]" aria-hidden />
          <h3 className="m-0 text-[13px] font-semibold text-[var(--navy)]">Before you pay</h3>
        </div>
        <ul className="m-0 space-y-2 pl-0 text-[12px] leading-relaxed text-[var(--ink-soft)]">
          <li className="list-none">Quoted fares can change until ticketing.</li>
          <li className="list-none">Passenger names must match travel documents.</li>
          <li className="list-none">Airline fare rules and FlightOne terms apply.</li>
        </ul>
      </section>

      <section className="fo-desk__panel flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <MessageCircle className="h-4 w-4 shrink-0 text-[var(--cyan)]" aria-hidden />
          <div className="min-w-0">
            <p className="m-0 text-[13px] font-semibold text-[var(--navy)]">Need help?</p>
            <p className="m-0 text-[12px] text-[var(--ink-soft)]">Chat with Ava</p>
          </div>
        </div>
        <Link
          href="/chat?new=true"
          className={buttonClassName({ variant: "secondary", size: "sm", className: "shrink-0" })}
        >
          Open chat
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </section>
    </div>
  );
}

function FlightLeg({
  originCode,
  destCode,
  airlineCode,
  airlineTitle,
  flightNum,
  cabinText,
  departTime,
  arriveTime,
  dateLabel,
  duration,
}: {
  originCode: string;
  destCode: string;
  airlineCode: string | null;
  airlineTitle: string;
  flightNum?: string | null;
  cabinText: string | null;
  departTime: string | null;
  arriveTime: string | null;
  dateLabel: string | null;
  duration: string | null;
}) {
  const metaLine = [airlineTitle !== "—" ? airlineTitle : null, flightNum, cabinText]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="rounded-[var(--fo-desk-radius)] border border-[var(--fo-desk-line)] bg-[var(--fo-desk-wash)] p-3">
      <div className="mb-2.5 flex items-center gap-2.5">
        {airlineCode ? (
          <div className="flex h-7 w-7 items-center justify-center rounded bg-[var(--navy)] text-[11px] font-bold tracking-wide text-[var(--white)]">
            {airlineCode.slice(0, 2).toUpperCase()}
          </div>
        ) : null}
        <div className="min-w-0">
          <h3 className="m-0 text-[13px] font-semibold leading-tight text-[var(--navy)]">
            {getCityName(originCode)} → {getCityName(destCode)}
          </h3>
          {metaLine ? (
            <p className="m-0 text-[12px] text-[var(--ink-soft)]">{metaLine}</p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="m-0 text-[12px] font-semibold uppercase tracking-wider text-[var(--ink-soft)]">
            {originCode}
          </p>
          <p className="m-0 text-[15px] font-semibold leading-tight text-[var(--navy)]">
            {departTime || "—"}
          </p>
          {dateLabel ? (
            <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">{dateLabel}</p>
          ) : null}
        </div>

        <div className="flex max-w-[120px] flex-1 flex-col items-center px-1">
          {duration ? (
            <span className="mb-1 text-[12px] text-[var(--ink-soft)]">{duration}</span>
          ) : null}
          <div className="h-px w-full bg-[var(--fo-desk-line-strong)]" />
        </div>

        <div className="text-right">
          <p className="m-0 text-[12px] font-semibold uppercase tracking-wider text-[var(--ink-soft)]">
            {destCode}
          </p>
          <p className="m-0 text-[15px] font-semibold leading-tight text-[var(--navy)]">
            {arriveTime || "—"}
          </p>
          {dateLabel ? (
            <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">{dateLabel}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
