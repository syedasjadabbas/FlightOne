/**
 * The chat → results → deal state that survives in the /chat URL, so the
 * browser Back button from checkout lands exactly where the traveller left:
 * same conversation, results workspace open, same offer or trip on screen.
 *
 *   /chat?c=<conversationId>&view=results&offer=<offerId>
 *   /chat?c=<conversationId>&view=results&trip=<itineraryId>
 *
 * Pure — no React, no window — so the shape is unit tested and shared by the
 * chat page (writer + reader) and checkout (reader, for "Back to search").
 */

export type ChatView = "chat" | "results";

export type ChatUrlState = {
  conversationId: string | null;
  view: ChatView;
  /** Single-leg offer whose detail modal is open. */
  offerId: string | null;
  /** Multi-city itinerary whose detail modal is open. */
  tripId: string | null;
};

export const EMPTY_CHAT_URL_STATE: ChatUrlState = {
  conversationId: null,
  view: "chat",
  offerId: null,
  tripId: null,
};

/**
 * Params that trigger an action once (start a new chat, run a homepage query,
 * resume a checkout). Left in the URL, going Back re-fires them — `new=true`
 * wiped the thread and `q=` re-ran the search.
 */
export const ONE_SHOT_PARAMS = ["new", "q", "resumeCheckout"] as const;

/** Ids are supplier offer ids / cuids; cap length so a crafted URL stays inert. */
const MAX_ID = 300;

function cleanId(raw: string | null): string | null {
  const v = raw?.trim();
  return v && v.length <= MAX_ID ? v : null;
}

export function parseChatUrlState(search: string | URLSearchParams): ChatUrlState {
  const p = typeof search === "string" ? new URLSearchParams(search) : search;
  const offerId = cleanId(p.get("offer"));
  // An offer and a trip can't both be open — the offer wins, as it is the
  // narrower selection.
  const tripId = offerId ? null : cleanId(p.get("trip"));
  const view: ChatView =
    p.get("view") === "results" || offerId || tripId ? "results" : "chat";
  return { conversationId: cleanId(p.get("c")), view, offerId, tripId };
}

/**
 * Serialise onto an existing query string, preserving unrelated params and
 * dropping the one-shot ones. Returns "" when nothing is worth keeping.
 */
export function buildChatSearch(
  state: ChatUrlState,
  existing: string | URLSearchParams = "",
): string {
  const p = new URLSearchParams(existing);
  for (const k of [...ONE_SHOT_PARAMS, "c", "view", "offer", "trip"]) p.delete(k);

  if (state.conversationId) p.set("c", state.conversationId);
  if (state.view === "results") p.set("view", "results");
  // A detail modal only exists on top of results — never serialise it alone.
  if (state.view === "results") {
    if (state.offerId) p.set("offer", state.offerId);
    else if (state.tripId) p.set("trip", state.tripId);
  }

  const s = p.toString();
  return s ? `?${s}` : "";
}

export function chatUrl(state: ChatUrlState): string {
  return `/chat${buildChatSearch(state)}`;
}

// --- last chat URL, for checkout's "Back to search" -------------------------

const LAST_URL_KEY = "fo-chat-last-url";

export function rememberChatUrl(url: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(LAST_URL_KEY, url);
  } catch {
    // Private mode / quota — Back falls back to plain /chat.
  }
}

/** Last /chat URL this tab was on, or plain /chat. Only ever a /chat path. */
export function lastChatUrl(): string {
  if (typeof window === "undefined") return "/chat";
  try {
    const url = sessionStorage.getItem(LAST_URL_KEY);
    // Never navigate to anything that isn't our own chat route.
    return url && /^\/chat(\?|$)/.test(url) ? url : "/chat";
  } catch {
    return "/chat";
  }
}
