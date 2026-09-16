import { airportLabel } from "@/lib/inventory/places";
import { isFlight, isHotel, isPackage } from "@/lib/inventory/types";
import { formatMoney } from "@/utils/money";
import { airlineDisplayName, airlineIataCode } from "@/lib/consultant/airlines";
import type { OfferCard, OfferCardFlight } from "@/lib/consultant/types";
import type { FlightOffer } from "@/lib/inventory/types";
import { hasCheckedBaggageIncluded } from "@/lib/inventory/fareDisplay";
import type { ScoredOffer } from "@/lib/recommendation/recommendation";
import { buildItineraryKeyFromFlightOffer } from "./itineraryKey";

function formatDurationShort(minutes: number): string {
  if (minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function estimateArriveTime(departHHMM: string, durationMinutes: number): string | null {
  if (!departHHMM || durationMinutes <= 0) return null;
  const [hh, mm] = departHHMM.split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  const total = hh * 60 + mm + durationMinutes;
  const outH = Math.floor(total / 60) % 24;
  const outM = total % 60;
  return `${String(outH).padStart(2, "0")}:${String(outM).padStart(2, "0")}`;
}

function flightFareFields(o: FlightOffer): Partial<OfferCardFlight> {
  const meta = o.fareMetadata;
  if (!meta) return {};
  return {
    ...(meta.brandName ? { fareBrandName: meta.brandName } : {}),
    ...(meta.fareBasisCode ? { fareBasisCode: meta.fareBasisCode } : {}),
    ...(meta.bookingClass ? { bookingClass: meta.bookingClass } : {}),
    ...(meta.validatingCarrier ? { validatingCarrier: meta.validatingCarrier } : {}),
    ...(meta.paymentTimeLimit ? { paymentTimeLimit: meta.paymentTimeLimit } : {}),
    ...(meta.baggageAllowance ? { baggageAllowance: meta.baggageAllowance } : {}),
    ...(meta.fareRulesSummary ? { fareRulesSummary: meta.fareRulesSummary } : {}),
    ...(meta.supplierPriceBreakdown
      ? { supplierPriceBreakdown: meta.supplierPriceBreakdown }
      : {}),
    ...(meta.bookingRefs ? { bookingRefs: meta.bookingRefs } : {}),
    validationStatus: meta.validationStatus,
    ...(meta.connectionWarnings?.length
      ? { connectionWarnings: meta.connectionWarnings }
      : {}),
  };
}

export function toOfferCard(s: ScoredOffer, locale: string): OfferCard {
  const p = s.priced;
  const o = p.offer;

  let title = "";
  let subtitle = "";
  const badges: string[] = [];

  if (isFlight(o)) {
    const roundTrip = Boolean(o.returnDate);
    title = roundTrip
      ? `${o.origin} ⇄ ${o.destination}`
      : `${o.origin} → ${o.destination}`;
    const outDur = o.durationMinutes > 0 ? formatDurationShort(o.durationMinutes) : "";
    const retDur =
      roundTrip && o.returnDurationMinutes && o.returnDurationMinutes > 0
        ? formatDurationShort(o.returnDurationMinutes)
        : "";
    const outStops =
      o.stops === 0 ? "non-stop" : o.stops === 1 ? "1 stop" : `${o.stops} stops`;
    const retStops =
      o.returnStops == null
        ? null
        : o.returnStops === 0
          ? "non-stop"
          : o.returnStops === 1
            ? "1 stop"
            : `${o.returnStops} stops`;
    const returnSeg = o.returnSegments?.[0];
    const returnTimeBit = returnSeg
      ? ` · return ${returnSeg.departTimeLocal}`
      : o.returnDate
        ? ` · return ${o.returnDate}`
        : "";
    const durBit = [outDur, retDur].filter(Boolean).join(" / ");
    const stopsBit = retStops ? `${outStops} · ${retStops} home` : outStops;
    const fareBrand = o.fareMetadata?.brandName;
    const cabinBit = fareBrand || o.cabin;
    subtitle = `${roundTrip ? "Round trip · " : ""}${o.airline} · ${cabinBit} · ${stopsBit}${durBit ? ` · ${durBit}` : ""} · dep ${o.departTimeLocal}${returnTimeBit}`;
    if (roundTrip) badges.push("Round trip");
    if (fareBrand) badges.push(fareBrand);
    if (o.stops === 0 && (o.returnStops == null || o.returnStops === 0)) {
      badges.push("Non-stop");
    }
    if (o.refundable === true) badges.push("Refundable");
    if (o.refundable === false) badges.push("Non-refundable");
    if (o.tags.includes("live")) badges.push("Live fare");
    if (o.tags.includes("web-meta")) badges.push("Market ref");
    if (o.tags.includes("nearby-airport")) badges.push("Nearby airport");
    if (o.tags.includes("hub-stitched")) badges.push("Multi-ticket");
    if (o.baggageKg != null && o.baggageKg > 0) badges.push(`${o.baggageKg}kg bag`);
    else if (
      hasCheckedBaggageIncluded(o.fareMetadata?.baggageAllowance, o.baggageKg)
    ) {
      badges.push("Checked bag");
    }
  } else if (isHotel(o)) {
    title = o.name;
    subtitle = `${o.stars}★ · ${o.area} · ${o.roomType} · guest ${o.ratingScore}/10 · per night`;
    if (o.breakfastIncluded) badges.push("Breakfast");
    if (o.refundable) badges.push("Free cancel");
    if (o.tags.includes("live")) badges.push("Live rate");
  } else if (isPackage(o)) {
    title = `${o.origin} → ${o.destination}`;
    subtitle = `${o.nights} nights · ${o.airline} + ${o.hotelName} ${o.stars}★`;
    badges.push("Flight + hotel");
    if (o.refundable) badges.push("Refundable");
  }

  const roundTrip = isFlight(o) && Boolean(o.returnDate);
  const arrive =
    isFlight(o) && o.arriveTimeLocal
      ? o.arriveTimeLocal
      : isFlight(o)
        ? estimateArriveTime(o.departTimeLocal, o.durationMinutes)
        : null;

  return {
    id: o.id,
    type: o.type,
    angle: s.angle,
    title,
    subtitle,
    price: formatMoney(p.customerPrice, locale),
    priceMinor: p.customerPrice.amount,
    currency: p.customerPrice.currency,
    ...(o.supplierOfferSnapshotId
      ? {
          supplierOfferSnapshotId: o.supplierOfferSnapshotId,
          ...(o.snapshotExpiresAt ? { snapshotExpiresAt: o.snapshotExpiresAt } : {}),
        }
      : {}),
    marketPrice: p.hasMarketEdge ? formatMoney(o.marketPrice, locale) : null,
    savingsPct: p.hasMarketEdge && p.savingsVsMarketPct > 0 ? p.savingsVsMarketPct : null,
    reasons: s.reasons.slice(0, 3),
    badges,
    unitsLeft: o.unitsLeft,
    ...(isFlight(o)
      ? {
          itineraryKey: buildItineraryKeyFromFlightOffer(o),
          hubStitched: o.tags.includes("hub-stitched"),
        }
      : {}),
    ...(roundTrip ? { roundTrip: true as const, returnDate: o.returnDate } : {}),
    ...(isFlight(o)
      ? {
          flight: {
            airline: airlineDisplayName(o.airline),
            airlineCode: airlineIataCode(o.airline),
            originCode: o.originCode,
            destinationCode: o.destinationCode,
            originCity: o.origin,
            destinationCity: o.destination,
            originAirportName: airportLabel(o.originCode),
            destinationAirportName: airportLabel(o.destinationCode),
            nearbyAirport: o.tags.includes("nearby-airport"),
            departTimeLocal: o.departTimeLocal,
            arriveTimeLocal: arrive,
            ...(o.departureDate ? { departureDate: o.departureDate } : {}),
            durationMinutes: o.durationMinutes,
            stops: o.stops,
            cabin: o.cabin,
            ...(o.baggageKg != null ? { baggageKg: o.baggageKg } : {}),
            ...(o.refundable != null ? { refundable: o.refundable } : {}),
            ...(o.flightNumber ? { flightNumber: o.flightNumber } : {}),
            ...(o.aircraft ? { aircraft: o.aircraft } : {}),
            ...(o.segments?.length ? { segments: o.segments } : {}),
            ...(o.returnSegments?.length ? { returnSegments: o.returnSegments } : {}),
            ...(typeof o.returnStops === "number" ? { returnStops: o.returnStops } : {}),
            ...(typeof o.returnDurationMinutes === "number" && o.returnDurationMinutes > 0
              ? { returnDurationMinutes: o.returnDurationMinutes }
              : {}),
            ...(roundTrip && o.returnDate ? { returnDate: o.returnDate } : {}),
            ...flightFareFields(o),
          },
        }
      : {}),
  };
}
