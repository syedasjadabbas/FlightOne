/**
 * Module 07 — Traveller Vault: structured document store behind the
 * traveller profile (see docs/modules/07-traveller-vault.md).
 *
 * Invariants enforced here:
 *  - Owner-only access — no cross-user read/download/link path.
 *  - Binary storage via vault.storage.js (fail-closed when unconfigured).
 *  - DB stores fileUrl only (GCS https://… or local://…); no storageKey writes.
 *  - Raw bytes never leave the service layer in list/detail responses.
 *  - Every read/download is access-logged via writeAudit.
 *  - PATCH creates a new version (supersedesId); soft-delete retains rows.
 *  - Platform-issued TICKET/HOTEL_VOUCHER rows are immutable once ingested.
 */
import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import { writeAudit } from "../../lib/audit.js";
import { randomToken, sha256Hex } from "../../lib/crypto.js";
import { isAllowedGcsUrl } from "../../lib/storageUrl.js";
import {
  buildStorageKey,
  decodeBase64Content,
  getVaultStorage,
  getVaultStorageCapability,
  resolveStoredFileUrl,
  validateUploadPayload,
} from "./vault.storage.js";
import {
  VISA_RECORD_PUBLIC_SELECT,
  loadVisaIntelligenceOverlay,
  toPublicVisaMeta,
  upsertVisaRecord,
} from "./vault.visaMeta.js";
import { computeExpiryStatus } from "../profile/documentExpiry.js";

const DEFAULT_SHARE_TTL_HOURS = 72;

const PLATFORM_IMMUTABLE_TYPES = new Set(["TICKET", "HOTEL_VOUCHER"]);

/** Public metadata — never includes storageKey, contentSha256, or encryptedNote. */
const DOCUMENT_SELECT = {
  id: true,
  ownerUserId: true,
  companionId: true,
  type: true,
  title: true,
  bookingId: true,
  issueDate: true,
  expiresAt: true,
  fileUrl: true,
  fileMeta: true,
  contentType: true,
  byteSize: true,
  originalFilename: true,
  version: true,
  supersedesId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  visaRecord: { select: VISA_RECORD_PUBLIC_SELECT },
};

const DOCUMENT_INTERNAL_SELECT = {
  ...DOCUMENT_SELECT,
  storageKey: true,
  encryptedNote: true,
};

function documentHasBinary(row) {
  return Boolean(resolveStoredFileUrl(row) || (row.byteSize && row.fileUrl));
}

function toPublicDocument(row) {
  if (!row) return row;
  const {
    storageKey: _sk,
    contentSha256: _hash,
    encryptedNote: _note,
    visaRecord,
    ...rest
  } = row;
  const expired =
    row.expiresAt && new Date(row.expiresAt).getTime() < Date.now();
  let lifecycleStatus = "ACTIVE";
  if (!row.isActive) lifecycleStatus = "SUPERSEDED";
  else if (expired) lifecycleStatus = "EXPIRED";

  const expiry = computeExpiryStatus(row.expiresAt);
  const visaMeta =
    row.type === "VISA"
      ? toPublicVisaMeta(visaRecord || { holderStatus: "ISSUED" }, {
          expiresAt: row.expiresAt,
          isActive: row.isActive,
        })
      : null;

  return {
    ...rest,
    hasBinary: documentHasBinary(row),
    lifecycleStatus,
    expiryStatus: expiry.state,
    daysUntilExpiry: expiry.daysRemaining,
    isPlatformIssued: Boolean(row.bookingId) && PLATFORM_IMMUTABLE_TYPES.has(row.type),
    visaMeta,
  };
}

