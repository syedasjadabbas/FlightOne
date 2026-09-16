/**
 * Module 11 — group NotificationOutbox fan-out (deduped).
 * Reuses shared enqueue — never a parallel notification system.
 * Member ID resolution lives in groups.service (Prisma there).
 */
import { enqueueNotificationOutbox } from "../../lib/notifications/enqueue.js";

const DEFAULT_CHANNELS = ["APP", "EMAIL", "WHATSAPP"];

export async function notifyGroupMembers({
  groupId,
  memberUserIds,
  dedupeKeyPrefix,
  title,
  body,
  payload = {},
  channels = DEFAULT_CHANNELS,
}) {
  const ids = [...new Set((memberUserIds || []).filter(Boolean))];
  if (!ids.length) return { enqueued: 0 };

  const rows = [];
  for (const userId of ids) {
    for (const channel of channels) {
      rows.push({
        userId,
        channel,
        dedupeKey: `${dedupeKeyPrefix}:${userId}:${channel}`,
        title,
        body,
        payload: { module: "groups", groupId, ...payload },
      });
    }
  }

  return enqueueNotificationOutbox(rows);
}
