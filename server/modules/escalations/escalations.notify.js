/**
 * Module 13 — NotificationOutbox fan-out (deduped).
 * Reuses shared enqueue — never a parallel notification system.
 */
import prisma from "../../config/prisma.js";
import { enqueueNotificationOutbox } from "../../lib/notifications/enqueue.js";

const CUSTOMER_CHANNELS = ["APP", "EMAIL"];
const OPS_CHANNELS = ["APP", "EMAIL"];

/** Users with ops:escalations:read (consultants / ops). */
export async function listEscalationOpsUserIds() {
  const rows = await prisma.userRole.findMany({
    where: {
      role: {
        permissions: {
          some: { permission: { key: "ops:escalations:read" } },
        },
      },
    },
    select: { userId: true },
  });
  return [...new Set(rows.map((r) => r.userId).filter(Boolean))];
}

export async function notifyEscalationCreated(ticket) {
  const rows = [];
  for (const channel of CUSTOMER_CHANNELS) {
    rows.push({
      userId: ticket.userId,
      channel,
      dedupeKey: `escalation:created:${ticket.id}:${channel}`,
      title: "Human consultant requested",
      body: "Your conversation was handed to a FlightOne consultant. A team member will follow up — this confirms the request only, not an assignment yet.",
      payload: {
        module: "escalations",
        escalationId: ticket.id,
        conversationId: ticket.conversationId,
        trigger: ticket.trigger,
        status: ticket.status,
      },
    });
  }

  const opsIds = (await listEscalationOpsUserIds()).filter((id) => id !== ticket.userId);
  for (const userId of opsIds) {
    for (const channel of OPS_CHANNELS) {
      rows.push({
        userId,
        channel,
        dedupeKey: `escalation:ops:new:${ticket.id}:${userId}:${channel}`,
        title: "New escalation in queue",
        body: `New ${ticket.trigger} escalation (${ticket.id.slice(0, 8)}…). Priority ${ticket.priority}.`,
        payload: {
          module: "escalations",
          escalationId: ticket.id,
          conversationId: ticket.conversationId,
          trigger: ticket.trigger,
          status: ticket.status,
        },
      });
    }
  }

  return enqueueNotificationOutbox(rows);
}

export async function notifyEscalationStatusChange(ticket, { event }) {
  const rows = [];
  const titleByEvent = {
    ASSIGNED: "Consultant assigned",
    IN_PROGRESS: "Consultant is working on your case",
    RESOLVED: "Escalation resolved",
    CANCELLED: "Escalation cancelled",
  };
  const bodyByEvent = {
    ASSIGNED:
      "A FlightOne consultant has been assigned to your handoff. They can see your full AI conversation history.",
    IN_PROGRESS: "A consultant has started working on your escalation.",
    RESOLVED: ticket.resolutionNote
      ? `Your escalation was resolved: ${String(ticket.resolutionNote).slice(0, 280)}`
      : "Your escalation was marked resolved.",
    CANCELLED: "Your escalation was cancelled.",
  };
  const title = titleByEvent[event] || "Escalation update";
  const body = bodyByEvent[event] || `Escalation status is now ${ticket.status}.`;

  for (const channel of CUSTOMER_CHANNELS) {
    rows.push({
      userId: ticket.userId,
      channel,
      dedupeKey: `escalation:${event.toLowerCase()}:${ticket.id}:${channel}`,
      title,
      body,
      payload: {
        module: "escalations",
        escalationId: ticket.id,
        conversationId: ticket.conversationId,
        trigger: ticket.trigger,
        status: ticket.status,
        event,
      },
    });
  }
  return enqueueNotificationOutbox(rows);
}
