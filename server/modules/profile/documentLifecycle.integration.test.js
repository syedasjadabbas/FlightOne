/**
 * Module 02 document lifecycle integration tests.
 * Run: node --test modules/profile/documentLifecycle.integration.test.js
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

if (!process.env.FIELD_ENCRYPTION_KEY) {
  process.env.FIELD_ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
}

const { default: prisma } = await import("../../config/prisma.js");
const { resetFieldEncryptionKeyCache } = await import(
  "../../lib/fieldEncryption.js"
);
resetFieldEncryptionKeyCache();

const identityDocumentService = await import("./identityDocument.service.js");
const {
  scheduleExpiryNotificationsForDocument,
  runDocumentExpiryScheduler,
} = await import("./documentExpiry.scheduler.js");
const { expiryNotificationDedupeKey } = await import("./documentExpiry.js");

const suffix = Date.now();
const users = [];

async function createUser(label) {
  const user = await prisma.user.create({
    data: {
      email: `fo.doclife.${label}.${suffix}@example.com`,
      name: `DocLife ${label}`,
      passwordHash: await bcrypt.hash("TestPass123!", 10),
    },
  });
  users.push(user.id);
  return user;
}

async function createVaultStub(userId, { type = "PASSPORT", title = "Vault stub" } = {}) {
  return prisma.vaultDocument.create({
    data: {
      ownerUserId: userId,
      type,
      title,
      fileUrl: `vault://document/pending`,
      isActive: true,
    },
  });
}

before(async () => {
  await prisma.$queryRaw`SELECT 1`;
});

after(async () => {
  for (const id of users) {
    await prisma.notificationOutbox
      .deleteMany({ where: { userId: id } })
      .catch(() => {});
    await prisma.vaultShareLink
      .deleteMany({ where: { createdByUserId: id } })
      .catch(() => {});
    await prisma.vaultDocument.deleteMany({ where: { ownerUserId: id } }).catch(() => {});
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("document lifecycle integration", () => {
  it("rejects invalid issue/expiry pairing", async () => {
    const user = await createUser("bad-dates");
    await assert.rejects(
      () =>
        identityDocumentService.createIdentityDocument(user.id, {
          type: "PASSPORT",
          documentNumber: "BAD1",
          issuedAt: new Date("2030-01-01"),
          expiresAt: new Date("2020-01-01"),
        }),
      (err) => err.statusCode === 400,
    );
  });

  it("verifies and rejects with audit fields; OCR cannot overwrite verified", async () => {
    const user = await createUser("verify");
    const vault = await createVaultStub(user.id);
    const doc = await identityDocumentService.createIdentityDocument(user.id, {
      type: "PASSPORT",
      documentNumber: "VER123",
      countryCode: "PK",
      issuedAt: new Date("2020-01-01"),
      expiresAt: new Date("2030-01-01"),
      vaultDocumentId: vault.id,
    });
    assert.equal(doc.verificationStatus, "UNVERIFIED");

    const { setOcrProvider, resetOcrProvider, mapOcrExtraction } = await import(
      "./ocr/ocr.provider.js"
    );
    setOcrProvider({
      name: "test-http",
      async extract() {
        return mapOcrExtraction("PASSPORT", {
          provider: "test-http",
          fields: { documentNumber: "OCR999", countryCode: "AE" },
          confidence: 0.8,
        });
      },
    });

    try {
      const ocr = await identityDocumentService.runIdentityDocumentOcr(
        user.id,
        doc.id,
        {},
      );
      assert.equal(ocr.applied, false);
      assert.equal(ocr.extraction.fields.documentNumber, "OCR999");

      const pendingApply = await identityDocumentService.applyIdentityDocumentOcr(
        user.id,
        doc.id,
        { acceptedFields: ["documentNumber", "countryCode"] },
      );
      assert.equal(pendingApply.countryCode, "AE");
      assert.equal(pendingApply.documentNumber, "OCR999");
      assert.equal(pendingApply.verificationStatus, "PENDING");

      const verified =
        await identityDocumentService.setIdentityDocumentVerification(
          user.id,
          doc.id,
          { decision: "VERIFIED", note: "manual check ok" },
        );
      assert.equal(verified.verificationStatus, "VERIFIED");
      assert.equal(verified.verifiedByUserId, user.id);
      assert.ok(verified.verifiedAt);

      // OCR run on verified doc must not change fields; apply blocked.
      const ocrAgain = await identityDocumentService.runIdentityDocumentOcr(
        user.id,
        doc.id,
        {},
      );
      assert.equal(ocrAgain.document.verificationStatus, "VERIFIED");
      assert.equal(ocrAgain.document.countryCode, "AE");

      await assert.rejects(
        () =>
          identityDocumentService.applyIdentityDocumentOcr(user.id, doc.id, {
            acceptedFields: ["documentNumber"],
          }),
        (err) => err.statusCode === 409,
      );

      await assert.rejects(
        () =>
          identityDocumentService.updateIdentityDocument(user.id, doc.id, {
            countryCode: "US",
          }),
        (err) => err.statusCode === 409,
      );

      const rejected =
        await identityDocumentService.setIdentityDocumentVerification(
          user.id,
          doc.id,
          { decision: "REJECTED", note: "blurry scan" },
        );
      assert.equal(rejected.verificationStatus, "REJECTED");
    } finally {
      resetOcrProvider();
    }
  });

  it("unconfigured OCR stores empty reviewable extract (no fake data)", async () => {
    const user = await createUser("ocr-empty");
    const doc = await identityDocumentService.createIdentityDocument(user.id, {
      type: "VISA",
      documentNumber: "VKEEP",
      countryCode: "AE",
      expiresAt: new Date("2027-01-01"),
    });
    const ocr = await identityDocumentService.runIdentityDocumentOcr(
      user.id,
      doc.id,
      { rawText: "should not be parsed locally" },
    );
    assert.deepEqual(ocr.extraction.fields, {});
    assert.equal(ocr.applied, false);
    assert.equal(ocr.document.documentNumber, null);
  });

  it("worker runDocumentExpiryScheduler executes without throw", async () => {
    const result = await runDocumentExpiryScheduler({
      now: new Date(),
      leadDays: [180, 30, 7],
      batchSize: 10,
    });
    assert.equal(typeof result.scanned, "number");
    assert.equal(typeof result.enqueued, "number");
    assert.deepEqual(result.leadDays, [180, 30, 7]);
  });

  it("re-upload supersedes old active document and requires new vault id", async () => {
    const user = await createUser("reup");
    const vaultOld = await createVaultStub(user.id, { title: "old" });
    const vaultNew = await createVaultStub(user.id, {
      type: "NATIONAL_ID",
      title: "new",
    });
    const doc = await identityDocumentService.createIdentityDocument(user.id, {
      type: "NATIONAL_ID",
      documentNumber: "CNIC-1",
      countryCode: "PK",
      expiresAt: new Date("2028-01-01"),
      vaultDocumentId: vaultOld.id,
    });

    await assert.rejects(
      () =>
        identityDocumentService.reuploadIdentityDocument(user.id, doc.id, {
          vaultDocumentId: vaultOld.id,
        }),
      (err) => err.statusCode === 400,
    );

    const next = await identityDocumentService.reuploadIdentityDocument(
      user.id,
      doc.id,
      {
        vaultDocumentId: vaultNew.id,
        documentNumber: "CNIC-2",
      },
    );
    assert.equal(next.status, "ACTIVE");
    assert.equal(next.supersedesId, doc.id);
    assert.equal(next.vaultDocumentId, vaultNew.id);
    assert.equal(next.verificationStatus, "UNVERIFIED");
    assert.equal(next.documentNumber, "CNIC-2");

    const old = await prisma.travellerIdentityDocument.findUnique({
      where: { id: doc.id },
    });
    assert.equal(old.status, "SUPERSEDED");

    const active = await identityDocumentService.listIdentityDocuments(user.id, {
      status: "ACTIVE",
    });
    assert.equal(active.length, 1);
    assert.equal(active[0].id, next.id);
    assert.equal(active[0].documentNumber, null);
  });

  it("blocks linking another user's vault document", async () => {
    const a = await createUser("link-a");
    const b = await createUser("link-b");
    const bVault = await createVaultStub(b.id);
    await assert.rejects(
      () =>
        identityDocumentService.createIdentityDocument(a.id, {
          type: "PASSPORT",
          documentNumber: "X1",
          vaultDocumentId: bVault.id,
        }),
      (err) => err.statusCode === 404,
    );
  });

  it("isolates documents between users", async () => {
    const a = await createUser("iso-a");
    const b = await createUser("iso-b");
    const doc = await identityDocumentService.createIdentityDocument(a.id, {
      type: "VISA",
      documentNumber: "V-A",
      countryCode: "AE",
      expiresAt: new Date("2027-01-01"),
    });
    await assert.rejects(
      () => identityDocumentService.getIdentityDocument(b.id, doc.id),
      (err) => err.statusCode === 404,
    );
    await assert.rejects(
      () =>
        identityDocumentService.setIdentityDocumentVerification(b.id, doc.id, {
          decision: "VERIFIED",
        }),
      (err) => err.statusCode === 404,
    );
  });

  it("dedupes expiry notifications per lead + channel", async () => {
    const user = await createUser("expiry");
    const expiresAt = new Date(Date.now() + 5 * 86_400_000);
    const doc = await identityDocumentService.createIdentityDocument(user.id, {
      type: "PASSPORT",
      documentNumber: "EXP1",
      countryCode: "PK",
      expiresAt,
    });

    const first = await scheduleExpiryNotificationsForDocument(
      {
        id: doc.id,
        ownerUserId: user.id,
        type: "PASSPORT",
        expiresAt,
      },
      { leadDays: [180, 30, 7], channels: ["APP", "EMAIL"] },
    );
    assert.ok(first.enqueued > 0);

    const second = await scheduleExpiryNotificationsForDocument(
      {
        id: doc.id,
        ownerUserId: user.id,
        type: "PASSPORT",
        expiresAt,
      },
      { leadDays: [180, 30, 7], channels: ["APP", "EMAIL"] },
    );
    assert.equal(second.enqueued, 0);
    assert.ok(second.skippedDuplicate > 0);

    const key = expiryNotificationDedupeKey(doc.id, 7);
    const rows = await prisma.notificationOutbox.findMany({
      where: { dedupeKey: key },
    });
    assert.equal(rows.length, 2); // APP + EMAIL
  });

  it("scheduler marks past-due ACTIVE docs EXPIRED", async () => {
    const user = await createUser("expired-mark");
    const doc = await identityDocumentService.createIdentityDocument(user.id, {
      type: "RESIDENCE_PERMIT",
      documentNumber: "RP-OLD",
      countryCode: "PK",
      expiresAt: new Date("2020-01-01"),
    });
    const result = await runDocumentExpiryScheduler({
      now: new Date("2026-09-03T12:00:00Z"),
      leadDays: [180, 30, 7],
    });
    assert.ok(result.markedExpired >= 1);
    const row = await prisma.travellerIdentityDocument.findUnique({
      where: { id: doc.id },
    });
    assert.equal(row.status, "EXPIRED");
  });
});
