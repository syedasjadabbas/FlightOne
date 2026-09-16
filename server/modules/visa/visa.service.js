/**
 * Module 08 — Visa Intelligence.
 *
 * Provider-backed nationality × destination lookups with explicit
 * UNCONFIGURED / DATA_UNAVAILABLE / STALE / VERIFIED statuses.
 * Never invents visa rules, fees, or eligibility.
 */
import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import { hasPermissionEff } from "../../lib/permissions.service.js";
import { DEFAULT_PAGE_SIZE } from "../../lib/utils.js";
import { writeAudit } from "../../lib/audit.js";
import {
  fetchVisaRequirementRow,
  getVisaDataCapability,
  toVisaRequirementAssessment,
} from "./visa.provider.js";
import {
  buildDocumentChecklistGuidance,
  loadTravellerVisaContext,
  summarizeHeldVisaValidity,
} from "./visa.travellerContext.js";
import { assertOwnedVaultDocument } from "../vault/vault.service.js";

const MAX_PAGE_SIZE = 100;
const MAX_TRANSIT_COUNTRIES = 10;

const APPLICATION_SELECT = {
  id: true,
  userId: true,
  nationalityCode: true,
  destinationCode: true,
  category: true,
  status: true,
  appointmentAt: true,
  appointmentLocation: true,
  checklist: true,
  vaultDocumentIds: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
};

