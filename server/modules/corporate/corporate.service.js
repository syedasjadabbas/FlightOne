/**
 * Module 06 — Corporate Travel (Phase 1).
 *
 * Owns Company / CompanyMembership / TravelPolicy / ApprovalRequest
 * (prisma/corporate.prisma). Bookings/payments call
 * `assertCorporateBookingAllowed` / `consumeCredit` before/after RESERVE.
 * Cancel / refund flows call `releaseCreditForBooking` to restore consumed credit.
 *
 * Invariants:
 *  - Policy evaluation ≠ approval. `evaluatePolicy` is deterministic and
 *    auditable; approval is a separate workflow with PENDING/APPROVED/REJECTED.
 *  - Corporate bookings always need an APPROVED ApprovalRequest before pay/reserve
 *    (within-policy requests are auto-APPROVED when created).
 *  - companyId from clients is never trusted without membership verification.
 *  - Module 05 `companyMarkupBps` is fed from `Company.markupBps` when set —
 *    no duplicate pricing engine / rate tables.
 */
import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import { writeAudit } from "../../lib/audit.js";
import { hasPermissionEff } from "../../lib/permissions.service.js";
import { DEFAULT_PAGE_SIZE } from "../../lib/utils.js";
import { assertNonNegativeBps, assertNonNegativeMinorAmount } from "../../lib/money.js";
import {
  CORPORATE_FINANCE_PERMISSION,
  DECISION_TO_STATUS,
} from "./corporate.constants.js";

export { CORPORATE_FINANCE_PERMISSION };

/**
 * Demo mode skips the corporate spend gate so a scripted demo can reach
 * payment. Hard-blocked in production: these are real financial controls, and
 * an env flag alone must never be enough to disable them on a live deployment.
 */
function isDemoBookingEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    // `test` is excluded too: the suite asserts that the credit and approval
    // gates REJECT, and a demo bypass silently turned those assertions green.
    process.env.NODE_ENV !== "test" &&
    process.env.DEMO_FLIGHT_INVENTORY === "true"
  );
}

/**
 * Whether effective permissions allow setting creditLimitMinor / markupBps.
 * Accepts `{ global, byCompany }` from requireAuth or a Set (internal auth).
 */
export function canConfigureCorporateFinance(effectivePermissions, companyId) {
  if (!effectivePermissions) return false;
  if (effectivePermissions instanceof Set) {
    return (
      effectivePermissions.has("*") ||
      effectivePermissions.has(CORPORATE_FINANCE_PERMISSION)
    );
  }
  return hasPermissionEff(
    effectivePermissions,
    CORPORATE_FINANCE_PERMISSION,
    companyId,
  );
}

function assertCanConfigureCorporateFinance(effectivePermissions, companyId) {
  if (!canConfigureCorporateFinance(effectivePermissions, companyId)) {
    throw new AppError(
      403,
      "Forbidden: setting credit or markup requires corporate:company:write",
    );
  }
}

const MAX_PAGE_SIZE = 100;

const CABIN_RANK = { ECONOMY: 0, PREMIUM_ECONOMY: 1, BUSINESS: 2, FIRST: 3 };

const COMPANY_SELECT = {
  id: true,
  name: true,
  creditLimitMinor: true,
  creditUsedMinor: true,
  currency: true,
  isActive: true,
  billingCycle: true,
  markupBps: true,
  createdAt: true,
  updatedAt: true,
};

const MEMBERSHIP_SELECT = {
  id: true,
  companyId: true,
  userId: true,
  role: true,
  department: true,
  costCentre: true,
  createdAt: true,
};

const POLICY_SELECT = {
  id: true,
  companyId: true,
  name: true,
  maxCabin: true,
  maxAmountMinor: true,
  preferredAirlines: true,
  advanceBookingDays: true,
  createdAt: true,
};

const APPROVAL_SELECT = {
  id: true,
  companyId: true,
  bookingId: true,
  requesterUserId: true,
  status: true,
  policyViolation: true,
  amountMinor: true,
  currency: true,
  approverUserId: true,
  decisionNote: true,
  createdAt: true,
  decidedAt: true,
};

const PROJECT_CODE_SELECT = {
  id: true,
  companyId: true,
  code: true,
  name: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

async function getCompanyOrThrow(companyId, select = COMPANY_SELECT) {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select });
  if (!company) {
    throw new AppError(404, "Company not found");
  }
  return company;
}

/** Phase-1: one flat policy per company (most recent wins). */
async function getEffectivePolicy(companyId) {
  return prisma.travelPolicy.findFirst({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    select: POLICY_SELECT,
  });
}

function cabinExceedsPolicy(cabin, maxCabin) {
  if (!cabin || !maxCabin) return false;
  const cabinRank = CABIN_RANK[String(cabin).toUpperCase()];
  const maxRank = CABIN_RANK[String(maxCabin).toUpperCase()];
  if (cabinRank === undefined || maxRank === undefined) return false;
  return cabinRank > maxRank;
}

function preferredAirlinesList(preferredAirlines) {
  if (!Array.isArray(preferredAirlines)) return [];
  return preferredAirlines
    .map((a) => String(a).trim().toUpperCase())
    .filter(Boolean);
}

/**
 * Membership gate. Never trust a client-supplied companyId without this.
 * @param {string[]} [allowedRoles] when set, role must be one of these.
 */
export async function requireCompanyMembership(userId, companyId, { allowedRoles } = {}) {
  if (!userId) throw new AppError(401, "Authentication required");
  if (!companyId) throw new AppError(400, "companyId is required");

  const membership = await prisma.companyMembership.findUnique({
    where: { companyId_userId: { companyId, userId } },
    select: MEMBERSHIP_SELECT,
  });
  if (!membership) {
    throw new AppError(403, "Not a member of this company");
  }
  if (allowedRoles?.length && !allowedRoles.includes(membership.role)) {
    throw new AppError(403, "Insufficient company role");
  }
  return membership;
}

function auditCorporate(userId, action, resourceType, resourceId, metadata) {
  return writeAudit({
    userId,
    action,
    resourceType,
    resourceId,
    metadata: metadata ?? null,
  }).catch(() => {});
}

/**
 * Deterministic policy evaluation — NOT an approval decision.
 * Callers surface violations to travellers; booking still needs APPROVED approval.
 */
