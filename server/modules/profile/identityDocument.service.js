import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import { writeAudit } from "../../lib/audit.js";
import { encryptField, decryptField, isEncryptedField } from "../../lib/fieldEncryption.js";
import { getOrCreateProfile } from "./profile.service.js";
import {
  assertValidDocumentDates,
  computeExpiryStatus,
} from "./documentExpiry.js";
import {
  getOcrProvider,
  mapOcrExtraction,
  sanitizeOcrFields,
} from "./ocr/ocr.provider.js";
import {
  assertOwnedVaultDocument,
  getVaultContentMetaForOcr,
  getVaultBinaryForOcr,
} from "../vault/vault.service.js";

const DOC_SELECT = {
  id: true,
  ownerUserId: true,
  profileUserId: true,
  companionId: true,
  type: true,
  documentNumberEnc: true,
  countryCode: true,
  documentSubtype: true,
  issuedAt: true,
  expiresAt: true,
  vaultDocumentId: true,
  status: true,
  supersedesId: true,
  verificationStatus: true,
  verifiedAt: true,
  verifiedByUserId: true,
  verificationNote: true,
  ocrExtract: true,
  ocrExtractedAt: true,
  ocrProvider: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
};

function validateDatesOrThrow(issuedAt, expiresAt) {
  assertValidDocumentDates(issuedAt, expiresAt);
}

function toPublicDocument(row, { auditReq, actorUserId, includeNumber = false } = {}) {
  if (!row) return row;
  const { documentNumberEnc, ...rest } = row;
  const expiry = computeExpiryStatus(rest.expiresAt);
  const hasDocumentNumber = Boolean(documentNumberEnc);
  const base = {
    ...rest,
    expiry,
    hasDocumentNumber,
    documentNumber: null,
  };

  if (!includeNumber || !documentNumberEnc) {
    return base;
  }

  base.documentNumber = decryptField(documentNumberEnc);
  void writeAudit({
    userId: actorUserId ?? rest.ownerUserId,
    action: "profile.identity_document.read",
    resourceType: "TravellerIdentityDocument",
    resourceId: rest.id,
    req: auditReq,
    metadata: {
      type: rest.type,
      encrypted: isEncryptedField(documentNumberEnc),
    },
  });
  return base;
}

async function assertCompanionOwned(ownerUserId, companionId) {
  if (!companionId) return;
  const companion = await prisma.travellerCompanion.findUnique({
    where: { id: companionId },
    select: { id: true, ownerUserId: true },
  });
  if (!companion || companion.ownerUserId !== ownerUserId) {
    throw new AppError(404, "Companion not found");
  }
}

async function findOwnDocumentOrThrow(ownerUserId, id) {
  const doc = await prisma.travellerIdentityDocument.findUnique({
    where: { id },
    select: DOC_SELECT,
  });
  if (!doc || doc.ownerUserId !== ownerUserId) {
    throw new AppError(404, "Identity document not found");
  }
  return doc;
}