const APPLICATION_ALLOWED_TRANSITIONS = {
  DRAFT: ["SUBMITTED", "WITHDRAWN"],
  SUBMITTED: ["IN_PROCESS", "WITHDRAWN"],
  IN_PROCESS: ["APPROVED", "REJECTED", "WITHDRAWN"],
  APPROVED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

export function getCapability() {
  return getVisaDataCapability();
}

/**
 * Core lookup — destination + optional transit countries (distinct roles).
 */
export async function lookupVisa({ nationality, destination, transitCountries } = {}) {
  if (!nationality || !destination) {
    throw new AppError(400, "nationality and destination are required");
  }
  const nationalityCode = String(nationality).toUpperCase();
  const destinationCode = String(destination).toUpperCase();

  const transitCodes = Array.from(
    new Set((transitCountries || []).map((c) => String(c).toUpperCase())),
  ).slice(0, MAX_TRANSIT_COUNTRIES);

  const destRow = await fetchVisaRequirementRow(nationalityCode, destinationCode);
  const result = toVisaRequirementAssessment(destRow, {
    nationalityCode,
    destinationCode,
    role: "destination",
  });

  if (transitCodes.length > 0) {
    const transitRows = await Promise.all(
      transitCodes.map((code) => fetchVisaRequirementRow(nationalityCode, code)),
    );
    result.transit = transitCodes.map((code, i) => {
      const assessment = toVisaRequirementAssessment(transitRows[i], {
        nationalityCode,
        destinationCode: code,
        role: "transit",
      });
      // Surface catalog transitNotes when present — never invent airport/duration rules.
      return {
        ...assessment,
        transitGuidance: assessment.transitNotes
          ? {
              kind: "country_level_notes",
              notes: assessment.transitNotes,
              airportSpecific: false,
              durationSpecific: false,
              note: "Country-level transit notes from attributed catalog only. Airport/duration-specific Timatic rules require an external authority feed.",
            }
          : {
              kind: "unavailable",
              notes: null,
              airportSpecific: false,
              durationSpecific: false,
              note: "No attributed transit notes on file for this nationality × transit country.",
            },
      };
    });
  }

  result.escalateRecommended =
    Boolean(result.escalateRecommended) ||
    (Array.isArray(result.transit) &&
      result.transit.some((t) => t.escalateRecommended));

  return result;
}

async function tryKnowledgeRetrieve(query) {
  try {
    const knowledgeModule = await import("../knowledge/knowledge.service.js");
    if (typeof knowledgeModule.retrieveKnowledge !== "function") {
      return null;
    }
    return await knowledgeModule.retrieveKnowledge({ query, limit: 5 });
  } catch {
    return null;
  }
}

/** GET /requirements */
export async function getVisaRequirements({ nationality, destination, transit }) {
  return lookupVisa({ nationality, destination, transitCountries: transit });
}

/** POST /lookup — structured + optional knowledge (never overrides UNKNOWN with invented facts). */
export async function performVisaLookup({ nationality, destination, transitCountries }) {
  const structured = await lookupVisa({ nationality, destination, transitCountries });
  const query = `visa requirements for ${String(nationality).toUpperCase()} nationality travelling to ${String(destination).toUpperCase()}`;
  const knowledge = await tryKnowledgeRetrieve(query);

  return {
    ...structured,
    knowledge: knowledge ?? { hits: [], coverage: "none" },
    // Knowledge hits are guidance — never elevate coverage to "fact" without attribution.
    knowledgeIsGuidance: true,
  };
}

/**
 * Full traveller-aware assessment (Profile + Vault context).
 * Does not infer eligibility when nationality/passport inputs are missing.
 */
export async function assessVisaForTraveller(
  userId,
  { destination, transitCountries, nationality: nationalityOverride, purpose } = {},
) {
  if (!destination) {
    throw new AppError(400, "destination is required");
  }

  const context = await loadTravellerVisaContext(userId);
  const nationality = (nationalityOverride || context.nationality || "")
    .toString()
    .toUpperCase();

  const missingInputs = [];
  if (!nationality || nationality.length !== 2) {
    missingInputs.push("nationality");
  }
  if (!context.hasPassport) {
    missingInputs.push("passport");
  }

  if (missingInputs.length) {
    return {
      status: "INCOMPLETE_INPUTS",
      isFact: false,
      isGuidance: true,
      escalateRecommended: true,
      missingInputs,
      purpose: purpose ?? null,
      traveller: {
        nationality: context.nationality,
        hasPassport: context.hasPassport,
      },
      requirement: null,
      checklist: null,
      heldVisa: null,
      confidenceNote:
        "Cannot assess visa requirements without required traveller inputs. Do not infer eligibility.",
      avaSummary:
        "I need your nationality (and ideally a passport on file) before I can look up destination visa requirements. I will not guess.",
    };
  }

  const requirement = await lookupVisa({
    nationality,
    destination: String(destination).toUpperCase(),
    transitCountries,
  });

  const checklist = buildDocumentChecklistGuidance(
    requirement.requiredDocuments,
    context,
  );
  const heldVisa = summarizeHeldVisaValidity(
    context,
    String(destination).toUpperCase(),
  );

  const residenceNote =
    context.residencePermits.length > 0
      ? {
          present: true,
          countries: context.residencePermits.map((r) => r.countryCode).filter(Boolean),
          note: "Residence permit on file may affect rules in some destinations — not auto-applied as an exemption.",
        }
      : {
          present: false,
          countries: [],
          note: null,
        };

  const escalateRecommended =
    requirement.escalateRecommended ||
    requirement.dataStatus === "DATA_UNAVAILABLE" ||
    requirement.dataStatus === "UNCONFIGURED" ||
    requirement.dataStatus === "STALE" ||
    (requirement.category === "EMBASSY" && !requirement.isFact);

  const avaSummary = buildAvaVisaSummary({
    requirement,
    checklist,
    heldVisa,
    residenceNote,
    purpose,
  });

  return {
    status: "ASSESSED",
    isFact: requirement.isFact,
    isGuidance: !requirement.isFact,
    escalateRecommended,
    missingInputs: [],
    purpose: purpose ?? null,
    traveller: {
      nationality,
      hasPassport: context.hasPassport,
      passportExpiry: context.passports[0]?.expiresAt ?? null,
      passportExpiryStatus: context.passports[0]?.expiry?.status ?? null,
    },
    requirement,
    checklist,
    heldVisa,
    residence: residenceNote,
    confidenceNote: requirement.confidenceNote,
    avaSummary,
  };
}

function buildAvaVisaSummary({ requirement, checklist, heldVisa, residenceNote, purpose }) {
  const lines = [];
  lines.push(
    `Lookup ${requirement.nationalityCode} → ${requirement.destinationCode} (${requirement.role}): category=${requirement.category}, dataStatus=${requirement.dataStatus}.`,
  );
  if (requirement.isFact) {
    lines.push(
      `Attributed fact from ${requirement.source} (verified ${requirement.lastVerifiedAt}).`,
    );
  } else {
    lines.push(requirement.confidenceNote);
  }
  if (Array.isArray(requirement.transit) && requirement.transit.length) {
    for (const t of requirement.transit) {
      lines.push(
        `Transit ${t.destinationCode}: category=${t.category}, dataStatus=${t.dataStatus} (distinct from destination).`,
      );
    }
  }
  if (checklist?.items?.length) {
    lines.push(
      `Document checklist: ${checklist.missingCount} item(s) without a Profile/Vault presence hint (guidance only).`,
    );
  }
  if (heldVisa?.hasMatchingVisaOnFile) {
    lines.push("A destination-matching visa document exists on profile — check stored expiry; do not assume trip coverage.");
  }
  if (residenceNote?.present) {
    lines.push(residenceNote.note);
  }
  if (purpose) {
    lines.push(`Stated purpose: ${purpose} — purpose-specific eligibility is not inferred.`);
  }
  if (requirement.escalateRecommended) {
    lines.push("Recommend human consultant escalation — confidence is insufficient for a firm answer.");
  }
  lines.push("Never invent fees, processing times, exemptions, or approval likelihood.");
  return lines.join(" ");
}

/** Booking hook — structured assessment only; informational, never a hard block. */
export async function checkVisaForBooking({
  nationality,
  destination,
  transitCountries,
  userId,
} = {}) {
  let nat = nationality;
  if ((!nat || String(nat).length !== 2) && userId) {
    const ctx = await loadTravellerVisaContext(userId);
    nat = ctx.nationality;
  }
  if (!nat || !destination) {
    return {
      category: "UNKNOWN",
      dataStatus: "INCOMPLETE_INPUTS",
      isFact: false,
      isGuidance: true,
      escalateRecommended: false,
      missingInputs: [
        ...(!nat ? ["nationality"] : []),
        ...(!destination ? ["destination"] : []),
      ],
      confidenceNote:
        "Visa check skipped — nationality and destination are both required. Not a booking block.",
    };
  }
  return lookupVisa({
    nationality: nat,
    destination,
    transitCountries,
  });
}

/**
 * Human escalation when visa cannot be confidently resolved.
 * Uses Module 13 createEscalationFromTrigger when conversationId provided;
 * otherwise writes an audit-only recommendation record path via audit log.
 */
export async function escalateVisaUncertainty({
  userId,
  conversationId,
  bookingId,
  assessment,
  reason,
  req,
}) {
  if (!userId) throw new AppError(401, "Authentication required");

  const payload = {
    reason: reason || "Visa case cannot be confidently resolved from attributed data",
    assessmentStatus: assessment?.status ?? assessment?.dataStatus ?? null,
    nationality: assessment?.traveller?.nationality ?? assessment?.nationalityCode ?? null,
    destination:
      assessment?.requirement?.destinationCode ?? assessment?.destinationCode ?? null,
    dataStatus: assessment?.requirement?.dataStatus ?? assessment?.dataStatus ?? null,
    category: assessment?.requirement?.category ?? assessment?.category ?? null,
  };

  await writeAudit({
    userId,
    action: "visa.escalate_recommended",
    resourceType: conversationId ? "Conversation" : "VisaAssessment",
    resourceId: conversationId || bookingId || "none",
    req,
    metadata: payload,
  });

  if (!conversationId) {
    return {
      escalated: false,
      auditOnly: true,
      trigger: "VISA_UNCERTAIN",
      message:
        "Escalation intent recorded. Provide conversationId to open a Module 13 human handoff ticket.",
      payload,
    };
  }

  try {
    const { createEscalationFromTrigger } = await import(
      "../escalations/escalations.service.js"
    );
    const ticket = await createEscalationFromTrigger({
      conversationId,
      userId,
      trigger: "VISA_UNCERTAIN",
      bookingId: bookingId ?? null,
      extraContext: { visa: payload },
    });
    return { escalated: true, auditOnly: false, trigger: "VISA_UNCERTAIN", ticket, payload };
  } catch (e) {
    // If enum not migrated yet or escalation fails, keep audit-only path.
    return {
      escalated: false,
      auditOnly: true,
      trigger: "VISA_UNCERTAIN",
      message: e?.message || "Escalation ticket could not be created",
      payload,
    };
  }
}

export async function createVisaApplication(user, { nationality, destination, category, notes }) {
  const nationalityCode = String(nationality).toUpperCase();
  const destinationCode = String(destination).toUpperCase();

  let resolvedCategory = category ?? null;
  if (!resolvedCategory) {
    const requirement = await lookupVisa({
      nationality: nationalityCode,
      destination: destinationCode,
    });
    if (requirement.isFact && requirement.category && requirement.category !== "UNKNOWN") {
      resolvedCategory = requirement.category;
    }
  }

  return prisma.visaApplication.create({
    data: {
      userId: user.id,
      nationalityCode,
      destinationCode,
      category: resolvedCategory,
      notes: notes ?? null,
    },
    select: APPLICATION_SELECT,
  });
}

async function getApplicationOrThrow(id) {
  const application = await prisma.visaApplication.findUnique({
    where: { id },
    select: APPLICATION_SELECT,
  });
  if (!application) {
    throw new AppError(404, "Visa application not found");
  }
  return application;
}

function assertApplicationAccess(application, user, permissions) {
  const isOwner = application.userId === user.id;
  const hasWrite = hasPermissionEff(permissions, "visa:write");
  if (!isOwner && !hasWrite) {
    throw new AppError(403, "Forbidden");
  }
}

export async function listVisaApplications(
  user,
  permissions,
  { status, userId, all, page, pageSize } = {},
) {
  const take = Math.min(pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const currentPage = page || 1;
  const skip = (currentPage - 1) * take;

  let where;
  if (userId || all) {
    if (!hasPermissionEff(permissions, "visa:read")) {
      throw new AppError(403, "visa:read permission required to list applications for other users");
    }
    where = userId ? { userId } : {};
  } else {
    where = { userId: user.id };
  }
  if (status) {
    where = { ...where, status };
  }

  const [items, total] = await Promise.all([
    prisma.visaApplication.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: APPLICATION_SELECT,
    }),
    prisma.visaApplication.count({ where }),
  ]);

  return {
    items,
    page: currentPage,
    pageSize: take,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / take),
  };
}

