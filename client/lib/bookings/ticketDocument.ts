/**
 * Shapes a booking into the data an e-ticket prints.
 *
 * Pure — no React, no fetch — so the layout can be unit tested and reused by
 * both the on-screen ticket and the printable/download version.
 */

export type TicketSegment = {
  carrier: string;
  flightNumber: string;
  originCode: string;
  destinationCode: string;
  departureDate: string;
  departTimeLocal: string;
  arrivalDate: string;
  arriveTimeLocal: string;
  durationMinutes?: number | null;
  layoverMinutesAfter?: number;
  aircraft?: string | null;
  bookingClass?: string;
};

export type TicketLeg = {
  label: string;
  originCode: string;
  destinationCode: string;
  departureDate?: string | null;
  carrier?: string | null;
  flightNumber?: string | null;
  durationMinutes?: number | null;
  cabin?: string | null;
  segments: TicketSegment[];
};

export type TicketDocument = {
  bookingId: string;
  pnr: string | null;
  ticketNumbers: string[];
  passengerName: string;
  originCode: string | null;
  destinationCode: string | null;
  departureDate: string | null;
  returnDate: string | null;
  cabin: string | null;
  carrier: string | null;
  segments: TicketSegment[];
  returnSegments: TicketSegment[];
  /** Multi-trip / multi-city legs */
  legs?: TicketLeg[];
  /** Sequence of route stop codes (e.g. ["LHE", "LHR", "SFO", "MCO", "LHE"]) */
  hops?: string[];
  currency: string;
  /** Customer-facing total in minor units. */
  totalMinor: number;
  baseMinor: number | null;
  taxesMinor: number | null;
  issuedAt: string | null;
  /** True when this booking came from the offline demo corpus. */
  demo: boolean;
  baggage?: string | null;
  isRoundTrip?: boolean;
  isMultiCity?: boolean;
};

type Json = Record<string, unknown>;

const asRecord = (v: unknown): Json | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null;

const asString = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

function asSegments(v: unknown): TicketSegment[] {
  if (!Array.isArray(v)) return [];
  return v.filter((s): s is TicketSegment => {
    const r = asRecord(s);
    return Boolean(r?.originCode && r?.destinationCode && r?.departTimeLocal);
  });
}

/**
 * "TK" + "TK745" → "TK745"; "EK" + "826" → "EK826".
 *
 * Suppliers are inconsistent about whether flightNumber already carries the
 * carrier prefix, and blindly concatenating produced "TKTK310" on the ticket.
 */
export function formatFlightNumber(carrier: string, flightNumber: string): string {
  const c = (carrier || "").toUpperCase().trim();
  const fn = (flightNumber || "").toUpperCase().trim();
  if (!c) return fn;
  if (!fn) return c;
  return fn.startsWith(c) ? fn : `${c}${fn}`;
}

