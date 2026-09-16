import { describe, expect, it } from "vitest";
import {
  guardPlanPassengers,
  intentFromPlan,
  parseJsonObject,
  parseTravelPlan,
  splitComplexReturnPlan,
  preferNonstopOffers,
  ensureReturnHomeLeg,
  validateSearchPlan,
} from "./travelPlan";

describe("parseJsonObject", () => {
  it("parses bare JSON", () => {
    expect(parseJsonObject('{"action":"close"}')).toEqual({ action: "close" });
  });

  it("strips markdown fences", () => {
    expect(parseJsonObject('```json\n{"action":"close"}\n```')).toEqual({
      action: "close",
    });
  });

  it("recovers first object from noisy text", () => {
    expect(parseJsonObject('Here you go:\n{"action":"off_topic"}\nThanks')).toEqual({
      action: "off_topic",
    });
  });

  it("repairs trailing commas", () => {
    expect(parseJsonObject('{"action":"close",}')).toEqual({ action: "close" });
  });

  it("returns null on garbage", () => {
    expect(parseJsonObject("not json")).toBeNull();
  });
});

describe("parseTravelPlan", () => {
  it("accepts searches[] multi-leg flights", () => {
    const plan = parseTravelPlan(
      JSON.stringify({
        action: "search",
        searches: [
          {
            product: "FLIGHT",
            query: {
              origin: "LHE",
              destination: "LHR",
              departureDate: "2026-08-10",
              passengers: 1,
              cabinClass: "ECONOMY",
            },
          },
          {
            product: "FLIGHT",
            query: {
              origin: "LHR",
              destination: "DXB",
              departureDate: "2026-08-12",
              passengers: 1,
              cabinClass: "ECONOMY",
            },
          },
        ],
      }),
    );
    expect(plan?.action).toBe("search");
    if (plan?.action === "search") {
      expect(plan.searches).toHaveLength(2);
      expect(plan.searches[0]).toMatchObject({
        product: "FLIGHT",
        query: { origin: "LHE", destination: "LHR" },
      });
      expect(plan.searches[1]).toMatchObject({
        product: "FLIGHT",
        query: { origin: "LHR", destination: "DXB" },
      });
    }
  });

  it("accepts mixed flight + hotel searches", () => {
    const plan = parseTravelPlan(
      JSON.stringify({
        action: "search",
        searches: [
          {
            product: "FLIGHT",
            query: {
              origin: "LHE",
              destination: "DXB",
              departureDate: "2026-09-01",
            },
          },
          {
            product: "HOTEL",
            query: {
              cityCode: "DXB",
              checkInDate: "2026-09-01",
              checkOutDate: "2026-09-04",
              hotelName: "Burj Al Arab",
            },
          },
        ],
      }),
    );
    expect(plan?.action).toBe("search");
    if (plan?.action === "search") {
      expect(plan.searches.map((s) => s.product)).toEqual(["FLIGHT", "HOTEL"]);
    }
  });

  it("normalizes legacy single product/query into searches[]", () => {
    const plan = parseTravelPlan(
      JSON.stringify({
        action: "search",
        product: "FLIGHT",
        query: {
          origin: "lhe",
          destination: "DXB",
          departureDate: "2026-09-01",
          passengers: 1,
          cabinClass: "BUSINESS",
        },
      }),
    );
    expect(plan).toEqual({
      action: "search",
      searches: [
        {
          product: "FLIGHT",
          query: {
            origin: "LHE",
            destination: "DXB",
            departureDate: "2026-09-01",
            passengers: 1,
            cabinClass: "BUSINESS",
          },
        },
      ],
    });
  });

  it("accepts clarify / close / off_topic", () => {
    expect(
      parseTravelPlan(
        JSON.stringify({
          action: "clarify",
          missing: ["destination"],
          ask: "Where to?",
        }),
      ),
    ).toEqual({
      action: "clarify",
      missing: ["destination"],
      ask: "Where to?",
    });
    expect(parseTravelPlan('{"action":"close"}')).toEqual({ action: "close" });
    expect(parseTravelPlan('{"action":"off_topic"}')).toEqual({
      action: "off_topic",
    });
  });

  it("maps city names to IATA and skips invalid legs", () => {
    const plan = parseTravelPlan(
      JSON.stringify({
        action: "search",
        searches: [
          {
            product: "FLIGHT",
            query: {
              origin: "Lahore",
              destination: "London",
              departureDate: "2026-08-21",
              passengers: 1,
              cabinClass: "ECONOMY",
            },
          },
          {
            product: "HOTEL",
            query: {
              cityCode: "??",
              checkInDate: "bad",
              checkOutDate: "also-bad",
            },
          },
        ],
        filters: { preferredAirlines: ["QR", "SV"] },
      }),
    );
    expect(plan?.action).toBe("search");
    if (plan?.action !== "search") return;
    expect(plan.searches).toHaveLength(1);
    expect(plan.searches[0]).toMatchObject({
      product: "FLIGHT",
      query: { origin: "LHE", destination: "LHR", departureDate: "2026-08-21" },
    });
    expect(plan.filters?.preferredAirlines).toEqual(["QR", "SV"]);
  });

  it("rejects same origin/destination", () => {
    expect(
      parseTravelPlan(
        JSON.stringify({
          action: "search",
          searches: [
            {
              product: "FLIGHT",
              query: {
                origin: "DXB",
                destination: "DXB",
                departureDate: "2026-09-01",
              },
            },
          ],
        }),
      ),
    ).toBeNull();
  });

  it("rejects bad dates and cabin", () => {
    expect(
      parseTravelPlan(
        JSON.stringify({
          action: "search",
          product: "FLIGHT",
          query: {
            origin: "LHE",
            destination: "DXB",
            departureDate: "01-09-2026",
          },
        }),
      ),
    ).toBeNull();

    expect(
      parseTravelPlan(
        JSON.stringify({
          action: "search",
          product: "HOTEL",
          query: {
            cityCode: "DXB",
            checkInDate: "2026-09-05",
            checkOutDate: "2026-09-01",
          },
        }),
      ),
    ).toBeNull();

    // Unknown cabin is soft-dropped — still a valid one-way search.
    expect(
      parseTravelPlan(
        JSON.stringify({
          action: "search",
          product: "FLIGHT",
          query: {
            origin: "LHE",
            destination: "DXB",
            departureDate: "2026-09-01",
            cabinClass: "COUCH",
          },
        }),
      ),
    ).toEqual({
      action: "search",
      searches: [
        {
          product: "FLIGHT",
          query: {
            origin: "LHE",
            destination: "DXB",
            departureDate: "2026-09-01",
          },
        },
      ],
    });
  });

  it("synthesizes ask when clarify is missing ask", () => {
    expect(
      parseTravelPlan(JSON.stringify({ action: "clarify", missing: ["origin"] })),
    ).toEqual({
      action: "clarify",
      missing: ["origin"],
      ask: "Where are you flying from?",
    });
  });

  it("fills assumed dates on multi-leg search missing departureDate", () => {
    const plan = parseTravelPlan(
      JSON.stringify({
        action: "search",
        datesAssumed: true,
        searches: [
          {
            product: "FLIGHT",
            query: { origin: "LHE", destination: "LHR", passengers: 1, cabinClass: "ECONOMY" },
          },
          {
            product: "FLIGHT",
            query: { origin: "LHR", destination: "SFO", passengers: 1, cabinClass: "ECONOMY" },
          },
          {
            product: "FLIGHT",
            query: { origin: "MCO", destination: "LHE", passengers: 1, cabinClass: "ECONOMY" },
          },
        ],
      }),
      { today: "2026-09-15" },
    );
    expect(plan?.action).toBe("search");
    if (plan?.action === "search") {
      expect(plan.datesAssumed).toBe(true);
      expect(plan.searches).toHaveLength(3);
      expect(plan.searches[0]).toMatchObject({
        product: "FLIGHT",
        query: { origin: "LHE", destination: "LHR", departureDate: "2026-10-06" },
      });
      expect(plan.searches[1]).toMatchObject({
        product: "FLIGHT",
        query: { origin: "LHR", destination: "SFO", departureDate: "2026-10-09" },
      });
      expect(plan.searches[2]).toMatchObject({
        product: "FLIGHT",
        query: { origin: "MCO", destination: "LHE", departureDate: "2026-10-12" },
      });
    }
  });
});