export async function evaluatePolicy({
  companyId,
  amountMinor,
  cabin,
  airline,
  departureDate,
} = {}) {
  if (!companyId) throw new AppError(400, "companyId is required");
  if (amountMinor !== undefined && amountMinor !== null) {
    assertNonNegativeMinorAmount(amountMinor, "amountMinor");
  }

  const policy = await getEffectivePolicy(companyId);
  const violations = [];

  if (!policy) {
    return {
      withinPolicy: true,
      violations,
      policy: null,
      note: "No travel policy configured — no policy constraints to evaluate",
    };
  }

  if (policy.maxAmountMinor != null && amountMinor != null && amountMinor > policy.maxAmountMinor) {
    violations.push({
      code: "AMOUNT_EXCEEDS_MAX",
      message: "amount exceeds policy max",
      maxAmountMinor: policy.maxAmountMinor,
      amountMinor,
    });
  }

  if (cabinExceedsPolicy(cabin, policy.maxCabin)) {
    violations.push({
      code: "CABIN_EXCEEDS_MAX",
      message: "cabin exceeds policy max",
      maxCabin: policy.maxCabin,
      cabin: cabin ?? null,
    });
  }

  const preferred = preferredAirlinesList(policy.preferredAirlines);
  if (preferred.length && airline) {
    const code = String(airline).trim().toUpperCase();
    if (code && !preferred.includes(code)) {
      violations.push({
        code: "AIRLINE_NOT_PREFERRED",
        message: "airline is outside preferred list",
        preferredAirlines: preferred,
        airline: code,
      });
    }
  }

  if (policy.advanceBookingDays != null && departureDate) {
    const depart = new Date(departureDate);
    if (!Number.isNaN(depart.getTime())) {
      const now = new Date();
      const msPerDay = 24 * 60 * 60 * 1000;
      const daysOut = Math.floor((depart.getTime() - now.getTime()) / msPerDay);
      if (daysOut < policy.advanceBookingDays) {
        violations.push({
          code: "ADVANCE_BOOKING_WINDOW",
          message: "departure is inside the advance-booking window",
          advanceBookingDays: policy.advanceBookingDays,
          daysOut,
          departureDate: depart.toISOString(),
        });
      }
    }
  }

  return {
    withinPolicy: violations.length === 0,
    violations,
    policy,
  };
}

/**
 * Verify membership + active company; return markup for Module 05 when set.
 * Used by createQuote — rejects forged companyId.
 */
export async function resolveCorporateQuoteContext(userId, companyId) {
  await requireCompanyMembership(userId, companyId);
  const company = await getCompanyOrThrow(companyId);
  if (!company.isActive) {
    throw new AppError(403, "Company account is not active");
  }
  return {
    companyId: company.id,
    company,
    companyMarkupBps:
      company.markupBps != null && Number.isInteger(company.markupBps)
        ? company.markupBps
        : undefined,
  };
}

/**
 * Self-service company creation is allowed for any authenticated user.
 * Financial fields (creditLimitMinor > 0, non-null markupBps) require
 * `corporate:company:write` — enforced here even if middleware is skipped.
 *
 * @param {string} creatorUserId
 * @param {object} body
 * @param {{ global?: string[], byCompany?: Record<string, string[]> } | Set<string> | null} [effectivePermissions]
 */
export async function createCompany(
  creatorUserId,
  { name, creditLimitMinor, currency, billingCycle, isActive, markupBps },
  effectivePermissions = null,
) {
  const resolvedCredit =
    creditLimitMinor === undefined || creditLimitMinor === null ? 0 : creditLimitMinor;
  const wantsNonZeroCredit = resolvedCredit !== 0;
  const wantsMarkup = markupBps !== undefined && markupBps !== null;

  if (wantsNonZeroCredit || wantsMarkup) {
    assertCanConfigureCorporateFinance(effectivePermissions);
  }

  assertNonNegativeMinorAmount(resolvedCredit, "creditLimitMinor");
  if (wantsMarkup) {
    assertNonNegativeBps(markupBps, "markupBps");
  }

  try {
    const company = await prisma.$transaction(async (tx) => {
      const created = await tx.company.create({
        data: {
          name,
          creditLimitMinor: resolvedCredit,
          currency: currency ?? "USD",
          billingCycle: billingCycle ?? null,
          isActive: isActive ?? true,
          markupBps: wantsMarkup ? markupBps : null,
        },
        select: COMPANY_SELECT,
      });
      await tx.companyMembership.create({
        data: { companyId: created.id, userId: creatorUserId, role: "ADMIN" },
      });
      return created;
    });
    auditCorporate(creatorUserId, "corporate.company.create", "Company", company.id, {
      companyId: company.id,
      name: company.name,
    });
    return company;
  } catch (e) {
    if (e.code === "P2002") {
      throw new AppError(409, "A company with this name already exists");
    }
    throw e;
  }
}

export async function listCompanies(userId, effectivePermissions) {
  const isPlatformAdmin = Boolean(
    effectivePermissions?.global?.includes("corporate:company:write"),
  );

  if (isPlatformAdmin) {
    return prisma.company.findMany({ orderBy: { createdAt: "desc" }, select: COMPANY_SELECT });
  }

  const memberships = await prisma.companyMembership.findMany({
    where: { userId },
    select: { companyId: true },
  });
  const companyIds = memberships.map((m) => m.companyId);
  if (!companyIds.length) return [];

  return prisma.company.findMany({
    where: { id: { in: companyIds } },
    orderBy: { createdAt: "desc" },
    select: COMPANY_SELECT,
  });
}

export async function getCompanyForMember(userId, companyId) {
  await requireCompanyMembership(userId, companyId);
  return getCompanyOrThrow(companyId);
}

/**
 * Company ADMIN may update non-financial account fields (name, billing, active).
 * creditLimitMinor / markupBps require `corporate:company:write` (service-enforced).
 * Does not invent creditUsed — that is only advanced by consumeCredit.
 *
 * @param {string} actorUserId
 * @param {string} companyId
 * @param {object} patch
 * @param {{ global?: string[], byCompany?: Record<string, string[]> } | Set<string> | null} [effectivePermissions]
 */
