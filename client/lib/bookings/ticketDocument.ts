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
  currency: string;
  /** Customer-facing total in minor units. */
  totalMinor: number;
  baseMinor: number | null;
  taxesMinor: number | null;
  issuedAt: string | null;
  /** True when this booking came from the offline demo corpus. */
  demo: boolean;
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

  return {
    bookingId: booking.id,
    pnr: booking.externalRef ?? null,
    ticketNumbers,
    passengerName,
    originCode:
      asString(itin.origin) ?? segments[0]?.originCode ?? routeParts[0] ?? null,
    destinationCode:
      asString(itin.destination) ??
      segments[segments.length - 1]?.destinationCode ??
      routeParts[1] ??
      null,
    departureDate: asString(itin.departureDate) ?? segments[0]?.departureDate ?? null,
    returnDate: asString(itin.returnDate) ?? returnSegments[0]?.departureDate ?? null,
    cabin: asString(itin.cabin) ?? asString(pricingInput.cabin) ?? booking.cabin ?? null,
    carrier: asString(itin.carrier) ?? segments[0]?.carrier ?? null,
    segments,
    returnSegments,
    currency: booking.currency,
    totalMinor: booking.amountMinor,
    baseMinor,
    taxesMinor,
    issuedAt: asString(ticket.at),
    demo: ticket.details != null && asRecord(ticket.details)?.demo === true,
  };
}
