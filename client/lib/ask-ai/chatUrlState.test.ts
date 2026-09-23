import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  buildChatSearch,
  chatUrl,
  lastChatUrl,
  parseChatUrlState,
  rememberChatUrl,
} from "./chatUrlState";

describe("parseChatUrlState", () => {
  it("reads conversation, view and an open single-leg offer", () => {
    expect(parseChatUrlState("?c=conv1&view=results&offer=DEMO-LHE-DXB-15OCT-01")).toEqual({
      conversationId: "conv1",
      view: "results",
      offerId: "DEMO-LHE-DXB-15OCT-01",
      tripId: null,
    });
  });

  it("reads an open multi-city trip", () => {
    const s = parseChatUrlState("?c=conv1&view=results&trip=itin-mc-1");
    expect(s.tripId).toBe("itin-mc-1");
    expect(s.offerId).toBeNull();
  });

  it("implies the results view when a deal is open", () => {
    expect(parseChatUrlState("?offer=o1").view).toBe("results");
  });

  it("keeps only one selection when a URL names both", () => {
    const s = parseChatUrlState("?offer=o1&trip=t1");
    expect(s.offerId).toBe("o1");
    expect(s.tripId).toBeNull();
  });

  it("ignores junk and oversized values", () => {
    const s = parseChatUrlState(`?view=admin&c=${"x".repeat(400)}&offer=%20`);
    expect(s).toEqual({ conversationId: null, view: "chat", offerId: null, tripId: null });
  });
});

describe("buildChatSearch", () => {
  it("drops one-shot params so Back never resets the chat or re-runs a search", () => {
    const search = buildChatSearch(
      { conversationId: "c1", view: "results", offerId: "o1", tripId: null },
      "?new=true&q=Lahore%20to%20Dubai&resumeCheckout=true",
    );
    expect(search).toBe("?c=c1&view=results&offer=o1");
  });

  it("preserves unrelated params", () => {
    expect(
      buildChatSearch(
        { conversationId: null, view: "chat", offerId: null, tripId: null },
        "?utm_source=mail",
      ),
    ).toBe("?utm_source=mail");
  });

  it("never serialises a deal without the results view underneath it", () => {
    expect(
      buildChatSearch({ conversationId: "c1", view: "chat", offerId: "o1", tripId: null }),
    ).toBe("?c=c1");
  });

  it("round-trips through parse", () => {
    const state = { conversationId: "c1", view: "results" as const, offerId: null, tripId: "t1" };
    expect(parseChatUrlState(buildChatSearch(state))).toEqual(state);
    expect(chatUrl(state)).toBe("/chat?c=c1&view=results&trip=t1");
  });
});

describe("last chat URL", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {});
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    });
  });

  it("returns what was remembered", () => {
    rememberChatUrl("/chat?c=c1&view=results&offer=o1");
    expect(lastChatUrl()).toBe("/chat?c=c1&view=results&offer=o1");
  });

  it("refuses to hand back anything that is not our chat route", () => {
    // sessionStorage is script-writable; "Back to search" must never become
    // an open redirect.
    rememberChatUrl("https://evil.example/chat");
    expect(lastChatUrl()).toBe("/chat");
    rememberChatUrl("//evil.example");
    expect(lastChatUrl()).toBe("/chat");
    rememberChatUrl("/chatroom");
    expect(lastChatUrl()).toBe("/chat");
  });
});
