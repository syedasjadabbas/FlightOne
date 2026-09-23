import type { OfferType } from "@/lib/inventory/types";
import type { FlightSegment } from "@/lib/inventory/types";
import type {
  BaggageAllowance,
  ConnectionWarning,
  FareRulesSummary,
  FareValidationStatus,
  SupplierBookingRefs,
  SupplierPriceBreakdown,
} from "@/lib/inventory/fareTypes";
import type { TravelPlan } from "@/lib/consultant/travelPlan";
import type { OfferAngle } from "@/lib/recommendation/recommendation";
import type { ChatTurn } from "@/lib/llm";
import type { TravellerLocation } from "@/lib/geo/types";
import type { SearchResultsPanel } from "@/lib/ask-ai/types";

export interface ExtractedIntent {
  type?: OfferType;
  origin?: string;
  destination?: string;
  /** Multi-city itinerary destinations in visit order (e.g. London, Dubai). */
  destinations?: string[];
  /** Named property the customer asked for (e.g. "Burj Al Arab"). */
  hotelName?: string;
  /** Budget in minor units (heuristic $ parse is USD-like; LLM path uses party size separately). */
  maxBudgetMinor?: number;
  cabin?: "economy" | "premium" | "business";
  minStars?: number;
  /** Total travellers for GDS passenger/guest counts (1–9). */
  passengers?: number;
  /** ISO date from LLM plan (flight departure or hotel check-in). */
  departureDate?: string;
  /** ISO date from LLM plan (flight return or hotel check-out). */
  returnDate?: string;
  /** True when dates were defaulted (~today+21), not stated by the customer. */
  datesAssumed?: boolean;
  /** Result filters from refine language (nonstop, refundable, …). */
  filters?: IntentFilters;
  /** True if the user said something clearly non-travel. */
  offTopic: boolean;
}

export interface IntentFilters {
  nonstopOnly?: boolean;
  maxStops?: number;
  refundableOnly?: boolean;
  /** Preferred marketing carriers (IATA), soft-ranked — never a hard wipe. */
  preferredAirlines?: string[];
  /** Longest single layover the customer will accept, in minutes. */
  maxLayoverMinutes?: number;
  /** Earliest acceptable local departure, "HH:MM" (24h). */
  departAfterLocal?: string;
  /** Latest acceptable local departure, "HH:MM" (24h). */
  departBeforeLocal?: string;
  /** Latest acceptable local arrival, "HH:MM" (24h). */
  arriveBeforeLocal?: string;
  /** Customer requires a checked bag included in the fare. */
  checkedBagRequired?: boolean;
  /** Hard carrier wipe (IATA) — distinct from preferredAirlines, which only soft-ranks. */
  airlinesOnly?: string[];
}

/** A curated offer flattened for the UI — no server-only fields leak through. */
export interface OfferCard {
  id: string;
  type: OfferType;
  angle: OfferAngle;
  title: string;
  subtitle: string;
  score?: number;
  price: string; // formatted, edge-only
  priceMinor: number;
  currency: string;
  /** Persisted supplier offer snapshot — required to create a server quote. */
  supplierOfferSnapshotId?: string;
  snapshotExpiresAt?: string;
  marketPrice: string | null;
  savingsPct: number | null;
  reasons: string[];
  badges: string[];
  /** Present only when supplier returns seat/fare availability; omitted for live GDS when unknown. */
  unitsLeft?: number;
  /** True when price is a round-trip Travelport total. */
  roundTrip?: boolean;
  /** ISO return date when roundTrip. */
  returnDate?: string;
  /** Structured flight fields for timeline cards + detail modal. */
  flight?: OfferCardFlight;
  /** Deterministic identity for the flown path (excludes price, baggage). */
  itineraryKey?: string;
  /** How many fares share this itinerary in the current result set. */
  faresOnItinerary?: number;
  /** True when this fare is the lowest price on its itinerary in the current set. */
  isLowestFareOnItinerary?: boolean;
  /** Lowest customer priceMinor on this itinerary in the current set. */
  lowestFareOnItineraryMinor?: number;
  /** Hub-stitched multi-ticket construction (not a single through fare). */
  hubStitched?: boolean;
  /**
   * Extra context forwarded to the quote endpoint. Used by multi-city trips to
   * carry every leg alongside the first-leg snapshot the booking is anchored
   * to — see lib/bookings/offerFromItinerary.ts.
   */
  metadata?: Record<string, unknown>;
}

export interface OfferCardFlight {
  airline: string;
  airlineCode: string;
  originCode: string;
  destinationCode: string;
  originCity: string;
  destinationCity: string;
  departTimeLocal: string;
  arriveTimeLocal: string | null;
  departureDate?: string;
  durationMinutes: number;
  stops: number;
  cabin: "economy" | "premium" | "business";
  baggageKg?: number;
  refundable?: boolean;
  flightNumber?: string;
  aircraft?: string;
  segments?: FlightSegment[];
  /** Return-bound sectors when this card is a paired round trip. */
  returnSegments?: FlightSegment[];
  returnStops?: number;
  returnDurationMinutes?: number;
  /** True when this fare uses a substitute metro airport (e.g. DMK for Bangkok). */
  nearbyAirport?: boolean;
  /** Airport terminal name — Suvarnabhumi, Don Mueang, Heathrow… */
  originAirportName?: string;
  destinationAirportName?: string;
  /** ISO return date when this card is a round trip. */
  returnDate?: string;
  /** Branded fare name from Travelport when available. */
  fareBrandName?: string;
  fareBasisCode?: string;
  bookingClass?: string;
  validatingCarrier?: string;
  paymentTimeLimit?: string;
  baggageAllowance?: BaggageAllowance;
  fareRulesSummary?: FareRulesSummary;
  supplierPriceBreakdown?: SupplierPriceBreakdown;
  bookingRefs?: SupplierBookingRefs;
  validationStatus?: FareValidationStatus;
  connectionWarnings?: ConnectionWarning[];
}

