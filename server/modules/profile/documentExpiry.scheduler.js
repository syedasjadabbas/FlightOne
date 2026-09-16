/**
 * Module 02 — schedule document-expiry notifications into the shared
 * NotificationOutbox (APP / EMAIL / WHATSAPP). Deduped via
 * @@unique([dedupeKey, channel]) + skipDuplicates.
 */
import prisma from "../../config/prisma.js";
import { enqueueNotificationOutbox } from "../../lib/notifications/enqueue.js";
import {
  PROFILE_DOC_NOTIFICATION_CHANNELS,
  dueExpiryLeadNotifications,
  expiryNotificationDedupeKey,
  getExpiryLeadDays,
  computeExpiryStatus,
} from "./documentExpiry.js";

function channelsFromEnv() {
  const raw = process.env.PROFILE_DOC_NOTIFICATION_CHANNELS?.trim();
  if (!raw) return [...PROFILE_DOC_NOTIFICATION_CHANNELS];
  const allowed = new Set(PROFILE_DOC_NOTIFICATION_CHANNELS);
  const parsed = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((c) => allowed.has(c));
  return parsed.length ? [...new Set(parsed)] : [...PROFILE_DOC_NOTIFICATION_CHANNELS];
}

function titleFor(leadDays, type, daysRemaining) {
  const label = type.replaceAll("_", " ");
  if (daysRemaining != null && daysRemaining <= leadDays) {
    return `${label} expiry reminder (${leadDays}-day notice)`;
  }
  return `${label} expires in ${leadDays} day${leadDays === 1 ? "" : "s"}`;
}

/**
 * Enqueue notifications for one document for all due lead buckets.
 * @returns {{ enqueued: number, skippedDuplicate: number, leads: number[] }}
 */
export async function scheduleExpiryNotificationsForDocument(doc, opts = {}) {
  const now = opts.now ?? new Date();
  const leadDays = opts.leadDays ?? getExpiryLeadDays();
  const channels = opts.channels ?? channelsFromEnv();
  const dueLeads = dueExpiryLeadNotifications(doc.expiresAt, { now, leadDays });

  if (dueLeads.length === 0) {
    return { enqueued: 0, skippedDuplicate: 0, leads: [] };
  }

  const expiry = computeExpiryStatus(doc.expiresAt, { now, leadDays });
  let enqueued = 0;
  let skippedDuplicate = 0;

  for (const lead of dueLeads) {
    const dedupeKey = expiryNotificationDedupeKey(doc.id, lead);
    const rows = channels.map((channel) => ({
      userId: doc.ownerUserId,
      channel,
      dedupeKey,
      title: titleFor(lead, doc.type, expiry.daysRemaining),
      body: `Your ${doc.type.replaceAll("_", " ").toLowerCase()} expires in ${expiry.daysRemaining} day(s). Please renew before travel.`,
      payload: {
        module: "profile",
        kind: "document_expiry",
        documentId: doc.id,
        documentType: doc.type,
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
 * Scan ACTIVE identity documents approaching expiry and enqueue notifications.
 * Also flips past-due ACTIVE rows to EXPIRED (status field).
 */
export async function runDocumentExpiryScheduler(opts = {}) {
  const now = opts.now ?? new Date();
  const leadDays = opts.leadDays ?? getExpiryLeadDays();
  const maxLead = Math.max(...leadDays);
  const horizon = new Date(now.getTime() + maxLead * 86_400_000);
  const batchSize = opts.batchSize ?? 200;

  // Mark expired ACTIVE docs.
  const expired = await prisma.travellerIdentityDocument.updateMany({
    where: {
      status: "ACTIVE",
      expiresAt: { lt: now },
    },
    data: { status: "EXPIRED" },
  });

  const candidates = await prisma.travellerIdentityDocument.findMany({
    where: {
      status: "ACTIVE",
      expiresAt: { not: null, lte: horizon, gte: now },
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

  let enqueued = 0;
  let skippedDuplicate = 0;
  for (const doc of candidates) {
    const r = await scheduleExpiryNotificationsForDocument(doc, { now, leadDays });
    enqueued += r.enqueued;
    skippedDuplicate += r.skippedDuplicate;
  }

  return {
    markedExpired: expired.count,
    scanned: candidates.length,
    enqueued,
    skippedDuplicate,
    leadDays,
  };
}
