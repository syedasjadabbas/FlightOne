import { describe, expect, it } from "vitest";
import {
  applyQuestionAwareReply,
  clarificationSlotFromContext,
  draftPlanFromHistory,
  firstFlightQuery,
  isBooleanYesNoQuestion,
  mergeTravelPlan,
  normalizeMissingSlot,
  retryClarifyAskFor,
} from "./mergeTravelPlan";
import type { TravelPlan } from "./travelPlan";

const OPTS = {
  today: "2026-09-01",
  defaultOriginIata: "LHE",
  defaultOriginPlace: "Lahore",
};

function searchPlan(
  origin: string,
  destination: string,
  departureDate: string,
  returnDate?: string,
): Extract<TravelPlan, { action: "search" }> {
  return {
    action: "search",
    searches: [
      {
        product: "FLIGHT",
        query: {
          origin,
          destination,
          departureDate,
          ...(returnDate ? { returnDate } : {}),
          passengers: 1,
          cabinClass: "ECONOMY",
        },
      },
    ],
  };
}

describe("mergeTravelPlan multi-turn continuity", () => {
  it("1. full route + date survives confirmation turn", () => {
    const prev = searchPlan("KHI", "DXB", "2026-09-10");
    const merged = mergeTravelPlan(
      { action: "clarify", missing: ["tripType"], ask: "Would you like a one-way or round trip?" },
      {
        ...OPTS,
        message: "one way",
        history: [
          { role: "user", content: "I wanna fly to Dubai from Karachi on 10th Sept" },
          { role: "assistant", content: "Would you like a one-way or round trip?" },
        ],
        previousPlan: prev,
      },
    );
    expect(merged?.action).toBe("search");
    expect(firstFlightQuery(merged)).toMatchObject({
      origin: "KHI",
      destination: "DXB",
      departureDate: "2026-09-10",
    });
  });

  it("2. full route + date → yes does not reset", () => {
    const prev = searchPlan("KHI", "DXB", "2026-09-10");
    const merged = mergeTravelPlan(
      { action: "clarify", missing: ["destination"], ask: "Where would you like to fly to?" },
      {
        ...OPTS,
        message: "yes",
        history: [
          { role: "user", content: "i wanna fly to dubai from karachi on 10th sept" },
          {
            role: "assistant",
            content: "When would you like to fly from KHI to DXB?",
          },
        ],
        previousPlan: prev,
      },
    );
    expect(merged?.action).toBe("search");
    expect(firstFlightQuery(merged)).toMatchObject({
      origin: "KHI",
      destination: "DXB",
      departureDate: "2026-09-10",
    });
  });

  it("3. full route → date reply fills departure", () => {
    const prev = searchPlan("LHE", "DXB", "");
    const merged = mergeTravelPlan(null, {
      ...OPTS,
      message: "September 10",
      history: [
        { role: "user", content: "I want to fly from Lahore to Dubai" },
        { role: "assistant", content: "What date would you like to depart?" },
      ],
      previousPlan: {
        action: "clarify",
        missing: ["departureDate"],
        ask: "What date would you like to depart?",
        draft: prev,
      },
    });
    expect(firstFlightQuery(merged)).toMatchObject({
      origin: "LHE",
      destination: "DXB",
      departureDate: "2026-09-10",
    });
  });

  it("4. departure preserved when return date arrives", () => {
    const prev = searchPlan("KHI", "DXB", "2026-09-10");
    const merged = mergeTravelPlan(null, {
      ...OPTS,
      message: "September 15",
      history: [
        { role: "user", content: "I want to fly from Karachi to Dubai on September 10" },
        { role: "assistant", content: "When would you like to return?" },
      ],
      previousPlan: {
        action: "clarify",
        missing: ["returnDate"],
        ask: "When would you like to return?",
        draft: prev,
      },
    });
    expect(firstFlightQuery(merged)).toMatchObject({
      origin: "KHI",
      destination: "DXB",
      departureDate: "2026-09-10",
      returnDate: "2026-09-15",
    });
  });

  it("5. route split across turns", () => {
    const merged = mergeTravelPlan(null, {
      ...OPTS,
      message: "Dubai",
      history: [
        { role: "user", content: "I want to fly from Karachi" },
        { role: "assistant", content: "Where would you like to fly to?" },
      ],
      previousPlan: {
        action: "clarify",
        missing: ["destination"],
        ask: "Where would you like to fly to?",
        draft: searchPlan("KHI", "", ""),
      },
    });
    expect(firstFlightQuery(merged)?.origin).toBe("KHI");
    expect(firstFlightQuery(merged)?.destination).toBe("DXB");
  });

  it("6. destination-only reply", () => {
    const r = applyQuestionAwareReply(
      "Dubai",
      "Where would you like to fly to?",
      { origin: "KHI", destination: "", departureDate: "", passengers: 1 },
      OPTS,
    );
    expect(r.query?.destination).toBe("DXB");
    expect(r.query?.origin).toBe("KHI");
  });

  it("7. origin-only reply", () => {
    const r = applyQuestionAwareReply(
      "Karachi",
      "Where are you flying from?",
      { origin: "", destination: "DXB", departureDate: "2026-09-10", passengers: 1 },
      OPTS,
    );
    expect(r.query?.origin).toBe("KHI");
    expect(r.query?.destination).toBe("DXB");
  });

  it("8. one way clears return", () => {
    const prev = searchPlan("LHE", "DXB", "2026-09-10", "2026-09-15");
    const merged = mergeTravelPlan(null, {
      ...OPTS,
      message: "one way",
      history: [
        { role: "assistant", content: "Would you like a one-way or round trip?" },
      ],
      previousPlan: prev,
    });
    expect(firstFlightQuery(merged)?.returnDate).toBeUndefined();
  });

  it("9. round trip asks for return date", () => {
    const prev = searchPlan("LHE", "DXB", "2026-09-10");
    const merged = mergeTravelPlan(null, {
      ...OPTS,
      message: "round trip",
      history: [
        { role: "assistant", content: "Would you like a one-way or round trip?" },
      ],
      previousPlan: prev,
    });
    expect(merged?.action).toBe("clarify");
    if (merged?.action === "clarify") {
      expect(merged.missing).toContain("returnDate");
      expect(merged.draft).toBeTruthy();
    }
  });

  it("10. yes to round-trip question", () => {
    const prev = searchPlan("LHE", "DXB", "2026-09-10");
    const merged = mergeTravelPlan({ action: "close" }, {
      ...OPTS,
      message: "yes",
      history: [
        { role: "assistant", content: "Would you like a round trip?" },
      ],
      previousPlan: prev,
    });
    expect(merged?.action).toBe("clarify");
    if (merged?.action === "clarify") {
      expect(merged.missing).toContain("returnDate");
    }
  });

  it("11. yes to nearby-airport question preserves route", () => {
    const prev = searchPlan("KHI", "DXB", "2026-09-10");
    const merged = mergeTravelPlan(null, {
      ...OPTS,
      message: "yes",
      history: [
        { role: "assistant", content: "Would you like nearby airports included?" },
      ],
      previousPlan: prev,
    });
    expect(firstFlightQuery(merged)).toMatchObject({
      origin: "KHI",
      destination: "DXB",
      departureDate: "2026-09-10",
    });
  });

  it("12. short date reply", () => {
    const r = applyQuestionAwareReply(
      "September 10",
      "What date would you like to depart?",
      { origin: "LHE", destination: "DXB", departureDate: "", passengers: 1 },
      OPTS,
    );
    expect(r.query?.departureDate).toBe("2026-09-10");
  });

  it("13-16. preserves origin, destination, departure, return", () => {
    const prev = searchPlan("KHI", "DXB", "2026-09-10", "2026-09-15");
    const merged = mergeTravelPlan(
      { action: "clarify", missing: ["destination"], ask: "Where would you like to fly to?" },
      {
        ...OPTS,
        message: "yes",
        history: [{ role: "assistant", content: "Anything else?" }],
        previousPlan: prev,
      },
    );
    expect(firstFlightQuery(merged)).toMatchObject({
      origin: "KHI",
      destination: "DXB",
      departureDate: "2026-09-10",
      returnDate: "2026-09-15",
    });
  });

  it("17. does not re-ask known slots", () => {
    const prev = searchPlan("KHI", "DXB", "2026-09-10");
    const merged = mergeTravelPlan(
      {
        action: "clarify",
        missing: ["departureDate"],
        ask: "When would you like to fly from KHI to DXB?",
      },
      {
        ...OPTS,
        message: "i wanna fly to dubai from karachi on 10th sept",
        history: [],
        previousPlan: prev,
      },
    );
    expect(merged?.action).toBe("search");
  });

  it("18. does not search before required slots exist", () => {
    const merged = mergeTravelPlan(null, {
      ...OPTS,
      message: "Dubai",
      history: [],
      previousPlan: null,
    });
    // Destination alone without origin/date → clarify or incomplete
    if (merged?.action === "search") {
      expect(firstFlightQuery(merged)?.departureDate).toBeTruthy();
    } else {
      expect(merged?.action).toBe("clarify");
    }
  });

  it("19. searches once required slots complete", () => {
    const merged = mergeTravelPlan(searchPlan("LHE", "DXB", "2026-09-10"), {
      ...OPTS,
      message: "I want to fly from Lahore to Dubai on September 10",
      history: [],
      previousPlan: null,
    });
    expect(merged?.action).toBe("search");
  });

  it("20. same origin and destination still clarifies", () => {
    const bad = searchPlan("DXB", "DXB", "2026-09-10");
    const merged = mergeTravelPlan(bad, {
      ...OPTS,
      message: "fly DXB to DXB on September 10",
      history: [],
      previousPlan: null,
    });
    expect(merged?.action).toBe("clarify");
  });

  it("reconstructs draft from history when previousPlan lacks draft", () => {
    const draft = draftPlanFromHistory(
      [
        {
          role: "user",
          content: "I wanna fly to Dubai from Karachi on September 10, 2026",
        },
      ],
      OPTS,
    );
    expect(firstFlightQuery(draft)).toMatchObject({
      origin: "KHI",
      destination: "DXB",
      departureDate: "2026-09-10",
    });
  });
});

