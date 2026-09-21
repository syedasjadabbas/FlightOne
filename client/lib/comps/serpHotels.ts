import { API_BASE_URL } from "@/lib/api/baseApi";
import type { Gps, SerpHotelProperty } from "./types";

export type { Gps, SerpHotelProperty };

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data?: T;
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
 * True when Next can call Express comps (Serp key lives on the server).
 */
export function isSerpConfigured(): boolean {
  return Boolean(process.env.INTERNAL_API_KEY?.trim());
}

/**
 * Google Hotels via Express `/api/v1/comps/hotels`. Soft-fail → [].
 */
export async function searchGoogleHotels(opts: {
  q: string;
  checkInDate: string;
  checkOutDate: string;
  currency: string;
  adults?: number;
  hotelClass?: number;
  timeoutMs?: number;
}): Promise<SerpHotelProperty[]> {
  const headers = authHeaders();
  if (!headers) return [];

  const timeoutMs = opts.timeoutMs ?? 18000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs + 5000);

  try {
    const res = await fetch(`${compsBase()}/comps/hotels`, {
      method: "POST",
      headers,
      body: JSON.stringify(opts),
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[comps/hotels] HTTP ${res.status}`);
      return [];
    }
    const body = (await res.json()) as ApiEnvelope<{ properties?: SerpHotelProperty[] }>;
    return body?.data?.properties ?? [];
  } catch (e) {
    console.warn("[comps/hotels] failed:", e instanceof Error ? e.message : e);
    return [];
  } finally {
    clearTimeout(timer);
  }
}
