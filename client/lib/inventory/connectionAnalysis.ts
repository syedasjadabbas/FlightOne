import type { FlightSegment } from "./types";
import type { ConnectionWarning } from "./fareTypes";

/** Minimum connection time before flagging a short layover (minutes). */
export const SHORT_LAYOVER_MINUTES = 45;

/** Layover longer than this is flagged as a long connection (minutes). */
export const LONG_LAYOVER_MINUTES = 240;

function normCode(code: string | undefined): string {
  return (code ?? "").trim().toUpperCase();
}

/** Analyze segment connections for airport changes and layover warnings. */
export function analyzeConnectionWarnings(segments: FlightSegment[]): ConnectionWarning[] {
  const warnings: ConnectionWarning[] = [];
  if (segments.length < 2) return warnings;

  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]!;
    const next = segments[i + 1]!;
    const at = normCode(seg.destinationCode);
    const layover = seg.layoverMinutesAfter ?? 0;

    if (at && normCode(next.originCode) !== at) {
      warnings.push({
        kind: "airport_change",
        message: `Airport change: arrive ${at}, depart ${next.originCode}`,
        atAirportCode: at,
        ...(layover > 0 ? { layoverMinutes: layover } : {}),
      });
    }

    if (layover > 0) {
      if (layover < SHORT_LAYOVER_MINUTES) {
        warnings.push({
          kind: "short_layover",
          message: `Short connection (${layover} min) in ${at}`,
          atAirportCode: at,
          layoverMinutes: layover,
        });
      } else if (layover >= LONG_LAYOVER_MINUTES) {
        warnings.push({
          kind: "long_layover",
          message: `Long layover (${Math.round(layover / 60)}h ${layover % 60}m) in ${at}`,
          atAirportCode: at,
          layoverMinutes: layover,
        });
      }
    }

    if (
      seg.arrivalDate &&
      next.departureDate &&
      seg.arrivalDate !== next.departureDate
    ) {
      warnings.push({
        kind: "overnight_connection",
        message: `Overnight connection in ${at}`,
        atAirportCode: at,
        ...(layover > 0 ? { layoverMinutes: layover } : {}),
      });
    }
  }

  return warnings;
}

export function allConnectionWarnings(
  outbound: FlightSegment[] | undefined,
  inbound: FlightSegment[] | undefined,
): ConnectionWarning[] {
  return [
    ...analyzeConnectionWarnings(outbound ?? []),
    ...analyzeConnectionWarnings(inbound ?? []),
  ];
}
