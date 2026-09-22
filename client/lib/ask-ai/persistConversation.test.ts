import { describe, expect, it } from "vitest";
import {
  searchPanelFromConversationMetadata,
  travelPlanFromConversationMetadata,
  uiMessagesFromConversationDetail,
} from "./persistConversation";

describe("conversation resume helpers", () => {
  it("parses travelPlan from conversation metadata", () => {
    const plan = travelPlanFromConversationMetadata({
      travelPlan: {
        action: "search",
        searches: [
          {
            product: "FLIGHT",
            query: {
              origin: "LHE",
              destination: "DXB",
              departureDate: "2026-09-18",
              passengers: 1,
              cabinClass: "ECONOMY",
            },
          },
        ],
        filters: { preferredAirlines: ["EY"] },
      },
      travelPlanUpdatedAt: "2026-09-03T00:00:00.000Z",
    });
    expect(plan?.action).toBe("search");
    if (plan?.action === "search") {
      const first = plan.searches[0];
      if (first && first.product === "FLIGHT") {
        expect(first.query.origin).toBe("LHE");
        expect(first.query.destination).toBe("DXB");
      }
      expect(plan.filters?.preferredAirlines).toEqual(["EY"]);
    }
  });

  it("returns null for missing/invalid metadata travelPlan", () => {
    expect(travelPlanFromConversationMetadata(null)).toBeNull();
    expect(travelPlanFromConversationMetadata({})).toBeNull();
    expect(
      travelPlanFromConversationMetadata({ travelPlan: { action: "nope" } }),
    ).toBeNull();
  });

  it("parses searchPanel from conversation metadata", () => {
    const panel = searchPanelFromConversationMetadata({
      searchPanel: {
        offers: [{ id: "off-1" }],
        totalCount: 1,
        liveFlights: true,
      },
    });
    expect(panel?.offers).toHaveLength(1);
    expect(panel?.liveFlights).toBe(true);
  });

  it("returns null for missing/invalid metadata searchPanel", () => {
    expect(searchPanelFromConversationMetadata(null)).toBeNull();
    expect(searchPanelFromConversationMetadata({})).toBeNull();
    expect(searchPanelFromConversationMetadata({ searchPanel: null })).toBeNull();
    expect(searchPanelFromConversationMetadata({ searchPanel: "invalid" })).toBeNull();
  });

  it("maps server messages to UiMessage roles", () => {
    const msgs = uiMessagesFromConversationDetail({
      messages: [
        {
          id: "1",
          role: "USER",
          content: "Fly LHE to DXB",
          provider: null,
          createdAt: "2026-09-03T00:00:00.000Z",
        },
        {
          id: "2",
          role: "ASSISTANT",
          content: "Best overall is ready.",
          provider: "flightone",
          createdAt: "2026-09-03T00:00:01.000Z",
        },
        {
          id: "3",
          role: "SYSTEM",
          content: "ignore",
          provider: null,
          createdAt: "2026-09-03T00:00:02.000Z",
        },
      ],
    });
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toMatchObject({ role: "user", content: "Fly LHE to DXB" });
    expect(msgs[1]).toMatchObject({
      role: "assistant",
      content: "Best overall is ready.",
      provider: "flightone",
    });
  });
});