export async function updateCompany(
  actorUserId,
  companyId,
  { name, creditLimitMinor, billingCycle, isActive, markupBps },
  effectivePermissions = null,
) {
  await requireCompanyMembership(actorUserId, companyId, { allowedRoles: ["ADMIN"] });
  const existing = await getCompanyOrThrow(companyId);

  const touchesFinance = creditLimitMinor !== undefined || markupBps !== undefined;
  if (touchesFinance) {
    assertCanConfigureCorporateFinance(effectivePermissions, companyId);
  }

  if (creditLimitMinor !== undefined) {
    assertNonNegativeMinorAmount(creditLimitMinor, "creditLimitMinor");
    if (creditLimitMinor < existing.creditUsedMinor) {
      throw new AppError(
        400,
        `creditLimitMinor cannot be below credit already used (${existing.creditUsedMinor})`,
      );
    }
  }
  if (markupBps !== undefined && markupBps !== null) {
    assertNonNegativeBps(markupBps, "markupBps");
  }

  const data = {};
  if (name !== undefined) data.name = name;
  if (creditLimitMinor !== undefined) data.creditLimitMinor = creditLimitMinor;
  if (billingCycle !== undefined) data.billingCycle = billingCycle;
  if (isActive !== undefined) data.isActive = isActive;
  if (markupBps !== undefined) data.markupBps = markupBps;

  try {
    const company = await prisma.company.update({
      where: { id: companyId },
      data,
      select: COMPANY_SELECT,
    });
    auditCorporate(actorUserId, "corporate.company.update", "Company", company.id, {
      companyId,
      fields: Object.keys(data),
    });
    return company;
  } catch (e) {
    if (e.code === "P2002") {
      throw new AppError(409, "A company with this name already exists");
    }
    throw e;
  }
}

export async function addMember(actorUserId, companyId, { userId, role, department, costCentre }) {
  await requireCompanyMembership(actorUserId, companyId, { allowedRoles: ["ADMIN"] });
  await getCompanyOrThrow(companyId, { id: true });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) throw new AppError(404, "User not found");

  try {
    const membership = await prisma.companyMembership.create({
      data: {
        companyId,
        userId,
        role,
        department: department ?? null,
        costCentre: costCentre ?? null,
      },
      select: MEMBERSHIP_SELECT,
    });
    auditCorporate(actorUserId, "corporate.member.add", "CompanyMembership", membership.id, {
      companyId,
      memberUserId: userId,
      role,
    });
    return membership;
  } catch (e) {
    if (e.code === "P2002") {
      throw new AppError(409, "User is already a member of this company");
    }
    throw e;
  }
}

/**
 * List members with Module 02 TravellerProfile summary (no document PII).
 */
export async function listMembers(actorUserId, companyId) {
  await requireCompanyMembership(actorUserId, companyId);
  await getCompanyOrThrow(companyId, { id: true });

  const memberships = await prisma.companyMembership.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
    select: MEMBERSHIP_SELECT,
  });
  const userIds = memberships.map((m) => m.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      email: true,
      name: true,
      profile: {
        select: {
          displayName: true,
          preferredCabin: true,
          preferredAirlines: true,
          seatPref: true,
          mealPref: true,
        },
      },
    },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  return memberships.map((m) => {
    const u = byId.get(m.userId);
    return {
      ...m,
      traveller: u
        ? {
            email: u.email,
            name: u.name,
            displayName: u.profile?.displayName ?? u.name ?? null,
            preferredCabin: u.profile?.preferredCabin ?? null,
            preferredAirlines: u.profile?.preferredAirlines ?? null,
            seatPref: u.profile?.seatPref ?? null,
            mealPref: u.profile?.mealPref ?? null,
          }
        : null,
    };
  });
}

export async function updateMember(
  actorUserId,
  companyId,
  memberUserId,
  { role, department, costCentre },
) {
  await requireCompanyMembership(actorUserId, companyId, { allowedRoles: ["ADMIN"] });
  const membership = await prisma.companyMembership.findUnique({
    where: { companyId_userId: { companyId, userId: memberUserId } },
    select: MEMBERSHIP_SELECT,
  });
  if (!membership) throw new AppError(404, "Membership not found");

  if (role !== undefined && membership.role === "ADMIN" && role !== "ADMIN") {
    const adminCount = await prisma.companyMembership.count({
      where: { companyId, role: "ADMIN" },
    });
    if (adminCount <= 1) {
      throw new AppError(409, "Cannot demote the last company ADMIN");
    }
  }

  const data = {};
  if (role !== undefined) data.role = role;
  if (department !== undefined) data.department = department;
  if (costCentre !== undefined) data.costCentre = costCentre;

  const updated = await prisma.companyMembership.update({
    where: { id: membership.id },
    data,
    select: MEMBERSHIP_SELECT,
  });
  auditCorporate(actorUserId, "corporate.member.update", "CompanyMembership", updated.id, {
    companyId,
    memberUserId,
    fields: Object.keys(data),
  });
  return updated;
}

export async function removeMember(actorUserId, companyId, memberUserId) {
  await requireCompanyMembership(actorUserId, companyId, { allowedRoles: ["ADMIN"] });
  const membership = await prisma.companyMembership.findUnique({
    where: { companyId_userId: { companyId, userId: memberUserId } },
    select: MEMBERSHIP_SELECT,
  });
  if (!membership) throw new AppError(404, "Membership not found");

  if (membership.role === "ADMIN") {
    const adminCount = await prisma.companyMembership.count({
      where: { companyId, role: "ADMIN" },
    });
    if (adminCount <= 1) {
      throw new AppError(409, "Cannot remove the last company ADMIN");
    }
  }

  await prisma.companyMembership.delete({ where: { id: membership.id } });
  auditCorporate(actorUserId, "corporate.member.remove", "CompanyMembership", membership.id, {
    companyId,
    memberUserId,
  });
  return { removed: true, companyId, userId: memberUserId };
}

export async function createPolicy(
  actorUserId,
  companyId,
  { name, maxCabin, maxAmountMinor, preferredAirlines, advanceBookingDays },
) {
  await requireCompanyMembership(actorUserId, companyId, { allowedRoles: ["ADMIN"] });
  await getCompanyOrThrow(companyId, { id: true });
  if (maxAmountMinor !== undefined && maxAmountMinor !== null) {
    assertNonNegativeMinorAmount(maxAmountMinor, "maxAmountMinor");
  }
  const policy = await prisma.travelPolicy.create({
    data: {
      companyId,
      name,
      maxCabin: maxCabin ?? null,
      maxAmountMinor: maxAmountMinor ?? null,
      preferredAirlines: preferredAirlines ?? null,
      advanceBookingDays: advanceBookingDays ?? null,
    },
    select: POLICY_SELECT,
  });
  auditCorporate(actorUserId, "corporate.policy.create", "TravelPolicy", policy.id, {
    companyId,
    name: policy.name,
  });
  return policy;
}

