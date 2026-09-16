/**
 * Shared NotificationOutbox enqueue (deduped via @@unique([dedupeKey, channel])).
 * Domain modules build rows; this helper only persists them.
 * Never invents recipients, titles, or payloads.
 */
import prisma from "../../config/prisma.js";

/**
 * @param {Array<{
 *   userId: string,
 *   channel: string,
 *   dedupeKey: string,
 *   title: string,
 *   body: string,
 *   payload?: object,
 *   status?: string,
 *   scheduledAt?: Date | null,
 * }>} rows
 * @returns {Promise<{ enqueued: number }>}
 */
export async function enqueueNotificationOutbox(rows) {
  const data = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (!data.length) return { enqueued: 0 };
  try {
    const result = await prisma.notificationOutbox.createMany({
      data,
      skipDuplicates: true,
    });
    return { enqueued: result.count ?? 0 };
  } catch {
    return { enqueued: 0 };
  }
}
