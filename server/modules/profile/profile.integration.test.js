/**
 * Module 02 profile integration tests against the live Postgres DB.
 * Requires DATABASE_URL + FIELD_ENCRYPTION_KEY.
 * Run: node --test modules/profile/profile.integration.test.js
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { ZodError } from "zod";

dotenv.config();

if (!process.env.FIELD_ENCRYPTION_KEY) {
  process.env.FIELD_ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
}

const { default: prisma } = await import("../../config/prisma.js");
const { resetFieldEncryptionKeyCache, isEncryptedField } = await import(
  "../../lib/fieldEncryption.js"
);
resetFieldEncryptionKeyCache();

const profileService = await import("./profile.service.js");
const companionService = await import("./companion.service.js");
const identityDocumentService = await import("./identityDocument.service.js");
const emergencyContactService = await import("./emergencyContact.service.js");
const loyaltyService = await import("./loyalty.service.js");
const historyService = await import("./history.service.js");
const { updateProfileSchema } = await import("./profile.validators.js");

const suffix = Date.now();
const users = [];

async function createUser(label) {
  const email = `fo.profile.${label}.${suffix}@example.com`;
  const user = await prisma.user.create({
    data: {
      email,
      name: `Profile ${label}`,
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
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("Module 02 profile foundation (integration)", () => {
  it("creates a profile on first retrieval (authenticated user scope)", async () => {
    const user = await createUser("a");
    const profile = await profileService.getOrCreateProfile(user.id);
    assert.equal(profile.userId, user.id);
    assert.ok(profile.displayName);
    assert.ok(profile.completeness);
    assert.equal(typeof profile.completeness.score, "number");

    const again = await profileService.getOrCreateProfile(user.id);
    assert.equal(again.userId, user.id);
  });

  it("updates and persists travel preferences", async () => {
    const user = await createUser("b");
    await profileService.getOrCreateProfile(user.id);
    const updated = await profileService.updateProfile(user.id, {
      seatPref: "aisle",
      mealPref: "halal",
      preferredAirlines: ["EY", "PK"],
      preferredCabin: "ECONOMY",
      maxLayoverMinutes: 180,
      nationality: "PK",
      phone: "+923001234567",
    });
    assert.equal(updated.seatPref, "aisle");
    assert.equal(updated.preferredCabin, "ECONOMY");
    assert.equal(updated.maxLayoverMinutes, 180);
    assert.deepEqual(updated.preferredAirlines, ["EY", "PK"]);

    const loaded = await profileService.getOrCreateProfile(user.id);
    assert.equal(loaded.seatPref, "aisle");
    assert.equal(loaded.mealPref, "halal");
    assert.equal(loaded.nationality, "PK");
  });

  it("stores identity documents with encrypted numbers and decrypts on read", async () => {
    const user = await createUser("c");
    const doc = await identityDocumentService.createIdentityDocument(user.id, {
      type: "PASSPORT",
      documentNumber: "P1234567",
      countryCode: "PK",
      issuedAt: new Date("2020-01-01"),
      expiresAt: new Date("2030-01-01"),
    });
    assert.equal(doc.documentNumber, "P1234567");
    assert.equal(doc.type, "PASSPORT");
    assert.equal(doc.countryCode, "PK");
    assert.equal(doc.status, "ACTIVE");

    const raw = await prisma.travellerIdentityDocument.findUnique({
      where: { id: doc.id },
    });
    assert.ok(raw.documentNumberEnc);
    assert.ok(isEncryptedField(raw.documentNumberEnc));
    assert.notEqual(raw.documentNumberEnc, "P1234567");

    const listed = await identityDocumentService.listIdentityDocuments(user.id);
    assert.equal(listed.length, 1);
    assert.equal(listed[0].documentNumber, null);
    assert.equal(listed[0].hasDocumentNumber, true);
    assert.ok(listed[0].expiry);

    const listedWithNumber = await identityDocumentService.listIdentityDocuments(
      user.id,
      { includeNumber: true },
    );
    assert.equal(listedWithNumber[0].documentNumber, "P1234567");
  });

  it("isolates profile data between users", async () => {
    const a = await createUser("iso-a");
    const b = await createUser("iso-b");

    const companion = await companionService.createCompanion(a.id, {
      fullName: "A Spouse",
      kind: "FAMILY",
      relationship: "spouse",
      passportNumber: "XY999",
    });
    const contact = await emergencyContactService.createEmergencyContact(a.id, {
      fullName: "Emergency A",
      phone: "+92000",
      isPrimary: true,
    });
    const doc = await identityDocumentService.createIdentityDocument(a.id, {
      type: "NATIONAL_ID",
      documentNumber: "CNIC-111",
      countryCode: "PK",
    });
    await loyaltyService.addLoyaltyMembership(a.id, {
      type: "AIRLINE",
      programCode: "EY",
      memberNumber: "EY123",
    });

    const bCompanions = await companionService.listCompanions(b.id);
    const bContacts = await emergencyContactService.listEmergencyContacts(b.id);
    const bDocs = await identityDocumentService.listIdentityDocuments(b.id);
    const bLoyalty = await loyaltyService.listLoyaltyMemberships(b.id);
    assert.equal(bCompanions.length, 0);
    assert.equal(bContacts.length, 0);
    assert.equal(bDocs.length, 0);
    assert.equal(bLoyalty.length, 0);

    await assert.rejects(
      () => companionService.updateCompanion(b.id, companion.id, { fullName: "Hack" }),
      (err) => err.statusCode === 404,
    );
    await assert.rejects(
      () =>
        emergencyContactService.updateEmergencyContact(b.id, contact.id, {
          fullName: "Hack",
        }),
      (err) => err.statusCode === 404,
    );
    await assert.rejects(
      () =>
        identityDocumentService.updateIdentityDocument(b.id, doc.id, {
          documentNumber: "HACK",
        }),
      (err) => err.statusCode === 404,
    );
  });

  it("persists emergency contacts, family companions, loyalty, and history shape", async () => {
    const user = await createUser("d");
    await emergencyContactService.createEmergencyContact(user.id, {
      fullName: "Dad",
      phone: "+92111",
      relationship: "father",
    });
    await companionService.createCompanion(user.id, {
      kind: "FAMILY",
      fullName: "Kid",
      relationship: "child",
    });
    await loyaltyService.addLoyaltyMembership(user.id, {
      type: "HOTEL",
      programCode: "MARRIOTT",
      memberNumber: "M-1",
    });

    const profile = await profileService.getOrCreateProfile(user.id);
    assert.ok(profile.completeness.hasOwnProperty("missing"));

    const history = await historyService.listTravelHistory(user.id);
    assert.ok(Array.isArray(history.items));
    assert.equal(typeof history.stats.totalBookings, "number");

    const family = await companionService.listCompanions(user.id, {
      kind: "FAMILY",
    });
    assert.equal(family.length, 1);
    assert.equal(family[0].kind, "FAMILY");
  });

  it("rejects invalid profile patch input via schema", () => {
    assert.throws(
      () => updateProfileSchema.parse({ maxLayoverMinutes: -1 }),
      ZodError,
    );
    assert.throws(
      () => updateProfileSchema.parse({ preferredCabin: "ROCKET" }),
      ZodError,
    );
  });

  it("renewal supersedes prior identity document without deleting audit row", async () => {
    const user = await createUser("e");
    const first = await identityDocumentService.createIdentityDocument(user.id, {
      type: "VISA",
      documentNumber: "V-OLD",
      countryCode: "AE",
      documentSubtype: "tourist",
      expiresAt: new Date("2025-01-01"),
    });
    const renewed = await identityDocumentService.createIdentityDocument(user.id, {
      type: "VISA",
      documentNumber: "V-NEW",
      countryCode: "AE",
      documentSubtype: "tourist",
      expiresAt: new Date("2028-01-01"),
      supersedesId: first.id,
    });
    assert.equal(renewed.supersedesId, first.id);

    const old = await prisma.travellerIdentityDocument.findUnique({
      where: { id: first.id },
    });
    assert.equal(old.status, "SUPERSEDED");
    assert.ok(old.documentNumberEnc);
  });
});