export async function listPolicies(actorUserId, companyId) {
  await requireCompanyMembership(actorUserId, companyId);
  await getCompanyOrThrow(companyId, { id: true });
  return prisma.travelPolicy.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    select: POLICY_SELECT,
  });
}

export async function updatePolicy(
  actorUserId,
  companyId,
  policyId,
  { name, maxCabin, maxAmountMinor, preferredAirlines, advanceBookingDays },
) {
  await requireCompanyMembership(actorUserId, companyId, { allowedRoles: ["ADMIN"] });
  const policy = await prisma.travelPolicy.findFirst({
    where: { id: policyId, companyId },
    select: { id: true },
  });
  if (!policy) throw new AppError(404, "Travel policy not found");

  if (maxAmountMinor !== undefined && maxAmountMinor !== null) {
    assertNonNegativeMinorAmount(maxAmountMinor, "maxAmountMinor");
  }

  const data = {};
  if (name !== undefined) data.name = name;
  if (maxCabin !== undefined) data.maxCabin = maxCabin;
  if (maxAmountMinor !== undefined) data.maxAmountMinor = maxAmountMinor;
  if (preferredAirlines !== undefined) data.preferredAirlines = preferredAirlines;
  if (advanceBookingDays !== undefined) data.advanceBookingDays = advanceBookingDays;

  const updated = await prisma.travelPolicy.update({
    where: { id: policyId },
    data,
    select: POLICY_SELECT,
  });
  auditCorporate(actorUserId, "corporate.policy.update", "TravelPolicy", updated.id, {
    companyId,
    fields: Object.keys(data),
  });
  return updated;
}

/**
 * Approval gate state for a booking: REQUIRED → PENDING → APPROVED/REJECTED.
 * Distinct from policy evaluation (`withinPolicy` / violations).
 */
export async function getBookingApprovalGate(actorUserId, bookingId) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      userId: true,
      amountMinor: true,
      currency: true,
      status: true,
      metadata: true,
    },
  });
  if (!booking) throw new AppError(404, "Booking not found");

  const companyId = booking.metadata?.companyId;
  if (!companyId || typeof companyId !== "string") {
    return {
      corporate: false,
      companyId: null,
      approvalStatus: null,
      canProceed: true,
      policyEvaluation: null,
      approval: null,
    };
  }

  const membership = await requireCompanyMembership(actorUserId, companyId);
  if (
    booking.userId !== actorUserId &&
    membership.role !== "ADMIN" &&
    membership.role !== "APPROVER"
  ) {
    throw new AppError(403, "Forbidden");
  }

  const cabin = booking.metadata?.cabin ?? booking.metadata?.pricing?.input?.cabin;
  const policyEvaluation = await evaluatePolicy({
    companyId,
    amountMinor: booking.amountMinor,
    cabin,
    airline: booking.metadata?.airline,
    departureDate: booking.metadata?.departureDate,
  });

  const approval = await prisma.approvalRequest.findFirst({
    where: { bookingId, companyId },
    orderBy: { createdAt: "desc" },
    select: APPROVAL_SELECT,
  });

  let approvalStatus = "REQUIRED";
  if (approval) {
    if (approval.status === "PENDING" || approval.status === "CHANGES_REQUESTED") {
      approvalStatus = "PENDING";
    } else if (approval.status === "APPROVED") {
      approvalStatus = "APPROVED";
    } else if (approval.status === "REJECTED") {
      approvalStatus = "REJECTED";
    } else {
      approvalStatus = approval.status;
    }
  }

  return {
    corporate: true,
    companyId,
    bookingId: booking.id,
    bookingStatus: booking.status,
    approvalStatus,
    canProceed: approvalStatus === "APPROVED",
    // Explicit: policy pass/fail is not an approval decision.
    policyEvaluation: {
      withinPolicy: policyEvaluation.withinPolicy,
      violations: policyEvaluation.violations,
      policyId: policyEvaluation.policy?.id ?? null,
    },
    approval,
  };
}

/**
 * Admin/approver visibility into company-tagged bookings (metadata.companyId).
 * MEMBERs only see their own corporate bookings.
 */
export async function listCompanyBookings(actorUserId, companyId, { page, pageSize } = {}) {
  const membership = await requireCompanyMembership(actorUserId, companyId);
  const take = Math.min(pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const currentPage = page || 1;
  const skip = (currentPage - 1) * take;

  const where = {
    ...(membership.role === "MEMBER" ? { userId: actorUserId } : {}),
    metadata: {
      path: ["companyId"],
      equals: companyId,
    },
  };

  const [items, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        userId: true,
        status: true,
        product: true,
        currency: true,
        amountMinor: true,
        netMinor: true,
        marginMinor: true,
        createdAt: true,
        metadata: true,
      },
    }),
    prisma.booking.count({ where }),
  ]);

  return {
    items,
    page: currentPage,
    pageSize: take,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / take),
  };
}

/**
 * Create ApprovalRequest. Auto-APPROVED when within policy; PENDING on violation.
 * Policy evaluation is recorded on the row — approval status is separate.
 */
