/**
 * Best-effort chat persistence for authenticated users.
 * Uses RTK Query (baseApi) against Express `/api/v1/conversations` + escalations.
 * Never throws into the chat UX. SSE/streaming remains separate (not via RTK).
 */
import { store } from "@/lib/api/store";
import { conversationsApi } from "@/lib/api/conversations.api";
import { escalationsApi, type EscalationTrigger } from "@/lib/api/escalations.api";
import type { UiMessage } from "@/app/components/chat.types";
import { parseTravelPlan, type TravelPlan } from "@/lib/consultant/travelPlan";
import type { SearchResultsPanel } from "./types";

async function rtkSafe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

/**
 * In-flight create, so concurrent callers share one request.
 *
 * The `existingId` guard alone is not enough: the caller only learns the new id
 * after this resolves, so two calls in the same tick both see `null` and both
 * POST — producing two conversations for one chat. Cleared on settle so a new
 * chat (or a failed create) can start a fresh one.
 */
let creating: Promise<string | null> | null = null;

export async function ensureConversationId(
  existingId: string | null,
  title?: string,
): Promise<string | null> {
  if (existingId) return existingId;
  if (creating) return creating;

  creating = rtkSafe(
    store
      .dispatch(
        conversationsApi.endpoints.createConversation.initiate(
          { title: title || "FlightOne chat" },
          { track: false },
        ),
      )
      .unwrap(),
  ).then((created) => created?.id ?? null);

  try {
    return await creating;
  } finally {
    creating = null;
  }
}

/** Module 13 — request human handoff for an owned conversation. */
export async function requestConversationEscalation(
  conversationId: string,
  opts?: { trigger?: string; note?: string; bookingId?: string },
): Promise<{
  id: string;
  status: string;
  trigger: string;
  deduplicated?: boolean;
} | null> {
  return rtkSafe(
    store
      .dispatch(
        escalationsApi.endpoints.requestEscalation.initiate(
          {
            conversationId,
            ...(opts?.trigger ? { trigger: opts.trigger as EscalationTrigger } : {}),
            ...(opts?.note ? { note: opts.note } : {}),
            ...(opts?.bookingId ? { bookingId: opts.bookingId } : {}),
          },
          { track: false },
        ),
      )
      .unwrap(),
  );
}

/** Persist a single assistant message (e.g. after escalation handoff). */
export async function recordAssistantMessage(
  conversationId: string,
  content: string,
  provider?: string | null,
): Promise<boolean> {
  if (!content.trim()) return false;
  const result = await rtkSafe(
    store
      .dispatch(
        conversationsApi.endpoints.recordConversationMessages.initiate(
          {
            conversationId,
            messages: [
              {
                role: "ASSISTANT" as const,
                content,
                provider: provider ?? "flightone",
              },
            ],
          },
          { track: false },
        ),
      )
      .unwrap(),
  );
  return Boolean(result);
}

export async function recordTurnMessages(
  conversationId: string,
  userContent: string,
  assistantContent: string,
  provider?: string | null,
  travelPlan?: unknown,
  searchPanel?: unknown,
): Promise<boolean> {
  const messages = [
    { role: "USER" as const, content: userContent },
    {
      role: "ASSISTANT" as const,
      content: assistantContent,
      provider: provider ?? "flightone",
    },
  ];
  const result = await rtkSafe(
    store
      .dispatch(
        conversationsApi.endpoints.recordConversationMessages.initiate(
          {
            conversationId,
            messages,
            ...(travelPlan !== undefined ? { travelPlan } : {}),
            ...(searchPanel !== undefined ? { searchPanel } : {}),
          },
          { track: false },
        ),
      )
      .unwrap(),
  );
  return Boolean(result);
}

export async function recordGuestHandoffMessages(
  conversationId: string,
  messages: UiMessage[],
  searchPanel?: unknown,
): Promise<boolean> {
  const payload = messages
    .filter((m) => m.id !== "greet" && m.content.trim())
    .map((m) => ({
      role: (m.role === "user" ? "USER" : "ASSISTANT") as "USER" | "ASSISTANT",
      content: m.content,
      provider: m.provider ?? null,
    }));
  if (payload.length === 0) return true;
  const result = await rtkSafe(
    store
      .dispatch(
        conversationsApi.endpoints.recordConversationMessages.initiate(
          {
            conversationId,
            messages: payload,
            ...(searchPanel !== undefined ? { searchPanel } : {}),
          },
          { track: false },
        ),
      )
      .unwrap(),
  );
  return Boolean(result);
}

type ConversationSummary = {
  id: string;
  title: string | null;
  updatedAt: string;
};

type ConversationDetail = ConversationSummary & {
  metadata?: unknown;
  messages?: Array<{
    id: string;
    role: "USER" | "ASSISTANT" | "SYSTEM" | "AGENT";
    content: string;
    provider: string | null;
    createdAt: string;
  }>;
};

export type ConversationResume = {
  conversationId: string;
  messages: UiMessage[];
  travelPlan: TravelPlan | null;
  searchPanel?: SearchResultsPanel | null;
};

/** Coerce opaque conversation.metadata.travelPlan into a validated TravelPlan. */
export function travelPlanFromConversationMetadata(
  metadata: unknown,
): TravelPlan | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const raw = (metadata as { travelPlan?: unknown }).travelPlan;
  if (raw == null) return null;
  try {
    return parseTravelPlan(JSON.stringify(raw));
  } catch {
    return null;
  }
}

/** Coerce opaque conversation.metadata.searchPanel into SearchResultsPanel if valid. */
export function searchPanelFromConversationMetadata(
  metadata: unknown,
): SearchResultsPanel | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const raw = (metadata as { searchPanel?: unknown }).searchPanel;
  if (!raw || typeof raw !== "object") return null;
  return raw as SearchResultsPanel;
}

export function uiMessagesFromConversationDetail(detail: {
  messages?: ConversationDetail["messages"];
}): UiMessage[] {
  const rows = detail.messages ?? [];
  return rows
    .filter((m) => m.role === "USER" || m.role === "ASSISTANT")
    .filter((m) => m.content?.trim())
    .map((m) => ({
      id: m.id,
      role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
      content: m.content,
      provider: m.provider,
    }));
}

/**
 * Load the most recently updated conversation for the signed-in user so a new
 * browser/device can resume messages + TravelPlan from server metadata.
 */
export async function loadLatestConversationResume(): Promise<ConversationResume | null> {
  const list = await rtkSafe(
    store
      .dispatch(
        conversationsApi.endpoints.listConversations.initiate(
          { page: 1, pageSize: 1 },
          { subscribe: false, forceRefetch: true },
        ),
      )
      .unwrap(),
  );
  const latest = list?.items?.[0];
  if (!latest?.id) return null;
  return loadConversationResumeById(latest.id);
}

/** Resume a specific server conversation (cross-device history picker). */
export async function loadConversationResumeById(
  conversationId: string,
): Promise<ConversationResume | null> {
  if (!conversationId?.trim()) return null;
  const detail = await rtkSafe(
    store
      .dispatch(
        conversationsApi.endpoints.getConversation.initiate(conversationId.trim(), {
          subscribe: false,
          forceRefetch: true,
        }),
      )
      .unwrap(),
  );
  if (!detail) return null;

  const messages = uiMessagesFromConversationDetail(detail);
  if (messages.length === 0) return null;

  return {
    conversationId: detail.id,
    messages,
    travelPlan: travelPlanFromConversationMetadata(detail.metadata),
    searchPanel: searchPanelFromConversationMetadata(detail.metadata),
  };
}
