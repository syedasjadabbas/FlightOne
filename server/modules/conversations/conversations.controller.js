import { successResponse } from "../../lib/response.js";
import * as conversationsService from "./conversations.service.js";

export async function create(req, res, next) {
  try {
    const data = await conversationsService.createConversation(req.user.id, req.body);
    return successResponse(res, "Conversation created", data, 201);
  } catch (e) {
    next(e);
  }
}

export async function list(req, res, next) {
  try {
    const data = await conversationsService.listConversations(req.user.id, req.query);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function getById(req, res, next) {
  try {
    const data = await conversationsService.getConversationById(req.user.id, req.params.id);
    return successResponse(res, "OK", data);
  } catch (e) {
    next(e);
  }
}

export async function addMessage(req, res, next) {
  try {
    const data = await conversationsService.addMessage(
      req.user.id,
      req.params.id,
      req.body.content,
    );
    return successResponse(res, "Message sent", data, 201);
  } catch (e) {
    next(e);
  }
}

export async function recordMessages(req, res, next) {
  try {
    const data = await conversationsService.recordMessages(
      req.user.id,
      req.params.id,
      req.body.messages,
      req.body.travelPlan,
      req.body.searchPanel,
    );
    return successResponse(res, "Messages recorded", data, 201);
  } catch (e) {
    next(e);
  }
}

export async function escalate(req, res, next) {
  try {
    const data = await conversationsService.escalateConversation(
      req.user.id,
      req.params.id,
      req.body.note,
    );
    return successResponse(res, "Conversation escalated", data);
  } catch (e) {
    next(e);
  }
}

export async function remove(req, res, next) {
  try {
    const data = await conversationsService.deleteConversation(req.user.id, req.params.id);
    return successResponse(res, "Conversation deleted", data);
  } catch (e) {
    next(e);
  }
}

