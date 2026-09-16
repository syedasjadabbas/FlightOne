#!/usr/bin/env node
/**
 * Module 09 — Live Journey Management background worker (one-shot).
 * Never fabricates status — pollWatch uses the configured provider (fail-closed).
 */
import { runOneShotWorker } from "../lib/runOneShotWorker.js";

const CONCURRENCY = Number(process.env.JOURNEY_WORKER_CONCURRENCY) || 3;
const BATCH_SIZE = Number(process.env.JOURNEY_WORKER_BATCH_SIZE) || 200;

void runOneShotWorker("journey.worker", async ({ prisma, logger, shouldStop }) => {
  if (shouldStop()) return;

  const { pollWatch } = await import("../modules/journey/journey.service.js");
  const {
    filterDueWatches,
    workerWindowCutoffs,
    mapLimit,
  } = await import("../modules/journey/journey.workerSelect.js");

  const now = new Date();
  const { cooldownCutoff, lookaheadCutoff, lookbehindCutoff } = workerWindowCutoffs(now);

  const candidates = await prisma.journeyWatch.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { departAt: null },
        {
          AND: [
            { departAt: { gte: lookbehindCutoff } },
            { departAt: { lte: lookaheadCutoff } },
          ],
        },
      ],
    },
    select: { id: true, bookingId: true, flightNumber: true, lastPolledAt: true },
    take: BATCH_SIZE,
    orderBy: { lastPolledAt: "asc" },
  });

  const due = filterDueWatches(candidates, cooldownCutoff);

  if (due.length === 0 || shouldStop()) {
    logger.info("journey.worker.done", {
      candidates: candidates.length,
      polled: 0,
      events: 0,
      aborted: shouldStop(),
    });
    return;
  }

  let eventsDetected = 0;
  let polled = 0;
  await mapLimit(due, CONCURRENCY, async (watch) => {
    if (shouldStop()) return;
    try {
      const result = await pollWatch(watch.id);
      polled += 1;
      if (result.event || (result.events && result.events.length)) {
        eventsDetected += result.events?.length || (result.event ? 1 : 0);
      }
      logger.info("journey.worker.polled", {
        watchId: watch.id,
        bookingId: watch.bookingId,
        dataStatus: result.dataStatus,
        eventDetected: Boolean(result.event) || (result.events?.length ?? 0) > 0,
        eventTypes: (result.events || []).map((e) => e.type),
      });
    } catch (e) {
      logger.error("journey.worker.poll_failed", { watchId: watch.id, err: e?.message });
    }
  });

  logger.info("journey.worker.done", {
    candidates: candidates.length,
    polled,
    events: eventsDetected,
    aborted: shouldStop(),
  });
});
