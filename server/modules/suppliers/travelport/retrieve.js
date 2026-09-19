/**
 * Travelport TripServices Universal Record retrieve & modify.
 *
 * GET /book/reservation/reservations/{locator}
 * POST /book/session/reservationworkbench/buildfromlocator?Locator=
 * POST /book/specialservice/reservationworkbench/{id}/specialservices
 * POST /book/reservation/reservations/{workbenchID}
 */
import { randomUUID } from "node:crypto";
import { isTravelportConfigured } from "./config.js";
import { travelportFetch } from "./http.js";
import { extractWorkbenchId } from "./workbench.js";
import { extractTicketNumbers } from "./ticket.js";

function extractSegments(json) {
  const segments = [];
  const rawSegments =
    json?.ReservationResponse?.Reservation?.Product ||
    json?.Reservation?.Product ||
    json?.Product ||
    [];
  const list = Array.isArray(rawSegments) ? rawSegments : [rawSegments];
  for (const item of list) {
    if (!item) continue;
    const flightSegment = item.FlightSegment || item.Flight || item;
    if (flightSegment.carrier || flightSegment.Carrier || flightSegment.flightNumber || flightSegment.FlightNumber) {
      segments.push({
        carrier: flightSegment.carrier || flightSegment.Carrier || null,
        flightNumber: flightSegment.flightNumber || flightSegment.FlightNumber || null,
        origin: flightSegment.departure?.location || flightSegment.Departure?.location || flightSegment.origin || null,
        destination: flightSegment.arrival?.location || flightSegment.Arrival?.location || flightSegment.destination || null,
        departureTime: flightSegment.departure?.time || flightSegment.Departure?.time || null,
        arrivalTime: flightSegment.arrival?.time || flightSegment.Arrival?.time || null,
      });
    }
  }
  return segments;
}

function extractTravelers(json) {
  const travelers = [];
  const rawTravelers =
    json?.ReservationResponse?.Reservation?.Traveler ||
    json?.Reservation?.Traveler ||
    json?.Traveler ||
    [];
  const list = Array.isArray(rawTravelers) ? rawTravelers : [rawTravelers];
  for (const t of list) {
    if (!t) continue;
    const name = t.PersonName || {};
    travelers.push({
      id: t.id || null,
      givenName: name.Given || null,
      surname: name.Surname || null,
      prefix: name.Prefix || null,
      passengerTypeCode: t.passengerTypeCode || "ADT",
      gender: t.gender || null,
      birthDate: t.birthDate || null,
      ssrs: Array.isArray(t.SpecialService) ? t.SpecialService.map((s) => s.serviceCode || s) : [],
    });
  }
  return travelers;
}

function extractTicketingTimeLimit(json) {
  return (
    json?.ReservationResponse?.Reservation?.TicketingTimeLimit ||
    json?.Reservation?.TicketingTimeLimit ||
    json?.TicketingTimeLimit ||
    json?.Reservation?.Receipt?.PaymentTimeLimit ||
    null
  );
}

/**
 * Retrieve Universal Record / held PNR details by locator.
 * @param {string} locator
 * @returns {Promise<{ status: "ok"|"failed"|"unconfigured", locator?: string, reservation?: object, details?: object }>}
 */
