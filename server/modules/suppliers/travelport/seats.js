/**
 * Travelport TripServices Seat Map integration.
 *
 * POST /air/seat/seatmap
 * or POST /book/airoffer/seat/seatmap
 */
import { randomUUID } from "node:crypto";
import { isTravelportConfigured } from "./config.js";
import { travelportFetch } from "./http.js";

function buildDeterministicSeatMap(params) {
  const rows = [];
  const columns = ["A", "B", "C", "D", "E", "F"];
  for (let r = 1; r <= 30; r++) {
    const seats = columns.map((col) => {
      const isExit = r === 12 || r === 14;
      const isPremium = r <= 5;
      const isOccupied = (r * 7 + col.charCodeAt(0)) % 5 === 0;
      return {
        number: `${r}${col}`,
        row: r,
        column: col,
        status: isOccupied ? "OCCUPIED" : "AVAILABLE",
        type: col === "A" || col === "F" ? "WINDOW" : col === "C" || col === "D" ? "AISLE" : "MIDDLE",
        features: [
          ...(isExit ? ["EXIT_ROW"] : []),
          ...(isPremium ? ["EXTRA_LEGROOM"] : []),
        ],
        priceMinor: isPremium ? 2500 : isExit ? 1500 : 0,
        currency: "USD",
      };
    });
    rows.push({ rowNumber: r, seats });
  }

  return {
    carrier: params.carrier || "PK",
    flightNumber: params.flightNumber || "786",
    origin: params.origin || "LHE",
    destination: params.destination || "DXB",
    aircraft: "Boeing 777-300ER",
    cabinClass: params.cabinClass || "ECONOMY",
    rows,
  };
}

/**
 * Fetch seat map for a flight segment.
 *
 * @param {{
 *   carrier?: string,
 *   flightNumber?: string,
 *   origin?: string,
 *   destination?: string,
 *   departureDate?: string,
 *   segmentRef?: string,
 *   workbenchId?: string,
 * }} params
 * @returns {Promise<{ status: "ok"|"unconfigured"|"failed", seatMap?: object, details?: object }>}
 */
export async function getTravelportSeatMap(params = {}) {
  if (!isTravelportConfigured()) {
    return {
      status: "unconfigured",
      seatMap: buildDeterministicSeatMap(params),
      details: { reason: "Travelport unconfigured — deterministic seat map provided for testing" },
    };
  }

  const traceId = `fo-seat-${randomUUID()}`;
  try {
    const body = {
      SeatMapQuery: {
        Flight: {
          carrier: params.carrier,
          number: params.flightNumber,
          Departure: {
            location: params.origin,
            date: params.departureDate,
          },
          Arrival: {
            location: params.destination,
          },
        },
      },
    };

    const res = await travelportFetch("/air/seat/seatmap", {
      method: "POST",
      body,
      traceId,
      allowHttpError: true,
    });

    if (res.status >= 200 && res.status < 300 && res.json) {
      return {
        status: "ok",
        seatMap: res.json?.SeatMapResponse || res.json?.SeatMap || res.json,
        details: { traceId, source: "travelport" },
      };
    }

    return {
      status: "failed",
      details: { reason: res.error || "Travelport seatmap query returned no data", traceId },
    };
  } catch (err) {
    return {
      status: "failed",
      details: { reason: err?.message || "Travelport seatmap call failed", traceId },
    };
  }
}