describe("intentFromPlan", () => {
  it("maps multi-city flights to destinations[]", () => {
    const intent = intentFromPlan({
      action: "search",
      searches: [
        {
          product: "FLIGHT",
          query: {
            origin: "LHE",
            destination: "LHR",
            departureDate: "2026-08-10",
          },
        },
        {
          product: "FLIGHT",
          query: {
            origin: "LHR",
            destination: "DXB",
            departureDate: "2026-08-12",
          },
        },
      ],
    });
    expect(intent).toMatchObject({
      type: "flight",
      origin: "Lahore",
      destination: "Dubai",
      destinations: ["London", "Dubai"],
      departureDate: "2026-08-10",
      offTopic: false,
    });
  });

  it("maps off_topic", () => {
    expect(intentFromPlan({ action: "off_topic" }).offTopic).toBe(true);
  });
});

describe("guardPlanPassengers", () => {
  it("resets LLM passengers when message only mentions nights", () => {
    const plan = parseTravelPlan(
      JSON.stringify({
        action: "search",
        searches: [
          {
            product: "FLIGHT",
            query: {
              origin: "LHE",
              destination: "LHR",
              departureDate: "2026-08-21",
              passengers: 4,
            },
          },
        ],
      }),
    )!;
    const guarded = guardPlanPassengers(
      plan,
      "Qatar from Lahore to London. Stay in London is for 4 nights",
    );
    expect(guarded.action).toBe("search");
    if (guarded.action === "search") {
      expect(guarded.searches[0].product).toBe("FLIGHT");
      if (guarded.searches[0].product === "FLIGHT") {
        expect(guarded.searches[0].query.passengers).toBe(1);
      }
    }
  });
});