/** GET /api/v1/profile/documents */
export async function listIdentityDocuments(ownerUserId, query = {}, opts = {}) {
  const where = {
    ownerUserId,
    ...(query.type ? { type: query.type } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.companionId === "self"
      ? { companionId: null }
      : query.companionId
        ? { companionId: query.companionId }
        : {}),
  };
  const rows = await prisma.travellerIdentityDocument.findMany({
    where,
    select: DOC_SELECT,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  return rows.map((r) =>
    toPublicDocument(r, {
      auditReq: opts.req,
      actorUserId: ownerUserId,
      includeNumber: query.includeNumber === true || query.includeNumber === "true",
    }),
  );
}

/** GET /api/v1/profile/documents/:id */
export async function getIdentityDocument(ownerUserId, id, opts = {}) {
  const doc = await findOwnDocumentOrThrow(ownerUserId, id);
  return toPublicDocument(doc, {
    auditReq: opts.req,
    actorUserId: ownerUserId,
    includeNumber: opts.includeNumber !== false,
  });
}

/**
 * POST /api/v1/profile/documents
 * New documents always start UNVERIFIED — verification requires explicit workflow.
 */
export async function createIdentityDocument(ownerUserId, data, opts = {}) {
  await getOrCreateProfile(ownerUserId);
  await assertCompanionOwned(ownerUserId, data.companionId);
  validateDatesOrThrow(data.issuedAt, data.expiresAt);
  if (data.vaultDocumentId) {
    await assertOwnedVaultDocument(ownerUserId, data.vaultDocumentId);
  }

  if (data.supersedesId) {
    const prior = await findOwnDocumentOrThrow(ownerUserId, data.supersedesId);
    if (prior.status !== "ACTIVE") {
      throw new AppError(400, "Can only supersede an ACTIVE identity document");
    }
  }

  const companionId = data.companionId ?? null;
  const created = await prisma.$transaction(async (tx) => {
    if (data.supersedesId) {
      await tx.travellerIdentityDocument.update({
        where: { id: data.supersedesId },
        data: { status: "SUPERSEDED" },
      });
    }

    return tx.travellerIdentityDocument.create({
      data: {
        ownerUserId,
        profileUserId: companionId ? null : ownerUserId,
        companionId,
        type: data.type,
        documentNumberEnc: data.documentNumber
          ? encryptField(data.documentNumber)
          : null,
        countryCode: data.countryCode ?? null,
        documentSubtype: data.documentSubtype ?? null,
        issuedAt: data.issuedAt ?? null,
        expiresAt: data.expiresAt ?? null,
        vaultDocumentId: data.vaultDocumentId ?? null,
        supersedesId: data.supersedesId ?? null,
        verificationStatus: "UNVERIFIED",
        verifiedAt: null,
        verifiedByUserId: null,
        verificationNote: null,
        metadata: data.metadata ?? undefined,
        status: "ACTIVE",
      },
      select: DOC_SELECT,
    });
  });

  void writeAudit({
    userId: ownerUserId,
    action: "profile.identity_document.create",
    resourceType: "TravellerIdentityDocument",
    resourceId: created.id,
    req: opts.req,
    metadata: { type: created.type },
  });

  return toPublicDocument(created, {
    auditReq: opts.req,
    actorUserId: ownerUserId,
    includeNumber: true,
  });
}

/** PATCH /api/v1/profile/documents/:id — metadata edits; not for verification. */
export async function updateIdentityDocument(ownerUserId, id, patch, opts = {}) {
  const current = await findOwnDocumentOrThrow(ownerUserId, id);
  if (current.status === "SUPERSEDED") {
    throw new AppError(400, "Superseded documents are immutable; re-upload instead");
  }
  if (current.verificationStatus === "VERIFIED") {
    throw new AppError(
      409,
      "Verified documents cannot be edited in place; re-upload to replace",
    );
  }
  if (patch.companionId !== undefined) {
    await assertCompanionOwned(ownerUserId, patch.companionId);
  }
  if (patch.vaultDocumentId) {
    await assertOwnedVaultDocument(ownerUserId, patch.vaultDocumentId);
  }

  const nextIssued = patch.issuedAt !== undefined ? patch.issuedAt : current.issuedAt;
  const nextExpires = patch.expiresAt !== undefined ? patch.expiresAt : current.expiresAt;
  validateDatesOrThrow(nextIssued, nextExpires);

  const data = {
    ...(patch.type !== undefined ? { type: patch.type } : {}),
    ...(patch.countryCode !== undefined ? { countryCode: patch.countryCode } : {}),
    ...(patch.documentSubtype !== undefined
      ? { documentSubtype: patch.documentSubtype }
      : {}),
    ...(patch.issuedAt !== undefined ? { issuedAt: patch.issuedAt } : {}),
    ...(patch.expiresAt !== undefined ? { expiresAt: patch.expiresAt } : {}),
    ...(patch.vaultDocumentId !== undefined
      ? { vaultDocumentId: patch.vaultDocumentId }
      : {}),
    ...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}),
    ...(patch.companionId !== undefined
      ? {
          companionId: patch.companionId,
          profileUserId: patch.companionId ? null : ownerUserId,
        }
      : {}),
    ...(patch.documentNumber !== undefined
      ? {
          documentNumberEnc:
            patch.documentNumber === null || patch.documentNumber === ""
              ? null
              : encryptField(patch.documentNumber),
        }
      : {}),
  };

  const updated = await prisma.travellerIdentityDocument.update({
    where: { id },
    data,
    select: DOC_SELECT,
  });

  void writeAudit({
    userId: ownerUserId,
    action: "profile.identity_document.update",
    resourceType: "TravellerIdentityDocument",
    resourceId: id,
    req: opts.req,
    metadata: { type: updated.type },
  });

  return toPublicDocument(updated, {
    auditReq: opts.req,
    actorUserId: ownerUserId,
    includeNumber: true,
  });
}

/**
 * POST /api/v1/profile/documents/:id/reupload
 * Replaces ACTIVE doc with a new ACTIVE row; prior becomes SUPERSEDED.
 */
