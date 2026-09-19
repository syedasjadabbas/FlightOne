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

function formatSingleTraveler(s, index = 0) {
  if (!s || typeof s !== "object") return null;
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

  const travelerId = s.id || `pax-${index + 1}`;
  const personName = {
    "@type": "PersonName",
    Given: String(given).trim(),
    Surname: String(surname).trim(),
  };

  // SDS Rule 4: Passenger titles appended automatically (MR/MRS/MS/MSTR/MISS)
  const title = s.title || s.prefix;
  if (title && typeof title === "string" && title.trim()) {
    personName.Prefix = title.trim().toUpperCase();
  }

  const traveler = {
    "@type": "Traveler",
    id: travelerId,
    PersonName: personName,
  };

  // Passenger type: ADT, CNN/CHD, INF
  const ptc = s.passengerType || s.passengerTypeCode || s.type || s.ptc;
  if (ptc && typeof ptc === "string") {
    traveler.passengerTypeCode = ptc.trim().toUpperCase();
  } else {
    traveler.passengerTypeCode = "ADT";
  }

  // DOB & Gender
  const dob = s.dateOfBirth || s.dob || s.birthDate;
  if (dob && typeof dob === "string") {
    traveler.birthDate = dob.trim().split("T")[0];
  }
  const gender = s.gender || s.sex;
  if (gender && typeof gender === "string") {
    const g = gender.trim().toUpperCase();
    traveler.gender = g.startsWith("M") ? "Male" : g.startsWith("F") ? "Female" : "Undisclosed";
  }

  // Contact (Phone & Email) -> OSI / Contact
  const phone = s.phone || s.telephone || s.mobileNumber;
  if (phone && typeof phone === "string" && phone.trim()) {
    traveler.Telephone = [
      {
        "@type": "Telephone",
        phoneNumber: phone.trim(),
        role: "Mobile",
      },
    ];
  }
  const email = s.email;
  if (email && typeof email === "string" && email.trim()) {
    traveler.Email = [
      {
        "@type": "Email",
        value: email.trim(),
      },
    ];
  }

  // APIS / Passport Document Details
  const doc = s.document || s.passport || s.identityDocument || (Array.isArray(s.documents) ? s.documents[0] : null);
  const docNumber = doc?.number || doc?.passportNumber || s.passportNumber;
  if (docNumber && typeof docNumber === "string" && docNumber.trim()) {
    traveler.DocDetails = [
      {
        "@type": "DocDetails",
        docType: doc?.type || "Passport",
        docNumber: docNumber.trim(),
        issueCountry: (doc?.issuingCountry || doc?.country || s.nationality || "PAK").toUpperCase(),
        nationality: (doc?.nationality || s.nationality || "PAK").toUpperCase(),
        expireDate: doc?.expiryDate || doc?.expireDate || s.passportExpiryDate || null,
        birthDate: traveler.birthDate ?? null,
      },
    ];
  }

  // Frequent Flyer / Loyalty numbers
  const ff = s.frequentFlyer || s.loyaltyProgram || s.loyalty;
  const ffNumber = ff?.number || ff?.accountNumber || s.loyaltyNumber;
  const ffAirline = ff?.airline || ff?.supplierCode || s.loyaltyAirline;
  if (ffNumber && ffAirline) {
    traveler.LoyaltyProgramAccount = [
      {
        "@type": "LoyaltyProgramAccount",
        supplierCode: String(ffAirline).trim().toUpperCase(),
        accountNumber: String(ffNumber).trim(),
      },
    ];
  }

  // SSRs (Special Service Requests: meals, wheelchair, infant/bassinet)
  const ssrs = [];
  const meal = s.mealPreference || s.meal || s.mealCode;
  if (meal && typeof meal === "string" && meal.trim()) {
    ssrs.push({
      "@type": "SpecialService",
      serviceCode: meal.trim().toUpperCase(),
      serviceType: "Meal",
    });
  }
  const assistance = s.assistance || s.wheelchair || s.ssrCode;
  if (assistance && typeof assistance === "string" && assistance.trim()) {
    ssrs.push({
      "@type": "SpecialService",
      serviceCode: assistance.trim().toUpperCase(),
      serviceType: "Assistance",
    });
  }
  if (Array.isArray(s.specialRequests)) {
    for (const req of s.specialRequests) {
      if (req && typeof req === "string") {
        ssrs.push({ "@type": "SpecialService", serviceCode: req.trim().toUpperCase() });
      } else if (req && typeof req === "object" && req.serviceCode) {
        ssrs.push({ "@type": "SpecialService", ...req });
      }
    }
  }
  if (ssrs.length > 0) {
    traveler.SpecialService = ssrs;
  }

  return traveler;
}

export function travelerFromSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;

  // If snapshot contains a passengers array, map each passenger
  const paxList = Array.isArray(snapshot.passengers)
    ? snapshot.passengers
    : Array.isArray(snapshot.travellers)
      ? snapshot.travellers
      : null;

  if (paxList && paxList.length > 0) {
    const formatted = paxList.map((p, idx) => formatSingleTraveler(p, idx)).filter(Boolean);
    if (!formatted.length) return null;
    return {
      Traveler: formatted.length === 1 ? formatted[0] : formatted,
    };
  }

  const single = formatSingleTraveler(snapshot, 0);
  if (!single) return null;
  return {
    Traveler: single,
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

/**
 * Cancel confirmed or held reservation by PNR locator.
 * @param {string} locator
 */
export async function cancelTravelportReservation(locator) {
  const loc = typeof locator === "string" ? locator.trim() : "";
  if (!loc) {
    return { status: "failed", reason: "Locator required to cancel Travelport reservation" };
  }
  if (!isTravelportConfigured()) {
    return { status: "unconfigured", reason: "Travelport credentials not configured" };
  }

  const encoded = encodeURIComponent(loc);
  const attempts = [
    { path: `/book/reservation/reservations/${encoded}/cancel`, body: {} },
    { path: `/book/reservation/cancel`, body: { Locator: { value: loc } } },
  ];

  for (const attempt of attempts) {
    const res = await travelportFetch(attempt.path, {
      method: "POST",
      body: attempt.body,
      allowHttpError: true,
    });
    if (res.status >= 200 && res.status < 300) {
      return { status: "ok", locator: loc, path: attempt.path, details: res.json };
    }
  }

  return {
    status: "failed",
    reason: "Travelport cancel endpoints did not confirm reservation cancellation",
    locator: loc,
  };
}