describe("splitComplexReturnPlan", () => {
  it("splits Madinah layover into three one-ways", () => {
    const plan = parseTravelPlan(
      JSON.stringify({
        action: "search",
        searches: [
          {
            product: "FLIGHT",
            query: {
              origin: "LHE",
              destination: "LHR",
              departureDate: "2026-08-21",
              returnDate: "2026-08-25",
              passengers: 1,
            },
          },
        ],
      }),
    )!;
    const split = splitComplexReturnPlan(
      plan,
      "Qatar on 21st Lahore to London. Return on Saudia with 3 day layover in Madinah. Stay 4 nights.",
    );
    expect(split.action).toBe("search");
    if (split.action !== "search") return;
    expect(split.searches).toHaveLength(3);
    expect(split.searches.map((s) => s.product)).toEqual([
      "FLIGHT",
      "FLIGHT",
      "FLIGHT",
    ]);
    const qs = split.searches
      .filter((s) => s.product === "FLIGHT")
      .map((s) => s.query);
    expect(qs[0]).toMatchObject({
      origin: "LHE",
      destination: "LHR",
      departureDate: "2026-08-21",
    });
    expect(qs[0].returnDate).toBeUndefined();
    expect(qs[1]).toMatchObject({
      origin: "LHR",
      destination: "MED",
      departureDate: "2026-08-25",
    });
    expect(qs[2]).toMatchObject({
      origin: "MED",
      destination: "LHE",
      departureDate: "2026-08-28",
    });
  });

  it("leaves simple night-stay RT untouched", () => {
    const plan = parseTravelPlan(
      JSON.stringify({
        action: "search",
        searches: [
          {
            product: "FLIGHT",
            query: {
              origin: "LHE",
              destination: "LHR",
              departureDate: "2026-08-21",
              returnDate: "2026-08-25",
              passengers: 1,
            },
          },
        ],
      }),
    )!;
    const out = splitComplexReturnPlan(
      plan,
      "flights Lahore to London on 21st, stay for 4 nights",
    );
    expect(out).toEqual(plan);
  });

  it("completes Bali layover plan with missing BKK→LHE home leg", () => {
    const msg =
      "find flight to bali on 25th August, stay there for 4 nights and return layover in bangkok for 2 nights then back to lahore";
    const plan = parseTravelPlan(
      JSON.stringify({
        action: "search",
        searches: [
          {
            product: "FLIGHT",
            query: {
              origin: "LHE",
              destination: "DPS",
              departureDate: "2026-08-25",
              passengers: 1,
            },
          },
          {
            product: "FLIGHT",
            query: {
              origin: "DPS",
              destination: "BKK",
              departureDate: "2026-08-29",
              passengers: 1,
            },
          },
        ],
      }),
    )!;
    const split = splitComplexReturnPlan(plan, msg);
    expect(split.action).toBe("search");
    if (split.action !== "search") return;
    const qs = split.searches
      .filter((s) => s.product === "FLIGHT")
      .map((s) => s.query);
    expect(qs).toHaveLength(3);
    expect(qs[0]).toMatchObject({ origin: "LHE", destination: "DPS" });
    expect(qs[1]).toMatchObject({ origin: "DPS", destination: "BKK" });
    expect(qs[2]).toMatchObject({
      origin: "BKK",
      destination: "LHE",
      departureDate: "2026-08-31",
    });
  });

  it("expands single RT via Bangkok layover into three one-ways", () => {
    const msg =
      "flight to bali on 25th August stay 4 nights return layover in bangkok for 2 nights then back to lahore";
    const plan = parseTravelPlan(
      JSON.stringify({
        action: "search",
        searches: [
          {
            product: "FLIGHT",
            query: {
              origin: "LHE",
              destination: "DPS",
              departureDate: "2026-08-25",
              returnDate: "2026-08-29",
              passengers: 1,
            },
          },
        ],
      }),
    )!;
    const split = splitComplexReturnPlan(plan, msg);
    expect(split.action).toBe("search");
    if (split.action !== "search") return;
    const qs = split.searches
      .filter((s) => s.product === "FLIGHT")
      .map((s) => s.query);
    expect(qs).toHaveLength(3);
    expect(qs.map((q) => `${q.origin}-${q.destination}`)).toEqual([
      "LHE-DPS",
      "DPS-BKK",
      "BKK-LHE",
    ]);
    expect(qs[2].departureDate).toBe("2026-08-31");
  });
});

