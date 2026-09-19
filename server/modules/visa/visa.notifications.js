/**
 * Module 08 — Visa expiry + apply-by-departure notifications.
 *
 * Rules:
 * - Never invent processing times or apply-by dates.
 * - Visa-doc expiry: only ACTIVE identity docs of type VISA with real expiresAt.
 * - Apply-by: only when booking has a real departAt AND requirement has attributed
 *   processingDaysMax (isFact / STALE with numbers) — never invent Max days.
 * - Deduped via NotificationOutbox @@unique([dedupeKey, channel]).
 */
import prisma from "../../config/prisma.js";
import { enqueueNotificationOutbox } from "../../lib/notifications/enqueue.js";
import {
  PROFILE_DOC_NOTIFICATION_CHANNELS,
  dueExpiryLeadNotifications,
  daysUntil,
  computeExpiryStatus,
} from "../profile/documentExpiry.js";
import {
  fetchVisaRequirementRow,
  toVisaRequirementAssessment,
} from "./visa.provider.js";

/** Visa-specific lead days (PRD: visa expiry reminders). Override via VISA_DOC_EXPIRY_LEAD_DAYS. */
export function getVisaExpiryLeadDays(env = process.env) {
  const raw = env.VISA_DOC_EXPIRY_LEAD_DAYS?.trim();
  if (!raw) return [180, 30, 7];
  const parsed = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  return parsed.length ? [...new Set(parsed)].sort((a, b) => b - a) : [180, 30, 7];
}

/** Lead days before apply-by date. Override via VISA_APPLY_BY_LEAD_DAYS. */
export function getVisaApplyByLeadDays(env = process.env) {
  const raw = env.VISA_APPLY_BY_LEAD_DAYS?.trim();
  if (!raw) return [30, 14, 7];
  const parsed = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  return parsed.length ? [...new Set(parsed)].sort((a, b) => b - a) : [30, 14, 7];
}

function channelsFromEnv(env = process.env) {
  const raw = env.VISA_NOTIFICATION_CHANNELS?.trim() || env.PROFILE_DOC_NOTIFICATION_CHANNELS?.trim();
  if (!raw) return [...PROFILE_DOC_NOTIFICATION_CHANNELS];
  const allowed = new Set(PROFILE_DOC_NOTIFICATION_CHANNELS);
  const parsed = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((c) => allowed.has(c));
  return parsed.length ? [...new Set(parsed)] : [...PROFILE_DOC_NOTIFICATION_CHANNELS];
}

export function visaExpiryDedupeKey(documentId, leadDays) {
  return `visa-doc-expiry:${documentId}:lead:${leadDays}`;
}

export function visaApplyByDedupeKey(bookingId, leadDays) {
  return `visa-apply-by:${bookingId}:lead:${leadDays}`;
}

/**
 * Compute apply-by date only from real departAt + attributed processingDaysMax.
 * @returns {Date|null}
 */
export function computeApplyByDate(departAt, processingDaysMax) {
  if (departAt == null || processingDaysMax == null) return null;
  if (!Number.isInteger(processingDaysMax) || processingDaysMax < 0) return null;
  const depart = departAt instanceof Date ? departAt : new Date(departAt);
  if (Number.isNaN(depart.getTime())) return null;
  return new Date(depart.getTime() - processingDaysMax * 86_400_000);
}

/**
 * Schedule visa identity-document expiry notifications (type === VISA only).
 */
