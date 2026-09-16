/**
 * Module 02 within-account merge/dedupe + personalization isolation.
 * Requires DATABASE_URL + FIELD_ENCRYPTION_KEY.
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
const { resetFieldEncryptionKeyCache, isEncryptedField } = await import(
  "../../lib/fieldEncryption.js"
);
resetFieldEncryptionKeyCache();

const companionService = await import("./companion.service.js");
const loyaltyService = await import("./loyalty.service.js");
const emergencyContactService = await import("./emergencyContact.service.js");
const profileService = await import("./profile.service.js");
const dedupeService = await import("./profileDedupe.service.js");
const personalizationService = await import("./personalization.service.js");

const suffix = Date.now();
const users = [];

async function createUser(label) {
  const email = `fo.dedupe.${label}.${suffix}@example.com`;
  const user = await prisma.user.create({
    data: {
      email,
      name: `Dedupe ${label}`,
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

describe("Module 02 dedupe / personalization (integration)", () => {
  it("encrypts companion passport and omits number from default list", async () => {
    const user = await createUser("passport");
    const created = await companionService.createCompanion(user.id, {
      fullName: "Sam Traveller",
      kind: "FAMILY",
      passportNumber: "AB998877",
      passportExpiry: new Date("2031-06-01"),
      dateOfBirth: new Date("1990-01-15"),
    });
    assert.equal(created.passportNumber, "AB998877");
    assert.equal(created.hasPassport, true);

    const raw = await prisma.travellerCompanion.findUnique({
      where: { id: created.id },
    });
    assert.ok(raw.passportNumber);
    assert.ok(isEncryptedField(raw.passportNumber));
    assert.notEqual(raw.passportNumber, "AB998877");

    const listed = await companionService.listCompanions(user.id);
    assert.equal(listed.length, 1);
    assert.equal(listed[0].passportNumber, null);
    assert.equal(listed[0].hasPassport, true);

    const withPass = await companionService.listCompanions(user.id, {
      includePassport: true,
    });
    assert.equal(withPass[0].passportNumber, "AB998877");
  });

  it("refuses cross-user companion access", async () => {
    const a = await createUser("own");
    const b = await createUser("other");
    const c = await companionService.createCompanion(a.id, {
      fullName: "Only A",
      kind: "COMPANION",
    });
    await assert.rejects(
      () => companionService.updateCompanion(b.id, c.id, { fullName: "Hijack" }),
      (err) => err.statusCode === 404 || err.status === 404 || err.message?.includes("not found"),
    );
    await assert.rejects(
      () => companionService.deleteCompanion(b.id, c.id),
      (err) => err.statusCode === 404 || err.status === 404 || err.message?.includes("not found"),
    );
  });

  it("merges exact loyalty duplicates but retains conflicting companion passports", async () => {
    const user = await createUser("merge");
    await profileService.getOrCreateProfile(user.id);

    const keeper = await companionService.createCompanion(user.id, {
      fullName: "Jamie Doe",
      kind: "FAMILY",
      dateOfBirth: new Date("1988-03-01"),
      passportNumber: "PASS-ONE",
    });
    const conflict = await companionService.createCompanion(user.id, {
      fullName: "Jamie Doe",
      kind: "FAMILY",
      dateOfBirth: new Date("1988-03-01"),
      passportNumber: "PASS-TWO",
    });
    const safeDup = await companionService.createCompanion(user.id, {
      fullName: "Alex Same",
      kind: "COMPANION",
      dateOfBirth: new Date("1992-05-05"),
    });
    await companionService.createCompanion(user.id, {
      fullName: "Alex Same",
      kind: "COMPANION",
      dateOfBirth: new Date("1992-05-05"),
      relationship: "friend",
    });

    await loyaltyService.addLoyaltyMembership(user.id, {
      type: "AIRLINE",
      programCode: "EY",
      memberNumber: "FF111",
    });
    // Legacy/race duplicate rows (service rejects exact create) — insert via prisma.
    await prisma.loyaltyMembership.create({
      data: {
        profileUserId: user.id,
        type: "AIRLINE",
        programCode: "EY",
        memberNumber: "FF111",
      },
    });

    await emergencyContactService.createEmergencyContact(user.id, {
      fullName: "Mom",
      phone: "+923001111111",
      isPrimary: true,
    });
    await prisma.emergencyContact.create({
      data: {
        profileUserId: user.id,
        fullName: "Mother",
        phone: "+92-300-1111111",
        isPrimary: false,
      },
    });

    const preview = await dedupeService.findProfileDuplicates(user.id);
    assert.equal(preview.hasDuplicates, true);
    assert.ok(preview.companionDuplicates.length >= 1);
    assert.ok(preview.loyaltyDuplicates.length >= 1);
    assert.ok(preview.emergencyDuplicates.length >= 1);

    const result = await dedupeService.applyProfileDedupe(user.id);
    assert.ok(result.merged.loyalty >= 1);
    assert.ok(result.merged.emergencyContacts >= 1);
    assert.ok(result.merged.companions >= 1);
    assert.ok(
      result.conflicts.some(
        (c) =>
          c.type === "companion_passport" &&
          (c.retainedId === conflict.id || c.keeperId === conflict.id),
      ),
    );

    const remaining = await companionService.listCompanions(user.id);
    assert.ok(remaining.some((c) => c.id === keeper.id || c.id === conflict.id));
    assert.ok(remaining.some((c) => c.id === conflict.id));
    assert.ok(remaining.some((c) => c.fullName === "Alex Same"));
    assert.equal(remaining.filter((c) => c.fullName === "Alex Same").length, 1);

    const loyalty = await loyaltyService.listLoyaltyMemberships(user.id);
    assert.equal(loyalty.filter((m) => m.programCode === "EY").length, 1);
  });

  it("personalization bundle excludes document numbers and stays user-scoped", async () => {
    const a = await createUser("pers-a");
    const b = await createUser("pers-b");
    await profileService.updateProfile(a.id, {
      preferredAirlines: ["PK"],
      preferredCabin: "BUSINESS",
      seatPref: "aisle",
      mealPref: "halal",
      maxLayoverMinutes: 150,
    });
    await loyaltyService.addLoyaltyMembership(a.id, {
      type: "AIRLINE",
      programCode: "EY",
      memberNumber: "X1",
    });
    await loyaltyService.addLoyaltyMembership(a.id, {
      type: "HOTEL",
      programCode: "MARRIOTT",
      memberNumber: "H1",
    });
    await companionService.createCompanion(a.id, {
      fullName: "Kid A",
      kind: "FAMILY",
      passportNumber: "SECRET99",
    });

    await prisma.booking.create({
      data: {
        userId: a.id,
        product: "FLIGHT",
        status: "COMPLETED",
        currency: "USD",
        amountMinor: 50000,
        netMinor: 40000,
        marginMinor: 10000,
        metadata: {
          origin: "LHE",
          destination: "DXB",
          airline: "EY",
          cabin: "ECONOMY",
        },
      },
    });

    const bundle = await personalizationService.getPersonalizationBundle(a.id);
    assert.deepEqual(bundle.preferredAirlines, ["PK"]);
    assert.equal(bundle.preferredCabin, "BUSINESS");
    assert.equal(bundle.seatPref, "aisle");
    assert.deepEqual(bundle.loyaltyAirlineCodes, ["EY"]);
    assert.deepEqual(bundle.hotelLoyaltyChains, ["MARRIOTT"]);
    assert.equal(bundle.companions[0].fullName, "Kid A");
    assert.ok(!JSON.stringify(bundle).includes("SECRET99"));
    assert.ok(bundle.travelHistory.frequentRoutes.includes("LHE-DXB"));
    assert.ok(bundle.travelHistory.frequentAirlines.includes("EY"));
    assert.equal(bundle.travelHistory.totalBookings, 1);

    const other = await personalizationService.getPersonalizationBundle(b.id);
    assert.ok(!other.loyaltyAirlineCodes.includes("EY"));
    assert.equal(other.companions.length, 0);
    assert.equal(other.travelHistory.totalBookings, 0);
    assert.deepEqual(other.travelHistory.frequentRoutes, []);
  });
});