export async function createApprovalRequest(requesterUserId, { bookingId, companyId }) {
  await requireCompanyMembership(requesterUserId, companyId);

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, userId: true, amountMinor: true, currency: true, metadata: true },
  });
  if (!booking) {
    throw new AppError(404, "Booking not found");
  }
  if (booking.userId !== requesterUserId) {
    throw new AppError(403, "Only the booking owner may request approval for it");
  }

  // Booking must already be tagged to this company (set at quote with verified membership).
  if (booking.metadata?.companyId && booking.metadata.companyId !== companyId) {
    throw new AppError(403, "Booking is not associated with this company");
  }

  const existing = await prisma.approvalRequest.findFirst({
    where: { bookingId, companyId, status: { in: ["PENDING", "APPROVED"] } },
    select: APPROVAL_SELECT,
  });
  if (existing) return existing;

  const cabin = booking.metadata?.cabin ?? booking.metadata?.pricing?.input?.cabin;
  const airline = booking.metadata?.airline ?? null;
  const departureDate = booking.metadata?.departureDate ?? null;
  const evaluation = await evaluatePolicy({
    companyId,
    amountMinor: booking.amountMinor,
    cabin,
    airline,
    departureDate,
  });
  const needsHumanApproval = !evaluation.withinPolicy;

  const approval = await prisma.approvalRequest.create({
    data: {
      companyId,
      bookingId,
      requesterUserId,
      amountMinor: booking.amountMinor,
      currency: booking.currency,
      status: needsHumanApproval ? "PENDING" : "APPROVED",
      policyViolation: needsHumanApproval
        ? {
            // Keep legacy reason string for existing clients/tests.
            reason: evaluation.violations[0]?.message ?? "policy violation",
            violations: evaluation.violations,
            maxAmountMinor: evaluation.policy?.maxAmountMinor ?? null,
            maxCabin: evaluation.policy?.maxCabin ?? null,
            amountMinor: booking.amountMinor,
            cabin: cabin ?? null,
          }
        : null,
      decisionNote: needsHumanApproval
        ? null
        : "Auto-approved — recorded approval within policy",
      decidedAt: needsHumanApproval ? null : new Date(),
    },
    select: APPROVAL_SELECT,
  });

  auditCorporate(requesterUserId, "corporate.approval.create", "ApprovalRequest", approval.id, {
    companyId,
    bookingId,
    status: approval.status,
    withinPolicy: evaluation.withinPolicy,
  });

  if (approval.status === "PENDING") {
    await notifyApprovalRequestedSafe(approval, booking);
  }

  return approval;
}

async function notifyApprovalRequestedSafe(approval, booking) {
  try {
    const { enqueueNotificationOutbox } = await import("../../lib/notifications/enqueue.js");
    const approvers = await prisma.companyMembership.findMany({
      where: {
        companyId: approval.companyId,
        role: { in: ["APPROVER", "ADMIN"] },
      },
      select: { userId: true },
    });
    const approverIds = [...new Set(approvers.map((a) => a.userId).filter(Boolean))];
    if (!approverIds.length) return;

    const formattedAmount = `${approval.currency} ${(approval.amountMinor / 100).toFixed(2)}`;
    const title = "Corporate Travel Approval Requested";
    const body = `Travel approval requested for booking ${approval.bookingId} (${formattedAmount}). Action required.`;

    const rows = [];
    for (const approverId of approverIds) {
      for (const channel of ["APP", "EMAIL", "WHATSAPP"]) {
        rows.push({
          userId: approverId,
          channel,
          dedupeKey: `corporate:approval:request:${approval.id}:${approverId}:${channel.toLowerCase()}`,
          title,
          body,
          payload: {
            module: "corporate",
            approvalId: approval.id,
            bookingId: approval.bookingId,
            companyId: approval.companyId,
            amountMinor: approval.amountMinor,
            currency: approval.currency,
          },
        });
      }
    }
    await enqueueNotificationOutbox(rows);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Failed to enqueue corporate approval requested notification", {
      approvalId: approval?.id,
      err: e,
    });
  }
}

async function notifyApprovalDecidedSafe(approval, updated, decision, note) {
  try {
    const { enqueueNotificationOutbox } = await import("../../lib/notifications/enqueue.js");
    const statusLabel = updated.status.toLowerCase();
    const title = `Travel Approval ${updated.status}`;
    const reasonSuffix = note ? `: ${note}` : ".";
    const body = `Your travel approval request for booking ${approval.bookingId} was ${statusLabel}${reasonSuffix}`;

    const rows = ["APP", "EMAIL", "WHATSAPP"].map((channel) => ({
      userId: approval.requesterUserId,
      channel,
      dedupeKey: `corporate:approval:decision:${updated.id}:${statusLabel}:${channel.toLowerCase()}`,
      title,
      body,
      payload: {
        module: "corporate",
        approvalId: updated.id,
        bookingId: approval.bookingId,
        companyId: approval.companyId,
        decision,
        status: updated.status,
        decisionNote: note ?? null,
      },
    }));
    await enqueueNotificationOutbox(rows);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Failed to enqueue corporate approval decided notification", {
      approvalId: updated?.id,
      err: e,
    });
  }
}

export async function listApprovals(
  userId,
  { status, companyId, page, pageSize } = {},
  effectivePermissions,
) {
  const take = Math.min(pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const currentPage = page || 1;
  const skip = (currentPage - 1) * take;

  const isPlatformAdmin = Boolean(
    effectivePermissions?.global?.includes("corporate:approvals:read"),
  );
  let allowedCompanyIds = null;
  if (!isPlatformAdmin) {
    const memberships = await prisma.companyMembership.findMany({
      where: { userId },
      select: { companyId: true },
    });
    allowedCompanyIds = memberships.map((m) => m.companyId);
    if (companyId && !allowedCompanyIds.includes(companyId)) {
      throw new AppError(403, "Not a member of this company");
    }
    if (!allowedCompanyIds.length) {
      return { items: [], page: currentPage, pageSize: take, total: 0, totalPages: 0 };
    }
  }

  const where = {
    ...(status ? { status } : {}),
    ...(companyId
      ? { companyId }
      : allowedCompanyIds
        ? { companyId: { in: allowedCompanyIds } }
        : {}),
  };

  const [items, total] = await Promise.all([
    prisma.approvalRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: APPROVAL_SELECT,
    }),
    prisma.approvalRequest.count({ where }),
  ]);

  return {
    items,
    page: currentPage,
    pageSize: take,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / take),
  };
}