export async function scheduleVisaDocumentExpiryNotifications(doc, opts = {}) {
  if (!doc || doc.type !== "VISA" || !doc.expiresAt) {
    return { enqueued: 0, skippedDuplicate: 0, leads: [] };
  }
  const now = opts.now ?? new Date();
  const leadDays = opts.leadDays ?? getVisaExpiryLeadDays();
  const channels = opts.channels ?? channelsFromEnv();
  const dueLeads = dueExpiryLeadNotifications(doc.expiresAt, { now, leadDays });
  if (!dueLeads.length) return { enqueued: 0, skippedDuplicate: 0, leads: [] };

  const expiry = computeExpiryStatus(doc.expiresAt, { now, leadDays });
  let enqueued = 0;
  let skippedDuplicate = 0;

  for (const lead of dueLeads) {
    const dedupeKey = visaExpiryDedupeKey(doc.id, lead);
    const rows = channels.map((channel) => ({
      userId: doc.ownerUserId,
      channel,
      dedupeKey,
      title: `Visa document expiry reminder (${lead}-day notice)`,
      body: `A visa document on your profile expires in ${expiry.daysRemaining} day(s). Renew before travel — this is not an eligibility determination.`,
      payload: {
        module: "visa",
        kind: "visa_document_expiry",
        documentId: doc.id,
        leadDays: lead,
        expiresAt: doc.expiresAt,
        daysRemaining: expiry.daysRemaining,
      },
    }));
    const { enqueued: created } = await enqueueNotificationOutbox(rows);
    enqueued += created;
    skippedDuplicate += rows.length - created;
  }

  return { enqueued, skippedDuplicate, leads: dueLeads };
}

/**
 * Apply-by reminder for a booking — only when departAt + attributed processingDaysMax exist.
 */
export async function scheduleVisaApplyByNotifications(booking, requirement, opts = {}) {
  const now = opts.now ?? new Date();
  const leadDays = opts.leadDays ?? getVisaApplyByLeadDays();
  const channels = opts.channels ?? channelsFromEnv();

  const departAt =
    booking?.metadata?.departAt ||
    booking?.metadata?.departureDate ||
    booking?.metadata?.pricing?.input?.departureDate ||
    null;
  const processingDaysMax =
    requirement?.isFact || requirement?.dataStatus === "STALE"
      ? requirement?.processingDaysMax
      : null;

  const applyBy = computeApplyByDate(departAt, processingDaysMax);
  if (!applyBy) {
    return {
      enqueued: 0,
      skippedDuplicate: 0,
      leads: [],
      skippedReason: "missing_departAt_or_attributed_processingDaysMax",
    };
  }

  const daysRemaining = daysUntil(applyBy, now);
  if (daysRemaining < 0) {
    return { enqueued: 0, skippedDuplicate: 0, leads: [], skippedReason: "apply_by_passed" };
  }

  const dueLeads = leadDays.filter((lead) => daysRemaining <= lead);
  if (!dueLeads.length) {
    return { enqueued: 0, skippedDuplicate: 0, leads: [], skippedReason: "outside_lead_window" };
  }

  let enqueued = 0;
  let skippedDuplicate = 0;
  for (const lead of dueLeads) {
    const dedupeKey = visaApplyByDedupeKey(booking.id, lead);
    const rows = channels.map((channel) => ({
      userId: booking.userId,
      channel,
      dedupeKey,
      title: `Visa application timing reminder (${lead}-day notice)`,
      body: `Based on attributed processing time (max ${processingDaysMax} days) and your departure date, consider applying by ${applyBy.toISOString().slice(0, 10)}. This is guidance from catalog data — not a guarantee.`,
      payload: {
        module: "visa",
        kind: "visa_apply_by",
        bookingId: booking.id,
        leadDays: lead,
        applyBy: applyBy.toISOString(),
        processingDaysMax,
        departAt,
        dataStatus: requirement?.dataStatus ?? null,
        isFact: Boolean(requirement?.isFact),
      },
    }));
    const { enqueued: created } = await enqueueNotificationOutbox(rows);
    enqueued += created;
    skippedDuplicate += rows.length - created;
  }

  return { enqueued, skippedDuplicate, leads: dueLeads };
}

/**
 * Worker entry: visa doc expiry + apply-by for upcoming booked trips.
 */
