/**
 * Module 08 — Traveller visa context from Module 02 / 07 (no duplicate storage).
 * Service-adjacent helper used only by visa.service — not routes/controllers.
 */
import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import { computeExpiryStatus } from "../profile/documentExpiry.js";

/**
 * Load nationality + identity/vault-linked documents for visa assessment.
 * Never returns decrypted document numbers.
 */
export async function loadTravellerVisaContext(userId) {
  if (!userId) {
    throw new AppError(401, "Authentication required");
  }

  const [profile, identityDocs, vaultDocs] = await Promise.all([
    prisma.travellerProfile.findUnique({
      where: { userId },
      select: { nationality: true, displayName: true },
    }),
    prisma.travellerIdentityDocument.findMany({
      where: { ownerUserId: userId, status: "ACTIVE" },
      select: {
        id: true,
        type: true,
        countryCode: true,
        documentSubtype: true,
        expiresAt: true,
        verificationStatus: true,
        vaultDocumentId: true,
        companionId: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.vaultDocument.findMany({
      where: { ownerUserId: userId, isActive: true },
      select: {
        id: true,
        type: true,
        title: true,
        expiresAt: true,
        companionId: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const passports = identityDocs.filter((d) => d.type === "PASSPORT");
  const visas = identityDocs.filter((d) => d.type === "VISA");
  const residence = identityDocs.filter((d) => d.type === "RESIDENCE_PERMIT");
  const nationalIds = identityDocs.filter((d) => d.type === "NATIONAL_ID");

  return {
    userId,
    nationality: profile?.nationality?.toUpperCase?.() || profile?.nationality || null,
    hasPassport: passports.length > 0,
    passports: passports.map((d) => ({
      id: d.id,
      countryCode: d.countryCode,
      expiresAt: d.expiresAt,
      expiry: computeExpiryStatus(d.expiresAt),
      verificationStatus: d.verificationStatus,
      vaultDocumentId: d.vaultDocumentId,
    })),
    visasHeld: visas.map((d) => ({
      id: d.id,
      countryCode: d.countryCode,
      documentSubtype: d.documentSubtype,
      expiresAt: d.expiresAt,
      expiry: computeExpiryStatus(d.expiresAt),
      verificationStatus: d.verificationStatus,
      vaultDocumentId: d.vaultDocumentId,
    })),
    residencePermits: residence.map((d) => ({
      id: d.id,
      countryCode: d.countryCode,
      expiresAt: d.expiresAt,
      expiry: computeExpiryStatus(d.expiresAt),
      verificationStatus: d.verificationStatus,
      vaultDocumentId: d.vaultDocumentId,
    })),
    nationalIds: nationalIds.map((d) => ({
      id: d.id,
      countryCode: d.countryCode,
      verificationStatus: d.verificationStatus,
    })),
    vaultDocuments: vaultDocs.map((d) => ({
      id: d.id,
      type: d.type,
      title: d.title,
      expiresAt: d.expiresAt,
      expiry: computeExpiryStatus(d.expiresAt),
    })),
  };
}

/**
 * Build checklist progress from requirement requiredDocuments vs owned docs.
 * Heuristic matching only — never invents that a document "satisfies" a legal bar.
 */
export function buildDocumentChecklistGuidance(requiredDocuments, travellerContext) {
  const items = Array.isArray(requiredDocuments)
    ? requiredDocuments.map((x) => String(x))
    : requiredDocuments && typeof requiredDocuments === "object"
      ? Object.values(requiredDocuments).map((x) => String(x))
      : [];

  if (!items.length) {
    return {
      items: [],
      missingCount: 0,
      note: "No attributed required-document list is on file for this route.",
    };
  }

  const checklist = items.map((label) => {
    const lower = label.toLowerCase();
    let matched = false;
    let matchHint = null;

    if (/passport/.test(lower)) {
      matched = travellerContext.hasPassport;
      matchHint = matched ? "Active passport on profile" : "No active passport on profile";
    } else if (/photo|photograph/.test(lower)) {
      const photo = travellerContext.vaultDocuments.some((v) =>
        /photo|passport|image/i.test(v.title || ""),
      );
      matched = photo;
      matchHint = photo ? "Possible photo found in vault titles" : "No matching vault photo detected";
    } else if (/residence|permit/.test(lower)) {
      matched = travellerContext.residencePermits.length > 0;
      matchHint = matched
        ? "Residence permit on profile"
        : "No residence permit on profile";
    } else if (/visa/.test(lower)) {
      matched = travellerContext.visasHeld.length > 0;
      matchHint = matched ? "Visa document on profile" : "No visa document on profile";
    } else if (/national.?id|cnic|id card/.test(lower)) {
      matched = travellerContext.nationalIds.length > 0;
      matchHint = matched ? "National ID on profile" : "No national ID on profile";
    } else {
      matchHint =
        "Cannot auto-confirm this item from Profile/Vault — review manually (guidance only)";
    }

    return {
      item: label,
      presentHint: matched,
      matchHint,
      // Never claim legal sufficiency — only presence hints.
      legallySatisfied: null,
    };
  });

  return {
    items: checklist,
    missingCount: checklist.filter((c) => c.presentHint === false).length,
    note: "Checklist presence hints are guidance only — not a determination of visa eligibility.",
  };
}

/**
 * Visa validity awareness for held visas matching destination (when dates exist).
 */
export function summarizeHeldVisaValidity(travellerContext, destinationCode) {
  const dest = String(destinationCode || "").toUpperCase();
  const matching = (travellerContext.visasHeld || []).filter(
    (v) => v.countryCode && String(v.countryCode).toUpperCase() === dest,
  );
  if (!matching.length) {
    return {
      hasMatchingVisaOnFile: false,
      visas: [],
      note: "No destination-matching visa document on the traveller profile.",
    };
  }
  return {
    hasMatchingVisaOnFile: true,
    visas: matching.map((v) => ({
      id: v.id,
      expiresAt: v.expiresAt,
      expiryStatus: v.expiry?.status ?? null,
      verificationStatus: v.verificationStatus,
      // Do not claim the visa covers the trip purpose — guidance only.
      coversTrip: null,
    })),
    note: "Matching visa metadata found — validity shown from stored dates only; eligibility is not inferred.",
  };
}
