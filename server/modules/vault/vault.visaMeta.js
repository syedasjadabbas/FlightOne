/**
 * Phase 2 Visa Vault — traveller-owned visa metadata on VaultDocument.
 *
 * Does not invent embassy rules, processing times, or eligibility.
 * Attributed intelligence is attached at read time from Module 08 catalog/http.
 */
import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import { computeExpiryStatus } from "../profile/documentExpiry.js";

export const VAULT_VISA_HOLDER_STATUSES = [
  "ISSUED",
  "PENDING",
  "IN_PROCESS",
  "CANCELLED",
];

export const VISA_RECORD_PUBLIC_SELECT = {
  destinationCode: true,
  visaType: true,
  holderStatus: true,
  visaApplicationId: true,
  appointmentAt: true,
  appointmentLocation: true,
  issuingAuthority: true,
  remindersEnabled: true,
};

/**
 * Display status for a visa vault document. EXPIRED/EXPIRING are derived from
 * expiresAt; CANCELLED/PENDING/IN_PROCESS come from traveller-entered holderStatus.
 */
export function computeVisaDisplayStatus({
  holderStatus,
  expiresAt,
  isActive,
  now = new Date(),
} = {}) {
  if (isActive === false) return "SUPERSEDED";
  if (holderStatus === "CANCELLED") return "CANCELLED";
  const expiry = computeExpiryStatus(expiresAt, { now });
  if (expiry.isExpired) return "EXPIRED";
  if (holderStatus === "PENDING") return "PENDING";
  if (holderStatus === "IN_PROCESS") return "IN_PROCESS";
  if (expiry.state === "expiring_soon") return "EXPIRING";
  return "ISSUED";
}

export function toPublicVisaMeta(record, { expiresAt, isActive, now } = {}) {
  if (!record) return null;
  return {
    destinationCode: record.destinationCode ?? null,
    visaType: record.visaType ?? null,
    holderStatus: record.holderStatus ?? "ISSUED",
    visaStatus: computeVisaDisplayStatus({
      holderStatus: record.holderStatus,
      expiresAt,
      isActive,
      now,
    }),
    visaApplicationId: record.visaApplicationId ?? null,
    appointmentAt: record.appointmentAt ?? null,
    appointmentLocation: record.appointmentLocation ?? null,
    issuingAuthority: record.issuingAuthority ?? null,
    remindersEnabled: record.remindersEnabled !== false,
  };
}

function normalizeVisaMetaPatch(patch) {
  if (patch == null) return null;
  if (typeof patch !== "object" || Array.isArray(patch)) {
    throw new AppError(400, "visaMeta must be an object");
  }
  const data = {};
  if (patch.destinationCode !== undefined) {
    data.destinationCode = patch.destinationCode
      ? String(patch.destinationCode).trim().toUpperCase()
      : null;
  }
  if (patch.visaType !== undefined) {
    data.visaType = patch.visaType ? String(patch.visaType).trim() : null;
  }
  if (patch.holderStatus !== undefined) {
    if (
      patch.holderStatus != null &&
      !VAULT_VISA_HOLDER_STATUSES.includes(patch.holderStatus)
    ) {
      throw new AppError(400, "Invalid visa holderStatus");
    }
    data.holderStatus = patch.holderStatus || "ISSUED";
  }
  if (patch.visaApplicationId !== undefined) {
    data.visaApplicationId = patch.visaApplicationId || null;
  }
  if (patch.appointmentAt !== undefined) {
    data.appointmentAt = patch.appointmentAt ?? null;
  }
  if (patch.appointmentLocation !== undefined) {
    data.appointmentLocation = patch.appointmentLocation
      ? String(patch.appointmentLocation).trim()
      : null;
  }
  if (patch.issuingAuthority !== undefined) {
    data.issuingAuthority = patch.issuingAuthority
      ? String(patch.issuingAuthority).trim()
      : null;
  }
  if (patch.remindersEnabled !== undefined) {
    data.remindersEnabled = Boolean(patch.remindersEnabled);
  }
  return data;
}

export async function assertOwnedVisaApplication(userId, applicationId) {
  if (!applicationId) return null;
  const application = await prisma.visaApplication.findFirst({
    where: { id: applicationId, userId },
    select: {
      id: true,
      status: true,
      appointmentAt: true,
      appointmentLocation: true,
      destinationCode: true,
      nationalityCode: true,
      vaultDocumentIds: true,
    },
  });
  if (!application) {
    throw new AppError(404, "Visa application not found");
  }
  return application;
}

async function linkDocumentOnApplication(application, documentId) {
  if (!application || !documentId) return;
  const existing = Array.isArray(application.vaultDocumentIds)
    ? application.vaultDocumentIds.filter((id) => typeof id === "string")
    : [];
  if (existing.includes(documentId)) return;
  await prisma.visaApplication.update({
    where: { id: application.id },
    data: { vaultDocumentIds: [...existing, documentId] },
  });
}

/**
 * Create or update the visa record for a VISA vault document.
 * Rejects visaMeta on non-VISA types.
 */
