import dotenv from "dotenv";
import prisma from "../config/prisma.js";
import { hashPassword } from "../lib/password.js";
import {
  assertProductionBootstrapAdminSafe,
  isProductionEnv,
} from "../lib/productionConfig.js";

dotenv.config();

// Module 00 — Foundation & Security: Super Admin role + a starter set of permission
// keys spanning the modules that exist/are-in-flight today. Other modules should add
// their own keys here (or via a follow-up seed) as they ship real enforcement.
const SUPER_ADMIN_PERMISSION_KEYS = [
  "booking:create",
  "booking:read",
  "vault:document:read",
  // Module 07 — Traveller Vault: `vault:document:write` is not enforced on
  // any route today (every write is owner-only, checked inside
  // vault.service.js — see modules/vault/vault.routes.js) but is seeded
  // additively for ops/agent-facing write access once that lands.
  "vault:document:write",
  "corporate:approvals:write",
  "ops:dashboard:read",
  "dashboard:read",
  // Module 16 — AI Knowledge Platform: content ingestion (added additively,
  // existing "ops:dashboard:read" key still satisfies the same route via an
  // OR-permission check — see modules/knowledge/knowledge.routes.js).
  "knowledge:write",
  "knowledge:read",
  // Module 13 — Human Agent Escalation: consultant queue access (added
  // additively — see modules/escalations/escalations.routes.js).
  "ops:escalations:read",
  "ops:escalations:write",
  // Module 13 — specialist consultant pools (VIP / medical). Additive; queue
  // routing uses these without inventing availability.
  "ops:escalations:vip",
  "ops:escalations:medical",
  // Module 15 — Operations Platform: event-outbox/accounting read + supplier
  // reconciliation write (added additively — existing "ops:dashboard:read"
  // still satisfies the dashboard/accounting/reconcile-read/audit routes —
  // see modules/operations/operations.routes.js).
  "ops:events:read",
  "ops:reconcile:write",
  // Module 14 — Refund & Reissue Engine: added additively — see
  // modules/refunds/refunds.routes.js. Booking owners can calculate/create/
  // submit/view their own refund cases without either key (ownership check
  // inside refunds.service.js); these keys are for ops/agents acting on any
  // booking, and `refunds:write` is required outright for `/cases/:id/complete`.
  "refunds:read",
  "refunds:write",
  // Module 05 — Pricing: highest agent discretionary-discount tier for Super Admin.
  // Exact BPS are PricingConfig-driven; see pricing.constants.js.
  "pricing:discount:senior",
  // Module 06 — Corporate Travel: company management + approval workflow
  // (added additively — "corporate:approvals:write" was already seeded
  // above; see modules/corporate/corporate.routes.js).
  "corporate:company:write",
  "corporate:approvals:read",
  // Module 08 — Visa Intelligence: `visa:read` gates the cross-user
  // applications queue view, `visa:write` lets an ops/consultant agent
  // update a traveller's application on their behalf (added additively —
  // see modules/visa/visa.routes.js / visa.service.js).
  "visa:read",
  "visa:write",
  // Module 10 — Rewards & Referrals: added additively — see
  // modules/rewards/rewards.routes.js. Every user manages their own reward
  // account/ledger without this key (ownership check inside
  // rewards.service.js#listLedger); this key is for ops/agents inspecting
  // another user's ledger.
  "rewards:read",
  // Module 11 — Group Travel / Module 12 — MICE Platform: platform-wide
  // organizer-equivalent override (added additively — see
  // modules/groups/groups.service.js and modules/mice/mice.service.js).
  "groups:write",
  "mice:write",
  // Module 09 — Live Journey Management: gates the "watch someone else's
  // journey" surface. Watch/event/notification owners can read their own
  // rows without this key (ownership check inside journey.service.js,
  // mirroring refunds.service.js); `ops:dashboard:read` already covers
  // `POST /journey/notifications/drain` — see
  // modules/journey/journey.routes.js.
  "journey:read",
];

async function seedSuperAdminRole() {
  const role = await prisma.role.upsert({
    where: { name: "Super Admin" },
    update: {},
    create: {
      name: "Super Admin",
      description: "Platform-wide administrator — all permission keys.",
    },
  });

  for (const key of SUPER_ADMIN_PERMISSION_KEYS) {
    const permission = await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key, label: key },
    });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
      update: {},
      create: { roleId: role.id, permissionId: permission.id },
    });
  }

  console.log(
    `Seeded role "${role.name}" with ${SUPER_ADMIN_PERMISSION_KEYS.length} permission key(s)`,
  );
  return role;
}

async function assignRoleToUser(userId, roleId) {
  // Prisma's compound-unique `where` filter can't take `null` for a nullable column
  // (companyId), so upsert-by-compound-key doesn't work here — findFirst + create instead.
  const existing = await prisma.userRole.findFirst({
    where: { userId, roleId, companyId: null },
    select: { id: true },
  });
  if (existing) return;
  await prisma.userRole.create({ data: { userId, roleId } });
}

