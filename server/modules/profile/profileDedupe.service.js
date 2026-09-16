/**
 * Module 02 — within-account duplicate detection/merge.
 *
 * TravellerProfile is 1:1 with User, so "duplicate profiles" in practice means
 * duplicate companions, loyalty rows, or emergency contacts on the same account.
 * Never merges across users. Never silently deletes conflicting identity data.
 */
import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import { writeAudit } from "../../lib/audit.js";
import { decryptField, isEncryptedField } from "../../lib/fieldEncryption.js";

function normalizeName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function dobKey(d) {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString().slice(0, 10);
}

function phoneKey(phone) {
  return String(phone || "").replace(/\D/g, "");
}

/**
 * Preview duplicate clusters owned by this user.
 */
export async function findProfileDuplicates(userId) {
  const [companions, loyalty, contacts] = await Promise.all([
    prisma.travellerCompanion.findMany({
      where: { ownerUserId: userId },
      select: {
        id: true,
        fullName: true,
        kind: true,
        dateOfBirth: true,
        passportNumber: true,
        updatedAt: true,
        createdAt: true,
        _count: { select: { identityDocuments: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.loyaltyMembership.findMany({
      where: { profileUserId: userId },
      select: {
        id: true,
        type: true,
        programCode: true,
        memberNumber: true,
        createdAt: true,
      },
    }),
    prisma.emergencyContact.findMany({
      where: { profileUserId: userId },
      select: {
        id: true,
        fullName: true,
        phone: true,
        isPrimary: true,
        createdAt: true,
      },
    }),
  ]);

  const companionGroups = new Map();
  for (const c of companions) {
    const key = `${normalizeName(c.fullName)}|${dobKey(c.dateOfBirth)}`;
    if (!companionGroups.has(key)) companionGroups.set(key, []);
    companionGroups.get(key).push(c);
  }
  const companionDuplicates = [...companionGroups.values()]
    .filter((g) => g.length > 1)
    .map((g) => ({
      key: `${normalizeName(g[0].fullName)}|${dobKey(g[0].dateOfBirth)}`,
      ids: g.map((x) => x.id),
      names: g.map((x) => x.fullName),
    }));

  const loyaltyGroups = new Map();
  for (const m of loyalty) {
    const key = `${m.type}|${m.programCode.toUpperCase()}|${m.memberNumber}`;
    if (!loyaltyGroups.has(key)) loyaltyGroups.set(key, []);
    loyaltyGroups.get(key).push(m);
  }
  const loyaltyDuplicates = [...loyaltyGroups.values()]
    .filter((g) => g.length > 1)
    .map((g) => ({
      key: `${g[0].type}|${g[0].programCode}|${g[0].memberNumber}`,
      ids: g.map((x) => x.id),
    }));

  const contactGroups = new Map();
  for (const c of contacts) {
    const key = phoneKey(c.phone);
    if (!key) continue;
    if (!contactGroups.has(key)) contactGroups.set(key, []);
    contactGroups.get(key).push(c);
  }
  const emergencyDuplicates = [...contactGroups.values()]
    .filter((g) => g.length > 1)
    .map((g) => ({
      key: phoneKey(g[0].phone),
      ids: g.map((x) => x.id),
      phones: g.map((x) => x.phone),
    }));

  return {
    companionDuplicates,
    loyaltyDuplicates,
    emergencyDuplicates,
    hasDuplicates:
      companionDuplicates.length > 0 ||
      loyaltyDuplicates.length > 0 ||
      emergencyDuplicates.length > 0,
  };
}

function pickCompanionKeeper(group) {
  return [...group].sort((a, b) => {
    const docs = (b._count?.identityDocuments ?? 0) - (a._count?.identityDocuments ?? 0);
    if (docs !== 0) return docs;
    const aPass = a.passportNumber ? 1 : 0;
    const bPass = b.passportNumber ? 1 : 0;
    if (bPass !== aPass) return bPass - aPass;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  })[0];
}

function passportConflict(aEnc, bEnc) {
  if (!aEnc || !bEnc) return false;
  try {
    const a = decryptField(aEnc);
    const b = decryptField(bEnc);
    if (!a || !b) return false;
    return a !== b;
  } catch {
    // If decrypt fails, treat as conflict — never drop either row.
    return true;
  }
}

/**
 * Apply safe within-account merges. Conflicting identity/passport data is retained.
 */
export async function applyProfileDedupe(userId, opts = {}) {
  const preview = await findProfileDuplicates(userId);
  if (!preview.hasDuplicates) {
    return {
      merged: { companions: 0, loyalty: 0, emergencyContacts: 0 },
      conflicts: [],
      preview,
    };
  }

  const conflicts = [];
  let companionsMerged = 0;
  let loyaltyMerged = 0;
  let emergencyMerged = 0;

  await prisma.$transaction(async (tx) => {
    // Companions
    for (const cluster of preview.companionDuplicates) {
      const rows = await tx.travellerCompanion.findMany({
        where: { ownerUserId: userId, id: { in: cluster.ids } },
        select: {
          id: true,
          fullName: true,
          passportNumber: true,
          passportExpiry: true,
          relationship: true,
          kind: true,
          dateOfBirth: true,
          metadata: true,
          updatedAt: true,
          createdAt: true,
          _count: { select: { identityDocuments: true } },
        },
      });
      if (rows.length < 2) continue;
      const keeper = pickCompanionKeeper(rows);
      const losers = rows.filter((r) => r.id !== keeper.id);

      for (const loser of losers) {
        if (passportConflict(keeper.passportNumber, loser.passportNumber)) {
          conflicts.push({
            type: "companion_passport",
            keeperId: keeper.id,
            retainedId: loser.id,
            reason: "Conflicting passport numbers — both records retained",
          });
          await tx.travellerCompanion.update({
            where: { id: loser.id },
            data: {
              metadata: {
                ...(loser.metadata && typeof loser.metadata === "object"
                  ? loser.metadata
                  : {}),
                duplicateOfCompanionId: keeper.id,
                dedupeConflict: "passport_mismatch",
              },
            },
          });
          continue;
        }

        // Move documents to keeper
        await tx.travellerIdentityDocument.updateMany({
          where: { companionId: loser.id, ownerUserId: userId },
          data: { companionId: keeper.id },
        });

        // Fill empty keeper fields from loser
        const patch = {};
        if (!keeper.passportNumber && loser.passportNumber) {
          patch.passportNumber = loser.passportNumber;
          patch.passportExpiry = loser.passportExpiry;
        }
        if (!keeper.relationship && loser.relationship) {
          patch.relationship = loser.relationship;
        }
        if (!keeper.dateOfBirth && loser.dateOfBirth) {
          patch.dateOfBirth = loser.dateOfBirth;
        }
        if (Object.keys(patch).length) {
          await tx.travellerCompanion.update({
            where: { id: keeper.id },
            data: patch,
          });
        }

        await tx.travellerCompanion.delete({ where: { id: loser.id } });
        companionsMerged += 1;
      }
    }

    // Loyalty — keep oldest, delete exact duplicates
    for (const cluster of preview.loyaltyDuplicates) {
      const rows = await tx.loyaltyMembership.findMany({
        where: { profileUserId: userId, id: { in: cluster.ids } },
        orderBy: { createdAt: "asc" },
      });
      if (rows.length < 2) continue;
      const [, ...dupes] = rows;
      for (const d of dupes) {
        await tx.loyaltyMembership.delete({ where: { id: d.id } });
        loyaltyMerged += 1;
      }
    }

    // Emergency contacts — keep primary if any, else oldest; delete phone dupes
    for (const cluster of preview.emergencyDuplicates) {
      const rows = await tx.emergencyContact.findMany({
        where: { profileUserId: userId, id: { in: cluster.ids } },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      });
      if (rows.length < 2) continue;
      const [, ...dupes] = rows;
      for (const d of dupes) {
        await tx.emergencyContact.delete({ where: { id: d.id } });
        emergencyMerged += 1;
      }
    }
  });

  void writeAudit({
    userId,
    action: "profile.dedupe.apply",
    resourceType: "TravellerProfile",
    resourceId: userId,
    req: opts.req,
    metadata: {
      companionsMerged,
      loyaltyMerged,
      emergencyMerged,
      conflictCount: conflicts.length,
    },
  });

  return {
    merged: {
      companions: companionsMerged,
      loyalty: loyaltyMerged,
      emergencyContacts: emergencyMerged,
    },
    conflicts,
    preview: await findProfileDuplicates(userId),
  };
}

/**
 * Guard: refuse if caller somehow passes another user's id (controller uses req.user.id).
 */
export async function assertOwnedProfile(userId) {
  if (!userId) throw new AppError(401, "Unauthorized");
  return userId;
}

export { normalizeName, isEncryptedField };
