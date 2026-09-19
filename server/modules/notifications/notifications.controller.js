/**
 * Inbound Webhook / Callback Handler for SMS & WhatsApp Delivery Reports.
 * Strictly adheres to idempotency and status tracking (SENT -> DELIVERED -> READ / FAILED).
 */
import prisma from "../../config/prisma.js";
import logger from "../../lib/logger.js";

/**
 * Find NotificationOutbox row by provider message ID or notification ID.
 */
async function findOutboxRow(identifier) {
  if (!identifier) return null;
  // 1. Check direct ID match
  let row = await prisma.notificationOutbox.findUnique({
    where: { id: identifier },
  });
  if (row) return row;

  // 2. Check JSON payload path for provider messageId
  const candidate = await prisma.notificationOutbox.findFirst({
    where: {
      payload: {
        path: ["delivery", "messageId"],
        equals: identifier,
      },
    },
  });
  return candidate;
}

/**
 * POST /api/notifications/callbacks/sms
 * Handles Twilio DLR and generic HTTP gateway delivery reports.
 */
export async function handleSmsCallback(req, res) {
  const body = req.body || {};
  const query = req.query || {};

  const messageId =
    body.MessageSid ||
    body.messageId ||
    body.id ||
    query.MessageSid ||
    query.messageId ||
    null;

  const rawStatus = (
    body.MessageStatus ||
    body.status ||
    query.MessageStatus ||
    query.status ||
    ""
  ).toLowerCase();

  const errorCode = body.ErrorCode || body.errorCode || body.error || null;
  const notificationId = body.notificationId || query.notificationId || null;

  const targetId = messageId || notificationId;
  if (!targetId) {
    return res.status(400).json({ ok: false, error: "Missing messageId or notificationId" });
  }

  const row = await findOutboxRow(targetId);
  if (!row) {
    logger.warn("notify.callback.sms.not_found", { targetId, rawStatus });
    return res.status(200).json({ ok: true, matched: false, message: "Outbox row not found" });
  }

  const existingPayload = row.payload && typeof row.payload === "object" ? row.payload : {};
  const existingDelivery =
    existingPayload.delivery && typeof existingPayload.delivery === "object"
      ? existingPayload.delivery
      : {};

  const nowIso = new Date().toISOString();

  // Delivered
  if (rawStatus === "delivered" || rawStatus === "success") {
    if (row.status === "DELIVERED") {
      // Idempotent no-op
      return res.status(200).json({ ok: true, updated: false, status: "DELIVERED" });
    }

    await prisma.notificationOutbox.update({
      where: { id: row.id },
      data: {
        status: "DELIVERED",
        payload: {
          ...existingPayload,
          delivery: {
            ...existingDelivery,
            status: "DELIVERED",
            deliveredAt: nowIso,
          },
        },
      },
    });

    logger.info("notify.callback.sms.delivered", { id: row.id, messageId });
    return res.status(200).json({ ok: true, updated: true, status: "DELIVERED" });
  }

  // Failed / Undelivered
  if (rawStatus === "undelivered" || rawStatus === "failed" || rawStatus === "rejected") {
    await prisma.notificationOutbox.update({
      where: { id: row.id },
      data: {
        status: "FAILED",
        payload: {
          ...existingPayload,
          delivery: {
            ...existingDelivery,
            status: "FAILED",
            failedAt: nowIso,
          },
          deliveryError: {
            reason: `sms_delivery_failed:${errorCode || rawStatus}`,
            at: nowIso,
          },
        },
      },
    });

    logger.warn("notify.callback.sms.failed", { id: row.id, messageId, rawStatus, errorCode });
    return res.status(200).json({ ok: true, updated: true, status: "FAILED" });
  }

  return res.status(200).json({ ok: true, updated: false, status: rawStatus || row.status });
}

/**
 * GET /api/notifications/callbacks/whatsapp
 * Meta WhatsApp Cloud API Webhook Verification Challenge.
 */
export function verifyWhatsAppWebhook(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const expectedToken =
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim() ||
    process.env.NOTIFY_WEBHOOK_API_KEY?.trim() ||
    "flightone_wa_verify";

  if (mode === "subscribe" && token === expectedToken) {
    logger.info("notify.callback.whatsapp.verified");
    return res.status(200).send(challenge);
  }

  logger.warn("notify.callback.whatsapp.verify_failed", { mode });
  return res.status(403).json({ ok: false, error: "Verification token mismatch" });
}

/**
 * POST /api/notifications/callbacks/whatsapp
 * Handles Meta Cloud API status updates and generic WhatsApp delivery callbacks.
 */
export async function handleWhatsAppCallback(req, res) {
  const body = req.body || {};

  // 1. Meta WhatsApp Cloud API payload format
  const entries = Array.isArray(body.entry) ? body.entry : [];
  const statusUpdates = [];

  for (const entry of entries) {
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change.value || {};
      const statuses = Array.isArray(value.statuses) ? value.statuses : [];
      for (const s of statuses) {
        statusUpdates.push({
          messageId: s.id,
          status: (s.status || "").toLowerCase(),
          timestamp: s.timestamp ? new Date(Number(s.timestamp) * 1000).toISOString() : new Date().toISOString(),
          errors: s.errors,
        });
      }
    }
  }

  // 2. Generic webhook payload format
  if (!statusUpdates.length) {
    const messageId = body.messageId || body.id || null;
    const rawStatus = (body.status || "").toLowerCase();
    const notificationId = body.notificationId || null;
    if (messageId || notificationId) {
      statusUpdates.push({
        messageId: messageId || notificationId,
        status: rawStatus,
        timestamp: new Date().toISOString(),
        errors: body.error ? [body.error] : null,
      });
    }
  }

  if (!statusUpdates.length) {
    return res.status(200).json({ ok: true, processed: 0 });
  }

  let updatedCount = 0;

  for (const update of statusUpdates) {
    const row = await findOutboxRow(update.messageId);
    if (!row) continue;

    const existingPayload = row.payload && typeof row.payload === "object" ? row.payload : {};
    const existingDelivery =
      existingPayload.delivery && typeof existingPayload.delivery === "object"
        ? existingPayload.delivery
        : {};

    if (update.status === "read") {
      await prisma.notificationOutbox.update({
        where: { id: row.id },
        data: {
          status: "READ",
          payload: {
            ...existingPayload,
            delivery: {
              ...existingDelivery,
              status: "READ",
              readAt: update.timestamp,
            },
          },
        },
      });
      updatedCount += 1;
    } else if (update.status === "delivered") {
      // Don't downgrade READ to DELIVERED
      if (row.status !== "READ") {
        await prisma.notificationOutbox.update({
          where: { id: row.id },
          data: {
            status: "DELIVERED",
            payload: {
              ...existingPayload,
              delivery: {
                ...existingDelivery,
                status: "DELIVERED",
                deliveredAt: update.timestamp,
              },
            },
          },
        });
        updatedCount += 1;
      }
    } else if (update.status === "failed") {
      await prisma.notificationOutbox.update({
        where: { id: row.id },
        data: {
          status: "FAILED",
          payload: {
            ...existingPayload,
            delivery: {
              ...existingDelivery,
              status: "FAILED",
              failedAt: update.timestamp,
            },
            deliveryError: {
              reason: `whatsapp_failed:${JSON.stringify(update.errors || "undelivered")}`,
              at: update.timestamp,
            },
          },
        },
      });
      updatedCount += 1;
    }
  }

  return res.status(200).json({ ok: true, processed: updatedCount });
}
