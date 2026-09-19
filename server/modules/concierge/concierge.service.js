/**
 * Traveller-owned autonomous concierge rules.
 */
import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import { writeAudit } from "../../lib/audit.js";
import { enqueueNotificationOutbox } from "../../lib/notifications/enqueue.js";
import { DEFAULT_PAGE_SIZE } from "../../lib/utils.js";
import { evaluateForWatch, evaluateRuleForEvent } from "./concierge.evaluate.js";

const RULE_SELECT = {
  id: true,
  userId: true,
  name: true,
  enabled: true,
  trigger: true,
  thresholdMinutes: true,
  action: true,
  maxAdditionalMinor: true,
  currency: true,
  notifyOnTrigger: true,
  disabledAt: true,
  createdAt: true,
  updatedAt: true,
};

const EXEC_SELECT = {
  id: true,
  ruleId: true,
  userId: true,
  bookingId: true,
  watchId: true,
  journeyEventId: true,
  idempotencyKey: true,
  status: true,
  reason: true,
  extraMinor: true,
  quoteBookingId: true,
  createdAt: true,
  updatedAt: true,
};

function publicRule(row) {
  if (!row) return row;
  return { ...row };
}

async function ownedRuleOrThrow(userId, ruleId) {
  const row = await prisma.conciergeRule.findUnique({
    where: { id: ruleId },
    select: RULE_SELECT,
  });
  if (!row || row.userId !== userId) {
    throw new AppError(404, "Concierge rule not found");
  }
  return row;
}

async function notifyRuleToggle(userId, rule, enabled) {
  if (!rule.notifyOnTrigger && enabled) return;
  await enqueueNotificationOutbox([
    {
      userId,
      channel: "APP",
      dedupeKey: `concierge.rule.${enabled ? "enabled" : "disabled"}:${rule.id}:APP`,
      title: enabled ? "Autonomous concierge rule on" : "Autonomous concierge rule off",
      body: enabled
        ? `“${rule.name}” can act when its travel conditions are met.`
        : `“${rule.name}” will not take autonomous actions.`,
      payload: { kind: enabled ? "concierge.rule.enabled" : "concierge.rule.disabled", ruleId: rule.id },
    },
  ]);
}

export { evaluateForWatch, evaluateRuleForEvent };

export async function createRule(userId, body) {
  if (!userId) throw new AppError(401, "Authentication required");
  const maxAdditionalMinor = Number(body.maxAdditionalMinor);
  if (!Number.isInteger(maxAdditionalMinor) || maxAdditionalMinor < 0) {
    throw new AppError(400, "maxAdditionalMinor must be a non-negative integer");
  }
  const thresholdMinutes =
    body.thresholdMinutes == null || body.thresholdMinutes === ""
      ? null
      : Number(body.thresholdMinutes);
  if (thresholdMinutes != null && (!Number.isInteger(thresholdMinutes) || thresholdMinutes < 0)) {
    throw new AppError(400, "thresholdMinutes must be a non-negative integer");
  }

  const row = await prisma.conciergeRule.create({
    data: {
      userId,
      name: String(body.name).trim(),
      enabled: body.enabled !== false,
      trigger: body.trigger,
      thresholdMinutes,
      action: body.action,
      maxAdditionalMinor,
      currency: (body.currency || "PKR").toUpperCase(),
      notifyOnTrigger: body.notifyOnTrigger !== false,
    },
    select: RULE_SELECT,
  });

  await writeAudit({
    userId,
    action: "concierge.rule.create",
    resourceType: "ConciergeRule",
    resourceId: row.id,
    metadata: {
      trigger: row.trigger,
      action: row.action,
      maxAdditionalMinor: row.maxAdditionalMinor,
      enabled: row.enabled,
    },
  }).catch(() => {});

  if (row.enabled) await notifyRuleToggle(userId, row, true);
  return publicRule(row);
}

export async function listRules(userId) {
  if (!userId) throw new AppError(401, "Authentication required");
  const items = await prisma.conciergeRule.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: RULE_SELECT,
  });
  return { items: items.map(publicRule) };
}

export async function getRule(userId, ruleId) {
  return publicRule(await ownedRuleOrThrow(userId, ruleId));
}

export async function updateRule(userId, ruleId, body) {
  const existing = await ownedRuleOrThrow(userId, ruleId);
  const data = {};
  if (body.name != null) data.name = String(body.name).trim();
  if (body.trigger != null) data.trigger = body.trigger;
  if (body.action != null) data.action = body.action;
  if (body.currency != null) data.currency = String(body.currency).toUpperCase();
  if (body.notifyOnTrigger != null) data.notifyOnTrigger = Boolean(body.notifyOnTrigger);
  if (body.thresholdMinutes !== undefined) {
    if (body.thresholdMinutes == null || body.thresholdMinutes === "") {
      data.thresholdMinutes = null;
    } else {
      const n = Number(body.thresholdMinutes);
      if (!Number.isInteger(n) || n < 0) {
        throw new AppError(400, "thresholdMinutes must be a non-negative integer");
      }
      data.thresholdMinutes = n;
    }
  }
  if (body.maxAdditionalMinor != null) {
    const n = Number(body.maxAdditionalMinor);
    if (!Number.isInteger(n) || n < 0) {
      throw new AppError(400, "maxAdditionalMinor must be a non-negative integer");
    }
    data.maxAdditionalMinor = n;
  }
  if (body.enabled != null) {
    data.enabled = Boolean(body.enabled);
    data.disabledAt = data.enabled ? null : new Date();
  }

  const row = await prisma.conciergeRule.update({
    where: { id: existing.id },
    data,
    select: RULE_SELECT,
  });

  await writeAudit({
    userId,
    action: data.enabled === false ? "concierge.rule.disable" : "concierge.rule.update",
    resourceType: "ConciergeRule",
    resourceId: row.id,
    metadata: { fields: Object.keys(data), enabled: row.enabled },
  }).catch(() => {});

  if (body.enabled === false && existing.enabled) await notifyRuleToggle(userId, row, false);
  if (body.enabled === true && !existing.enabled) await notifyRuleToggle(userId, row, true);
  return publicRule(row);
}

export async function disableRule(userId, ruleId) {
  return updateRule(userId, ruleId, { enabled: false });
}

export async function killSwitch(userId) {
  if (!userId) throw new AppError(401, "Authentication required");
  const result = await prisma.conciergeRule.updateMany({
    where: { userId, enabled: true },
    data: { enabled: false, disabledAt: new Date() },
  });
  await writeAudit({
    userId,
    action: "concierge.kill_switch",
    resourceType: "ConciergeRule",
    resourceId: userId,
    metadata: { disabledCount: result.count },
  }).catch(() => {});
  await enqueueNotificationOutbox([
    {
      userId,
      channel: "APP",
      dedupeKey: `concierge.kill_switch:${userId}:${Date.now()}`,
      title: "Autonomous concierge disabled",
      body: "All autonomous travel rules for your account are now off.",
      payload: { kind: "concierge.kill_switch", disabledCount: result.count },
    },
  ]);
  return { disabledCount: result.count };
}

export async function listActivity(userId, { page, pageSize } = {}) {
  if (!userId) throw new AppError(401, "Authentication required");
  const take = Math.min(pageSize || DEFAULT_PAGE_SIZE, 100);
  const currentPage = page || 1;
  const skip = (currentPage - 1) * take;
  const [items, total] = await Promise.all([
    prisma.conciergeExecution.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: EXEC_SELECT,
    }),
    prisma.conciergeExecution.count({ where: { userId } }),
  ]);
  return {
    items,
    page: currentPage,
    pageSize: take,
    total,
  };
}
