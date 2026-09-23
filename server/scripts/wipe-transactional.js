/**
 * Wipes TRANSACTIONAL data so the demo starts from a clean slate, while
 * preserving identity: users, roles/permissions, companies, memberships,
 * traveller profiles and reference data stay intact so you can still log in
 * and run the demo immediately.
 *
 * Uses TRUNCATE ... CASCADE rather than hand-ordered deletes — dozens of
 * tables reference Booking, and one missed FK leaves orphans or throws.
 *
 * Run: node scripts/wipe-transactional.js
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Transactional tables — safe to clear between demo runs. */
const WIPE = [
  // Bookings and everything hanging off them
  "Booking",
  "BookingTransition",
  "Payment",
  "SupplierOfferSnapshot",
  "ApprovalRequest",
  "RefundCase",
  "RefundCalculation",
  "AccountingEntry",
  "CommissionRecord",
  "SupplierReconItem",
  "CarbonEstimate",
  "Expense",
  "CorporateInvoice",
  "ServicingRequest",
  "ServicingAuditEvent",
  "EscalationTicket",
  "EscalationAction",
  "JourneyEvent",
  "JourneyWatch",
  // Chat
  "Conversation",
  "Message",
  "RecommendationFeedback",
  "DashboardSearchEvent",
  // Rewards / credits
  "RewardLedgerEntry",
  "RewardAccount",
  "CorporateRewardLedgerEntry",
  "TravelCredit",
  "ReferralAttribution",
  // Groups & MICE activity
  "GroupBookingShare",
  "GroupDocumentShare",
  "GroupAnnouncement",
  "GroupAttendanceRecord",
  "GroupAttendanceWaypoint",
  "GroupPhoto",
  "GroupPoll",
  "GroupPollVote",
  "GroupTripMemory",
  "GroupTravelRequest",
  "GroupMember",
  "TravelGroup",
  "MiceBookingShare",
  "MiceBudgetLine",
  "MiceCheckIn",
  "MiceDelegate",
  "MiceSession",
  "MiceSponsor",
  "MiceTransfer",
  "MiceEventEnquiry",
  "MiceEvent",
  // Visa & vault activity
  "VisaApplication",
  "VaultShareLink",
  "VaultVisaRecord",
  "VaultDocument",
  // Voice / concierge
  "VoiceBookingIntent",
  "VoiceOtpChallenge",
  "VoiceSession",
  "VoiceCallerBinding",
  "ConciergeExecution",
  // Outbox / audit noise
  "NotificationOutbox",
  "OpsOutboxEvent",
  "OpsExternalSync",
  "AuditLog",
];

/** Never touched — identity, config and reference data. */
const PRESERVED = [
  "User", "Role", "Permission", "RolePermission", "UserRole",
  "Company", "CompanyMembership", "TravelPolicy", "ProjectCode",
  "TravellerProfile", "TravellerIdentityDocument", "TravellerCompanion",
  "EmergencyContact", "LoyaltyMembership",
  "PricingConfig", "MarkupRule", "PromoCode", "VisaRequirement",
  "KnowledgeDocument", "KnowledgeChunk", "CorporateRewardProgram",
];

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to wipe data in production");
  }

  const url = process.env.DATABASE_URL ?? "";
  const host = url.match(/@([^/:]+)/)?.[1] ?? "unknown";
  if (!/^(localhost|127\.0\.0\.1)$/.test(host)) {
    throw new Error(
      `Refusing to wipe a non-local database (host: ${host}). ` +
        "This script is for the local demo database only.",
    );
  }
  console.log(`Target: ${host} — local, proceeding.\n`);

  const existing = new Set(
    (
      await prisma.$queryRawUnsafe(
        "SELECT tablename FROM pg_tables WHERE schemaname='public'",
      )
    ).map((r) => r.tablename),
  );

  const targets = WIPE.filter((t) => existing.has(t));
  const missing = WIPE.filter((t) => !existing.has(t));
  if (missing.length) console.log(`Skipped (no such table): ${missing.join(", ")}\n`);

  const before = {};
  for (const t of targets) {
    const [{ count }] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS count FROM "${t}"`,
    );
    if (count > 0) before[t] = count;
  }

  // CASCADE reaches any dependent table we did not list explicitly.
  const list = targets.map((t) => `"${t}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);

  console.log("Cleared:");
  for (const [t, c] of Object.entries(before)) console.log(`  ${t.padEnd(26)} ${c}`);
  if (Object.keys(before).length === 0) console.log("  (already empty)");

  console.log("\nPreserved:");
  for (const t of PRESERVED) {
    if (!existing.has(t)) continue;
    const [{ count }] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS count FROM "${t}"`,
    );
    if (count > 0) console.log(`  ${t.padEnd(26)} ${count}`);
  }
}

main()
  .catch((err) => {
    console.error(err.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