export async function decideApproval(approverUserId, id, { decision, note }) {
  const approval = await prisma.approvalRequest.findUnique({
    where: { id },
    select: { id: true, status: true, companyId: true, bookingId: true, requesterUserId: true },
  });
  if (!approval) {
    throw new AppError(404, "Approval request not found");
  }
  await requireCompanyMembership(approverUserId, approval.companyId, {
    allowedRoles: ["APPROVER", "ADMIN"],
  });
  if (approval.status !== "PENDING" && approval.status !== "CHANGES_REQUESTED") {
    throw new AppError(409, `Cannot decide an approval already in status ${approval.status}`);
  }

  const updated = await prisma.approvalRequest.update({
    where: { id },
    data: {
      status: DECISION_TO_STATUS[decision],
      approverUserId,
      decisionNote: note ?? null,
      decidedAt: new Date(),
    },
    select: APPROVAL_SELECT,
  });

  auditCorporate(approverUserId, "corporate.approval.decide", "ApprovalRequest", updated.id, {
    companyId: approval.companyId,
    bookingId: approval.bookingId,
    decision,
    status: updated.status,
  });

  await notifyApprovalDecidedSafe(approval, updated, decision, note);

  return updated;
}

export const decideApprovalRequest = decideApproval;

/**
 * Bookings/payments hook — corporate spend gate before RESERVE / corporate pay.
 */
export async function assertCorporateBookingAllowed({
  userId,
  companyId,
  bookingId,
  amountMinor,
  currency,
  cabin,
}) {
  if (!companyId) throw new AppError(400, "companyId is required");
  assertNonNegativeMinorAmount(amountMinor, "amountMinor");

  const membership = await requireCompanyMembership(userId, companyId);

  const company = await getCompanyOrThrow(companyId);
  if (!company.isActive) {
    throw new AppError(403, "Company account is not active");
  }
  if (currency && company.currency !== currency) {
    throw new AppError(
      400,
      `Booking currency ${currency} does not match company currency ${company.currency}`,
    );
  }

  // Demo mode: the corporate spend gate (credit limit → policy → approval) is
  // a three-step wall that a scripted demo cannot clear without seeding an
  // APPROVED ApprovalRequest per booking. Membership and company-active are
  // still enforced above — only the spend controls are skipped, and only
  // outside production.
  if (isDemoBookingEnabled()) {
    return {
      membership,
      company,
      policy: await getEffectivePolicy(companyId),
      approval: null,
      evaluation: { withinPolicy: true, violations: [] },
      violation: { amountViolation: false, cabinViolation: false },
      demoBypass: true,
    };
  }

  const availableCredit = company.creditLimitMinor - company.creditUsedMinor;
  if (availableCredit < amountMinor) {
    throw new AppError(402, "Corporate credit limit exceeded");
  }

  const policy = await getEffectivePolicy(companyId);
  const evaluation = await evaluatePolicy({
    companyId,
    amountMinor,
    cabin,
  });

  const approval = bookingId
    ? await prisma.approvalRequest.findFirst({
        where: { bookingId, companyId },
        orderBy: { createdAt: "desc" },
        select: APPROVAL_SELECT,
      })
    : null;

  if (!approval) {
    const err = new AppError(403, "approval required");
    err.code = "APPROVAL_REQUIRED";
    err.details = {
      withinPolicy: evaluation.withinPolicy,
      violations: evaluation.violations,
    };
    throw err;
  }
  if (approval.status === "PENDING" || approval.status === "CHANGES_REQUESTED") {
    const err = new AppError(409, "approval pending");
    err.code = "APPROVAL_PENDING";
    err.details = {
      approvalId: approval.id,
      status: approval.status,
      withinPolicy: evaluation.withinPolicy,
      violations: evaluation.violations,
    };
    throw err;
  }
  if (approval.status === "REJECTED") {
    const err = new AppError(403, "approval rejected");
    err.code = "APPROVAL_REJECTED";
    err.details = { approvalId: approval.id };
    throw err;
  }
  if (approval.status !== "APPROVED") {
    const err = new AppError(403, "approval required");
    err.code = "APPROVAL_REQUIRED";
    throw err;
  }

  return {
    membership,
    company,
    policy,
    approval,
    evaluation,
    violation: {
      amountViolation: evaluation.violations.some((v) => v.code === "AMOUNT_EXCEEDS_MAX"),
      cabinViolation: evaluation.violations.some((v) => v.code === "CABIN_EXCEEDS_MAX"),
    },
  };
}

export async function consumeCredit(companyId, amountMinor, { actorUserId, bookingId } = {}) {
  assertNonNegativeMinorAmount(amountMinor, "amountMinor");

  if (!bookingId) {
    await prisma.company.update({
      where: { id: companyId },
      data: { creditUsedMinor: { increment: amountMinor } },
    });
    await auditCorporate(actorUserId ?? null, "corporate.credit.consume", "Company", companyId, {
      companyId,
      amountMinor,
      bookingId: null,
    });
    return { consumed: true, deduplicated: false, amountMinor, companyId };
  }

  const result = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, metadata: true },
    });
    if (!booking) throw new AppError(404, "Booking not found");

    const meta =
      booking.metadata && typeof booking.metadata === "object" && !Array.isArray(booking.metadata)
        ? { ...booking.metadata }
        : {};
    const existing = meta.corporateCredit && typeof meta.corporateCredit === "object"
      ? meta.corporateCredit
      : null;

    if (
      existing &&
      typeof existing.consumedMinor === "number" &&
      existing.consumedMinor >= 0 &&
      !existing.releasedAt
    ) {
      return {
        consumed: false,
        deduplicated: true,
        amountMinor: existing.consumedMinor,
        companyId: existing.companyId || companyId,
      };
    }

    if (meta.companyId && meta.companyId !== companyId) {
      throw new AppError(403, "Booking company does not match credit consume company");
    }

    await tx.company.update({
      where: { id: companyId },
      data: { creditUsedMinor: { increment: amountMinor } },
    });

    const consumedAt = new Date().toISOString();
    await tx.booking.update({
      where: { id: bookingId },
      data: {
        metadata: {
          ...meta,
          companyId,
          corporateCredit: {
            companyId,
            consumedMinor: amountMinor,
            consumedAt,
          },
        },
      },
    });

    return { consumed: true, deduplicated: false, amountMinor, companyId, consumedAt };
  });

  await auditCorporate(actorUserId ?? null, "corporate.credit.consume", "Company", companyId, {
    companyId,
    amountMinor: result.amountMinor,
    bookingId,
    deduplicated: result.deduplicated === true,
  });

  return result;
}