export async function runVisaNotificationScheduler(opts = {}) {
  const now = opts.now ?? new Date();
  const expiryLeads = opts.expiryLeadDays ?? getVisaExpiryLeadDays();
  const applyLeads = opts.applyByLeadDays ?? getVisaApplyByLeadDays();
  const batchSize = opts.batchSize ?? 200;

  const maxExpiryLead = Math.max(...expiryLeads);
  const expiryHorizon = new Date(now.getTime() + maxExpiryLead * 86_400_000);

  const visaDocs = await prisma.travellerIdentityDocument.findMany({
    where: {
      type: "VISA",
      status: "ACTIVE",
      expiresAt: { not: null, lte: expiryHorizon, gte: now },
    },
    select: {
      id: true,
      ownerUserId: true,
      type: true,
      expiresAt: true,
      countryCode: true,
    },
    take: batchSize,
    orderBy: { expiresAt: "asc" },
  });

  let expiryEnqueued = 0;
  let expirySkipped = 0;
  for (const doc of visaDocs) {
    const r = await scheduleVisaDocumentExpiryNotifications(doc, {
      now,
      leadDays: expiryLeads,
    });
    expiryEnqueued += r.enqueued;
    expirySkipped += r.skippedDuplicate;
  }

  const vaultVisas = await prisma.vaultDocument.findMany({
    where: {
      type: "VISA",
      isActive: true,
      expiresAt: { not: null, lte: expiryHorizon, gte: now },
      OR: [{ visaRecord: null }, { visaRecord: { remindersEnabled: true } }],
    },
    select: {
      id: true,
      ownerUserId: true,
      type: true,
      expiresAt: true,
    },
    take: batchSize,
    orderBy: { expiresAt: "asc" },
  });

  let vaultExpiryScanned = 0;
  for (const doc of vaultVisas) {
    const linkedIdentity = await prisma.travellerIdentityDocument.findFirst({
      where: { vaultDocumentId: doc.id, type: "VISA", status: "ACTIVE" },
      select: { id: true },
    });
    if (linkedIdentity) continue;
    vaultExpiryScanned += 1;
    const r = await scheduleVisaDocumentExpiryNotifications(doc, {
      now,
      leadDays: expiryLeads,
    });
    expiryEnqueued += r.enqueued;
    expirySkipped += r.skippedDuplicate;
  }

  // Upcoming bookings with destination + departAt in metadata (never invent departAt).
  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: ["QUOTED", "RESERVED", "TICKETED", "ACTIVE"] },
    },
    select: {
      id: true,
      userId: true,
      metadata: true,
      status: true,
    },
    take: batchSize,
    orderBy: { createdAt: "desc" },
  });

  let applyEnqueued = 0;
  let applySkipped = 0;
  let applyCandidates = 0;

  for (const booking of bookings) {
    const meta = booking.metadata && typeof booking.metadata === "object" ? booking.metadata : {};
    const destination = meta.destination || meta.visaCheck?.destinationCode || null;
    const nationality =
      meta.nationality || meta.visaCheck?.nationalityCode || null;
    const departAt =
      meta.departAt || meta.departureDate || meta.pricing?.input?.departureDate || null;
    if (!destination || !nationality || !departAt) continue;

    applyCandidates += 1;
    let requirement = meta.visaCheck;
    // Re-check when cached check lacks attributed processing days — never invent Max.
    if (
      !requirement?.processingDaysMax ||
      !(requirement.isFact || requirement.dataStatus === "STALE")
    ) {
      try {
        const row = await fetchVisaRequirementRow(
          String(nationality).toUpperCase(),
          String(destination).toUpperCase(),
        );
        requirement = toVisaRequirementAssessment(row, {
          nationalityCode: String(nationality).toUpperCase(),
          destinationCode: String(destination).toUpperCase(),
        });
      } catch {
        continue;
      }
    }

    const r = await scheduleVisaApplyByNotifications(booking, requirement, {
      now,
      leadDays: applyLeads,
    });
    applyEnqueued += r.enqueued;
    applySkipped += r.skippedDuplicate;
  }

  return {
    visaDocsScanned: visaDocs.length,
    vaultVisaDocsScanned: vaultExpiryScanned,
    expiryEnqueued,
    expirySkippedDuplicate: expirySkipped,
    bookingsScanned: bookings.length,
    applyCandidates,
    applyEnqueued,
    applySkippedDuplicate: applySkipped,
    expiryLeadDays: expiryLeads,
    applyByLeadDays: applyLeads,
  };
}
