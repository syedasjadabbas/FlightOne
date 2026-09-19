/**
 * Module 07 — Vault retention / hard-purge.
 *
 * Soft-deleted (isActive=false) user documents older than VAULT_RETENTION_DAYS
 * may be hard-purged (row + storage object). Platform-issued TICKET /
 * HOTEL_VOUCHER rows are never purged. Documents still referenced by an
 * identity profile (vaultDocumentId) are never purged.
 */
import prisma from "../../config/prisma.js";
import { writeAudit } from "../../lib/audit.js";
import { getVaultStorage } from "./vault.storage.js";

const PLATFORM_TYPES = new Set(["TICKET", "HOTEL_VOUCHER"]);

export function getVaultRetentionDays(env = process.env) {
  const raw = Number(env.VAULT_RETENTION_DAYS);
  if (!Number.isFinite(raw) || raw < 1) return 365;
  return Math.min(Math.floor(raw), 3650);
}

/**
 * @returns {{ scanned: number, purged: number, skipped: number, retentionDays: number, purgedIds: string[] }}
 */
export async function runVaultRetentionPurge({ limit = 100, now = new Date() } = {}) {
  const retentionDays = getVaultRetentionDays();
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const storage = getVaultStorage();

  const candidates = await prisma.vaultDocument.findMany({
    where: {
      isActive: false,
      updatedAt: { lte: cutoff },
      NOT: {
        AND: [{ bookingId: { not: null } }, { type: { in: [...PLATFORM_TYPES] } }],
      },
    },
    orderBy: { updatedAt: "asc" },
    take: Math.min(Math.max(limit, 1), 500),
    select: {
      id: true,
      ownerUserId: true,
      type: true,
      bookingId: true,
      storageKey: true,
      supersedesId: true,
    },
  });

  let purged = 0;
  let skipped = 0;
  const purgedIds = [];

  for (const doc of candidates) {
    if (doc.bookingId && PLATFORM_TYPES.has(doc.type)) {
      skipped += 1;
      continue;
    }

    const referenced = await prisma.travellerIdentityDocument.count({
      where: { vaultDocumentId: doc.id },
    });
    if (referenced > 0) {
      skipped += 1;
      continue;
    }

    // Also protect if any newer version still points at this id via supersedes
    // chain while remaining referenced — already covered by vaultDocumentId check
    // on active rows; soft-deleted identity rows still count above.

    if (doc.storageKey) {
      try {
        await storage.remove({ storageKey: doc.storageKey });
      } catch {
        // Continue — metadata purge still proceeds; orphaned local files are acceptable.
      }
    }

    await prisma.vaultShareLink.deleteMany({ where: { documentId: doc.id } });
    await prisma.vaultVisaRecord.deleteMany({ where: { documentId: doc.id } }).catch(() => {});
    await prisma.vaultDocument.delete({ where: { id: doc.id } });

    await writeAudit({
      userId: doc.ownerUserId,
      action: "vault.document.purge",
      resourceType: "VaultDocument",
      resourceId: doc.id,
      metadata: {
        type: doc.type,
        retentionDays,
        hadStorageKey: Boolean(doc.storageKey),
      },
    });

    purged += 1;
    purgedIds.push(doc.id);
  }

  return {
    scanned: candidates.length,
    purged,
    skipped,
    retentionDays,
    purgedIds,
  };
}
