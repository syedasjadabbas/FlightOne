import { describe, expect, it } from "vitest";
import {
  canShowResultsWorkspace,
  deriveChatResultsState,
  isLiveSearchPanel,
} from "./chatResultsState";
import type { SearchResultsPanel } from "./types";

const clarifyPanel: SearchResultsPanel = {
  offers: [],
  filterPills: [],
  totalCount: 0,
  liveFlights: false,
};

const liveEmptyPanel: SearchResultsPanel = {
  offers: [],
  filterPills: [],
  totalCount: 0,
  liveFlights: true,
};

const liveResultsPanel: SearchResultsPanel = {
  offers: [{ id: "1" } as SearchResultsPanel["offers"][0]],
  filterPills: [],
  totalCount: 1,
  liveFlights: true,
};

describe("isLiveSearchPanel", () => {
  it("false for clarify panels", () => {
    expect(isLiveSearchPanel(clarifyPanel)).toBe(false);
  });

  it("true after live search", () => {
    expect(isLiveSearchPanel(liveEmptyPanel)).toBe(true);
  });
});

describe("deriveChatResultsState", () => {
  it("idle during clarify (non-live panel)", () => {
    expect(
      deriveChatResultsState({
        busy: false,
        searchPhase: "done",
        searchPanel: clarifyPanel,
        resultCount: 0,
        searchResultMessageId: "a1",
        latestAssistantId: "a1",
      }),
    ).toBe("idle");
  });

  it("searching while Travelport runs", () => {
    expect(
      deriveChatResultsState({
        busy: true,
        searchPhase: "search",
        searchPanel: null,
        resultCount: 0,
        searchResultMessageId: null,
        latestAssistantId: "a1",
      }),
    ).toBe("searching");
  });

  it("results only with live inventory", () => {
    expect(
      deriveChatResultsState({
        busy: false,
        searchPhase: "done",
        searchPanel: liveResultsPanel,
        resultCount: 1,
        searchResultMessageId: "a1",
        latestAssistantId: "a1",
      }),
    ).toBe("results");
  });

  it("empty after live search with zero offers", () => {
    expect(
      deriveChatResultsState({
        busy: false,
        searchPhase: "done",
        searchPanel: liveEmptyPanel,
        resultCount: 0,
        searchResultMessageId: "a1",
        latestAssistantId: "a1",
      }),
    ).toBe("empty");
  });

  it("idle when latest message is a new clarify after prior results", () => {
    expect(
      deriveChatResultsState({
        busy: false,
        searchPhase: "done",
        searchPanel: liveResultsPanel,
        resultCount: 12,
        searchResultMessageId: "old-search",
        latestAssistantId: "new-clarify",
      }),
    ).toBe("idle");
  });
});

describe("canShowResultsWorkspace", () => {
  it("false for clarify panels", () => {
    expect(
      canShowResultsWorkspace({
        searchPanel: clarifyPanel,
        resultCount: 0,
        busy: false,
        searchPhase: "done",
      }),
    ).toBe(false);
  });

  it("true when offers exist and not busy", () => {
    expect(
      canShowResultsWorkspace({
        searchPanel: liveResultsPanel,
        resultCount: 1,
        busy: false,
        searchPhase: "done",
      }),
    ).toBe(true);
  });

  it("false while Ava is busy processing", () => {
    expect(
      canShowResultsWorkspace({
        searchPanel: liveResultsPanel,
        resultCount: 1,
        busy: true,
        searchPhase: "search",
      }),
    ).toBe(false);
  });
});