describe("invalid clarification replies", () => {
  const malaysiaDraft = {
    action: "clarify" as const,
    missing: ["departureDate"],
    ask: "When would you like to fly from LHE to KUL?",
    draft: {
      action: "search" as const,
      searches: [
        {
          product: "FLIGHT" as const,
          query: {
            origin: "LHE",
            destination: "KUL",
            departureDate: "",
            passengers: 4,
          },
        },
      ],
    },
  };

  it("departure date question + yes → contextual retry, preserves route", () => {
    const merged = mergeTravelPlan(null, {
      ...OPTS,
      message: "yes",
      history: [
        {
          role: "user",
          content: "Family holiday in Malaysia from Lahore — flights and hotels for 4",
        },
        { role: "assistant", content: "When would you like to fly from LHE to KUL?" },
      ],
      previousPlan: malaysiaDraft,
    });
    expect(merged?.action).toBe("clarify");
    if (merged?.action === "clarify") {
      expect(merged.ask).not.toBe("When would you like to fly from LHE to KUL?");
      expect(merged.ask.toLowerCase()).toMatch(/date|depart/);
      expect(firstFlightQuery(merged)).toMatchObject({
        origin: "LHE",
        destination: "KUL",
      });
      expect(firstFlightQuery(merged)?.departureDate).toBeFalsy();
    }
  });

  it("departure date question + yes twice → hard require, not original ask", () => {
    const merged = mergeTravelPlan(null, {
      ...OPTS,
      message: "yes",
      history: [
        { role: "assistant", content: "What departure date would you like? For example, September 10." },
      ],
      previousPlan: {
        ...malaysiaDraft,
        ask: "What departure date would you like? For example, September 10.",
      },
    });
    expect(merged?.action).toBe("clarify");
    if (merged?.action === "clarify") {
      expect(merged.ask).toMatch(/need a departure date|September 10/i);
      expect(merged.ask).not.toBe("When would you like to fly from LHE to KUL?");
    }
  });

  it("departure date question + 11th of sept → fills slot", () => {
    const merged = mergeTravelPlan(null, {
      ...OPTS,
      message: "11th of sept",
      history: [
        { role: "assistant", content: "What date would you like to depart?" },
      ],
      previousPlan: malaysiaDraft,
    });
    expect(firstFlightQuery(merged)).toMatchObject({
      origin: "LHE",
      destination: "KUL",
      departureDate: "2026-09-11",
    });
  });

  it("mid September → vague clarify, not invented day", () => {
    const merged = mergeTravelPlan(null, {
      ...OPTS,
      message: "mid of sept",
      history: [
        { role: "assistant", content: "What date would you like to depart?" },
      ],
      previousPlan: malaysiaDraft,
    });
    expect(merged?.action).toBe("clarify");
    if (merged?.action === "clarify") {
      expect(merged.ask.toLowerCase()).toMatch(/specific date|search around/);
      expect(firstFlightQuery(merged)?.departureDate).toBeFalsy();
    }
  });

  it("complete one-way in one message → search", () => {
    const merged = mergeTravelPlan(
      {
        action: "search",
        searches: [
          {
            product: "FLIGHT",
            query: {
              origin: "LHE",
              destination: "DXB",
              departureDate: "2026-09-10",
              passengers: 1,
              cabinClass: "ECONOMY",
            },
          },
        ],
      },
      {
        ...OPTS,
        message: "I want to fly from Lahore to Dubai on September 10, 2026.",
        history: [],
        previousPlan: null,
      },
    );
    expect(merged?.action).toBe("search");
  });

  it("batch extract passengers + cabin + bag without clarifying them", () => {
    const merged = mergeTravelPlan(null, {
      ...OPTS,
      message: "Lahore to Dubai, September 10, 2 people, business class, checked bag.",
      history: [],
      previousPlan: {
        action: "search",
        searches: [
          {
            product: "FLIGHT",
            query: {
              origin: "LHE",
              destination: "DXB",
              departureDate: "2026-09-10",
              passengers: 2,
              cabinClass: "BUSINESS",
            },
          },
        ],
        filters: { checkedBagRequired: true },
      },
    });
    expect(merged?.action).toBe("search");
    expect(firstFlightQuery(merged)).toMatchObject({
      origin: "LHE",
      destination: "DXB",
      departureDate: "2026-09-10",
      passengers: 2,
      cabinClass: "BUSINESS",
    });
  });

  it("destination question + yes → retry, preserves origin", () => {
    const merged = mergeTravelPlan(null, {
      ...OPTS,
      message: "yes",
      history: [{ role: "assistant", content: "Where would you like to fly to?" }],
      previousPlan: {
        action: "clarify",
        missing: ["destination"],
        ask: "Where would you like to fly to?",
        draft: {
          action: "search",
          searches: [
            { product: "FLIGHT", query: { origin: "LHE", destination: "", departureDate: "", passengers: 1 } },
          ],
        },
      },
    });
    expect(merged?.action).toBe("clarify");
    if (merged?.action === "clarify") {
      expect(merged.ask).not.toBe("Where would you like to fly to?");
      expect(firstFlightQuery(merged)?.origin).toBe("LHE");
    }
  });

  it("return date question + yes → retry, preserves departure", () => {
    const merged = mergeTravelPlan(null, {
      ...OPTS,
      message: "yes",
      history: [{ role: "assistant", content: "When would you like to return?" }],
      previousPlan: {
        action: "clarify",
        missing: ["returnDate"],
        ask: "When would you like to return?",
        draft: searchPlan("LHE", "DXB", "2026-09-10"),
      },
    });
    expect(merged?.action).toBe("clarify");
    if (merged?.action === "clarify") {
      expect(merged.ask.toLowerCase()).toMatch(/return|date/);
      expect(merged.ask).not.toBe("When would you like to return?");
      expect(firstFlightQuery(merged)?.departureDate).toBe("2026-09-10");
    }
  });

  it("traveller count question + yes → retry", () => {
    const r = applyQuestionAwareReply(
      "yes",
      "How many passengers are travelling?",
      { origin: "LHE", destination: "DXB", departureDate: "2026-09-10", passengers: 1 },
      OPTS,
      "passengers",
    );
    expect(r.invalidAnswer).toBe(true);
    expect(r.handled).toBe(false);
  });

  it("cabin question + yes → invalid; business → fills cabin", () => {
    const invalid = applyQuestionAwareReply(
      "yes",
      "Which cabin would you prefer?",
      { origin: "LHE", destination: "DXB", departureDate: "2026-09-10", passengers: 1 },
      OPTS,
      "cabin",
    );
    expect(invalid.invalidAnswer).toBe(true);

    const valid = applyQuestionAwareReply(
      "business",
      "Which cabin would you prefer?",
      { origin: "LHE", destination: "DXB", departureDate: "2026-09-10", passengers: 1 },
      OPTS,
      "cabin",
    );
    expect(valid.query?.cabinClass).toBe("BUSINESS");
  });

  it("round-trip yes/no question + yes → sets round trip", () => {
    expect(
      isBooleanYesNoQuestion("Would you like a round trip?", "tripType"),
    ).toBe(true);
    const merged = mergeTravelPlan({ action: "close" }, {
      ...OPTS,
      message: "yes",
      history: [{ role: "assistant", content: "Would you like a round trip?" }],
      previousPlan: searchPlan("LHE", "DXB", "2026-09-10"),
    });
    expect(merged?.action).toBe("clarify");
    if (merged?.action === "clarify") {
      expect(merged.missing).toContain("returnDate");
    }
  });

  it("nearby-airport yes/no question + yes → preserves route", () => {
    expect(
      isBooleanYesNoQuestion("Would you like nearby airports included?", "nearbyAirports"),
    ).toBe(true);
    const merged = mergeTravelPlan(null, {
      ...OPTS,
      message: "yes",
      history: [{ role: "assistant", content: "Would you like nearby airports included?" }],
      previousPlan: searchPlan("KHI", "DXB", "2026-09-10"),
    });
    expect(firstFlightQuery(merged)).toMatchObject({
      origin: "KHI",
      destination: "DXB",
      departureDate: "2026-09-10",
    });
  });

  it("nonstop yes/no question + yes → valid boolean reply", () => {
    expect(
      isBooleanYesNoQuestion("Would you like nonstop flights only?", "nonstop"),
    ).toBe(true);
    const r = applyQuestionAwareReply(
      "yes",
      "Would you like nonstop flights only?",
      { origin: "LHE", destination: "DXB", departureDate: "2026-09-10", passengers: 1 },
      OPTS,
      "nonstop",
    );
    expect(r.invalidAnswer).toBeFalsy();
    expect(r.handled).toBe(true);
  });

  it("LHE-DXB full flow: yes then September 10", () => {
    const afterYes = mergeTravelPlan(null, {
      ...OPTS,
      message: "yes",
      history: [
        { role: "user", content: "I want to fly from Lahore to Dubai." },
        { role: "assistant", content: "When would you like to fly from LHE to DXB?" },
      ],
      previousPlan: {
        action: "clarify",
        missing: ["departureDate"],
        ask: "When would you like to fly from LHE to DXB?",
        draft: searchPlan("LHE", "DXB", ""),
      },
    });
    expect(afterYes?.action).toBe("clarify");
    if (afterYes?.action === "clarify") {
      expect(afterYes.ask.toLowerCase()).toMatch(/date|depart/);
    }

    const afterDate = mergeTravelPlan(null, {
      ...OPTS,
      message: "September 10",
      history: [
        { role: "assistant", content: "Sure. What date would you like to depart?" },
      ],
      previousPlan: {
        action: "clarify",
        missing: ["departureDate"],
        ask: "Sure. What date would you like to depart?",
        draft: searchPlan("LHE", "DXB", ""),
      },
    });
    expect(firstFlightQuery(afterDate)).toMatchObject({
      origin: "LHE",
      destination: "DXB",
      departureDate: "2026-09-10",
    });
  });

  it("classifies slots from structured missing[]", () => {
    expect(normalizeMissingSlot("departureDate")).toBe("departureDate");
    expect(
      clarificationSlotFromContext(
        { action: "clarify", missing: ["departureDate"], ask: "When?" },
        null,
      ),
    ).toBe("departureDate");
  });
});