export async function updateVisaApplication(user, permissions, id, body) {
  const application = await getApplicationOrThrow(id);
  assertApplicationAccess(application, user, permissions);

  const { status, appointmentAt, appointmentLocation, checklist, vaultDocumentIds, notes } =
    body;

  if (status && status !== application.status) {
    const allowed = APPLICATION_ALLOWED_TRANSITIONS[application.status] || [];
    if (!allowed.includes(status)) {
      throw new AppError(
        400,
        `Cannot transition visa application from ${application.status} to ${status}`,
      );
    }
  }

  if (Array.isArray(vaultDocumentIds)) {
    for (const vaultId of vaultDocumentIds) {
      await assertOwnedVaultDocument(application.userId, vaultId);
    }
  }

  const data = {};
  if (status !== undefined) data.status = status;
  if (appointmentAt !== undefined) data.appointmentAt = appointmentAt;
  if (appointmentLocation !== undefined) data.appointmentLocation = appointmentLocation;
  if (checklist !== undefined) data.checklist = checklist;
  if (vaultDocumentIds !== undefined) data.vaultDocumentIds = vaultDocumentIds;
  if (notes !== undefined) data.notes = notes;

  // Refresh checklist guidance against vault/profile when linking docs.
  let checklistProgress = null;
  if (vaultDocumentIds !== undefined || checklist !== undefined) {
    const reqRow = await lookupVisa({
      nationality: application.nationalityCode,
      destination: application.destinationCode,
    });
    const ctx = await loadTravellerVisaContext(application.userId);
    checklistProgress = buildDocumentChecklistGuidance(reqRow.requiredDocuments, ctx);
  }

  const updated = await prisma.visaApplication.update({
    where: { id },
    data,
    select: APPLICATION_SELECT,
  });

  return checklistProgress ? { ...updated, checklistProgress } : updated;
}

/**
 * Concise Ava-oriented guidance block (server-side). Used by chat grounding.
 */
export async function getAvaVisaGuidance(userId, args) {
  const assessment = await assessVisaForTraveller(userId, args);
  return {
    assessment,
    promptBlock: [
      "### Visa intelligence (Module 08 — attributed data only)",
      assessment.avaSummary,
      `isFact=${assessment.isFact}; escalateRecommended=${assessment.escalateRecommended}`,
      "If dataStatus is UNKNOWN, DATA_UNAVAILABLE, STALE, or UNCONFIGURED: say you cannot confirm requirements and offer human escalation. Never invent fees, timelines, or eligibility.",
    ].join("\n"),
  };
}