/**
 * Restore corporate credit for a booking that previously consumed it.
 *
 * Server-authoritative only:
 *  - amount from Booking.metadata.corporateCredit.consumedMinor (or legacy
 *    RESERVE evidence + booking.amountMinor) — never from client input
 *  - companyId from booking metadata only
 *  - only when booking status is CANCELLED or REFUNDED
 *  - idempotent per booking (releasedAt / releasedMinor stamped on metadata)
 *
 * Partial refunds: the corporate credit model consumes the full booking
 * amountMinor at RESERVE and has no partial-hold semantics. When a booking
 * reaches REFUNDED, the full consumed amount is released once — we do not
 * invent partial credit restoration from refundableMinor.
 *
 * @param {string} bookingId
 * @param {{ actorUserId?: string|null, reason?: string }} [opts]
 * @returns {Promise<object>}
 */
export async function releaseCreditForBooking(bookingId, { actorUserId, reason } = {}) {
  if (!bookingId || typeof bookingId !== "string") {
    throw new AppError(400, "bookingId is required");
  }

  const outcome = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        amountMinor: true,
        userId: true,
        metadata: true,
      },
    });
    if (!booking) throw new AppError(404, "Booking not found");

    const meta =
      booking.metadata && typeof booking.metadata === "object" && !Array.isArray(booking.metadata)
        ? { ...booking.metadata }
        : {};
    const companyId =
      typeof meta.companyId === "string" && meta.companyId.trim() ? meta.companyId.trim() : null;

    if (!companyId) {
      return {
        released: false,
        reason: "not_corporate",
        amountMinor: 0,
        bookingId,
      };
    }

    const creditMeta =
      meta.corporateCredit && typeof meta.corporateCredit === "object" ? { ...meta.corporateCredit } : {};

    if (creditMeta.releasedAt || typeof creditMeta.releasedMinor === "number") {
      return {
        released: false,
        deduplicated: true,
        reason: "already_released",
        amountMinor: creditMeta.releasedMinor ?? creditMeta.consumedMinor ?? 0,
        companyId,
        bookingId,
      };
    }

    if (!["CANCELLED", "REFUNDED"].includes(booking.status)) {
      throw new AppError(
        409,
        `Corporate credit can only be released when booking is CANCELLED or REFUNDED (got ${booking.status})`,
      );
    }

    let amountMinor =
      typeof creditMeta.consumedMinor === "number" && creditMeta.consumedMinor >= 0
        ? creditMeta.consumedMinor
        : null;

    if (amountMinor == null) {
      // Legacy bookings that consumed credit before metadata stamping:
      // only restore when a RESERVE transition proves consume ran.
      const reserved = await tx.bookingTransition.findFirst({
        where: { bookingId, toStatus: "RESERVED" },
        select: { id: true },
      });
      if (!reserved) {
        return {
          released: false,
          reason: "never_consumed",
          amountMinor: 0,
          companyId,
          bookingId,
        };
      }
      amountMinor = booking.amountMinor;
    }

    if (amountMinor <= 0) {
      return {
        released: false,
        reason: "zero_amount",
        amountMinor: 0,
        companyId,
        bookingId,
      };
    }

    if (creditMeta.companyId && creditMeta.companyId !== companyId) {
      throw new AppError(403, "Corporate credit company mismatch on booking");
    }

    const company = await tx.company.findUnique({
      where: { id: companyId },
      select: { id: true, creditUsedMinor: true },
    });
    if (!company) throw new AppError(404, "Company not found");

    const nextUsed = Math.max(0, company.creditUsedMinor - amountMinor);
    await tx.company.update({
      where: { id: companyId },
      data: { creditUsedMinor: nextUsed },
    });

    const releasedAt = new Date().toISOString();
    await tx.booking.update({
      where: { id: bookingId },
      data: {
        metadata: {
          ...meta,
          companyId,
          corporateCredit: {
            ...creditMeta,
            companyId,
            consumedMinor: amountMinor,
            releasedMinor: amountMinor,
            releasedAt,
            releaseReason: reason || null,
            creditUsedMinorAfter: nextUsed,
          },
        },
      },
    });

    return {
      released: true,
      deduplicated: false,
      reason: reason || "released",
      amountMinor,
      companyId,
      bookingId,
      creditUsedMinorAfter: nextUsed,
      releasedAt,
    };
  });

  if (outcome.released || outcome.deduplicated) {
    await auditCorporate(
      actorUserId ?? null,
      "corporate.credit.release",
      "Booking",
      bookingId,
      {
        companyId: outcome.companyId || null,
        amountMinor: outcome.amountMinor,
        bookingId,
        released: outcome.released === true,
        deduplicated: outcome.deduplicated === true,
        reason: outcome.reason || null,
      },
    );
  }

  return outcome;
}

/**
 * Server-validated profile switch. Never echoes an unverified companyId.
 */
export async function resolveActiveProfile(userId, { mode, companyId } = {}) {
  const normalized = String(mode || "PERSONAL").toUpperCase() === "CORPORATE" ? "CORPORATE" : "PERSONAL";

  if (normalized === "PERSONAL") {
    const profile = await prisma.travellerProfile.findUnique({
      where: { userId },
      select: {
        displayName: true,
        preferredCabin: true,
        preferredAirlines: true,
        seatPref: true,
        mealPref: true,
      },
    });
    return { mode: "PERSONAL", companyId: null, travellerProfile: profile, policy: null };
  }

  if (!companyId) {
    throw new AppError(400, "companyId is required for CORPORATE profile");
  }

  const membership = await requireCompanyMembership(userId, companyId);
  const company = await getCompanyOrThrow(companyId);
  if (!company.isActive) {
    throw new AppError(403, "Company account is not active");
  }

  const policy = await getEffectivePolicy(companyId);
  const profile = await prisma.travellerProfile.findUnique({
    where: { userId },
    select: {
      displayName: true,
      preferredCabin: true,
      preferredAirlines: true,
      seatPref: true,
      mealPref: true,
    },
  });

  return {
    mode: "CORPORATE",
    companyId: company.id,
    membership: {
      role: membership.role,
      department: membership.department,
      costCentre: membership.costCentre,
    },
    company: {
      id: company.id,
      name: company.name,
      currency: company.currency,
      creditLimitMinor: company.creditLimitMinor,
      creditUsedMinor: company.creditUsedMinor,
      creditAvailableMinor: company.creditLimitMinor - company.creditUsedMinor,
      markupBps: company.markupBps,
    },
    policy,
    /**
     * Soft Ava constraints derived from corporate policy.
     * Explicit policy evaluation at quote/pay remains authoritative.
     */
    avaConstraints: policy
      ? {
          maxCabin: policy.maxCabin ?? null,
          maxAmountMinor: policy.maxAmountMinor ?? null,
          preferredAirlines: preferredAirlinesList(policy.preferredAirlines),
          advanceBookingDays: policy.advanceBookingDays ?? null,
          authoritative: true,
          note: "Corporate policy is authoritative over Ava suggestions",
        }
      : null,
    travellerProfile: profile,
  };
}