describe("preferNonstopOffers", () => {
  it("ranks directs before connecting flights", () => {
    const out = preferNonstopOffers([
      { type: "flight", stops: 1, id: "c" },
      { type: "flight", stops: 0, id: "d" },
      { type: "flight", stops: 2, id: "e" },
    ]);
    expect(out.map((o) => o.id)).toEqual(["d", "c", "e"]);
  });
});

describe("ensureReturnHomeLeg", () => {
  it("no-ops when the last hop already ends at home", () => {
    const plan = parseTravelPlan(
      JSON.stringify({
        action: "search",
        searches: [
          {
            product: "FLIGHT",
            query: { origin: "LHE", destination: "DPS", departureDate: "2026-08-25" },
          },
          {
            product: "FLIGHT",
            query: { origin: "BKK", destination: "LHE", departureDate: "2026-08-31" },
          },
        ],
      }),
    )!;
    const out = ensureReturnHomeLeg(plan, "then back to lahore");
    expect(out).toEqual(plan);
  });
});

describe("validateSearchPlan", () => {
  it("accepts Lahore to Dubai with city names resolved to IATA", () => {
    const plan = parseTravelPlan(
      JSON.stringify({
        action: "search",
        searches: [
          {
            product: "FLIGHT",
            query: {
              origin: "Lahore",
              destination: "Dubai",
              departureDate: "2026-09-10",
            },
          },
        ],
      }),
    );
    expect(plan?.action).toBe("search");
    if (plan?.action !== "search") return;
    expect(plan.searches[0]).toMatchObject({
      product: "FLIGHT",
      query: { origin: "LHE", destination: "DXB", departureDate: "2026-09-10" },
    });
    expect(validateSearchPlan(plan)).toEqual({ ok: true });
  });

  it("rejects same origin and destination", () => {
    const plan = parseTravelPlan(
      JSON.stringify({
        action: "search",
        searches: [
          {
            product: "FLIGHT",
            query: {
              origin: "LHE",
              destination: "LHE",
              departureDate: "2026-09-10",
            },
          },
        ],
      }),
    );
    expect(plan).toBeNull();
  });

  it("blocks LHE to LHE after validation when LLM slips through", () => {
    const plan = {
      action: "search" as const,
      searches: [
        {
          product: "FLIGHT" as const,
          query: {
            origin: "LHE",
            destination: "LHE",
            departureDate: "2026-09-10",
          },
        },
      ],
    };
    const v = validateSearchPlan(plan);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe("same_origin_destination");
  });
});
