/**
 * Module 08 — Visa Intelligence tests.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-jwt-secret-min-32-characters-long";
}
if (!process.env.FIELD_ENCRYPTION_KEY) {
  process.env.FIELD_ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
}

process.env.VISA_PROVIDER = "catalog";

const { default: prisma } = await import("../../config/prisma.js");
const visaService = await import("./visa.service.js");
const { getVisaDataCapability, toVisaRequirementAssessment } = await import(
  "./visa.provider.js"
);
const {
  buildDocumentChecklistGuidance,
  summarizeHeldVisaValidity,
} = await import("./visa.travellerContext.js");

const suffix = Date.now();
const users = [];

async function createUser(label) {
  const user = await prisma.user.create({
    data: {
      email: `fo.visa.${label}.${suffix}@example.com`,
      name: `Visa ${label}`,
      passwordHash: await bcrypt.hash("TestPass123!", 10),
    },
  });
  users.push(user.id);
  return user;
}

before(async () => {
  await prisma.$queryRaw`SELECT 1`;
  // Ensure a known attributed catalog row for PK→AE if seed missing.
  await prisma.visaRequirement.upsert({
    where: {
      nationalityCode_destinationCode: { nationalityCode: "PK", destinationCode: "AE" },
    },
    update: {
      category: "VOA",
      source: "test-catalog",
      lastVerifiedAt: new Date(),
      isActive: true,
      requiredDocuments: ["Passport valid 6+ months", "Passport photo"],
    },
    create: {
      nationalityCode: "PK",
      destinationCode: "AE",
      category: "VOA",
      source: "test-catalog",
      lastVerifiedAt: new Date(),
      requiredDocuments: ["Passport valid 6+ months", "Passport photo"],
    },
  });
});

after(async () => {
  for (const id of users) {
    await prisma.notificationOutbox.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.visaApplication.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.travellerIdentityDocument.deleteMany({ where: { ownerUserId: id } }).catch(() => {});
    await prisma.vaultDocument.deleteMany({ where: { ownerUserId: id } }).catch(() => {});
    await prisma.travellerProfile.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.booking.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("visa Module 08", () => {
  it("capability reports catalog configured by default", () => {
    const cap = getVisaDataCapability({ VISA_PROVIDER: "catalog" });
    assert.equal(cap.configured, true);
    assert.equal(cap.canLookup, true);
  });

  it("unconfigured provider never invents categories", async () => {
    const prev = process.env.VISA_PROVIDER;
    process.env.VISA_PROVIDER = "unconfigured";
    const result = await visaService.lookupVisa({
      nationality: "PK",
      destination: "AE",
    });
    assert.equal(result.category, "UNKNOWN");
    assert.equal(result.dataStatus, "UNCONFIGURED");
    assert.equal(result.isFact, false);
    assert.equal(result.escalateRecommended, true);
    process.env.VISA_PROVIDER = prev || "catalog";
  });

  it("nationality + destination lookup returns attributed category", async () => {
    process.env.VISA_PROVIDER = "catalog";
    const result = await visaService.lookupVisa({
      nationality: "PK",
      destination: "AE",
    });
    assert.equal(result.category, "VOA");
    assert.ok(["VERIFIED", "STALE", "UNKNOWN"].includes(result.dataStatus));
    assert.equal(result.source, "test-catalog");
    assert.ok(!("fee" in result));
  });

  it("unknown pair is DATA_UNAVAILABLE without fabricating", async () => {
    const result = await visaService.lookupVisa({
      nationality: "PK",
      destination: "ZZ",
    });
    assert.equal(result.category, "UNKNOWN");
    assert.equal(result.dataStatus, "DATA_UNAVAILABLE");
    assert.equal(result.isFact, false);
    assert.equal(result.processingDaysMin, null);
  });

  it("stale rows are not treated as confirmed fact", () => {
    const stale = toVisaRequirementAssessment(
      {
        id: "1",
        nationalityCode: "PK",
        destinationCode: "US",
        category: "EMBASSY",
        source: "old",
        lastVerifiedAt: new Date("2015-01-01"),
        processingDaysMin: 10,
        processingDaysMax: 20,
        transitNotes: null,
        requiredDocuments: null,
        embassyInfo: null,
        isActive: true,
        updatedAt: new Date(),
      },
      { nationalityCode: "PK", destinationCode: "US" },
    );
    assert.equal(stale.dataStatus, "STALE");
    assert.equal(stale.isFact, false);
    assert.equal(stale.escalateRecommended, true);
  });

  it("transit entries are distinct from destination", async () => {
    await prisma.visaRequirement.upsert({
      where: {
        nationalityCode_destinationCode: { nationalityCode: "PK", destinationCode: "TR" },
      },
      update: {
        category: "E_VISA",
        source: "test-catalog",
        lastVerifiedAt: new Date(),
        transitNotes: "Airside notes",
        isActive: true,
      },
      create: {
        nationalityCode: "PK",
        destinationCode: "TR",
        category: "E_VISA",
        source: "test-catalog",
        lastVerifiedAt: new Date(),
        transitNotes: "Airside notes",
      },
    });
    const result = await visaService.lookupVisa({
      nationality: "PK",
      destination: "AE",
      transitCountries: ["TR"],
    });
    assert.equal(result.role, "destination");
    assert.equal(result.transit[0].role, "transit");
    assert.equal(result.transit[0].destinationCode, "TR");
    assert.notEqual(result.transit[0].destinationCode, result.destinationCode);
    assert.equal(result.transit[0].transitGuidance.airportSpecific, false);
    assert.equal(result.transit[0].transitGuidance.durationSpecific, false);
    assert.ok(result.transit[0].transitGuidance.notes.includes("Airside"));
  });

  it("latest nationality override beats saved profile", async () => {
    const user = await createUser("ov");
    await prisma.travellerProfile.create({
      data: { userId: user.id, nationality: "PK", displayName: "Override" },
    });
    await prisma.travellerIdentityDocument.create({
      data: {
        ownerUserId: user.id,
        profileUserId: user.id,
        type: "PASSPORT",
        countryCode: "PK",
        status: "ACTIVE",
        verificationStatus: "UNVERIFIED",
      },
    });
    const assessment = await visaService.assessVisaForTraveller(user.id, {
      destination: "AE",
      nationality: "IN",
    });
    assert.equal(assessment.traveller.nationality, "IN");
  });

  it("assess requires nationality and does not invent eligibility", async () => {
    const user = await createUser("nonat");
    const assessment = await visaService.assessVisaForTraveller(user.id, {
      destination: "AE",
    });
    assert.equal(assessment.status, "INCOMPLETE_INPUTS");
    assert.ok(assessment.missingInputs.includes("nationality"));
    assert.equal(assessment.isFact, false);
    assert.equal(assessment.requirement, null);
  });

  it("assess with profile nationality + checklist + passport", async () => {
    const user = await createUser("full");
    await prisma.travellerProfile.create({
      data: { userId: user.id, nationality: "PK", displayName: "Traveller" },
    });
    await prisma.travellerIdentityDocument.create({
      data: {
        ownerUserId: user.id,
        profileUserId: user.id,
        type: "PASSPORT",
        countryCode: "PK",
        status: "ACTIVE",
        verificationStatus: "UNVERIFIED",
        expiresAt: new Date("2030-01-01"),
      },
    });
    const assessment = await visaService.assessVisaForTraveller(user.id, {
      destination: "AE",
      purpose: "tourism",
    });
    assert.equal(assessment.status, "ASSESSED");
    assert.equal(assessment.traveller.nationality, "PK");
    assert.ok(assessment.checklist);
    assert.ok(assessment.avaSummary.includes("Never invent"));
    assert.equal(assessment.heldVisa.hasMatchingVisaOnFile, false);
  });

  it("residence permit context is guidance-only", async () => {
    const user = await createUser("res");
    await prisma.travellerProfile.create({
      data: { userId: user.id, nationality: "PK", displayName: "R" },
    });
    await prisma.travellerIdentityDocument.create({
      data: {
        ownerUserId: user.id,
        profileUserId: user.id,
        type: "PASSPORT",
        countryCode: "PK",
        status: "ACTIVE",
        verificationStatus: "UNVERIFIED",
      },
    });
    await prisma.travellerIdentityDocument.create({
      data: {
        ownerUserId: user.id,
        profileUserId: user.id,
        type: "RESIDENCE_PERMIT",
        countryCode: "AE",
        status: "ACTIVE",
        verificationStatus: "UNVERIFIED",
      },
    });
    const assessment = await visaService.assessVisaForTraveller(user.id, {
      destination: "AE",
    });
    assert.equal(assessment.residence.present, true);
    assert.ok(assessment.residence.note.includes("not auto-applied"));
  });

  it("held visa expiry awareness when dates exist", () => {
    const summary = summarizeHeldVisaValidity(
      {
        visasHeld: [
          {
            id: "v1",
            countryCode: "AE",
            expiresAt: new Date("2031-01-01"),
            expiry: { status: "OK" },
            verificationStatus: "VERIFIED",
          },
        ],
      },
      "AE",
    );
    assert.equal(summary.hasMatchingVisaOnFile, true);
    assert.equal(summary.visas[0].coversTrip, null);
  });

  it("checklist presence hints never claim legal satisfaction", () => {
    const checklist = buildDocumentChecklistGuidance(
      ["Passport valid 6+ months", "Bank statement"],
      { hasPassport: true, residencePermits: [], visasHeld: [], nationalIds: [], vaultDocuments: [] },
    );
    assert.equal(checklist.items[0].presentHint, true);
    assert.equal(checklist.items[0].legallySatisfied, null);
    assert.equal(checklist.items[1].legallySatisfied, null);
  });

  it("blocks linking another user's vault document on application update", async () => {
    const a = await createUser("va");
    const b = await createUser("vb");
    const vaultB = await prisma.vaultDocument.create({
      data: {
        ownerUserId: b.id,
        type: "VISA",
        title: "B visa",
        isActive: true,
      },
    });
    const app = await visaService.createVisaApplication(
      { id: a.id },
      { nationality: "PK", destination: "AE" },
    );
    await assert.rejects(
      () =>
        visaService.updateVisaApplication({ id: a.id }, [], app.id, {
          vaultDocumentIds: [vaultB.id],
        }),
      (err) => err.statusCode === 404,
    );
  });

  it("escalation records VISA_UNCERTAIN intent (audit-only without conversation)", async () => {
    const user = await createUser("esc");
    const result = await visaService.escalateVisaUncertainty({
      userId: user.id,
      assessment: {
        dataStatus: "DATA_UNAVAILABLE",
        nationalityCode: "PK",
        destinationCode: "ZZ",
      },
      reason: "test",
    });
    assert.equal(result.trigger, "VISA_UNCERTAIN");
    assert.equal(result.auditOnly, true);
  });

  it("Ava guidance block flags non-facts", async () => {
    const user = await createUser("ava");
    await prisma.travellerProfile.create({
      data: { userId: user.id, nationality: "PK", displayName: "A" },
    });
    await prisma.travellerIdentityDocument.create({
      data: {
        ownerUserId: user.id,
        profileUserId: user.id,
        type: "PASSPORT",
        countryCode: "PK",
        status: "ACTIVE",
        verificationStatus: "UNVERIFIED",
      },
    });
    const guided = await visaService.getAvaVisaGuidance(user.id, { destination: "ZZ" });
    assert.ok(guided.promptBlock.includes("DATA_UNAVAILABLE") || guided.promptBlock.includes("escalate"));
    assert.equal(guided.assessment.isFact, false);
  });

  it("visa doc expiry notifications enqueue and dedupe", async () => {
    const { scheduleVisaDocumentExpiryNotifications } = await import("./visa.notifications.js");
    const user = await createUser("vexp");
    await prisma.travellerProfile.create({
      data: { userId: user.id, nationality: "PK", displayName: "Vexp" },
    });
    const expiresAt = new Date(Date.now() + 5 * 86_400_000);
    const doc = await prisma.travellerIdentityDocument.create({
      data: {
        ownerUserId: user.id,
        profileUserId: user.id,
        type: "VISA",
        countryCode: "AE",
        status: "ACTIVE",
        verificationStatus: "UNVERIFIED",
        expiresAt,
      },
    });
    const first = await scheduleVisaDocumentExpiryNotifications(doc, {
      now: new Date(),
      leadDays: [180, 30, 7],
      channels: ["APP"],
    });
    assert.ok(first.enqueued >= 1);
    const second = await scheduleVisaDocumentExpiryNotifications(doc, {
      now: new Date(),
      leadDays: [180, 30, 7],
      channels: ["APP"],
    });
    assert.equal(second.enqueued, 0);
    assert.ok(second.skippedDuplicate >= 1);
  });

  it("apply-by notifications require attributed processing days + departAt", async () => {
    const { scheduleVisaApplyByNotifications } = await import("./visa.notifications.js");
    const user = await createUser("vapply");
    const booking = await prisma.booking.create({
      data: {
        userId: user.id,
        status: "QUOTED",
        product: "FLIGHT",
        currency: "PKR",
        amountMinor: 10000,
        netMinor: 9000,
        marginMinor: 1000,
        metadata: {
          destination: "AE",
          nationality: "PK",
          departAt: new Date(Date.now() + 20 * 86_400_000).toISOString(),
        },
      },
    });
    const skipped = await scheduleVisaApplyByNotifications(
      booking,
      { isFact: false, dataStatus: "UNKNOWN", processingDaysMax: 10 },
      { now: new Date(), leadDays: [30, 14, 7], channels: ["APP"] },
    );
    assert.equal(skipped.enqueued, 0);

    const first = await scheduleVisaApplyByNotifications(
      booking,
      { isFact: true, dataStatus: "VERIFIED", processingDaysMax: 10 },
      { now: new Date(), leadDays: [30, 14, 7], channels: ["APP"] },
    );
    assert.ok(first.enqueued >= 1);
    const again = await scheduleVisaApplyByNotifications(
      booking,
      { isFact: true, dataStatus: "VERIFIED", processingDaysMax: 10 },
      { now: new Date(), leadDays: [30, 14, 7], channels: ["APP"] },
    );
    assert.equal(again.enqueued, 0);
    assert.ok(again.skippedDuplicate >= 1);
  });
});