export interface ConsultantRequest {
  message: string;
  history: ChatTurn[];
  /** Resolved traveller location (GPS → IP → default). */
  location?: TravellerLocation | null;
  /**
   * Structured travel plan from the previous turn (draft/search/clarify).
   * Required for multi-turn slot continuity — do not rebuild from the latest message alone.
   */
  previousTravelPlan?: TravelPlan | null;
  /** Client turn id for dev logging / duplicate-request audit. */
  turnId?: string;
  /**
   * Module 02 saved prefs — soft defaults only. Conversation filters always win.
   * Loaded server-side from the authenticated profile; never mirrored as chat state.
   */
  profilePreferences?: import("@/lib/ask-ai/profilePreferences").ProfileTravelPreferences | null;
  /** Module 06 soft corporate policy line — server policy remains authoritative. */
  corporatePolicyLine?: string | null;
  /** Module 08 attributed visa guidance — never invented client-side. */
  visaGuidanceLine?: string | null;
  /** Module 09 attributed journey guidance — never invent delays/gates/rebooks. */
  journeyGuidanceLine?: string | null;
  /** Module 10 rewards ledger guidance — never invent balances/tiers. */
  rewardsGuidanceLine?: string | null;
  /** Module 11 group travel guidance — never invent members/itinerary/status. */
  groupGuidanceLine?: string | null;
  /** Module 12 MICE guidance — never invent delegates/budgets/attendance. */
  miceGuidanceLine?: string | null;
  /** Module 13 human escalation guidance — never fake assignment/resolution. */
  escalationGuidanceLine?: string | null;
  /** Module 14 refund/reissue guidance — never invent money or completion. */
  refundGuidanceLine?: string | null;
  /** Module 15 operations guidance — never invent CRM/accounting/recon. */
  operationsGuidanceLine?: string | null;
  /** Module 16 knowledge guidance — never invent FlightOne policy. */
  knowledgeGuidanceLine?: string | null;
  /** Module 17 management dashboard — authorized KPIs only. */
  dashboardGuidanceLine?: string | null;
  /**
   * Module 04 learned prefs from this user's RecommendationFeedback (bounded).
   * Softest signal — chat intent and profile filters always override.
   */
  learnedPreferences?: import("@/lib/recommendation/learning").LearnedPreferences | null;
}

export interface ConsultantResponse {
  reply: string;
  offers: OfferCard[];
  intent: ExtractedIntent;
  /** Prefetched WhatsApp deeplink for close/handoff turns (UI renders a button). */
  whatsappUrl?: string;
  /** Complete validated journeys when the itinerary pipeline ran. */
  itineraries?: ItinerarySummary[];
  /** Full SERP for the KAYAK-style results rail (all ranked inventory, not chat curation). */
  searchPanel?: SearchResultsPanel;
  meta: {
    /** "gemini" | "lmstudio:..." | "template" */
    provider: string;
    /** True when the reply was grounded in real inventory offers. */
    grounded: boolean;
    /** True when flight offers came from Travelport (not seed JSON). */
    liveFlights?: boolean;
    /** True when hotel offers came from Travelport Stays (not seed JSON). */
    liveHotels?: boolean;
    /** Origin city used for this turn's pitch. */
    originPlace?: string;
    locationSource?: TravellerLocation["source"];
    /** How travel search params were derived for this turn. */
    querySource?: "llm" | "heuristic";
    /** Itinerary pipeline ran for this turn. */
    itineraryMode?: boolean;
    revalidated?: boolean;
    /** Persist across turns for mergeTravelPlan. */
    travelPlan?: TravelPlan | null;
  };
}

/** Compact journey summary for UI / telemetry (no internal PricedOffer refs). */
export interface ItinerarySummary {
  id: string;
  angle: string;
  score: number;
  totalPrice: string;
  /** Total in minor units — used for client-side trip sort. */
  totalPriceMinor: number;
  currency: string;
  reasons: string[];
  hops: string[];
  constraintsSatisfied: boolean;
  construction: "single_ticket" | "multiple_tickets";
  /** True when any leg is sourced from Google Flights market reference. */
  hasMarketReferenceLeg?: boolean;
  /** Per-flight-offer legs for KAYAK-style multi-city trip cards. */
  legs?: Array<{
    originCode: string;
    destinationCode: string;
    airline: string;
    airlineCode: string;
    departTimeLocal: string;
    arriveTimeLocal: string | null;
    durationMinutes: number;
    stops: number;
    stopCodes?: string[];
    maxLayoverMinutes?: number;
    departureDate?: string;
    flightNumber?: string;
    aircraft?: string;
    cabin?: "economy" | "premium" | "business";
    baggageKg?: number;
    refundable?: boolean;
    priceMinor?: number;
    currency?: string;
    /** Google Flights market reference — not bookable via GDS. */
    marketReference?: boolean;
    /** Full sector breakdown for detail modal. */
    segments?: FlightSegment[];
    /** Source offer id — lets a trip card quote this leg like a single offer. */
    offerId?: string;
    /** Supplier snapshot for this leg; absent on synthetic / web-meta legs. */
    supplierOfferSnapshotId?: string;
  }>;
}