describe("explicit slot overrides (stale DXB prevention)", () => {
  const prevLheDxb = searchPlan("LHE", "DXB", "2026-09-10");

  it("1. Istanbul instead → LHE → IST, keep date", () => {
    const merged = mergeTravelPlan(null, {
      ...OPTS,
      message: "I want Istanbul instead",
      history: [{ role: "user", content: "Lahore to Dubai on Sep 10" }],
      previousPlan: prevLheDxb,
    });
    expect(firstFlightQuery(merged)).toMatchObject({
      origin: "LHE",
      destination: "IST",
      departureDate: "2026-09-10",
    });
  });

  it("2. Actually London → LHE → LHR", () => {
    const merged = mergeTravelPlan(null, {
      ...OPTS,
      message: "Actually London",
      history: [{ role: "user", content: "Lahore to Dubai" }],
      previousPlan: searchPlan("LHE", "DXB", "2026-09-10"),
    });
    expect(firstFlightQuery(merged)).toMatchObject({
      origin: "LHE",
      destination: "LHR",
    });
  });

  it("3. Make it Sep 15 → keep DXB, new date", () => {
    const merged = mergeTravelPlan(null, {
      ...OPTS,
      message: "Make it Sep 15",
      history: [{ role: "user", content: "Lahore to Dubai on Sep 10" }],
      previousPlan: prevLheDxb,
    });
    expect(firstFlightQuery(merged)).toMatchObject({
      origin: "LHE",
      destination: "DXB",
      departureDate: "2026-09-15",
    });
  });

  it("4. from Karachi instead → KHI → DXB", () => {
    const merged = mergeTravelPlan(null, {
      ...OPTS,
      message: "from Karachi instead",
      history: [{ role: "user", content: "Lahore to Dubai" }],
      previousPlan: searchPlan("LHE", "DXB", "2026-09-10"),
    });
    expect(firstFlightQuery(merged)).toMatchObject({
      origin: "KHI",
      destination: "DXB",
      departureDate: "2026-09-10",
    });
  });

  it("5. China from Lahore on Sep 15 → drop DXB, clarify city", () => {
    const merged = mergeTravelPlan(null, {
      ...OPTS,
      message: "I want to go to China from Lahore on Sep 15",
      history: [{ role: "user", content: "Lahore to Dubai" }],
      previousPlan: searchPlan("LHE", "DXB", "2026-09-10"),
    });
    expect(merged?.action).toBe("clarify");
    if (merged?.action === "clarify") {
      expect(merged.ask.toLowerCase()).toMatch(/china|beijing|shanghai|city/);
      expect(merged.missing).toContain("destination");
      const q = firstFlightQuery(merged);
      expect(q?.destination).toBeFalsy();
      expect(q?.origin).toBe("LHE");
      expect(q?.departureDate).toBe("2026-09-15");
    }
  });

  it("6. somewhere else → clarify, not Dubai search", () => {
    const merged = mergeTravelPlan(null, {
      ...OPTS,
      message: "I want to go somewhere else",
      history: [{ role: "user", content: "Lahore to Dubai" }],
      previousPlan: searchPlan("LHE", "DXB", "2026-09-10"),
    });
    expect(merged?.action).toBe("clarify");
    if (merged?.action === "clarify") {
      expect(merged.ask.toLowerCase()).toMatch(/where|instead/);
      const q = firstFlightQuery(merged);
      expect(q?.destination).toBeFalsy();
    }
  });

  it("Istanbul instead on Sep 15 → LHE → IST + new date", () => {
    const merged = mergeTravelPlan(null, {
      ...OPTS,
      message: "I want to go to Istanbul instead on September 15",
      history: [
        {
          role: "user",
          content: "I want to fly from Lahore to Dubai on September 10, 2026.",
        },
      ],
      previousPlan: searchPlan("LHE", "DXB", "2026-09-10"),
    });
    expect(firstFlightQuery(merged)).toMatchObject({
      origin: "LHE",
      destination: "IST",
      departureDate: "2026-09-15",
    });
  });

  it("Karachi to London on Sep 15 → KHI → LHR, no LHE/DXB", () => {
    const merged = mergeTravelPlan(null, {
      ...OPTS,
      message: "Actually I want to fly from Karachi to London on September 15.",
      history: [{ role: "user", content: "Lahore to Dubai" }],
      previousPlan: searchPlan("LHE", "DXB", "2026-09-10"),
    });
    expect(firstFlightQuery(merged)).toMatchObject({
      origin: "KHI",
      destination: "LHR",
      departureDate: "2026-09-15",
    });
  });

  it("LLM echo of stale DXB is overridden by Istanbul instead", () => {
    const merged = mergeTravelPlan(searchPlan("LHE", "DXB", "2026-09-10"), {
      ...OPTS,
      message: "I want Istanbul instead",
      history: [],
      previousPlan: searchPlan("LHE", "DXB", "2026-09-10"),
    });
    expect(firstFlightQuery(merged)).toMatchObject({
      origin: "LHE",
      destination: "IST",
    });
  });

  it("beijing on 10 sept after China clarify → LHE→PEK, no DXB", () => {
    const chinaAsk =
      "Which city in China would you like to fly to? Beijing, Shanghai, or another city?";
    const merged = mergeTravelPlan(null, {
      ...OPTS,
      message: "beijing on 10 sept",
      history: [
        { role: "user", content: "I want to go to China from Lahore on 15 sept" },
        { role: "assistant", content: chinaAsk },
      ],
      previousPlan: {
        action: "clarify",
        missing: ["destination"],
        ask: chinaAsk,
        draft: searchPlan("LHE", "", "2026-09-15"),
      },
    });
    expect(merged?.action).toBe("search");
    expect(firstFlightQuery(merged)).toMatchObject({
      origin: "LHE",
      destination: "PEK",
      departureDate: "2026-09-10",
    });
    expect(JSON.stringify(firstFlightQuery(merged))).not.toMatch(/DXB/);
  });

  it("beijing on 10 sept with stale DXB previousSearch → PEK wins", () => {
    const merged = mergeTravelPlan(searchPlan("LHE", "DXB", "2026-09-10"), {
      ...OPTS,
      message: "beijing on 10 sept",
      history: [
        { role: "assistant", content: "Which city in China would you like to fly to?" },
      ],
      previousPlan: searchPlan("LHE", "DXB", "2026-09-10"),
    });
    expect(firstFlightQuery(merged)).toMatchObject({
      origin: "LHE",
      destination: "PEK",
      departureDate: "2026-09-10",
    });
    expect(JSON.stringify(firstFlightQuery(merged))).not.toMatch(/DXB/);
  });
});

