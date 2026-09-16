/**
 * Travelport TripServices book workbench (held PNR).
 * Never invents locators. Returns failed/unconfigured when the API does not confirm.
 *
 * POST /book/session/reservationworkbench
 * POST /book/airoffer/reservationworkbench/{id}/offers/buildfromcatalogofferings
 * POST /book/traveler/reservationworkbench/{id}/travelers
 * POST /book/reservation/reservations/{workbenchID}
 */
import { randomUUID } from "node:crypto";
import { isTravelportConfigured, travelportConfig } from "./config.js";
import { travelportFetch } from "./http.js";
import { bookingRefsForRevalidation } from "../suppliers.service.js";
import { extractWorkbenchId } from "./workbench.js";

function extractLocator(json) {
  const candidates = [
    json?.ReservationResponse?.Reservation?.Receipt?.Confirmation?.Locator?.value,
    json?.ReservationResponse?.Reservation?.Locator?.value,
    json?.Reservation?.Receipt?.Confirmation?.Locator?.value,
    json?.Reservation?.Locator?.value,
    json?.Locator?.value,
    json?.LocatorCode,
    json?.locator,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

function travelerFromSnapshot(snapshot) {
  const s = snapshot && typeof snapshot === "object" ? snapshot : {};
  const given =
    s.givenName ||
    s.firstName ||
    (typeof s.fullName === "string" ? s.fullName.split(/\s+/)[0] : null) ||
    s.name;
  const surname =
    s.surname ||
    s.lastName ||
    (typeof s.fullName === "string" ? s.fullName.split(/\s+/).slice(-1)[0] : null);
  if (!given || !surname) return null;
  return {
    Traveler: {
      "@type": "Traveler",
      PersonName: {
        "@type": "PersonName",
        Given: String(given),
        Surname: String(surname),
      },
    },
  };
}

/**
 * @returns {Promise<{ status: "ok"|"failed"|"unconfigured", externalRef?: string|null, details?: object }>}
 */
export async function bookHeldReservationWithTravelport(booking) {
  if (!isTravelportConfigured()) {
    return { status: "unconfigured", details: { reason: "Travelport credentials are not configured" } };
  }

  const refs = bookingRefsForRevalidation(booking?.supplierBookingRefs) || {};
  const transactionId = refs.transactionId;
  const offeringId = refs.offeringId;
  const productRef = refs.productRef;
  if (!transactionId || !offeringId || !productRef) {
    return {
      status: "failed",
      details: { reason: "Missing supplier catalog references for workbench book" },
    };
  }

  const traveler = travelerFromSnapshot(booking?.travellerSnapshot);
  if (!traveler) {
    return {
      status: "failed",
      details: { reason: "Traveller details required for supplier reservation" },
    };
  }

  const traceId = `fo-book-${randomUUID()}`;
  const cfg = travelportConfig();

  try {
    const session = await travelportFetch("/book/session/reservationworkbench", {
      method: "POST",
      body: { ReservationWorkbench: { "@type": "ReservationWorkbench" } },
      traceId: `${traceId}-wb`,
      baseUrl: cfg.airBaseUrl,
    });
    const workbenchId = extractWorkbenchId(session.json);
    if (!workbenchId) {
      return {
        status: "failed",
        details: { reason: "Travelport did not return a workbench id", traceId, e2e: session.e2eTrackingId ?? null },
      };
    }

    await travelportFetch(
      `/book/airoffer/reservationworkbench/${encodeURIComponent(workbenchId)}/offers/buildfromcatalogofferings`,
      {
        method: "POST",
        traceId: `${traceId}-offer`,
        body: {
          OfferQueryBuildFromCatalogOfferings: {
            CatalogOfferingsIdentifier: { Identifier: { value: transactionId } },
            CatalogOfferingIdentifier: { Identifier: { value: offeringId } },
            ProductIdentifier: [{ Identifier: { value: productRef } }],
          },
        },
      },
    );

    await travelportFetch(
      `/book/traveler/reservationworkbench/${encodeURIComponent(workbenchId)}/travelers`,
      {
        method: "POST",
        traceId: `${traceId}-pax`,
        body: traveler,
      },
    );

    const commit = await travelportFetch(
      `/book/reservation/reservations/${encodeURIComponent(workbenchId)}`,
      {
        method: "POST",
        traceId: `${traceId}-commit`,
        body: {},
      },
    );

    const locator = extractLocator(commit.json);
    if (!locator) {
      return {
        status: "failed",
        details: {
          reason: "Travelport commit returned no locator",
          traceId,
          workbenchId,
        },
      };
    }

    return {
      status: "ok",
      externalRef: locator,
      details: { traceId, workbenchId, source: "travelport" },
    };
  } catch (err) {
    return {
      status: "failed",
      details: {
        reason: err?.message || "Travelport book failed",
        traceId,
      },
    };
  }
}

/**
 * Best-effort hold release. Tries documented cancel paths; never invents success.
 */
export async function cancelTravelportHold(booking) {
  const locator = typeof booking?.externalRef === "string" ? booking.externalRef.trim() : "";
  if (!locator) {
    return { status: "skipped", reason: "no live locator" };
  }
  if (!isTravelportConfigured()) {
    return { status: "skipped", reason: "Travelport unconfigured — cannot cancel supplier hold" };
  }

  const encoded = encodeURIComponent(locator);
  const attempts = [
    { path: `/book/reservation/reservations/${encoded}/cancel`, body: {} },
    { path: `/book/reservation/cancel`, body: { Locator: { value: locator } } },
  ];

  for (const attempt of attempts) {
    const res = await travelportFetch(attempt.path, {
      method: "POST",
      body: attempt.body,
      allowHttpError: true,
    });
    if (res.status >= 200 && res.status < 300) {
      return { status: "ok", locator, path: attempt.path };
    }
  }

  return {
    status: "failed",
    reason: "Travelport cancel endpoints did not confirm hold release",
    locator,
  };
}
