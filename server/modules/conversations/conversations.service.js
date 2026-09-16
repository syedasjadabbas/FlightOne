/**
 * Module 01 — AI Travel Consultant: conversation persistence.
 *
 * Persists conversation threads + messages server-side so they are resumable
 * across sessions/devices (per docs/modules/01-ai-travel-consultant.md,
 * "Conversation core" checklist). The actual LLM orchestration still lives
 * client-side in flight-one/lib/consultant/* for now — `generateAssistantReply`
 * below is an intentional stub, not a real model call, until that logic moves
 * server-side.
 */
import prisma from "../../config/prisma.js";
import { AppError } from "../../lib/customError.js";
import { DEFAULT_PAGE_SIZE } from "../../lib/utils.js";
import * as escalationsService from "../escalations/escalations.service.js";
import { retrieveKnowledge } from "../knowledge/knowledge.service.js";

const MAX_PAGE_SIZE = 100;

const CONVERSATION_LIST_SELECT = {
  id: true,
  title: true,
  status: true,
  createdAt: true,
  updatedAt: true,
};

const CONVERSATION_DETAIL_SELECT = {
  id: true,
  userId: true,
  title: true,
  status: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
};

const MESSAGE_SELECT = {
  id: true,
  conversationId: true,
  role: true,
  content: true,
  offers: true,
  provider: true,
  createdAt: true,
};

const STUB_ASSISTANT_REPLY =
  "Thanks for sharing that! I'm still learning the ropes here — a travel " +
  "consultant will pick this up shortly. In the meantime, feel free to add your " +
  "origin, destination, travel dates, and number of travellers so we can move faster.";

/**
 * Module 01 checklist stub: for now this returns a fixed, helpful string and
 * does not call any LLM/HTTP provider. Swap the body for a real orchestrator
 * call once the AI layer moves server-side — signature should stay stable.
 *
 * Module 16 hook point: grounds the stub reply against the AI Knowledge
 * Platform (modules/knowledge/knowledge.service.js#retrieveKnowledge) so
 * even this placeholder never presents policy/fare/visa-shaped content
 * without a traceable source (dev guide §7 / module 16 doc, "must not
 * present an answer ... that isn't traceable to a retrieved source").
 * When coverage is "none" no sources exist to append, so the reply is left
 * untouched. A real orchestrator replacing this stub should call
 * `retrieveKnowledge` the same way before answering grounded questions.
 */
export async function generateAssistantReply(_conversationId, userContent) {
  let sources = null;
  try {
    const { hits, coverage } = await retrieveKnowledge({ query: userContent, limit: 3 });
    if (coverage !== "none" && hits.length > 0) {
      sources = hits.map((h) => ({
        documentId: h.documentId,
        title: h.title,
        category: h.category,
        lastVerifiedAt: h.lastVerifiedAt,
        score: h.score,
      }));
    }
  } catch {
    // Best-effort grounding for this stub reply — a knowledge-store issue
    // must never break the conversation flow (this is still just a stub).
  }

  const content = sources
    ? `${STUB_ASSISTANT_REPLY}\n\nSources:\n${sources.map((s) => `- ${s.title} (${s.category})`).join("\n")}`
    : STUB_ASSISTANT_REPLY;

  return { content, provider: "stub", offers: null, sources };
}

async function findOwnedConversationOrThrow(userId, conversationId, select) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
    select,
  });
  if (!conversation) {
    throw new AppError(404, "Conversation not found");
  }
  return conversation;
}

export async function createConversation(userId, { title } = {}) {
  return prisma.conversation.create({
    data: {
      userId,
      title: title ?? null,
    },
    select: CONVERSATION_DETAIL_SELECT,
  });
}

export async function listConversations(userId, { page, pageSize } = {}) {
  const take = Math.min(pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const currentPage = page || 1;
  const skip = (currentPage - 1) * take;

  const [items, total] = await Promise.all([
    prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      skip,
      take,
      select: CONVERSATION_LIST_SELECT,
    }),
    prisma.conversation.count({ where: { userId } }),
  ]);

  return {
    items,
    page: currentPage,
    pageSize: take,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / take),
  };
}

export async function getConversationById(userId, conversationId) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
    select: {
      ...CONVERSATION_DETAIL_SELECT,
      messages: {
        orderBy: { createdAt: "asc" },
        select: MESSAGE_SELECT,
      },
    },
  });
  if (!conversation) {
    throw new AppError(404, "Conversation not found");
  }
  return conversation;
}

export async function addMessage(userId, conversationId, content) {
  await findOwnedConversationOrThrow(userId, conversationId, { id: true });

  const userMessage = await prisma.message.create({
    data: {
      conversationId,
      role: "USER",
      content,
    },
    select: MESSAGE_SELECT,
  });

  const reply = await generateAssistantReply(conversationId, content);

  const assistantMessage = await prisma.message.create({
    data: {
      conversationId,
      role: "ASSISTANT",
      content: reply.content,
      provider: reply.provider ?? "stub",
      offers: reply.offers ?? null,
    },
    select: MESSAGE_SELECT,
  });

  // Bump updatedAt so `GET /` (ordered by updatedAt desc) surfaces recently
  // active threads first.
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {},
  });

  return { userMessage, assistantMessage };
}

/**
 * Append messages already produced by the FlightOne Next.js chat orchestrator.
 * Does NOT generate a stub assistant reply — ownership scoped to userId.
 * Optional travelPlan is merged into conversation.metadata for cross-device resume.
 */
export async function recordMessages(userId, conversationId, messages, travelPlan) {
  await findOwnedConversationOrThrow(userId, conversationId, { id: true });

  const created = [];
  for (const msg of messages) {
    const row = await prisma.message.create({
      data: {
        conversationId,
        role: msg.role,
        content: msg.content,
        provider: msg.provider ?? null,
        offers: null,
      },
      select: MESSAGE_SELECT,
    });
    created.push(row);
  }

  const existing = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { metadata: true },
  });
  const prevMeta =
    existing?.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
      ? existing.metadata
      : {};

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      ...(travelPlan !== undefined
        ? {
            metadata: {
              ...prevMeta,
              travelPlan: travelPlan ?? null,
              travelPlanUpdatedAt: new Date().toISOString(),
            },
          }
        : {}),
    },
  });

  return { messages: created };
}

/**
 * Module 13 — Human Agent Escalation entry point for the customer-initiated
 * "talk to a human" trigger. Ownership of the escalation record itself
 * (EscalationTicket, zero-context-loss snapshot, consultant queue) lives in
 * modules/escalations/ — this just verifies the caller owns the conversation
 * and delegates to the shared trigger choke point so every escalation
 * source (this one, VIP/complex-itinerary/etc. detection, Module 05's
 * AI-discount-limit trigger) builds the same kind of ticket the same way.
 */
export async function escalateConversation(userId, conversationId, note) {
  await findOwnedConversationOrThrow(userId, conversationId, { id: true });

  const escalation = await escalationsService.createEscalationFromTrigger({
    conversationId,
    userId,
    trigger: "CUSTOMER_REQUEST",
    extraContext: note ? { customerNote: note } : undefined,
  });

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: CONVERSATION_DETAIL_SELECT,
  });

  return { conversation, escalation };
}
