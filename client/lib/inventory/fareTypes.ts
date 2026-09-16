/** Structured fare metadata from Travelport — only populated when GDS returns data. */

export interface BaggagePiece {
  included: boolean;
  pieces?: number;
  weightKg?: number;
  text?: string;
}

export interface BaggageAllowance {
  carryOn?: BaggagePiece;
  checked?: BaggagePiece;
}

export interface FareRulesSummary {
  changes?: string;
  cancellation?: string;
  refund?: string;
  noShow?: string;
}

export interface SupplierPriceBreakdown {
  currency: string;
  baseMinor?: number;
  taxesMinor?: number;
  feesMinor?: number;
  totalMinor: number;
}

export interface SupplierBookingRefs {
  productRef?: string | null;
  brandRef?: string | null;
  flightRefs?: string[];
  returnFlightRefs?: string[];
  transactionId?: string | null;
  combinabilityCode?: string | null;
  contentSource?: string | null;
}

export type ConnectionWarningKind =
  | "short_layover"
  | "long_layover"
  | "overnight_connection"
  | "airport_change";

export interface ConnectionWarning {
  kind: ConnectionWarningKind;
  message: string;
  atAirportCode: string;
  layoverMinutes?: number;
}

/** GDS search snapshot — not a revalidated bookable quote until revalidation succeeds. */
export type FareValidationStatus = "search_only" | "revalidated";

export interface FlightFareMetadata {
  brandName?: string;
  brandCode?: string;
  fareBasisCode?: string;
  bookingClass?: string;
  fareType?: string;
  validatingCarrier?: string;
  paymentTimeLimit?: string;
  baggageAllowance?: BaggageAllowance;
  fareRulesSummary?: FareRulesSummary;
  supplierPriceBreakdown?: SupplierPriceBreakdown;
  bookingRefs?: SupplierBookingRefs;
  validationStatus: FareValidationStatus;
  connectionWarnings?: ConnectionWarning[];
}