export async function upsertVisaRecord({
  documentId,
  ownerUserId,
  type,
  visaMeta,
  copyFromDocumentId,
}) {
  if (type !== "VISA") {
    if (visaMeta) {
      throw new AppError(400, "visaMeta is only allowed for VISA documents");
    }
    return null;
  }

  const patch = normalizeVisaMetaPatch(visaMeta) || {};
  if (patch.visaApplicationId) {
    const application = await assertOwnedVisaApplication(
      ownerUserId,
      patch.visaApplicationId,
    );
    await linkDocumentOnApplication(application, documentId);
    if (patch.appointmentAt === undefined && application.appointmentAt) {
      patch.appointmentAt = application.appointmentAt;
    }
    if (patch.appointmentLocation === undefined && application.appointmentLocation) {
      patch.appointmentLocation = application.appointmentLocation;
    }
    if (patch.destinationCode === undefined && application.destinationCode) {
      patch.destinationCode = application.destinationCode;
    }
  }

  let base = {};
  if (copyFromDocumentId) {
    const prior = await prisma.vaultVisaRecord.findUnique({
      where: { documentId: copyFromDocumentId },
      select: VISA_RECORD_PUBLIC_SELECT,
    });
    if (prior) base = { ...prior };
  } else {
    const existing = await prisma.vaultVisaRecord.findUnique({
      where: { documentId },
      select: VISA_RECORD_PUBLIC_SELECT,
    });
    if (existing) base = { ...existing };
  }

  const data = {
    destinationCode:
      patch.destinationCode !== undefined
        ? patch.destinationCode
        : (base.destinationCode ?? null),
    visaType: patch.visaType !== undefined ? patch.visaType : (base.visaType ?? null),
    holderStatus:
      patch.holderStatus !== undefined
        ? patch.holderStatus
        : (base.holderStatus ?? "ISSUED"),
    visaApplicationId:
      patch.visaApplicationId !== undefined
        ? patch.visaApplicationId
        : (base.visaApplicationId ?? null),
    appointmentAt:
      patch.appointmentAt !== undefined
        ? patch.appointmentAt
        : (base.appointmentAt ?? null),
    appointmentLocation:
      patch.appointmentLocation !== undefined
        ? patch.appointmentLocation
        : (base.appointmentLocation ?? null),
    issuingAuthority:
      patch.issuingAuthority !== undefined
        ? patch.issuingAuthority
        : (base.issuingAuthority ?? null),
    remindersEnabled:
      patch.remindersEnabled !== undefined
        ? patch.remindersEnabled
        : (base.remindersEnabled ?? true),
  };

  return prisma.vaultVisaRecord.upsert({
    where: { documentId },
    create: { documentId, ...data },
    update: data,
    select: VISA_RECORD_PUBLIC_SELECT,
  });
}

/**
 * Attributed Module 08 overlay — never invents category/embassy/processing.
 * Returned only on document detail reads.
 */
export async function loadVisaIntelligenceOverlay({
  ownerUserId,
  destinationCode,
  visaApplicationId,
}) {
  const overlay = {
    dataStatus: "INCOMPLETE_INPUTS",
    isFact: false,
    isGuidance: true,
    category: null,
    source: null,
    lastVerifiedAt: null,
    embassyInfo: null,
    processingDaysMin: null,
    processingDaysMax: null,
    requiredDocuments: null,
    confidenceNote:
      "Destination country is required before attributed visa guidance can be shown.",
    linkedApplication: null,
  };

  if (visaApplicationId) {
    const application = await prisma.visaApplication.findFirst({
      where: { id: visaApplicationId, userId: ownerUserId },
      select: {
        id: true,
        status: true,
        appointmentAt: true,
        appointmentLocation: true,
        destinationCode: true,
        nationalityCode: true,
        category: true,
      },
    });
    if (application) {
      overlay.linkedApplication = application;
    }
  }

  const dest =
    destinationCode || overlay.linkedApplication?.destinationCode || null;
  if (!dest) {
    return overlay;
  }

  const profile = await prisma.travellerProfile.findUnique({
    where: { userId: ownerUserId },
    select: { nationality: true },
  });
  const nationality = profile?.nationality?.toUpperCase?.() || null;
  if (!nationality || nationality.length !== 2) {
    overlay.confidenceNote =
      "Nationality on your profile is required to look up attributed destination visa guidance. Requirements are not invented.";
    return overlay;
  }

  const { fetchVisaRequirementRow, toVisaRequirementAssessment } = await import(
    "../visa/visa.provider.js"
  );
  const row = await fetchVisaRequirementRow(nationality, dest);
  const assessment = toVisaRequirementAssessment(row, {
    nationalityCode: nationality,
    destinationCode: dest,
    role: "destination",
  });

  return {
    dataStatus: assessment.dataStatus,
    isFact: Boolean(assessment.isFact),
    isGuidance: !assessment.isFact,
    category: assessment.category ?? null,
    source: assessment.source ?? null,
    lastVerifiedAt: assessment.lastVerifiedAt ?? null,
    embassyInfo: assessment.isFact || assessment.dataStatus === "STALE"
      ? assessment.embassyInfo ?? null
      : null,
    processingDaysMin: assessment.processingDaysMin ?? null,
    processingDaysMax: assessment.processingDaysMax ?? null,
    requiredDocuments:
      assessment.isFact || assessment.dataStatus === "STALE"
        ? assessment.requiredDocuments ?? null
        : null,
    confidenceNote: assessment.confidenceNote,
    linkedApplication: overlay.linkedApplication,
    nationalityCode: nationality,
    destinationCode: dest,
  };
}
