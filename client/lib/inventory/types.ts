import type { Money } from "@/types/money";
import type {
  BaggageAllowance,
  FareRulesSummary,
  FlightFareMetadata,
  SupplierBookingRefs,
  SupplierPriceBreakdown,
} from "./fareTypes";

/**
 * Normalized supplier inventory (stand-in for Module 03 output).
 *
 * Today this is seeded local data (`inventory.data.json`); later the same shape
 * is produced by supplier adapters (Booking.com, Trip.com, Galileo, RateHawk…).
 * Everything downstream (pricing, recommendation, consultant) codes against
 * these types, not the data source — so swapping in real suppliers is isolated.
 */

export type OfferType = "flight" | "hotel" | "package";
export type Cabin = "economy" | "premium" | "business";

/** One flown sector from GDS (layover sits on the arriving segment as layoverMinutesAfter). */
export interface FlightSegment {
  carrier: string;
  flightNumber: string;
  aircraft?: string | null;
  originCode: string;
  destinationCode: string;
  departureDate: string;
  departTimeLocal: string;
  arrivalDate: string;
  arriveTimeLocal: string;
  durationMinutes: number | null;
  layoverMinutesAfter?: number;
}

/** Fields shared by every offer type. */
interface BaseOffer {
  id: string;
  type: OfferType;
  /** Where the fare came from — a supplier or an OTA we compare against. */
  supplier: string;
  /**
   * Server-persisted supplier offer snapshot for Module 03 quote creation.
   * Absent on seed, web-meta, and hub-stitched synthetic offers.
   */
  supplierOfferSnapshotId?: string;
  snapshotExpiresAt?: string;
  /**
   * Net fare we pay the supplier, in minor units. The customer-facing price is
   * derived from this by the Pricing Engine (§Module 05) — never shown raw.
   */
  netFare: Money;
  /**
   * Authoritative Module 05 sell price from the server search response.
   * When present, display pricing must use this and must NOT re-apply local markup.
   */
  serverSellPrice?: Money;
  /** Audit trail from Module 05 when `serverSellPrice` is set. */
  serverPricing?: {
    markupBps?: number;
    appliedRules?: unknown[];
  };
  /**
   * Typical public price for a comparable option on a major OTA
   * (Booking.com / Trip.com). Used to prove our value, not billed.
   */
  marketPrice: Money;
  /** Undefined when supplier did not return cancellation/refund rules. */
  refundable?: boolean;
  /**
   * 0–100 supplier fulfillment reliability from real booking history.
   * Omit / null when FlightOne has no trustworthy sample — never invent a default.
   */
  supplierReliability?: number | null;
  /** Units left — only when supplier returns availability; omit for live GDS when unknown. */
  unitsLeft?: number;
  tags: string[];
}

export interface FlightOffer extends BaseOffer {
  type: "flight";
  origin: string;
  originCode: string;
  destination: string;
  destinationCode: string;
  airline: string;
  cabin: Cabin;
  stops: number;
  durationMinutes: number;
  /** Local departure time at the origin, "HH:MM" (24h). */
  departTimeLocal: string;
  /** Local arrival time at the final destination, "HH:MM" when known. */
  arriveTimeLocal?: string;
  /** ISO departure date when known from GDS. */
  departureDate?: string;
  /** Marketing flight number, e.g. EK625. */
  flightNumber?: string;
  /** Equipment code on the primary sector, e.g. B777 / 32A. */
  aircraft?: string;
  /** Ordered flown sectors (with layoverMinutesAfter between them). */
  segments?: FlightSegment[];
  /**
   * Return-bound sectors when netFare is a round-trip total. Same FlightSegment
   * shape as `segments` (outbound). Present only when GDS pairing succeeded.
   */
  returnSegments?: FlightSegment[];
  /** Stops on the return bound (mirrors `stops` for outbound). */
  returnStops?: number;
  /** Door-to-door minutes for the return bound. */
  returnDurationMinutes?: number;
  /**
   * When set, `netFare` is a round-trip total covering return on this date
   * (Travelport SearchCriteriaFlight return leg).
   */
  returnDate?: string;
  /** Checked-bag allowance in kg — only when returned by supplier/GDS. */
  baggageKg?: number;
  /** Branded fare + rules metadata from Travelport when available. */
  fareMetadata?: FlightFareMetadata;
  /**
   * 0–100 airline quality (OTP / service tier) when an authoritative feed exists.
   * Omit / null when unavailable — FlightOne does not invent airline rankings.
   */
  airlineScore?: number | null;
}

export interface HotelOffer extends BaseOffer {
  type: "hotel";
  city: string;
  cityCode: string;
  name: string;
  area: string;
  stars: number;
  roomType: string;
  breakfastIncluded: boolean;
  /** Guest review score, 0–10. */
  ratingScore: number;
  reviewCount: number;
  distanceToCentreKm: number;
  /** netFare / marketPrice are PER NIGHT for hotels. */
}

export interface PackageOffer extends BaseOffer {
  type: "package";
  origin: string;
  originCode: string;
  destination: string;
  destinationCode: string;
  airline: string;
  hotelName: string;
  stars: number;
  nights: number;
  /** netFare / marketPrice cover the whole package (flight + hotel). */
}

export type Offer = FlightOffer | HotelOffer | PackageOffer;

export function isFlight(o: Offer): o is FlightOffer {
  return o.type === "flight";
}
export function isHotel(o: Offer): o is HotelOffer {
  return o.type === "hotel";
}
export function isPackage(o: Offer): o is PackageOffer {
  return o.type === "package";
}

/** A place we know about, for intent matching and disambiguation. */
export function offerDestinationLabel(o: Offer): string {
  if (o.type === "hotel") return o.city;
  return o.destination;
}
