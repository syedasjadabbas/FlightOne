/**
 * Module 12 — MICE NotificationOutbox fan-out (deduped).
 */
import { enqueueNotificationOutbox } from "../../lib/notifications/enqueue.js";

export async function notifyMiceUsers({
  userIds,
  dedupeKeyPrefix,
  title,
  body,
  payload = {},
  channels = ["APP", "EMAIL"],
}) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
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
        payload: { module: "mice", ...payload },
      });
    }
  }
  return enqueueNotificationOutbox(rows);
}
