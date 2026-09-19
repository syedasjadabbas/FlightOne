/**
 * Travelport TripServices Divide PNR (split passengers from reservation).
 *
 * POST /book/reservation/reservations/{locator}/divide
 */
import { randomUUID } from "node:crypto";
import { isTravelportConfigured } from "./config.js";
import { travelportFetch } from "./http.js";

/**
 * Split one or more passengers from an existing reservation into a child PNR.
 *
 * @param {string} locator Parent PNR locator
 * @param {{ passengerIds?: string[], passengerNames?: string[] }} params
 * @returns {Promise<{
 *   status: "ok"|"unconfigured"|"failed",
 *   parentLocator?: string,
 *   childLocator?: string,
 *   splitPassengers?: string[],
 *   details?: object,
 * }>}
 */
export async function divideTravelportReservation(locator, params = {}) {
  const loc = typeof locator === "string" ? locator.trim() : "";
  if (!loc) {
    return { status: "failed", details: { reason: "Parent locator required to divide reservation" } };
  }

  const ids = Array.isArray(params.passengerIds) ? params.passengerIds : [];
  if (!ids.length && !params.passengerNames?.length) {
    return { status: "failed", details: { reason: "At least one passenger ID or name required to split PNR" } };
  }

  if (!isTravelportConfigured()) {
    const childLocator = `DIV-${randomUUID().slice(0, 6).toUpperCase()}`;
    return {
      status: "unconfigured",
      parentLocator: loc,
      childLocator,
      splitPassengers: ids.length ? ids : params.passengerNames,
      details: { reason: "Travelport unconfigured — simulated PNR divide for testing" },
    };
  }

  const traceId = `fo-div-${randomUUID()}`;
  try {
    const encoded = encodeURIComponent(loc);
    const body = {
      DivideReservation: {
        TravelerIdentifier: ids.map((id) => ({ Identifier: { value: id } })),
      },
    };

    const res = await travelportFetch(`/book/reservation/reservations/${encoded}/divide`, {
      method: "POST",
      body,
      traceId,
      allowHttpError: true,
    });

    if (res.status >= 200 && res.status < 300 && res.json) {
      const child =
        res.json?.ReservationResponse?.Reservation?.Receipt?.Confirmation?.Locator?.value ||
        res.json?.Reservation?.Locator?.value ||
        res.json?.childLocator;

      return {
        status: "ok",
        parentLocator: loc,
        childLocator: child || null,
        splitPassengers: ids,
        details: { traceId, source: "travelport" },
      };
    }

    return {
      status: "failed",
      details: { reason: res.error || "Travelport divide reservation call failed", traceId },
    };
  } catch (err) {
    return {
      status: "failed",
      details: { reason: err?.message || "Travelport divide failed", traceId },
    };
  }
}
