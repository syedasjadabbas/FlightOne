/**
 * Travelport TripServices Queues integration.
 * Used for reading PNR queues: schedule changes, ticketing time limit (TTL) alerts, waitlists.
 *
 * GET /air/queue/queues
 * GET /queue/queues/{queueNumber}
 */
import { randomUUID } from "node:crypto";
import { isTravelportConfigured } from "./config.js";
import { travelportFetch } from "./http.js";

/**
 * Read items from a GDS queue.
 *
 * @param {{
 *   queueNumber?: number | string,
 *   category?: string,
 *   pcc?: string,
 * }} [opts]
 * @returns {Promise<{
 *   status: "ok"|"unconfigured"|"failed",
 *   queueNumber?: number | string,
 *   items?: Array<{
 *     locator: string,
 *     reason: "TKTL"|"SC"|"WL"|"OTHER",
 *     placedAt: string,
 *     details?: string,
 *   }>,
 *   details?: object,
 * }>}
 */
export async function readTravelportQueue(opts = {}) {
  const queueNumber = opts.queueNumber ?? 1;

  if (!isTravelportConfigured()) {
    return {
      status: "unconfigured",
      queueNumber,
      items: [],
      details: { reason: "Travelport unconfigured — empty queue returned" },
    };
  }

  const traceId = `fo-q-${randomUUID()}`;
  try {
    const res = await travelportFetch(`/air/queue/queues/${encodeURIComponent(String(queueNumber))}`, {
      method: "GET",
      traceId,
      allowHttpError: true,
    });

    if (res.status >= 200 && res.status < 300 && res.json) {
      const rawItems = res.json?.QueueResponse?.QueueItem || res.json?.QueueItem || [];
      const items = (Array.isArray(rawItems) ? rawItems : [rawItems]).map((it) => ({
        locator: it.Locator?.value || it.locator || "",
        reason: it.reasonCode || it.Category || "OTHER",
        placedAt: it.placedAt || it.timestamp || new Date().toISOString(),
        details: it.description || null,
      }));

      return {
        status: "ok",
        queueNumber,
        items,
        details: { traceId, source: "travelport" },
      };
    }

    return {
      status: "failed",
      details: { reason: res.error || "Travelport queue read failed", traceId },
    };
  } catch (err) {
    return {
      status: "failed",
      details: { reason: err?.message || "Travelport queue read error", traceId },
    };
  }
}

/**
 * Get count of PNRs in a queue.
 *
 * @param {{ queueNumber?: number | string }} [opts]
 */
export async function countTravelportQueue(opts = {}) {
  const q = await readTravelportQueue(opts);
  if (q.status === "ok") {
    return { status: "ok", count: q.items?.length ?? 0 };
  }
  return { status: q.status, count: 0, details: q.details };
}
