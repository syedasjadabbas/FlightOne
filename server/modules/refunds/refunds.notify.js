/**
 * Module 14 — NotificationOutbox fan-out (deduped).
 */
import { enqueueNotificationOutbox } from "../../lib/notifications/enqueue.js";

const CHANNELS = ["APP", "EMAIL"];

export async function notifyServicingUsers({
  userIds,
  dedupeKeyPrefix,
  title,
  body,
  payload = {},
}) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return { enqueued: 0 };
  const rows = [];
  for (const userId of ids) {
    for (const channel of CHANNELS) {
      rows.push({
        userId,
        channel,
        dedupeKey: `${dedupeKeyPrefix}:${userId}:${channel}`,
        title,
        body,
        payload: { module: "refunds", ...payload },
      });
    }
  }
  return enqueueNotificationOutbox(rows);
}
