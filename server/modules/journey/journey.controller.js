import { successResponse } from "../../lib/response.js";
import * as journeyService from "./journey.service.js";

export async function getCapability(_req, res, next) {
  try {
    const data = journeyService.getJourneyCapability();
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function createWatch(req, res, next) {
  try {
    const data = await journeyService.ensureWatchForBooking({
      ...req.body,
      userId: req.user.id,
    });
    return successResponse(res, "Journey watch created", data, 201);
  } catch (e) {
    next(e);
  }
}

export async function listWatches(req, res, next) {
  try {
    const data = await journeyService.listWatchesForUser(req.user.id, req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function getWatch(req, res, next) {
  try {
    const data = await journeyService.getWatchForUser(
      req.user.id,
      req.params.id,
      req.permissions,
    );
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function listEvents(req, res, next) {
  try {
    const data = await journeyService.listEventsForWatch(
      req.user.id,
      req.params.id,
      req.query,
      req.permissions,
    );
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function poll(req, res, next) {
  try {
    await journeyService.getOwnedWatchOrThrow(
      req.user.id,
      req.params.id,
      { id: true },
      req.permissions,
    );
    const data = await journeyService.pollWatch(req.params.id);
    return successResponse(res, "Polled", data);
  } catch (e) {
    next(e);
  }
}

export async function alternatives(req, res, next) {
  try {
    const data = await journeyService.discoverDisruptionAlternatives(
      req.user.id,
      req.params.id,
      req.permissions,
    );
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function rebookHandoff(req, res, next) {
  try {
    const data = await journeyService.prepareRebookingHandoff(
      req.user.id,
      req.params.id,
      req.body,
      req.permissions,
    );
    return successResponse(res, "Handoff prepared", data);
  } catch (e) {
    next(e);
  }
}

export async function escalate(req, res, next) {
  try {
    const data = await journeyService.escalateJourneyDisruption({
      userId: req.user.id,
      watchId: req.params.id,
      conversationId: req.body?.conversationId,
      reason: req.body?.reason,
      req,
    });
    return successResponse(res, "Escalation recorded", data);
  } catch (e) {
    next(e);
  }
}

export async function drainNotifications(req, res, next) {
  try {
    const data = await journeyService.drainNotifications(req.body?.limit);
    return successResponse(res, "Drained", data);
  } catch (e) {
    next(e);
  }
}

export async function listNotifications(req, res, next) {
  try {
    const data = await journeyService.listNotificationsForUser(req.user.id, req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}