async function seedBootstrapAdmin() {
  // Production must never silently create admin@example.com / ChangeMe123!.
  assertProductionBootstrapAdminSafe();

  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@example.com")
    .trim()
    .toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || "ChangeMe123!";
  const name = process.env.BOOTSTRAP_ADMIN_NAME || "Super Admin";

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const passwordHash = await hashPassword(password);
    user = await prisma.user.create({
      data: { email, name, passwordHash, emailVerifiedAt: new Date() },
      select: { id: true, email: true, name: true, emailVerifiedAt: true },
    });
    // Never log passwords. Email is an identifier, not a secret.
    console.log(`Seeded bootstrap admin: ${user.email}`);
  } else {
    if (!user.emailVerifiedAt) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
      });
    }
    console.log(`Bootstrap admin already exists: ${email}`);
  }
  return user;
}

/**
 * Dev/demo traveller that logs in in one step:
 * - email already verified
 * - 2FA off
 * - no staff role (staff roles force mandatory 2FA enrollment on login)
 *
 * Skipped in production. Override with DEMO_USER_EMAIL / DEMO_USER_PASSWORD / DEMO_USER_NAME.
 */
async function seedDemoVerifiedTraveller() {
  if (isProductionEnv()) {
    console.log("Skipping demo verified traveller seed in production");
    return null;
  }

  const email = (process.env.DEMO_USER_EMAIL || "demo@flightone.local")
    .trim()
    .toLowerCase();
  const password = process.env.DEMO_USER_PASSWORD || "DemoPass123!";
  const name = process.env.DEMO_USER_NAME || "Demo Traveller";
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      passwordHash,
      passwordChangedAt: new Date(),
      emailVerifiedAt: new Date(),
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorPendingSecret: null,
      twoFactorBackupCodes: null,
      twoFactorLastStep: null,
      twoFactorAttempts: 0,
      twoFactorLockedUntil: null,
    },
    update: {
      name,
      passwordHash,
      passwordChangedAt: new Date(),
      emailVerifiedAt: new Date(),
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorPendingSecret: null,
      twoFactorBackupCodes: null,
      twoFactorLastStep: null,
      twoFactorAttempts: 0,
      twoFactorLockedUntil: null,
    },
    select: { id: true, email: true, name: true },
  });

  // Ensure a blank profile exists so profile screens don't 404.
  await prisma.travellerProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, displayName: name },
    update: { displayName: name },
  });

  // Strip any staff roles that would force 2FA enrollment.
  await prisma.userRole.deleteMany({ where: { userId: user.id } });

  console.log(
    `Seeded demo verified traveller: ${user.email} (email verified, 2FA off, no staff role)`,
  );
  return user;
}

// Module 16 — do NOT seed invented SOPs/policies into production knowledge.
// Isolated tests create their own fixtures.

// Module 08 — Visa Intelligence: do NOT seed invented visa "facts" that become
// VERIFIED catalog rows. Ops must enter attributed requirements via the API.
// Isolated tests create their own VisaRequirement fixtures.

// Module 05 — Pricing & Margin Engine: platform-wide defaults only.
// Do NOT seed sample route markup rules that invent commercial pricing.
// All values are integer basis points (dev guide §5 — never floats).
const PRICING_CONFIG_DEFAULTS = [
  // Platform default when no product-specific key and no MarkupRule matches.
  // Authoritative flight markup is 9% (900 bps) — aligned with flight-one-main/lib/pricing/pricing.ts.
  { key: "default_markup_bps", valueInt: 900 },
  { key: "flight_default_markup_bps", valueInt: 900 },
  { key: "hotel_default_markup_bps", valueInt: 1400 },
  // Minimum margin floor after discounts (4% — aligned with frontend DEFAULT_PRICING.minMarginPct).
  { key: "min_margin_bps", valueInt: 400 },
  // Hard ceiling on AI/agent-requested discretionary discounts — exceeding
  // this flags `escalationRequired` for Module 13 rather than being applied.
  { key: "ai_discount_max_bps", valueInt: 500 },
  // Module 05 negotiation buffer: caps discretionary AI/agent discounts to
  // min(ai_discount_max_bps, negotiation_buffer_bps) when buffer > 0.
  // Escalation beyond the effective cap is Module 13's concern.
  { key: "negotiation_buffer_bps", valueInt: 300 },
  // Module 05 agent discount permission tiers (PRD does not specify exact %).
  // Defaults are the smallest configurable ceilings; override via PricingConfig.
  { key: "agent_discount_junior_bps", valueInt: 100 },
  { key: "agent_discount_standard_bps", valueInt: 200 },
  { key: "agent_discount_senior_bps", valueInt: 300 },
];

async function seedPricingConfig() {
  for (const { key, valueInt } of PRICING_CONFIG_DEFAULTS) {
    await prisma.pricingConfig.upsert({
      where: { key },
      update: { valueInt },
      create: { key, valueInt },
    });
  }
  console.log(`Seeded ${PRICING_CONFIG_DEFAULTS.length} PricingConfig default(s)`);
}

/** Deactivate legacy demo markup invented by older seeds (idempotent). */
async function deactivateLegacySampleMarkup() {
  const result = await prisma.markupRule.updateMany({
    where: { name: "Default LHE route markup (sample)", isActive: true },
    data: { isActive: false },
  });
  if (result.count > 0) {
    console.log(`Deactivated ${result.count} legacy sample MarkupRule(s)`);
  }
}

async function main() {
  const superAdminRole = await seedSuperAdminRole();
  const admin = await seedBootstrapAdmin();
  await assignRoleToUser(admin.id, superAdminRole.id);
  console.log(`Assigned "${superAdminRole.name}" role to ${admin.email}`);

  await seedDemoVerifiedTraveller();

  await seedPricingConfig();
  await deactivateLegacySampleMarkup();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
