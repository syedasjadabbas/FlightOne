import { successResponse } from "../../lib/response.js";
import * as operationsService from "./operations.service.js";

export async function overview(req, res, next) {
  try {
    const data = await operationsService.getOperationsOverview();
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function integrations(req, res, next) {
  try {
    const data = await operationsService.getIntegrationStatus();
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function drainOutbox(req, res, next) {
  try {
    const data = await operationsService.drainOutbox({
      ...req.body,
      actorUserId: req.user?.id,
    });
    return successResponse(res, "Outbox drained", data);
  } catch (e) {
    next(e);
  }
}

export async function retryOutbox(req, res, next) {
  try {
    const data = await operationsService.retryFailedOutbox({
      ...req.body,
      actorUserId: req.user?.id,
    });
    return successResponse(res, "Failed outbox retried", data);
  } catch (e) {
    next(e);
  }
}

export async function listOutbox(req, res, next) {
  try {
    const data = await operationsService.listOutbox(req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function listAccounting(req, res, next) {
  try {
    const data = await operationsService.listAccounting(req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function finance(req, res, next) {
  try {
    const data = await operationsService.getFinanceSnapshot(req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function listCommissions(req, res, next) {
  try {
    const data = await operationsService.listCommissions(req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function reconcile(req, res, next) {
  try {
    const data = await operationsService.createReconciliationItem({
      ...req.body,
      actorUserId: req.user?.id,
    });
    return successResponse(res, "Reconciliation item recorded", data, 201);
  } catch (e) {
    next(e);
  }
}

export async function listReconciliation(req, res, next) {
  try {
    const data = await operationsService.listReconciliation(req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function listAudit(req, res, next) {
  try {
    const data = await operationsService.listAuditLog(req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function avaGuidance(req, res, next) {
  try {
    const data = await operationsService.buildAvaOperationsGuidance(
      req.user.id,
      req.query.bookingId,
    );
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}
