/**
 * Module 07 retention purge unit/integration tests.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

dotenv.config();

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-jwt-secret-min-32-characters-long";
}

const vaultRoot = await fs.mkdtemp(path.join(os.tmpdir(), "fo-vault-ret-"));
process.env.VAULT_STORAGE_PROVIDER = "local";
process.env.VAULT_LOCAL_ROOT = vaultRoot;
process.env.VAULT_RETENTION_DAYS = "30";

const { default: prisma } = await import("../../config/prisma.js");
const { runVaultRetentionPurge } = await import("./vault.retention.js");

const suffix = Date.now();
const users = [];

async function createUser(label) {
  const user = await prisma.user.create({
    data: {
      email: `fo.vault.ret.${label}.${suffix}@example.com`,
      name: `Ret ${label}`,
      passwordHash: await bcrypt.hash("TestPass123!", 10),
    },
  });
  users.push(user.id);
  return user;
}

before(async () => {
  await prisma.$queryRaw`SELECT 1`;
});

after(async () => {
  for (const id of users) {
    await prisma.travellerIdentityDocument
      .deleteMany({ where: { ownerUserId: id } })
      .catch(() => {});
    await prisma.vaultShareLink
      .deleteMany({ where: { createdByUserId: id } })
      .catch(() => {});
    await prisma.vaultDocument.deleteMany({ where: { ownerUserId: id } }).catch(() => {});
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
  await fs.rm(vaultRoot, { recursive: true, force: true }).catch(() => {});
});

describe("vault retention", () => {
  it("purges old soft-deleted user docs but keeps platform tickets and referenced docs", async () => {
    const user = await createUser("a");
    const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const purgeable = await prisma.vaultDocument.create({
      data: {
        ownerUserId: user.id,
        type: "OTHER",
        title: "old soft",
        isActive: false,
        updatedAt: old,
      },
    });
    // Force updatedAt via raw if prisma ignores on create
    await prisma.$executeRaw`
      UPDATE "VaultDocument" SET "updatedAt" = ${old} WHERE id = ${purgeable.id}
    `;

    const ticket = await prisma.vaultDocument.create({
      data: {
        ownerUserId: user.id,
        type: "TICKET",
        title: "ticket",
        bookingId: `bk-${suffix}`,
        isActive: false,
        updatedAt: old,
      },
    });
    await prisma.$executeRaw`
      UPDATE "VaultDocument" SET "updatedAt" = ${old} WHERE id = ${ticket.id}
    `;

    const referenced = await prisma.vaultDocument.create({
      data: {
        ownerUserId: user.id,
        type: "PASSPORT",
        title: "linked",
        isActive: false,
      },
    });
    await prisma.$executeRaw`
      UPDATE "VaultDocument" SET "updatedAt" = ${old} WHERE id = ${referenced.id}
    `;
    await prisma.travellerProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, displayName: "Ret" },
    });
    await prisma.travellerIdentityDocument.create({
      data: {
        ownerUserId: user.id,
        profileUserId: user.id,
        type: "PASSPORT",
        vaultDocumentId: referenced.id,
        status: "ACTIVE",
        verificationStatus: "UNVERIFIED",
      },
    });

    const result = await runVaultRetentionPurge({ limit: 50, now: new Date() });
    assert.ok(result.purged >= 1);
    assert.ok(result.purgedIds.includes(purgeable.id));

    const gone = await prisma.vaultDocument.findUnique({ where: { id: purgeable.id } });
    assert.equal(gone, null);

    const keptTicket = await prisma.vaultDocument.findUnique({ where: { id: ticket.id } });
    assert.ok(keptTicket);

    const keptRef = await prisma.vaultDocument.findUnique({ where: { id: referenced.id } });
    assert.ok(keptRef);
  });
});
