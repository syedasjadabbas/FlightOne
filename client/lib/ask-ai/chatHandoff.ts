/**
 * Stash active chat across /login ↔ /chat navigations so guest turns
 * survive signup/login without redesigning the chat UI.
 */
import type { TravelPlan } from "@/lib/consultant/travelPlan";
import type { UiMessage } from "@/app/components/chat.types";

const KEY = "fo-chat-handoff";

export type ChatHandoff = {
  messages: UiMessage[];
  previousTravelPlan: TravelPlan | null;
  conversationId: string | null;
  savedAt: number;
};

export function saveChatHandoff(data: Omit<ChatHandoff, "savedAt">): void {
  if (typeof window === "undefined") return;
  try {
    const payload: ChatHandoff = { ...data, savedAt: Date.now() };
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // quota / private mode — non-fatal
  }
}

export function loadChatHandoff(): ChatHandoff | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChatHandoff;
    if (!parsed?.messages?.length) return null;
    // Drop stale handoffs (> 2 hours)
    if (Date.now() - (parsed.savedAt || 0) > 2 * 60 * 60 * 1000) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearChatHandoff(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
