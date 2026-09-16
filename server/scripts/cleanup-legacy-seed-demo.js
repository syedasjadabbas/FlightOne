/**
 * One-shot idempotent cleanup of legacy Module 05/08 seed demo rows.
 * Safe to re-run. Does not touch PricingConfig, users, bookings, or migrations.
 *
 * Usage: node scripts/cleanup-legacy-seed-demo.js
 */
import dotenv from "dotenv";
dotenv.config();

const { default: prisma } = await import("../config/prisma.js");

/** Exact fingerprint from the retired SAMPLE_VISA_REQUIREMENTS seed. */
const LEGACY_VISA_SOURCE = "manual entry — Ops SOP v1";
const LEGACY_VISA_PAIRS = [
  { nationalityCode: "PK", destinationCode: "AE" },
  { nationalityCode: "PK", destinationCode: "TR" },
  { nationalityCode: "US", destinationCode: "GB" },
  { nationalityCode: "PK", destinationCode: "US" },
];

const LEGACY_MARKUP_NAME = "Default LHE route markup (sample)";

async function main() {
  const report = {
    visaMatched: [],
    visaDeleted: 0,
    markupMatched: [],
    markupDeactivated: 0,
    markupAlreadyInactive: 0,
  };

  const visaCandidates = await prisma.visaRequirement.findMany({
    where: {
      source: LEGACY_VISA_SOURCE,
      OR: LEGACY_VISA_PAIRS,
    },
    select: {
      id: true,
      nationalityCode: true,
      destinationCode: true,
      source: true,
      lastVerifiedAt: true,
      isActive: true,
    },
  });
  report.visaMatched = visaCandidates;

  if (visaCandidates.length) {
    const deleted = await prisma.visaRequirement.deleteMany({
      where: { id: { in: visaCandidates.map((r) => r.id) } },
    });
    report.visaDeleted = deleted.count;
  }

  const markupRows = await prisma.markupRule.findMany({
    where: { name: LEGACY_MARKUP_NAME },
    select: {
      id: true,
      name: true,
      routePattern: true,
      markupBps: true,
      isActive: true,
      priority: true,
    },
  });
  report.markupMatched = markupRows;

  const activeIds = markupRows.filter((r) => r.isActive).map((r) => r.id);
  report.markupAlreadyInactive = markupRows.length - activeIds.length;

  if (activeIds.length) {
    const updated = await prisma.markupRule.updateMany({
      where: { id: { in: activeIds } },
      data: { isActive: false },
    });
    report.markupDeactivated = updated.count;
  }

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