describe("sequential multi-turn correction chain", () => {
  const chinaHistory = (steps: { user: string; assistant: string }[]) =>
    steps.flatMap((s) => [
      { role: "user" as const, content: s.user },
      { role: "assistant" as const, content: s.assistant },
    ]);

  it("T1→T4: LHE/DXB → IST → LHR → KHI/LHR with date preserved", () => {
    const t1 = mergeTravelPlan(null, {
      ...OPTS,
      message: "I want to fly from Lahore to Dubai on September 10, 2026.",
      history: [],
      previousPlan: null,
    });
    expect(firstFlightQuery(t1)).toMatchObject({
      origin: "LHE",
      destination: "DXB",
      departureDate: "2026-09-10",
    });

    const t2 = mergeTravelPlan(null, {
      ...OPTS,
      message: "Actually Istanbul instead on September 15.",
      history: chinaHistory([
        {
          user: "I want to fly from Lahore to Dubai on September 10, 2026.",
          assistant: "Found flights.",
        },
      ]),
      previousPlan: t1 as Extract<TravelPlan, { action: "search" }>,
    });
    expect(firstFlightQuery(t2)).toMatchObject({
      origin: "LHE",
      destination: "IST",
      departureDate: "2026-09-15",
    });
    expect(JSON.stringify(firstFlightQuery(t2))).not.toMatch(/DXB/);

    const t3 = mergeTravelPlan(null, {
      ...OPTS,
      message: "No, London instead.",
      history: chinaHistory([
        {
          user: "I want to fly from Lahore to Dubai on September 10, 2026.",
          assistant: "Found flights.",
        },
        { user: "Actually Istanbul instead on September 15.", assistant: "Found flights." },
      ]),
      previousPlan: t2 as Extract<TravelPlan, { action: "search" }>,
    });
    expect(firstFlightQuery(t3)).toMatchObject({
      origin: "LHE",
      destination: "LHR",
      departureDate: "2026-09-15",
    });
    expect(JSON.stringify(firstFlightQuery(t3))).not.toMatch(/IST|DXB/);

    const t4 = mergeTravelPlan(null, {
      ...OPTS,
      message: "Actually from Karachi.",
      history: chinaHistory([
        {
          user: "I want to fly from Lahore to Dubai on September 10, 2026.",
          assistant: "Found flights.",
        },
        { user: "Actually Istanbul instead on September 15.", assistant: "Found flights." },
        { user: "No, London instead.", assistant: "Found flights." },
      ]),
      previousPlan: t3 as Extract<TravelPlan, { action: "search" }>,
    });
    expect(firstFlightQuery(t4)).toMatchObject({
      origin: "KHI",
      destination: "LHR",
      departureDate: "2026-09-15",
    });
    expect(JSON.stringify(firstFlightQuery(t4))).not.toMatch(/LHE|DXB|IST/);
  });

  it("T5: reverse correction KHI/LHR → KHI/DXB keeps date", () => {
    const prev = searchPlan("KHI", "LHR", "2026-09-15");
    const merged = mergeTravelPlan(null, {
      ...OPTS,
      message: "I want Dubai instead.",
      history: [
        { role: "user", content: "Actually from Karachi." },
        { role: "assistant", content: "Found flights to London." },
      ],
      previousPlan: prev,
    });
    expect(firstFlightQuery(merged)).toMatchObject({
      origin: "KHI",
      destination: "DXB",
      departureDate: "2026-09-15",
    });
    expect(JSON.stringify(firstFlightQuery(merged))).not.toMatch(/LHR|IST/);
  });
});
