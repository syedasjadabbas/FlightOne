import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import { writeAudit } from "../../lib/audit.js";
import { encryptField, decryptField, isEncryptedField } from "../../lib/fieldEncryption.js";

const COMPANION_SELECT = {
  id: true,
  ownerUserId: true,
  kind: true,
  fullName: true,
  relationship: true,
  dateOfBirth: true,
  passportNumber: true,
  passportExpiry: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
};

function toPublicCompanion(row, { auditReq, actorUserId, includePassport = false } = {}) {
  if (!row) return row;
  const { passportNumber: stored, ...rest } = row;
  const hasPassport = Boolean(stored);
  const base = {
    ...rest,
    hasPassport,
    passportNumber: null,
  };

  if (!includePassport || !stored) {
    return base;
  }

  base.passportNumber = decryptField(stored);
  void writeAudit({
    userId: actorUserId ?? rest.ownerUserId,
    action: "profile.companion.passport_read",
    resourceType: "TravellerCompanion",
    resourceId: rest.id,
    req: auditReq,
    metadata: { encrypted: isEncryptedField(stored) },
  });
  return base;
}

function prepareCompanionWrite(data) {
  if (!data) return {};
  const { passportNumber, metadata, ...rest } = data;
  const out = { ...rest };
  if (passportNumber !== undefined) {
    out.passportNumber =
      passportNumber === null || passportNumber === ""
        ? null
        : encryptField(passportNumber);
  }
  if (metadata !== undefined) {
    out.metadata = metadata;
  }
  return out;
}

function normalizeName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** GET /api/v1/profile/companions — list companions owned by this user. */
export async function listCompanions(ownerUserId, opts = {}) {
  const includePassport =
    opts.includePassport === true || opts.includePassport === "true";
  const rows = await prisma.travellerCompanion.findMany({
    where: {
      ownerUserId,
      ...(opts.kind ? { kind: opts.kind } : {}),
    },
    select: COMPANION_SELECT,
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) =>
    toPublicCompanion(r, {
      auditReq: opts.req,
      actorUserId: ownerUserId,
      includePassport,
    }),
  );
}

/** POST /api/v1/profile/companions — create a companion for this user. */
export async function createCompanion(ownerUserId, data, opts = {}) {
  const existing = await prisma.travellerCompanion.findMany({
    where: { ownerUserId },
    select: { id: true, fullName: true, dateOfBirth: true },
  });
  const nameKey = normalizeName(data.fullName);
  const dob = data.dateOfBirth
    ? new Date(data.dateOfBirth).toISOString().slice(0, 10)
    : "";
  const nearDup = existing.find((c) => {
    const sameName = normalizeName(c.fullName) === nameKey;
    if (!sameName) return false;
    if (!dob && !c.dateOfBirth) return true;
    if (!dob || !c.dateOfBirth) return false;
    return new Date(c.dateOfBirth).toISOString().slice(0, 10) === dob;
  });

  const writeData = prepareCompanionWrite(data);
  if (nearDup) {
    writeData.metadata = {
      ...(writeData.metadata && typeof writeData.metadata === "object"
        ? writeData.metadata
        : {}),
      possibleDuplicateOf: nearDup.id,
    };
  }

  const row = await prisma.travellerCompanion.create({
    data: { ownerUserId, ...writeData },
    select: COMPANION_SELECT,
  });

  return toPublicCompanion(row, {
    auditReq: opts.req,
    actorUserId: ownerUserId,
    includePassport: true,
  });
}

async function findOwnCompanionOrThrow(ownerUserId, id) {
  const companion = await prisma.travellerCompanion.findUnique({
    where: { id },
    select: { id: true, ownerUserId: true },
  });
  if (!companion || companion.ownerUserId !== ownerUserId) {
    throw new AppError(404, "Companion not found");
  }
  return companion;
}

/** PATCH /api/v1/profile/companions/:id — update own companion only. */
export async function updateCompanion(ownerUserId, id, patch, opts = {}) {
  await findOwnCompanionOrThrow(ownerUserId, id);
  const row = await prisma.travellerCompanion.update({
    where: { id },
    data: prepareCompanionWrite(patch),
    select: COMPANION_SELECT,
  });
  return toPublicCompanion(row, {
    auditReq: opts.req,
    actorUserId: ownerUserId,
    includePassport: true,
  });
}

/** DELETE /api/v1/profile/companions/:id — delete own companion only. */
export async function deleteCompanion(ownerUserId, id) {
  await findOwnCompanionOrThrow(ownerUserId, id);
  await prisma.travellerCompanion.delete({ where: { id } });
}