export async function retrieveTravelportReservation(locator) {
  const loc = typeof locator === "string" ? locator.trim() : "";
  if (!loc) {
    return { status: "failed", details: { reason: "Locator required to retrieve reservation" } };
  }
  if (!isTravelportConfigured()) {
    return {
      status: "unconfigured",
      details: { reason: "Travelport credentials not configured" },
    };
  }

  const traceId = `fo-ret-${randomUUID()}`;
  try {
    const encoded = encodeURIComponent(loc);
    const res = await travelportFetch(`/book/reservation/reservations/${encoded}`, {
      method: "GET",
      traceId,
      allowHttpError: true,
    });

    if (res.status >= 400 || !res.json) {
      // Fallback: try opening workbench from locator to retrieve details
      const wbSession = await travelportFetch(
        `/book/session/reservationworkbench/buildfromlocator?Locator=${encoded}`,
        { method: "POST", body: {}, traceId: `${traceId}-wb`, allowHttpError: true },
      );
      if (wbSession.status >= 200 && wbSession.status < 300 && wbSession.json) {
        const ticketNumbers = extractTicketNumbers(wbSession.json);
        const segments = extractSegments(wbSession.json);
        const travelers = extractTravelers(wbSession.json);
        const ttl = extractTicketingTimeLimit(wbSession.json);
        return {
          status: "ok",
          locator: loc,
          reservation: {
            locator: loc,
            status: ticketNumbers.length > 0 ? "TICKETED" : "RESERVED",
            ticketNumbers,
            segments,
            travelers,
            ticketingTimeLimit: ttl,
          },
          details: { traceId, source: "travelport_workbench" },
        };
      }

      return {
        status: "failed",
        details: {
          reason: res.error || "Reservation not found in Travelport",
          traceId,
          locator: loc,
        },
      };
    }

    const ticketNumbers = extractTicketNumbers(res.json);
    const segments = extractSegments(res.json);
    const travelers = extractTravelers(res.json);
    const ttl = extractTicketingTimeLimit(res.json);

    return {
      status: "ok",
      locator: loc,
      reservation: {
        locator: loc,
        status: ticketNumbers.length > 0 ? "TICKETED" : "RESERVED",
        ticketNumbers,
        segments,
        travelers,
        ticketingTimeLimit: ttl,
      },
      details: { traceId, source: "travelport_reservation" },
    };
  } catch (err) {
    return {
      status: "failed",
      details: { reason: err?.message || "Travelport retrieve failed", traceId, locator: loc },
    };
  }
}

/**
 * Modify an existing reservation (e.g. adding SSRs, remarks or contact updates).
 * Opens a workbench from locator, applies updates, commits.
 *
 * @param {string} locator
 * @param {{ ssrs?: Array<{ serviceCode: string, travelerId?: string }>, contact?: { phone?: string, email?: string } }} modifications
 */
export async function modifyTravelportReservation(locator, modifications = {}) {
  const loc = typeof locator === "string" ? locator.trim() : "";
  if (!loc) {
    return { status: "failed", details: { reason: "Locator required to modify reservation" } };
  }
  if (!isTravelportConfigured()) {
    return {
      status: "unconfigured",
      details: { reason: "Travelport credentials not configured" },
    };
  }

  const traceId = `fo-mod-${randomUUID()}`;
  try {
    const encoded = encodeURIComponent(loc);
    const session = await travelportFetch(
      `/book/session/reservationworkbench/buildfromlocator?Locator=${encoded}`,
      { method: "POST", body: {}, traceId: `${traceId}-wb` },
    );
    const workbenchId = extractWorkbenchId(session.json);
    if (!workbenchId) {
      return {
        status: "failed",
        details: { reason: "Travelport did not return a modify workbench id", traceId },
      };
    }

    const encodedWb = encodeURIComponent(workbenchId);

    // Apply SSR modifications if provided
    if (Array.isArray(modifications.ssrs) && modifications.ssrs.length > 0) {
      for (const ssr of modifications.ssrs) {
        await travelportFetch(`/book/specialservice/reservationworkbench/${encodedWb}/specialservices`, {
          method: "POST",
          traceId: `${traceId}-ssr`,
          body: {
            SpecialService: {
              "@type": "SpecialService",
              serviceCode: ssr.serviceCode,
              TravelerIdentifier: ssr.travelerId ? { Identifier: { value: ssr.travelerId } } : undefined,
            },
          },
          allowHttpError: true,
        });
      }
    }

    // Commit modified reservation
    const commit = await travelportFetch(`/book/reservation/reservations/${encodedWb}`, {
      method: "POST",
      traceId: `${traceId}-commit`,
      body: {},
    });

    return {
      status: "ok",
      locator: loc,
      updated: true,
      details: { traceId, workbenchId, commitStatus: commit.status },
    };
  } catch (err) {
    return {
      status: "failed",
      details: { reason: err?.message || "Travelport modify failed", traceId, locator: loc },
    };
  }
}
