import type { Money } from "@/types/money";
import type { PricedOffer } from "@/lib/pricing/pricing";

/**
 * Complete-journey candidate — assembled from priced components (or a single
 * GDS-priced RT offer). Pricing totals are sums of PricedOffer fields only;
 * never re-apply markup here.
 */
export interface ItineraryCandidate {
  id: string;
  offers: PricedOffer[];
  totalCustomerPrice: Money;
  totalNetFare: Money;
  totalMarginMinor: number;
  currency: string;
  constraints: {
    satisfied: boolean;
    violations: string[];
  };
  metrics: {
    totalDurationMinutes: number;
    totalStops: number;
    longestLayoverMinutes: number;
    overnightConnections: number;
  };
  ticketing: {
    construction: "single_ticket" | "multiple_tickets";
    risk: "low" | "medium" | "high";
  };
  market?: ItineraryMarketComparison;
}

export interface ItineraryMarketComparison {
  referencePrice?: Money;
  savings?: Money;
  savingsPct?: number;
  verified: boolean;
  source?: string;
}