export async function reuploadIdentityDocument(ownerUserId, id, body, opts = {}) {
  const current = await findOwnDocumentOrThrow(ownerUserId, id);
  if (current.status !== "ACTIVE") {
    throw new AppError(400, "Only ACTIVE documents can be re-uploaded");
  }
  if (!body.vaultDocumentId) {
    throw new AppError(400, "vaultDocumentId is required for re-upload");
  }
  if (body.vaultDocumentId === current.vaultDocumentId) {
    throw new AppError(400, "re-upload requires a new vaultDocumentId");
  }
  await assertOwnedVaultDocument(ownerUserId, body.vaultDocumentId);

  const issuedAt = body.issuedAt !== undefined ? body.issuedAt : current.issuedAt;
  const expiresAt = body.expiresAt !== undefined ? body.expiresAt : current.expiresAt;
  validateDatesOrThrow(issuedAt, expiresAt);

  const numberPlain =
    body.documentNumber !== undefined
      ? body.documentNumber
      : current.documentNumberEnc
        ? decryptField(current.documentNumberEnc)
        : null;

  const created = await prisma.$transaction(async (tx) => {
    await tx.travellerIdentityDocument.update({
      where: { id },
      data: { status: "SUPERSEDED" },
    });

    return tx.travellerIdentityDocument.create({
      data: {
        ownerUserId,
        profileUserId: current.profileUserId,
        companionId: current.companionId,
        type: body.type ?? current.type,
        documentNumberEnc: numberPlain ? encryptField(numberPlain) : null,
        countryCode:
          body.countryCode !== undefined ? body.countryCode : current.countryCode,
        documentSubtype:
          body.documentSubtype !== undefined
            ? body.documentSubtype
            : current.documentSubtype,
        issuedAt: issuedAt ?? null,
        expiresAt: expiresAt ?? null,
        vaultDocumentId: body.vaultDocumentId,
        supersedesId: current.id,
        verificationStatus: "UNVERIFIED",
        verifiedAt: null,
        verifiedByUserId: null,
        verificationNote: null,
        ocrExtract: null,
        ocrExtractedAt: null,
        ocrProvider: null,
        metadata: body.metadata ?? current.metadata ?? undefined,
        status: "ACTIVE",
      },
      select: DOC_SELECT,
    });
  });

  void writeAudit({
    userId: ownerUserId,
    action: "profile.identity_document.reupload",
    resourceType: "TravellerIdentityDocument",
    resourceId: created.id,
    req: opts.req,
    metadata: { supersedesId: current.id, vaultDocumentId: body.vaultDocumentId },
  });

  return toPublicDocument(created, {
    auditReq: opts.req,
    actorUserId: ownerUserId,
    includeNumber: true,
  });
}

/**
 * POST /api/v1/profile/documents/:id/verify
 * Explicit PENDING | VERIFIED | REJECTED — never implied by create/OCR.
 */
export async function setIdentityDocumentVerification(
  ownerUserId,
  id,
  { decision, note },
  opts = {},
) {
  const current = await findOwnDocumentOrThrow(ownerUserId, id);
  if (current.status === "SUPERSEDED") {
    throw new AppError(400, "Cannot verify a superseded document");
  }
  if (!["PENDING", "VERIFIED", "REJECTED"].includes(decision)) {
    throw new AppError(400, "decision must be PENDING, VERIFIED, or REJECTED");
  }

  const actorId = opts.actorUserId ?? ownerUserId;
  const updated = await prisma.travellerIdentityDocument.update({
    where: { id },
    data: {
      verificationStatus: decision,
      verifiedAt: new Date(),
      verifiedByUserId: actorId,
      verificationNote: note ?? null,
    },
    select: DOC_SELECT,
  });

  void writeAudit({
    userId: actorId,
    action: `profile.identity_document.verify.${decision.toLowerCase()}`,
    resourceType: "TravellerIdentityDocument",
    resourceId: id,
    req: opts.req,
    metadata: { decision },
  });

  return toPublicDocument(updated, {
    auditReq: opts.req,
    actorUserId: ownerUserId,
    includeNumber: false,
  });
}

/**
 * POST /api/v1/profile/documents/:id/ocr
 * Runs OCR provider; stores reviewable extract. Does not mutate verified fields.
 */
