import type { OfferCard, OfferCardFlight } from "@/lib/consultant/types";
import type { BaggageAllowance, FareRulesSummary } from "@/lib/inventory/fareTypes";
import type { FlightSegment } from "@/lib/inventory/types";
import {
  BAGGAGE_UNAVAILABLE,
  FARE_RULES_UNAVAILABLE,
  formatBaggageAllowance,
  formatFareRulesSummary,
  sanitizeFareRuleText,
} from "@/lib/inventory/fareDisplay";

export interface OfferLeg {
  originCode: string;
  destinationCode: string;
  departureDate?: string;
  airline?: string;
  airlineCode: string;
  flightNumber?: string;
  departTimeLocal: string;
  arriveTimeLocal?: string | null;
  durationMinutes?: number;
  stops?: number;
  cabin?: "economy" | "premium" | "business" | string;
  baggageKg?: number;
  segments: FlightSegment[];
  label?: string;
}

export function parseOfferLegs(offer: OfferCard): OfferLeg[] {
  const f = offer.flight;
  if (!f) return [];

  const rawTripLegs = Array.isArray(offer.metadata?.tripLegs)
    ? (offer.metadata.tripLegs as Record<string, unknown>[])
    : Array.isArray(offer.metadata?.legs)
      ? (offer.metadata.legs as Record<string, unknown>[])
      : null;

  if (rawTripLegs && rawTripLegs.length > 1) {
    return rawTripLegs.map((leg, i) => {
      const segs: FlightSegment[] =
        Array.isArray(leg.segments) && (leg.segments as unknown[]).length > 0
          ? (leg.segments as FlightSegment[])
          : [
              {
                carrier: (leg.airlineCode as string) || (leg.carrier as string) || f.airlineCode,
                flightNumber: (leg.flightNumber as string) || (leg.airlineCode as string) || f.flightNumber || "",
                aircraft: (leg.aircraft as string) || null,
                originCode: (leg.originCode as string) || f.originCode,
                destinationCode: (leg.destinationCode as string) || f.destinationCode,
                departureDate: (leg.departureDate as string) || f.departureDate || "",
                departTimeLocal: (leg.departTimeLocal as string) || (leg.departTime as string) || "—",
                arrivalDate: (leg.arrivalDate as string) || (leg.departureDate as string) || f.departureDate || "",
                arriveTimeLocal: (leg.arriveTimeLocal as string) || (leg.arriveTime as string) || "—",
                durationMinutes: typeof leg.durationMinutes === "number" ? leg.durationMinutes : null,
              },
            ];

      const lOrigin = (leg.originCode as string) || segs[0]?.originCode || f.originCode;
      const lDest = (leg.destinationCode as string) || segs[segs.length - 1]?.destinationCode || f.destinationCode;

      return {
        originCode: lOrigin,
        destinationCode: lDest,
        departureDate: (leg.departureDate as string) || segs[0]?.departureDate || f.departureDate,
        departTimeLocal: (leg.departTimeLocal as string) || segs[0]?.departTimeLocal || "—",
        arriveTimeLocal: (leg.arriveTimeLocal as string) || segs[segs.length - 1]?.arriveTimeLocal || "—",
        durationMinutes:
          typeof leg.durationMinutes === "number"
            ? leg.durationMinutes
            : segs.reduce((sum, s) => sum + (s.durationMinutes || 0), 0) || undefined,
        airline: (leg.airline as string) || (leg.airlineName as string) || f.airline,
        airlineCode: (leg.airlineCode as string) || (leg.carrier as string) || f.airlineCode,
        flightNumber: (leg.flightNumber as string) || segs[0]?.flightNumber,
        stops: typeof leg.stops === "number" ? leg.stops : Math.max(0, segs.length - 1),
        cabin: (leg.cabin as string) || f.cabin,
        baggageKg: typeof leg.baggageKg === "number" ? leg.baggageKg : f.baggageKg,
        segments: segs,
        label: `Flight ${i + 1}: ${lOrigin} → ${lDest}`,
      };
    });
  }

  const defaultOutbound: FlightSegment[] =
    f.segments && f.segments.length > 0
      ? f.segments
      : [
          {
            carrier: f.airlineCode,
            flightNumber: f.flightNumber || f.airlineCode,
            aircraft: f.aircraft ?? null,
            originCode: f.originCode,
            destinationCode: f.destinationCode,
            departureDate: f.departureDate || "",
            departTimeLocal: f.departTimeLocal,
            arrivalDate: f.departureDate || "",
            arriveTimeLocal: f.arriveTimeLocal || "",
            durationMinutes: f.durationMinutes,
          },
        ];

  if (offer.roundTrip && ((f.returnSegments && f.returnSegments.length > 0) || offer.returnDate || f.returnDate)) {
    const returnSegs: FlightSegment[] =
      f.returnSegments && f.returnSegments.length > 0
        ? f.returnSegments
        : [
            {
              carrier: f.airlineCode,
              flightNumber: f.flightNumber || f.airlineCode,
              aircraft: f.aircraft ?? null,
              originCode: f.destinationCode,
              destinationCode: f.originCode,
              departureDate: offer.returnDate || f.returnDate || f.departureDate || "",
              departTimeLocal: "—",
              arrivalDate: offer.returnDate || f.returnDate || f.departureDate || "",
              arriveTimeLocal: "—",
              durationMinutes: f.returnDurationMinutes ?? f.durationMinutes,
            },
          ];

    return [
      {
        originCode: f.originCode,
        destinationCode: f.destinationCode,
        departureDate: f.departureDate,
        departTimeLocal: f.departTimeLocal,
        arriveTimeLocal: f.arriveTimeLocal,
        durationMinutes: f.durationMinutes,
        airline: f.airline,
        airlineCode: f.airlineCode,
        flightNumber: f.flightNumber,
        stops: f.stops,
        cabin: f.cabin,
        baggageKg: f.baggageKg,
        segments: defaultOutbound,
        label: `Flight 1: Outbound · ${f.originCode} → ${f.destinationCode}`,
      },
      {
        originCode: f.destinationCode,
        destinationCode: f.originCode,
        departureDate: offer.returnDate || f.returnDate || f.departureDate,
        departTimeLocal: returnSegs[0]?.departTimeLocal || "—",
        arriveTimeLocal: returnSegs[returnSegs.length - 1]?.arriveTimeLocal || "—",
        durationMinutes: f.returnDurationMinutes ?? f.durationMinutes,
        airline: returnSegs[0]?.carrier ? f.airline : f.airline,
        airlineCode: returnSegs[0]?.carrier || f.airlineCode,
        flightNumber: returnSegs[0]?.flightNumber || f.flightNumber,
        stops: typeof f.returnStops === "number" ? f.returnStops : Math.max(0, returnSegs.length - 1),
        cabin: f.cabin,
        baggageKg: f.baggageKg,
        segments: returnSegs,
        label: `Flight 2: Return · ${f.destinationCode} → ${f.originCode}`,
      },
    ];
  }

  return [
    {
      originCode: f.originCode,
      destinationCode: f.destinationCode,
      departureDate: f.departureDate,
      departTimeLocal: f.departTimeLocal,
      arriveTimeLocal: f.arriveTimeLocal,
      durationMinutes: f.durationMinutes,
      airline: f.airline,
      airlineCode: f.airlineCode,
      flightNumber: f.flightNumber,
      stops: f.stops,
      cabin: f.cabin,
      baggageKg: f.baggageKg,
      segments: defaultOutbound,
      label: `Flight 1: ${f.originCode} → ${f.destinationCode}`,
    },
  ];
}