/** Minutes → "13h 54m". Returns null rather than "0h 0m" for unknown. */
export function formatDuration(minutes?: number | null): string | null {
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatTicketDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function buildTicketDocument(booking: {
  id: string;
  currency: string;
  amountMinor: number;
  netMinor?: number;
  externalRef?: string | null;
  cabin?: string | null;
  route?: string | null;
  metadata?: unknown;
  supplierBookingRefs?: unknown;
  travellerSnapshot?: unknown;
}): TicketDocument {
  const meta = asRecord(booking.metadata) ?? {};
  const refs = asRecord(booking.supplierBookingRefs) ?? {};
  const itin = asRecord(refs.itinerary) ?? {};
  const traveller = asRecord(booking.travellerSnapshot) ?? {};
  const supplierBooking = asRecord(meta.supplierBooking) ?? {};
  const ticket = asRecord(supplierBooking.ticket) ?? {};
  const pricing = asRecord(meta.pricing) ?? {};
  const pricingInput = asRecord(pricing.input) ?? {};
  const fare = asRecord(refs.fare) ?? {};
  const breakdown = asRecord(fare.priceBreakdown) ?? {};

  // `route` is "LHE-LHR"; used only when the itinerary lacks explicit codes.
  const routeParts = (asString(meta.route) ?? asString(pricingInput.route) ?? booking.route ?? "")
    .split("-")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  const segments = asSegments(itin.segments);
  const returnSegments = asSegments(itin.returnSegments);

  const ticketNumbers = Array.isArray(ticket.ticketNumbers)
    ? (ticket.ticketNumbers as unknown[]).filter((t): t is string => typeof t === "string" && !!t)
    : [];

  const firstName = asString(traveller.firstName) ?? asString(traveller.givenName);
  const lastName = asString(traveller.lastName) ?? asString(traveller.familyName);
  const passengerName =
    [firstName, lastName].filter(Boolean).join(" ") ||
    asString(traveller.fullName) ||
    asString(traveller.name) ||
    "Traveller";

  const baseMinor =
    typeof breakdown.baseMinor === "number"
      ? breakdown.baseMinor
      : typeof booking.netMinor === "number"
        ? booking.netMinor
        : null;
  const taxesMinor =
    typeof breakdown.taxesMinor === "number"
      ? breakdown.taxesMinor
      : baseMinor != null
        ? booking.amountMinor - baseMinor
        : null;

  const originCode =
    asString(itin.origin) ?? segments[0]?.originCode ?? routeParts[0] ?? null;

  const rawDest = asString(itin.destination);
  const lastOutboundDest = segments[segments.length - 1]?.destinationCode;
  const destinationCode =
    (returnSegments.length > 0 && lastOutboundDest)
      ? lastOutboundDest
      : (rawDest && rawDest !== originCode)
        ? rawDest
        : (lastOutboundDest ?? rawDest ?? routeParts[1] ?? null);

  const baggageAllowance = asRecord(fare.baggageAllowance);
  const checkedAllowance = asRecord(baggageAllowance?.checked);
  const baggageKg =
    typeof itin.baggageKg === "number" && itin.baggageKg > 0
      ? `${itin.baggageKg} kg`
      : typeof pricingInput.baggageKg === "number" && pricingInput.baggageKg > 0
        ? `${pricingInput.baggageKg} kg`
        : typeof checkedAllowance?.weightKg === "number" && checkedAllowance.weightKg > 0
          ? `${checkedAllowance.weightKg} kg`
          : asString(fare.baggage) ?? asString(itin.baggage) ?? null;

  const rawLegs: Record<string, unknown>[] = Array.isArray(meta.tripLegs)
    ? (meta.tripLegs as Record<string, unknown>[])
    : Array.isArray(meta.legs) && (meta.legs as unknown[]).length > 1
      ? (meta.legs as Record<string, unknown>[])
      : Array.isArray(itin.legs) && (itin.legs as unknown[]).length > 1
        ? (itin.legs as Record<string, unknown>[])
        : [];

  const ticketLegs: TicketLeg[] = rawLegs
    .map((leg, i): TicketLeg | null => {
      const segs = asSegments(leg.segments);
      const lOrigin = asString(leg.originCode) ?? segs[0]?.originCode;
      const lDest = asString(leg.destinationCode) ?? segs[segs.length - 1]?.destinationCode;
      if (!lOrigin || !lDest) return null;

      const legSegs: TicketSegment[] =
        segs.length > 0
          ? segs
          : [
              {
                carrier: asString(leg.airlineCode) ?? asString(leg.carrier) ?? "FO",
                flightNumber: asString(leg.flightNumber) ?? asString(leg.airlineCode) ?? "FO",
                originCode: lOrigin,
                destinationCode: lDest,
                departureDate: asString(leg.departureDate) ?? "",
                departTimeLocal: asString(leg.departTimeLocal) ?? asString(leg.departTime) ?? "—",
                arrivalDate: asString(leg.arrivalDate) ?? asString(leg.departureDate) ?? "",
                arriveTimeLocal: asString(leg.arriveTimeLocal) ?? asString(leg.arriveTime) ?? "—",
                durationMinutes: typeof leg.durationMinutes === "number" ? leg.durationMinutes : null,
                aircraft: asString(leg.aircraft) ?? null,
                bookingClass: asString(leg.bookingClass) ?? asString(leg.cabin) ?? undefined,
              },
            ];

      return {
        label: `Flight Sector ${i + 1}: ${lOrigin} → ${lDest}`,
        originCode: lOrigin,
        destinationCode: lDest,
        departureDate: asString(leg.departureDate) ?? legSegs[0]?.departureDate ?? null,
        carrier: asString(leg.airlineCode) ?? asString(leg.carrier) ?? legSegs[0]?.carrier ?? null,
        flightNumber: asString(leg.flightNumber) ?? legSegs[0]?.flightNumber ?? null,
        durationMinutes: typeof leg.durationMinutes === "number" ? leg.durationMinutes : null,
        cabin: asString(leg.cabin) ?? null,
        segments: legSegs,
      };
    })
    .filter((l): l is TicketLeg => l !== null);

  const rawHops = Array.isArray(meta.hops)
    ? (meta.hops as unknown[]).map((h) => String(h).trim().toUpperCase()).filter(Boolean)
    : [];

  const hops: string[] =
    rawHops.length > 0
      ? rawHops
      : ticketLegs.length > 0
        ? [
            ticketLegs[0]!.originCode,
            ...ticketLegs.map((l) => l.destinationCode),
          ]
        : routeParts.length > 0
          ? routeParts
          : [];

  const isMultiCity = ticketLegs.length > 1 || hops.length > 2 || (routeParts.length > 2 && routeParts[0] !== routeParts[routeParts.length - 1]);

  const isRoundTrip =
    !isMultiCity &&
    (returnSegments.length > 0 ||
      Boolean(asString(itin.returnDate)) ||
      (routeParts.length >= 3 && routeParts[0] === routeParts[routeParts.length - 1]));

  const resolvedSegments =
    segments.length > 0
      ? segments
      : ticketLegs.length > 0
        ? ticketLegs.flatMap((l) => l.segments)
        : [];

  return {
    bookingId: booking.id,
    pnr: booking.externalRef ?? null,
    ticketNumbers,
    passengerName,
    originCode,
    destinationCode: isMultiCity && ticketLegs.length > 0 ? (ticketLegs[ticketLegs.length - 1]?.destinationCode ?? destinationCode) : destinationCode,
    departureDate: asString(itin.departureDate) ?? resolvedSegments[0]?.departureDate ?? null,
    returnDate: asString(itin.returnDate) ?? returnSegments[0]?.departureDate ?? null,
    cabin: asString(itin.cabin) ?? asString(pricingInput.cabin) ?? booking.cabin ?? null,
    carrier: asString(itin.carrier) ?? resolvedSegments[0]?.carrier ?? null,
    segments: resolvedSegments,
    returnSegments,
    legs: ticketLegs.length > 0 ? ticketLegs : undefined,
    hops: hops.length > 0 ? hops : undefined,
    currency: booking.currency,
    totalMinor: booking.amountMinor,
    baseMinor,
    taxesMinor,
    issuedAt: asString(ticket.at),
    demo: ticket.details != null && asRecord(ticket.details)?.demo === true,
    baggage: baggageKg,
    isRoundTrip,
    isMultiCity,
  };
}