export async function runIdentityDocumentOcr(ownerUserId, id, body = {}, opts = {}) {
  const current = await findOwnDocumentOrThrow(ownerUserId, id);
  if (current.status === "SUPERSEDED") {
    throw new AppError(400, "Cannot OCR a superseded document");
  }

  const vaultMeta = await getVaultContentMetaForOcr(
    ownerUserId,
    current.vaultDocumentId,
  );
  let contentBase64 = null;
  if (vaultMeta.hasBinary && current.vaultDocumentId) {
    const binary = await getVaultBinaryForOcr(ownerUserId, current.vaultDocumentId);
    contentBase64 = binary?.contentBase64 ?? null;
  }
  const provider = getOcrProvider();
  // Pass vault id + content meta + optional binary for server-side OCR only.
  // Never log contentBase64 or return it to the client.
  const extraction = await provider.extract({
    documentType: current.type,
    vaultDocumentId: current.vaultDocumentId,
    contentType: vaultMeta.contentType,
    byteSize: vaultMeta.byteSize,
    hasBinary: vaultMeta.hasBinary,
    contentBase64,
    rawText: body.rawText ?? null,
  });

  const mapped = mapOcrExtraction(current.type, extraction);
  const nextVerification =
    current.verificationStatus === "VERIFIED"
      ? "VERIFIED"
      : current.verificationStatus === "REJECTED"
        ? "REJECTED"
        : "PENDING";

  const updated = await prisma.travellerIdentityDocument.update({
    where: { id },
    data: {
      ocrExtract: mapped,
      ocrExtractedAt: new Date(),
      ocrProvider: mapped.provider,
      // OCR never flips VERIFIED → anything else; unverified moves to PENDING for review.
      ...(current.verificationStatus === "VERIFIED" ||
      current.verificationStatus === "REJECTED"
        ? {}
        : { verificationStatus: nextVerification }),
    },
    select: DOC_SELECT,
  });

  void writeAudit({
    userId: ownerUserId,
    action: "profile.identity_document.ocr",
    resourceType: "TravellerIdentityDocument",
    resourceId: id,
    req: opts.req,
    metadata: {
      provider: mapped.provider,
      fieldKeys: Object.keys(mapped.fields),
      preservedVerification: current.verificationStatus,
    },
  });

  return {
    document: toPublicDocument(updated, {
      auditReq: opts.req,
      actorUserId: ownerUserId,
      includeNumber: false,
    }),
    extraction: mapped,
    applied: false,
  };
}

/**
 * POST /api/v1/profile/documents/:id/ocr/apply
 * Applies accepted OCR fields only when document is not VERIFIED.
 * Only fields present in the stored extraction (or supplied accepted map) are written.
 */
export async function applyIdentityDocumentOcr(
  ownerUserId,
  id,
  { acceptedFields },
  opts = {},
) {
  const current = await findOwnDocumentOrThrow(ownerUserId, id);
  if (current.verificationStatus === "VERIFIED") {
    throw new AppError(
      409,
      "OCR cannot overwrite verified document data; re-upload and re-verify instead",
    );
  }
  if (current.status === "SUPERSEDED") {
    throw new AppError(400, "Cannot apply OCR to a superseded document");
  }
  if (!current.ocrExtract || typeof current.ocrExtract !== "object") {
    throw new AppError(400, "No OCR extraction available to apply");
  }

  const extractedFields = sanitizeOcrFields(
    current.ocrExtract.fields ?? current.ocrExtract,
  );
  const allow = new Set(
    Array.isArray(acceptedFields) && acceptedFields.length
      ? acceptedFields
      : Object.keys(extractedFields),
  );

  const apply = {};
  for (const key of allow) {
    if (extractedFields[key] == null) continue;
    if (key === "documentNumber") {
      apply.documentNumberEnc = encryptField(extractedFields.documentNumber);
    } else if (key === "countryCode") {
      apply.countryCode = extractedFields.countryCode;
    } else if (key === "documentSubtype") {
      apply.documentSubtype = extractedFields.documentSubtype;
    } else if (key === "issuedAt") {
      apply.issuedAt = new Date(extractedFields.issuedAt);
    } else if (key === "expiresAt") {
      apply.expiresAt = new Date(extractedFields.expiresAt);
    }
    // fullName/nationality are review hints — not silently written onto profile.
  }

  if (Object.keys(apply).length === 0) {
    throw new AppError(400, "No accepted OCR fields available to apply");
  }

  validateDatesOrThrow(
    apply.issuedAt !== undefined ? apply.issuedAt : current.issuedAt,
    apply.expiresAt !== undefined ? apply.expiresAt : current.expiresAt,
  );

  const updated = await prisma.travellerIdentityDocument.update({
    where: { id },
    data: {
      ...apply,
      verificationStatus: "PENDING",
    },
    select: DOC_SELECT,
  });

  void writeAudit({
    userId: ownerUserId,
    action: "profile.identity_document.ocr_apply",
    resourceType: "TravellerIdentityDocument",
    resourceId: id,
    req: opts.req,
    metadata: { acceptedFields: [...allow] },
  });

  return toPublicDocument(updated, {
    auditReq: opts.req,
    actorUserId: ownerUserId,
    includeNumber: true,
  });
}

/** DELETE /api/v1/profile/documents/:id */
export async function deleteIdentityDocument(ownerUserId, id, opts = {}) {
  await findOwnDocumentOrThrow(ownerUserId, id);
  await prisma.travellerIdentityDocument.delete({ where: { id } });
  void writeAudit({
    userId: ownerUserId,
    action: "profile.identity_document.delete",
    resourceType: "TravellerIdentityDocument",
    resourceId: id,
    req: opts.req,
  });
}