export function formatDurationLabel(
  minutes?: number | null,
  style: "short" | "long" = "short",
): string {
  if (!minutes || minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (style === "long") {
    if (h === 0) return `${m} mins`;
    if (m === 0) return `${h} hrs`;
    return `${h} hrs ${m} mins`;
  }
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}`;
}

export function stopsLabel(stops: number): string {
  if (stops <= 0) return "Direct";
  if (stops === 1) return "1 stop";
  return `${stops} stops`;
}

export function cabinLabel(cabin: OfferCardFlight["cabin"]): string {
  if (cabin === "business") return "Business Class";
  if (cabin === "premium") return "Premium Economy";
  return "Economy Class";
}

/** @deprecated Prefer BAGGAGE_UNAVAILABLE / FARE_RULES_UNAVAILABLE */
export const FARE_DETAIL_UNKNOWN = "Not confirmed";

export { BAGGAGE_UNAVAILABLE, FARE_RULES_UNAVAILABLE };

export function baggageAllowanceLabel(
  kg?: number,
  allowance?: BaggageAllowance,
): string {
  return formatBaggageAllowance(allowance, kg);
}

export function refundableFareLabel(
  refundable?: boolean,
  rules?: FareRulesSummary,
): string {
  const summary = formatFareRulesSummary(rules, refundable);
  if (summary !== FARE_RULES_UNAVAILABLE) {
    const cancellation = sanitizeFareRuleText(rules?.cancellation);
    if (cancellation) return cancellation;
    if (refundable === true) return "Refundable";
    if (refundable === false) return "Non-refundable";
    return summary.split(" · ")[0] ?? summary;
  }
  if (refundable == null) return FARE_RULES_UNAVAILABLE;
  return refundable ? "Refundable" : "Non-refundable";
}

export function refundableFareHint(
  refundable?: boolean,
  rules?: FareRulesSummary,
): string {
  if (rules?.changes || rules?.cancellation || rules?.refund) {
    return formatFareRulesSummary(rules, refundable);
  }
  if (refundable == null) {
    return "Fare rules unavailable from Travelport for this search result.";
  }
  return refundable
    ? "Eligible for refund per airline policy."
    : "Changes or refunds may incur airline fees.";
}

export function baggageAllowanceHint(
  kg?: number,
  allowance?: BaggageAllowance,
): string {
  const label = formatBaggageAllowance(allowance, kg);
  if (label === BAGGAGE_UNAVAILABLE) {
    return "Allowance not returned by Travelport for this fare.";
  }
  return "Baggage allowance from Travelport for this fare.";
}

export function formatDayLabel(isoDate?: string): string | null {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatLayover(minutes: number): string {
  return `${formatDurationLabel(minutes, "long")} layover`;
}