/** Admin visibility: AuditLog rows tagged with this companyId in metadata. */
export async function listCompanyAudit(actorUserId, companyId, { page, pageSize } = {}) {
  await requireCompanyMembership(actorUserId, companyId, { allowedRoles: ["ADMIN"] });

  const take = Math.min(pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const currentPage = page || 1;
  const skip = (currentPage - 1) * take;

  const where = {
    OR: [
      { resourceType: "Company", resourceId: companyId },
      {
        metadata: {
          path: ["companyId"],
          equals: companyId,
        },
      },
    ],
  };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        userId: true,
        action: true,
        resourceType: true,
        resourceId: true,
        metadata: true,
        createdAt: true,
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    items,
    page: currentPage,
    pageSize: take,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / take),
  };
}

function isUniqueViolation(err) {
  return err?.code === "P2002";
}

function normalizeProjectCodeValue(code) {
  return String(code).trim().toUpperCase();
}

/**
 * Resolve an active project code for a verified company.
 * Used by bookings at quote time — never trusts client ownership claims.
 */
export async function resolveActiveProjectCode(companyId, projectCodeId) {
  if (!companyId) throw new AppError(400, "companyId is required");
  if (!projectCodeId || typeof projectCodeId !== "string") {
    throw new AppError(400, "projectCodeId is required");
  }
  const row = await prisma.projectCode.findFirst({
    where: { id: projectCodeId.trim(), companyId },
    select: PROJECT_CODE_SELECT,
  });
  if (!row) {
    throw new AppError(404, "Project code not found");
  }
  if (!row.isActive) {
    throw new AppError(400, "Project code is inactive");
  }
  return row;
}

export async function listProjectCodes(actorUserId, companyId, { activeOnly } = {}) {
  await requireCompanyMembership(actorUserId, companyId);
  await getCompanyOrThrow(companyId, { id: true });
  return prisma.projectCode.findMany({
    where: {
      companyId,
      ...(activeOnly ? { isActive: true } : {}),
    },
    orderBy: [{ isActive: "desc" }, { code: "asc" }],
    select: PROJECT_CODE_SELECT,
  });
}

export async function createProjectCode(actorUserId, companyId, { code, name, isActive }) {
  await requireCompanyMembership(actorUserId, companyId, { allowedRoles: ["ADMIN"] });
  await getCompanyOrThrow(companyId, { id: true });

  const normalizedCode = normalizeProjectCodeValue(code);
  if (!normalizedCode) {
    throw new AppError(400, "Project code is required");
  }

  let created;
  try {
    created = await prisma.projectCode.create({
      data: {
        companyId,
        code: normalizedCode,
        name: String(name).trim(),
        isActive: isActive !== false,
      },
      select: PROJECT_CODE_SELECT,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new AppError(409, "Project code already exists for this company");
    }
    throw err;
  }

  auditCorporate(actorUserId, "corporate.project_code.create", "ProjectCode", created.id, {
    companyId,
    code: created.code,
  });
  return created;
}

export async function updateProjectCode(
  actorUserId,
  companyId,
  projectCodeId,
  { code, name, isActive },
) {
  await requireCompanyMembership(actorUserId, companyId, { allowedRoles: ["ADMIN"] });
  const existing = await prisma.projectCode.findFirst({
    where: { id: projectCodeId, companyId },
    select: PROJECT_CODE_SELECT,
  });
  if (!existing) {
    throw new AppError(404, "Project code not found");
  }

  const data = {};
  if (code !== undefined) {
    const normalizedCode = normalizeProjectCodeValue(code);
    if (!normalizedCode) {
      throw new AppError(400, "Project code is required");
    }
    data.code = normalizedCode;
  }
  if (name !== undefined) data.name = String(name).trim();
  if (isActive !== undefined) data.isActive = isActive;

  let updated;
  try {
    updated = await prisma.projectCode.update({
      where: { id: existing.id },
      data,
      select: PROJECT_CODE_SELECT,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new AppError(409, "Project code already exists for this company");
    }
    throw err;
  }

  auditCorporate(actorUserId, "corporate.project_code.update", "ProjectCode", updated.id, {
    companyId,
    code: updated.code,
    isActive: updated.isActive,
  });
  return updated;
}

/**
 * Attach an active same-company project code to a QUOTED corporate booking.
 * Personal bookings and cross-company codes are rejected.
 */
export async function setBookingProjectCode(actorUserId, bookingId, projectCodeId) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      userId: true,
      status: true,
      metadata: true,
    },
  });
  if (!booking) {
    throw new AppError(404, "Booking not found");
  }
  if (booking.userId !== actorUserId) {
    throw new AppError(403, "Forbidden");
  }
  if (booking.status !== "QUOTED") {
    throw new AppError(409, "Project code can only be set on a QUOTED booking");
  }

  const companyId =
    booking.metadata?.companyId && typeof booking.metadata.companyId === "string"
      ? booking.metadata.companyId
      : null;
  if (!companyId) {
    throw new AppError(400, "Personal bookings cannot use project codes");
  }

  await requireCompanyMembership(actorUserId, companyId);
  const projectCode = await resolveActiveProjectCode(companyId, projectCodeId);

  const metadata = {
    ...(booking.metadata && typeof booking.metadata === "object" ? booking.metadata : {}),
    companyId,
    projectCodeId: projectCode.id,
    projectCode: projectCode.code,
    projectCodeName: projectCode.name,
  };

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { metadata },
    select: {
      id: true,
      status: true,
      metadata: true,
      amountMinor: true,
      currency: true,
    },
  });

  auditCorporate(actorUserId, "corporate.booking.project_code", "Booking", booking.id, {
    companyId,
    projectCodeId: projectCode.id,
    projectCode: projectCode.code,
  });

  return updated;
}
