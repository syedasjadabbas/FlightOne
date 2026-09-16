/**
 * Development-only flight search timing and request logs.
 * Never logs credentials or tokens.
 */
import type { FlightSearchQuery } from "@/lib/inventory/supplierSearch";

function debugEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.FLIGHT_SEARCH_DEBUG === "true";
}

export function logNormalizedFlightRequest(
  query: FlightSearchQuery,
  extra?: Record<string, unknown>,
): void {
  if (!debugEnabled()) return;
  console.info("[flight-search] normalized request", {
    origin: query.origin,
    destination: query.destination,
    departureDate: query.departureDate,
    returnDate: query.returnDate ?? null,
    travellers: query.passengers ?? 1,
    cabin: query.cabinClass ?? "ECONOMY",
    nonstop: false,
    ...extra,
  });
}

export function logFlightSearchTiming(phase: string, ms: number): void {
  if (!debugEnabled()) return;
  console.info(`[flight-search] ${phase}: ${(ms / 1000).toFixed(1)}s`);
}

export class FlightSearchTimer {
  private readonly startedAt = Date.now();
  private readonly marks = new Map<string, number>();

  mark(phase: string): void {
    this.marks.set(phase, Date.now() - this.startedAt);
  }

  flush(): void {
    if (!debugEnabled()) return;
    for (const [phase, ms] of this.marks) {
      logFlightSearchTiming(phase, ms);
    }
    logFlightSearchTiming("total", Date.now() - this.startedAt);
  }
}
