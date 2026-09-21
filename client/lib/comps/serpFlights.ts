import { API_BASE_URL } from "@/lib/api/baseApi";
import { isSerpConfigured } from "./serpHotels";

export type SerpFlightSegment = {
  carrier: string;
  flightNumber: string;
  originCode: string;
  destinationCode: string;
  departTimeLocal?: string;
  arriveTimeLocal?: string;
  durationMinutes?: number;
};

export type SerpFlightOption = {
  airlines: string[];
  /** Primary marketing carrier guess (2-letter when detectable). */
  carrierHint: string | null;
  priceMajor: number | null;
  currency: string;
  stops: number | null;
  durationMinutes: number | null;
  departureId: string | null;
  arrivalId: string | null;
  segments?: SerpFlightSegment[];
};

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data?: T;
};

const EMPTY: { options: SerpFlightOption[]; lowestPriceMajor: number | null } = {
  options: [],
  lowestPriceMajor: null,
};

function compsBase(): string {
  return (
    process.env.FLIGHTONE_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    API_BASE_URL
  ).replace(/\/$/, "");
}

function authHeaders(): HeadersInit | null {
  const internalKey = process.env.INTERNAL_API_KEY;
  if (!internalKey) {
    console.warn("[comps] INTERNAL_API_KEY missing — cannot reach backend Serp");
    return null;
  }
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Internal-Api-Key": internalKey,
  };
}

/**
 * Google Flights via Express `/api/v1/comps/flights`. Soft-fail → [].
 * One-way by default; set returnDate for round trip.
 */
export async function searchGoogleFlights(opts: {
  origin: string;
  destination: string;
  outboundDate: string;
  returnDate?: string;
  currency: string;
  adults?: number;
  /** Optional; only 2-char IATA codes are sent. Prefer post-filter instead. */
  includeAirlines?: string[];
  timeoutMs?: number;
}): Promise<{ options: SerpFlightOption[]; lowestPriceMajor: number | null }> {
  if (!isSerpConfigured()) return EMPTY;

  const headers = authHeaders();
  if (!headers) return EMPTY;

  const timeoutMs = opts.timeoutMs ?? 20000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs + 5000);

  try {
    const res = await fetch(`${compsBase()}/comps/flights`, {
      method: "POST",
      headers,
      body: JSON.stringify(opts),
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[comps/flights] HTTP ${res.status}`);
      return EMPTY;
    }
    const body = (await res.json()) as ApiEnvelope<{
      options?: SerpFlightOption[];
      lowestPriceMajor?: number | null;
    }>;
    return {
      options: body?.data?.options ?? [],
      lowestPriceMajor: body?.data?.lowestPriceMajor ?? null,
    };
  } catch (e) {
    console.warn("[comps/flights] failed:", e instanceof Error ? e.message : e);
    return EMPTY;
  } finally {
    clearTimeout(timer);
  }
}
