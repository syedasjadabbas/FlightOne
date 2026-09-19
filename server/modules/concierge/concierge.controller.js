import { successResponse } from "../../lib/response.js";
import * as concierge from "./concierge.service.js";

function handle(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (e) {
      next(e);
    }
  };
}

export const createRule = handle(async (req, res) => {
  const data = await concierge.createRule(req.user.id, req.body);
  return successResponse(res, "Rule created", data, 201);
});

export const listRules = handle(async (req, res) => {
  const data = await concierge.listRules(req.user.id);
  return successResponse(res, "OK", data);
});

export const getRule = handle(async (req, res) => {
  const data = await concierge.getRule(req.user.id, req.params.ruleId);
  return successResponse(res, "OK", data);
});

export const updateRule = handle(async (req, res) => {
  const data = await concierge.updateRule(req.user.id, req.params.ruleId, req.body);
  return successResponse(res, "Rule updated", data);
});

export const disableRule = handle(async (req, res) => {
  const data = await concierge.disableRule(req.user.id, req.params.ruleId);
  return successResponse(res, "Rule disabled", data);
});

export const killSwitch = handle(async (req, res) => {
  const data = await concierge.killSwitch(req.user.id);
  return successResponse(res, "Autonomous concierge disabled", data);
});

export const listActivity = handle(async (req, res) => {
  const data = await concierge.listActivity(req.user.id, req.query);
  return successResponse(res, "OK", data);
});