function isPlatformIssued(doc) {
  return Boolean(doc.bookingId) && PLATFORM_IMMUTABLE_TYPES.has(doc.type);
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

async function getOwnedDocumentOrThrow(userId, documentId, select = DOCUMENT_SELECT) {
  const doc = await prisma.vaultDocument.findFirst({
    where: { id: documentId, ownerUserId: userId },
    select,
  });
  if (!doc) {
    throw new AppError(404, "Document not found");
  }
  return doc;
}

/**
 * Profile / companion linking — vaultDocumentId must exist and belong to the
 * same user. Used by Module 02 identity-document create/update/reupload.
 */
export async function assertOwnedVaultDocument(userId, vaultDocumentId) {
  if (!vaultDocumentId) return null;
  const doc = await prisma.vaultDocument.findFirst({
    where: { id: vaultDocumentId, ownerUserId: userId },
    select: { id: true, ownerUserId: true, isActive: true, type: true },
  });
  if (!doc) {
    throw new AppError(404, "Vault document not found");
  }
  return doc;
}

export function getStorageCapability() {
  return getVaultStorageCapability();
}

export async function listMyDocuments(
  userId,
  { type, expiringWithinDays, includeInactive, companionId, destinationCode } = {},
) {
  const where = {
    ownerUserId: userId,
    ...(includeInactive === true || includeInactive === "true" ? {} : { isActive: true }),
  };
  if (type) where.type = type;
  if (companionId === "self") where.companionId = null;
  else if (companionId) where.companionId = companionId;
  if (expiringWithinDays !== undefined && expiringWithinDays !== null) {
    where.expiresAt = {
      lte: new Date(Date.now() + expiringWithinDays * 24 * 60 * 60 * 1000),
    };
  }
  if (destinationCode) {
    where.visaRecord = { destinationCode: String(destinationCode).toUpperCase() };
  }

  const items = await prisma.vaultDocument.findMany({
    where,
    orderBy: [{ expiresAt: "asc" }, { createdAt: "desc" }],
    select: DOCUMENT_SELECT,
  });

  return { items: items.map(toPublicDocument), total: items.length };
}

/**
 * Metadata-only create (no binary). Prefer uploadDocument when storing a file.
 * Rejects client-supplied storage keys / fake success paths.
 */
export async function createDocument(userId, req, body) {
  await assertCompanionOwned(userId, body.companionId);

  // Never accept client-controlled storage paths or binary fields on metadata create.
  if (body.storageKey || body.contentBase64 || body.contentSha256 || body.fileUrl) {
    throw new AppError(400, "Use POST /vault/upload to store binary content");
  }

  const doc = await prisma.vaultDocument.create({
    data: {
      ownerUserId: userId,
      type: body.type,
      title: body.title,
      companionId: body.companionId ?? null,
      bookingId: body.bookingId ?? null,
      issueDate: body.issueDate ?? null,
      expiresAt: body.expiresAt ?? null,
      fileUrl: null,
      fileMeta: body.fileMeta ?? undefined,
    },
    select: DOCUMENT_SELECT,
  });

  // Logical URL after id is known.
  const withUrl = await prisma.vaultDocument.update({
    where: { id: doc.id },
    data: { fileUrl: `vault://document/${doc.id}` },
    select: DOCUMENT_SELECT,
  });

  if (withUrl.type === "VISA") {
    await upsertVisaRecord({
      documentId: withUrl.id,
      ownerUserId: userId,
      type: withUrl.type,
      visaMeta: body.visaMeta,
    });
  }

  const stored = await prisma.vaultDocument.findFirst({
    where: { id: withUrl.id, ownerUserId: userId },
    select: DOCUMENT_SELECT,
  });

  await writeAudit({
    userId,
    action: "vault.document.create",
    resourceType: "VaultDocument",
    resourceId: withUrl.id,
    req,
    metadata: {
      type: withUrl.type,
      bookingId: withUrl.bookingId,
      hasBinary: false,
      hasVisaMeta: withUrl.type === "VISA",
    },
  });

  return toPublicDocument(stored || withUrl);
}

/**
 * Authenticated binary upload — creates a VaultDocument owned by the caller.
 * Prefer client GCS signed upload (fileUrl). contentBase64 remains for server/
 * legacy callers and is uploaded by the active storage provider.
 * Fails closed when storage is unconfigured (never fakes success).
 */
export async function uploadDocument(userId, req, body) {
  await assertCompanionOwned(userId, body.companionId);

  const hasFileUrl = Boolean(body.fileUrl);
  const hasBase64 = Boolean(body.contentBase64);
  if (hasFileUrl === hasBase64) {
    throw new AppError(400, "Provide exactly one of fileUrl or contentBase64");
  }

  let fileUrl = null;
  let validated;

  if (hasFileUrl) {
    if (!isAllowedGcsUrl(body.fileUrl)) {
      throw new AppError(400, "fileUrl must be a valid GCS public URL");
    }
    const cap = getVaultStorageCapability();
    if (!cap.canUpload) {
      const err = new AppError(503, "Vault storage is not configured");
      err.code = "VAULT_STORAGE_UNCONFIGURED";
      err.details = { capability: cap };
      throw err;
    }
    validated = validateUploadPayload({
      contentType: body.contentType,
      originalFilename: body.originalFilename,
      byteLength: Number(body.byteSize) || 1,
    });
    // byteSize from client is advisory; clamp to known max already done in validate.
    if (!Number.isInteger(body.byteSize) || body.byteSize <= 0) {
      throw new AppError(400, "byteSize is required when uploading via fileUrl");
    }
    validated = {
      ...validated,
      byteLength: body.byteSize,
    };
    fileUrl = body.fileUrl.trim();
  } else {
    const buffer = decodeBase64Content(body.contentBase64);
    validated = validateUploadPayload({
      contentType: body.contentType,
      originalFilename: body.originalFilename,
      byteLength: buffer.length,
    });
    const storage = getVaultStorage();
    const stub = await prisma.vaultDocument.create({
      data: {
        ownerUserId: userId,
        type: body.type,
        title: body.title,
        companionId: body.companionId ?? null,
        bookingId: body.bookingId ?? null,
        issueDate: body.issueDate ?? null,
        expiresAt: body.expiresAt ?? null,
        contentType: validated.contentType,
        byteSize: validated.byteLength,
        originalFilename: validated.originalFilename,
        fileUrl: null,
      },
      select: { id: true },
    });

    const storageKey = buildStorageKey({
      ownerUserId: userId,
      documentId: stub.id,
      originalFilename: validated.originalFilename,
    });

    try {
      const stored = await storage.put({
        storageKey,
        buffer,
        contentType: validated.contentType,
      });
      fileUrl = stored.fileUrl;
    } catch (e) {
      await prisma.vaultDocument.delete({ where: { id: stub.id } }).catch(() => {});
      throw e;
    }

    const doc = await prisma.vaultDocument.update({
      where: { id: stub.id },
      data: {
        storageKey: null,
        contentSha256: null,
        fileUrl,
        fileMeta: {
          uploadedAt: new Date().toISOString(),
          contentType: validated.contentType,
          byteSize: validated.byteLength,
          originalFilename: validated.originalFilename,
        },
      },
      select: DOCUMENT_SELECT,
    });

    if (doc.type === "VISA") {
      await upsertVisaRecord({
        documentId: doc.id,
        ownerUserId: userId,
        type: doc.type,
        visaMeta: body.visaMeta,
      });
    }

    const stored = await prisma.vaultDocument.findFirst({
      where: { id: doc.id, ownerUserId: userId },
      select: DOCUMENT_SELECT,
    });

    await writeAudit({
      userId,
      action: "vault.document.upload",
      resourceType: "VaultDocument",
      resourceId: doc.id,
      req,
      metadata: {
        type: doc.type,
        contentType: validated.contentType,
        byteSize: validated.byteLength,
        hasVisaMeta: doc.type === "VISA",
        via: "contentBase64",
      },
    });

    return toPublicDocument(stored || doc);
  }

  // Client already uploaded bytes to GCS via signed URL — metadata only.
  const doc = await prisma.vaultDocument.create({
    data: {
      ownerUserId: userId,
      type: body.type,
      title: body.title,
      companionId: body.companionId ?? null,
      bookingId: body.bookingId ?? null,
      issueDate: body.issueDate ?? null,
      expiresAt: body.expiresAt ?? null,
      contentType: validated.contentType,
      byteSize: validated.byteLength,
      originalFilename: validated.originalFilename,
      fileUrl,
      storageKey: null,
      contentSha256: null,
      fileMeta: {
        uploadedAt: new Date().toISOString(),
        contentType: validated.contentType,
        byteSize: validated.byteLength,
        originalFilename: validated.originalFilename,
        via: "gcs_signed_upload",
      },
    },
    select: DOCUMENT_SELECT,
  });

  if (doc.type === "VISA") {
    await upsertVisaRecord({
      documentId: doc.id,
      ownerUserId: userId,
      type: doc.type,
      visaMeta: body.visaMeta,
    });
  }

  const stored = await prisma.vaultDocument.findFirst({
    where: { id: doc.id, ownerUserId: userId },
    select: DOCUMENT_SELECT,
  });

  await writeAudit({
    userId,
    action: "vault.document.upload",
    resourceType: "VaultDocument",
    resourceId: doc.id,
    req,
    metadata: {
      type: doc.type,
      contentType: validated.contentType,
      byteSize: validated.byteLength,
      hasVisaMeta: doc.type === "VISA",
      via: "fileUrl",
    },
  });

  return toPublicDocument(stored || doc);
}

export async function getDocumentById(userId, req, documentId) {
  const doc = await getOwnedDocumentOrThrow(userId, documentId, DOCUMENT_SELECT);

  await writeAudit({
    userId,
    action: "vault.document.read",
    resourceType: "VaultDocument",
    resourceId: doc.id,
    req,
    metadata: { type: doc.type },
  });

  const publicDoc = toPublicDocument(doc);
  if (doc.type !== "VISA") {
    return publicDoc;
  }

  const visaIntelligence = await loadVisaIntelligenceOverlay({
    ownerUserId: userId,
    destinationCode: publicDoc.visaMeta?.destinationCode,
    visaApplicationId: publicDoc.visaMeta?.visaApplicationId,
  });

  return { ...publicDoc, visaIntelligence };
}

/**
 * Secure download — owner only. Returns buffer + headers; never JSON-embeds bytes
 * in list/detail responses.
 */
export async function downloadDocument(userId, req, documentId) {
  const doc = await getOwnedDocumentOrThrow(userId, documentId, DOCUMENT_INTERNAL_SELECT);

  const fileUrl = resolveStoredFileUrl(doc);
  if (!fileUrl) {
    throw new AppError(404, "Document has no stored file");
  }
  if (!doc.isActive) {
    throw new AppError(409, "Cannot download a superseded/deleted document");
  }

  const storage = getVaultStorage();
  const buffer = await storage.get({ fileUrl });

  await writeAudit({
    userId,
    action: "vault.document.download",
    resourceType: "VaultDocument",
    resourceId: doc.id,
    req,
    metadata: {
      type: doc.type,
      contentType: doc.contentType,
      byteSize: buffer.length,
    },
  });

  return {
    buffer,
    contentType: doc.contentType || "application/octet-stream",
    originalFilename: doc.originalFilename || "document",
    byteSize: buffer.length,
    documentId: doc.id,
  };
}

/**
 * Create a new version of a document. Binary replacement uses replaceDocumentBinary.
 */
export async function updateDocument(userId, req, documentId, patch) {
  const current = await getOwnedDocumentOrThrow(userId, documentId, DOCUMENT_INTERNAL_SELECT);

  if (isPlatformIssued(current)) {
    throw new AppError(409, "Platform-issued documents are immutable");
  }
  if (!current.isActive) {
    throw new AppError(409, "Cannot update a superseded/deleted document");
  }

  if (patch.companionId !== undefined) {
    await assertCompanionOwned(userId, patch.companionId);
  }

  // Reject metadata tampering that tries to set storage fields.
  if (
    patch.storageKey !== undefined ||
    patch.contentSha256 !== undefined ||
    patch.byteSize !== undefined ||
    patch.fileUrl !== undefined ||
    patch.ownerUserId !== undefined
  ) {
    throw new AppError(400, "Storage and ownership fields are not client-writable");
  }

  const versioningKeys = ["title", "companionId", "issueDate", "expiresAt", "fileMeta", "encryptedNote"];
  const hasVersioningPatch = versioningKeys.some((key) => patch[key] !== undefined);

  // Visa-only metadata edits stay in place — they are not a document renewal.
  if (!hasVersioningPatch && patch.visaMeta !== undefined) {
    if (current.type !== "VISA") {
      throw new AppError(400, "visaMeta is only allowed for VISA documents");
    }
    await upsertVisaRecord({
      documentId: current.id,
      ownerUserId: userId,
      type: current.type,
      visaMeta: patch.visaMeta,
    });
    const stored = await prisma.vaultDocument.findFirst({
      where: { id: current.id, ownerUserId: userId },
      select: DOCUMENT_SELECT,
    });
    await writeAudit({
      userId,
      action: "vault.document.visa_meta",
      resourceType: "VaultDocument",
      resourceId: current.id,
      req,
      metadata: { type: current.type },
    });
    return toPublicDocument(stored);
  }

  const preservedFileUrl = resolveStoredFileUrl(current);

  const next = await prisma.$transaction(async (tx) => {
    await tx.vaultDocument.update({
      where: { id: current.id },
      data: { isActive: false },
    });

    return tx.vaultDocument.create({
      data: {
        ownerUserId: current.ownerUserId,
        companionId:
          patch.companionId !== undefined ? patch.companionId : current.companionId,
        type: current.type,
        title: patch.title !== undefined ? patch.title : current.title,
        bookingId: current.bookingId,
        issueDate: patch.issueDate !== undefined ? patch.issueDate : current.issueDate,
        expiresAt: patch.expiresAt !== undefined ? patch.expiresAt : current.expiresAt,
        fileUrl: preservedFileUrl,
        fileMeta: patch.fileMeta !== undefined ? patch.fileMeta : current.fileMeta,
        storageKey: null,
        contentType: current.contentType,
        byteSize: current.byteSize,
        originalFilename: current.originalFilename,
        contentSha256: null,
        encryptedNote:
          patch.encryptedNote !== undefined ? patch.encryptedNote : current.encryptedNote,
        version: current.version + 1,
        supersedesId: current.id,
        isActive: true,
      },
      select: DOCUMENT_SELECT,
    });
  });

  const withUrl = next;
  if (withUrl.type === "VISA") {
    await upsertVisaRecord({
      documentId: withUrl.id,
      ownerUserId: userId,
      type: withUrl.type,
      visaMeta: patch.visaMeta,
      copyFromDocumentId: current.id,
    });
  }

  const stored = await prisma.vaultDocument.findFirst({
    where: { id: withUrl.id, ownerUserId: userId },
    select: DOCUMENT_SELECT,
  });

  await writeAudit({
    userId,
    action: "vault.document.version",
    resourceType: "VaultDocument",
    resourceId: withUrl.id,
    req,
    metadata: { supersedesId: current.id, version: withUrl.version },
  });

  return toPublicDocument(stored || withUrl);
}

/**
 * Replace binary content — new version row; prior retained (isActive=false).
 * Old object bytes are left in place for audit retention (soft retention).
 * Accepts fileUrl (GCS signed upload) or contentBase64 (server/legacy).
 */
export async function replaceDocumentBinary(userId, req, documentId, body) {
  const current = await getOwnedDocumentOrThrow(userId, documentId, DOCUMENT_INTERNAL_SELECT);

  if (isPlatformIssued(current)) {
    throw new AppError(409, "Platform-issued documents are immutable");
  }
  if (!current.isActive) {
    throw new AppError(409, "Cannot replace a superseded/deleted document");
  }

  const hasFileUrl = Boolean(body.fileUrl);
  const hasBase64 = Boolean(body.contentBase64);
  if (hasFileUrl === hasBase64) {
    throw new AppError(400, "Provide exactly one of fileUrl or contentBase64");
  }

  let fileUrl;
  let validated;

  if (hasFileUrl) {
    if (!isAllowedGcsUrl(body.fileUrl)) {
      throw new AppError(400, "fileUrl must be a valid GCS public URL");
    }
    if (!Number.isInteger(body.byteSize) || body.byteSize <= 0) {
      throw new AppError(400, "byteSize is required when uploading via fileUrl");
    }
    const cap = getVaultStorageCapability();
    if (!cap.canUpload) {
      const err = new AppError(503, "Vault storage is not configured");
      err.code = "VAULT_STORAGE_UNCONFIGURED";
      err.details = { capability: cap };
      throw err;
    }
    validated = validateUploadPayload({
      contentType: body.contentType ?? current.contentType,
      originalFilename: body.originalFilename ?? current.originalFilename,
      byteLength: body.byteSize,
    });
    fileUrl = body.fileUrl.trim();

    const next = await prisma.$transaction(async (tx) => {
      await tx.vaultDocument.update({
        where: { id: current.id },
        data: { isActive: false },
      });

      return tx.vaultDocument.create({
        data: {
          ownerUserId: current.ownerUserId,
          companionId: current.companionId,
          type: current.type,
          title: body.title !== undefined ? body.title : current.title,
          bookingId: current.bookingId,
          issueDate: body.issueDate !== undefined ? body.issueDate : current.issueDate,
          expiresAt: body.expiresAt !== undefined ? body.expiresAt : current.expiresAt,
          contentType: validated.contentType,
          byteSize: validated.byteLength,
          originalFilename: validated.originalFilename,
          fileUrl,
          storageKey: null,
          contentSha256: null,
          version: current.version + 1,
          supersedesId: current.id,
          isActive: true,
          fileMeta: {
            replacedAt: new Date().toISOString(),
            contentType: validated.contentType,
            byteSize: validated.byteLength,
            originalFilename: validated.originalFilename,
            supersedesId: current.id,
            via: "gcs_signed_upload",
          },
        },
        select: DOCUMENT_SELECT,
      });
    });

    if (next.type === "VISA") {
      await upsertVisaRecord({
        documentId: next.id,
        ownerUserId: userId,
        type: next.type,
        copyFromDocumentId: current.id,
      });
    }

    const stored = await prisma.vaultDocument.findFirst({
      where: { id: next.id, ownerUserId: userId },
      select: DOCUMENT_SELECT,
    });

    await writeAudit({
      userId,
      action: "vault.document.replace",
      resourceType: "VaultDocument",
      resourceId: next.id,
      req,
      metadata: {
        supersedesId: current.id,
        contentType: validated.contentType,
        byteSize: validated.byteLength,
        via: "fileUrl",
      },
    });

    return toPublicDocument(stored || next);
  }

  const buffer = decodeBase64Content(body.contentBase64);
  validated = validateUploadPayload({
    contentType: body.contentType ?? current.contentType,
    originalFilename: body.originalFilename ?? current.originalFilename,
    byteLength: buffer.length,
  });

  const nextStub = await prisma.$transaction(async (tx) => {
    await tx.vaultDocument.update({
      where: { id: current.id },
      data: { isActive: false },
    });

    return tx.vaultDocument.create({
      data: {
        ownerUserId: current.ownerUserId,
        companionId: current.companionId,
        type: current.type,
        title: body.title !== undefined ? body.title : current.title,
        bookingId: current.bookingId,
        issueDate: body.issueDate !== undefined ? body.issueDate : current.issueDate,
        expiresAt: body.expiresAt !== undefined ? body.expiresAt : current.expiresAt,
        contentType: validated.contentType,
        byteSize: validated.byteLength,
        originalFilename: validated.originalFilename,
        version: current.version + 1,
        supersedesId: current.id,
        isActive: true,
      },
      select: { id: true },
    });
  });

  const storageKey = buildStorageKey({
    ownerUserId: userId,
    documentId: nextStub.id,
    originalFilename: validated.originalFilename,
  });

  try {
    const storedBytes = await getVaultStorage().put({
      storageKey,
      buffer,
      contentType: validated.contentType,
    });
    fileUrl = storedBytes.fileUrl;
  } catch (e) {
    await prisma.vaultDocument.delete({ where: { id: nextStub.id } }).catch(() => {});
    await prisma.vaultDocument
      .update({ where: { id: current.id }, data: { isActive: true } })
      .catch(() => {});
    throw e;
  }

  const doc = await prisma.vaultDocument.update({
    where: { id: nextStub.id },
    data: {
      storageKey: null,
      contentSha256: null,
      fileUrl,
      fileMeta: {
        replacedAt: new Date().toISOString(),
        contentType: validated.contentType,
        byteSize: validated.byteLength,
        originalFilename: validated.originalFilename,
        supersedesId: current.id,
      },
    },
    select: DOCUMENT_SELECT,
  });

  if (doc.type === "VISA") {
    await upsertVisaRecord({
      documentId: doc.id,
      ownerUserId: userId,
      type: doc.type,
      copyFromDocumentId: current.id,
    });
  }

  const storedRow = await prisma.vaultDocument.findFirst({
    where: { id: doc.id, ownerUserId: userId },
    select: DOCUMENT_SELECT,
  });

  await writeAudit({
    userId,
    action: "vault.document.replace",
    resourceType: "VaultDocument",
    resourceId: doc.id,
    req,
    metadata: {
      supersedesId: current.id,
      contentType: validated.contentType,
      byteSize: validated.byteLength,
      via: "contentBase64",
    },
  });

  return toPublicDocument(storedRow || doc);
}

export async function deleteDocument(userId, req, documentId) {
  const current = await getOwnedDocumentOrThrow(userId, documentId, DOCUMENT_INTERNAL_SELECT);

  if (isPlatformIssued(current)) {
    throw new AppError(409, "Platform-issued documents cannot be deleted");
  }

  // Soft-delete only — retain metadata + bytes for audit/retention (Module 00 alignment).
  const doc = await prisma.vaultDocument.update({
    where: { id: current.id },
    data: { isActive: false },
    select: DOCUMENT_SELECT,
  });

  await writeAudit({
    userId,
    action: "vault.document.delete",
    resourceType: "VaultDocument",
    resourceId: doc.id,
    req,
  });

  return toPublicDocument(doc);
}

/**
 * Issue a one-time share token for a document. Only the hash is persisted.
 */
export async function createShareLink(userId, req, documentId, { ttlHours } = {}) {
  const doc = await getOwnedDocumentOrThrow(userId, documentId);
  if (!doc.isActive) {
    throw new AppError(409, "Cannot share a superseded/deleted document");
  }

  const token = randomToken();
  const tokenHash = sha256Hex(token);
  const expiresAt = new Date(
    Date.now() + (ttlHours ?? DEFAULT_SHARE_TTL_HOURS) * 60 * 60 * 1000,
  );

  await prisma.vaultShareLink.create({
    data: {
      documentId: doc.id,
      tokenHash,
      expiresAt,
      createdByUserId: userId,
    },
  });

  await writeAudit({
    userId,
    action: "vault.document.share",
    resourceType: "VaultDocument",
    resourceId: doc.id,
    req,
    metadata: { expiresAt },
  });

  return { token, expiresAt };
}

/**
 * Resolve a public share token to its document metadata (no binary).
 */
export async function getPublicDocument(req, token) {
  const tokenHash = sha256Hex(token);
  const link = await prisma.vaultShareLink.findUnique({
    where: { tokenHash },
    select: { id: true, documentId: true, expiresAt: true, revokedAt: true },
  });

  if (!link || link.revokedAt || link.expiresAt < new Date()) {
    throw new AppError(404, "Share link not found or expired");
  }

  const doc = await prisma.vaultDocument.findUnique({
    where: { id: link.documentId },
    select: DOCUMENT_SELECT,
  });
  if (!doc || !doc.isActive) {
    throw new AppError(404, "Document not found");
  }

  await writeAudit({
    userId: null,
    action: "vault.document.share_access",
    resourceType: "VaultDocument",
    resourceId: doc.id,
    req,
    metadata: { shareLinkId: link.id },
  });

  return toPublicDocument(doc);
}

/**
 * OCR helper — owned vault content metadata (never returns raw bytes unless
 * explicitly requested by an internal caller that already owns the document).
 */
export async function getVaultContentMetaForOcr(userId, vaultDocumentId) {
  if (!vaultDocumentId) {
    return { hasBinary: false, contentType: null, byteSize: null };
  }
  const doc = await assertOwnedVaultDocument(userId, vaultDocumentId);
  const full = await prisma.vaultDocument.findFirst({
    where: { id: doc.id, ownerUserId: userId },
    select: {
      storageKey: true,
      fileUrl: true,
      contentType: true,
      byteSize: true,
      isActive: true,
    },
  });
  return {
    hasBinary: Boolean(resolveStoredFileUrl(full)),
    contentType: full?.contentType ?? null,
    byteSize: full?.byteSize ?? null,
    isActive: full?.isActive ?? false,
  };
}

/**
 * Internal OCR binary fetch — owner-scoped. Caller must not log or return bytes to clients.
 * @returns {{ contentBase64: string, contentType: string, byteSize: number }|null}
 */
export async function getVaultBinaryForOcr(userId, vaultDocumentId) {
  if (!vaultDocumentId) return null;
  const doc = await getOwnedDocumentOrThrow(userId, vaultDocumentId, DOCUMENT_INTERNAL_SELECT);
  const fileUrl = resolveStoredFileUrl(doc);
  if (!fileUrl) return null;
  const storage = getVaultStorage();
  try {
    const buffer = await storage.get({ fileUrl });
    return {
      contentBase64: buffer.toString("base64"),
      contentType: doc.contentType || "application/octet-stream",
      byteSize: buffer.length,
    };
  } catch (e) {
    if (e?.code === "VAULT_STORAGE_UNCONFIGURED" || e?.statusCode === 503) {
      return null;
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Module 03 (AI Booking Engine) hook — auto-ingestion + printable PDFs
// ---------------------------------------------------------------------------

const PRODUCT_LABELS = { FLIGHT: "Flight", HOTEL: "Hotel", PACKAGE: "Package" };

async function persistPlatformPrintable({
  userId,
  type,
  title,
  bookingId,
  fileMeta,
  printable,
}) {
  const storage = getVaultStorage();
  const cap = getVaultStorageCapability();

  const row = await prisma.vaultDocument.create({
    data: {
      ownerUserId: userId,
      type,
      title,
      bookingId,
      fileUrl: null,
      fileMeta: {
        ...fileMeta,
        printableStatus: printable
          ? cap.configured
            ? "pending_store"
            : "storage_unconfigured"
          : "insufficient_confirmation",
      },
      contentType: printable ? "application/pdf" : null,
      byteSize: printable?.buffer?.length ?? null,
      originalFilename: printable?.filename ?? null,
    },
    select: { id: true },
  });

  if (!printable || !cap.configured) {
    return prisma.vaultDocument.update({
      where: { id: row.id },
      data: {
        fileUrl: null,
        fileMeta: {
          ...fileMeta,
          printableStatus: printable
            ? "storage_unconfigured"
            : "insufficient_confirmation",
          printableReady: false,
        },
      },
      select: DOCUMENT_SELECT,
    });
  }

  const storageKey = buildStorageKey({
    ownerUserId: userId,
    documentId: row.id,
    originalFilename: printable.filename,
  });

  try {
    const stored = await storage.put({
      storageKey,
      buffer: printable.buffer,
      contentType: "application/pdf",
    });
    return prisma.vaultDocument.update({
      where: { id: row.id },
      data: {
        storageKey: null,
        contentSha256: null,
        fileUrl: stored.fileUrl,
        fileMeta: {
          ...fileMeta,
          ...printable.meta,
          printableStatus: "stored",
          printableReady: true,
        },
      },
      select: DOCUMENT_SELECT,
    });
  } catch {
    return prisma.vaultDocument.update({
      where: { id: row.id },
      data: {
        fileUrl: null,
        fileMeta: {
          ...fileMeta,
          printableStatus: "store_failed",
          printableReady: false,
        },
      },
      select: DOCUMENT_SELECT,
    });
  }
}

/**
 * Auto-ingest ticket/voucher for a just-ticketed booking.
 * Generates printable PDFs from confirmed supplier data only (never fabricates
 * PNR/ticket/voucher numbers). Idempotent per booking+type.
 */
export async function ingestBookingDocuments({
  userId,
  bookingId,
  product,
  ticketNumbers,
  voucherRefs,
  externalRef,
  travellerSnapshot,
  currency,
  amountMinor,
  netMinor,
  supplierBookingRefs,
  metadata,
}) {
  const { buildBookingPrintable } = await import("./vault.printables.js");
  const created = [];
  const issuedAt = new Date().toISOString();

  let resolvedBooking = null;
  if (bookingId && (!supplierBookingRefs || !metadata || !travellerSnapshot)) {
    try {
      resolvedBooking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: {
          id: true,
          product: true,
          currency: true,
          amountMinor: true,
          netMinor: true,
          externalRef: true,
          travellerSnapshot: true,
          supplierBookingRefs: true,
          metadata: true,
        },
      });
    } catch {
      // ignore
    }
  }

  const finalProduct = product || resolvedBooking?.product || "FLIGHT";
  const finalCurrency = currency || resolvedBooking?.currency || "PKR";
  const finalAmountMinor = amountMinor != null ? amountMinor : (resolvedBooking?.amountMinor ?? 0);
  const finalNetMinor = netMinor != null ? netMinor : resolvedBooking?.netMinor;
  const finalExternalRef = externalRef || resolvedBooking?.externalRef || null;
  const finalTraveller = travellerSnapshot || resolvedBooking?.travellerSnapshot || null;
  const finalRefs = supplierBookingRefs || resolvedBooking?.supplierBookingRefs || {};
  const finalMeta = metadata || resolvedBooking?.metadata || {};

  const refsMeta = {
    ticketNumbers: ticketNumbers ?? null,
    voucherRefs: voucherRefs ?? null,
    externalRef: finalExternalRef,
    issuedAt,
  };

  const printableArgs = {
    product: finalProduct,
    bookingId,
    externalRef: finalExternalRef,
    ticketNumbers,
    voucherRefs,
    travellerSnapshot: finalTraveller,
    currency: finalCurrency,
    amountMinor: finalAmountMinor,
    netMinor: finalNetMinor,
    supplierBookingRefs: finalRefs,
    metadata: finalMeta,
    issuedAt,
  };

  const existingTicket = await prisma.vaultDocument.findFirst({
    where: { bookingId, type: "TICKET" },
    select: { id: true },
  });
  if (!existingTicket && (finalProduct === "FLIGHT" || finalProduct === "PACKAGE" || ticketNumbers?.length)) {
    const printable = buildBookingPrintable("TICKET", printableArgs);
    const row = await persistPlatformPrintable({
      userId,
      type: "TICKET",
      title: printable?.title || `${PRODUCT_LABELS[finalProduct] ?? finalProduct} ticket — ${finalExternalRef || bookingId.slice(-6).toUpperCase()}`,
      bookingId,
      fileMeta: refsMeta,
      printable,
    });
    created.push(row);
  }

  if (finalProduct === "HOTEL" || finalProduct === "PACKAGE" || voucherRefs?.length) {
    const existingVoucher = await prisma.vaultDocument.findFirst({
      where: { bookingId, type: "HOTEL_VOUCHER" },
      select: { id: true },
    });
    if (!existingVoucher) {
      const printable = buildBookingPrintable("HOTEL_VOUCHER", printableArgs);
      const row = await persistPlatformPrintable({
        userId,
        type: "HOTEL_VOUCHER",
        title: printable?.title || `${PRODUCT_LABELS[finalProduct] ?? finalProduct} voucher — ${finalExternalRef || bookingId.slice(-6).toUpperCase()}`,
        bookingId,
        fileMeta: refsMeta,
        printable,
      });
      created.push(row);
    }
  }

  for (const doc of created) {
    await writeAudit({
      userId,
      action: "vault.document.auto_ingest",
      resourceType: "VaultDocument",
      resourceId: doc.id,
      metadata: {
        bookingId,
        type: doc.type,
        hasBinary: Boolean(doc.byteSize),
        printableStatus: doc.fileMeta?.printableStatus ?? null,
      },
    });
  }

  return created.map(toPublicDocument);
}

/**
 * Cancel-side hook — intentionally a no-op (platform docs are immutable).
 */
export async function onBookingCancelled(_booking) {
  // Intentionally empty — see prior doc comment.
}

export { runVaultRetentionPurge, getVaultRetentionDays } from "./vault.retention.js";
export { getVaultStorageCapability };
