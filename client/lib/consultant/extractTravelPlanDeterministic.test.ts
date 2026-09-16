import { describe, expect, it } from "vitest";
import { parseFlightDatesFromMessage } from "./parseFlightDates";
import { extractFlightRouteFromMessage } from "./extractFlightRoute";
import { extractTravelPlanDeterministic } from "./extractTravelPlanDeterministic";

const OPTS = {
  today: "2026-09-01",
  defaultOriginIata: "LHE",
  defaultOriginPlace: "Lahore",
};

function flightQuery(result: ReturnType<typeof extractTravelPlanDeterministic>) {
  expect(result.kind).toBe("plan");
  if (result.kind !== "plan") return null;
  const leg = result.plan.searches[0];
  expect(leg.product).toBe("FLIGHT");
  if (leg.product !== "FLIGHT") return null;
  return leg.query;
}

describe("parseFlightDatesFromMessage", () => {
  it("parses September 10, 2026", () => {
    expect(parseFlightDatesFromMessage("on September 10, 2026", OPTS.today)).toEqual({
      departureDate: "2026-09-10",
    });
  });

  it("parses Sep 10 2026", () => {
    expect(parseFlightDatesFromMessage("Sep 10 2026", OPTS.today)).toEqual({
      departureDate: "2026-09-10",
    });
  });

  it("parses 10 September 2026", () => {
    expect(parseFlightDatesFromMessage("10 September 2026", OPTS.today)).toMatchObject({
      departureDate: "2026-09-10",
    });
  });

  it("parses 11th of sept", () => {
    expect(parseFlightDatesFromMessage("11th of sept", OPTS.today)).toMatchObject({
      departureDate: "2026-09-11",
      yearInferred: true,
    });
  });

  it("parses mid of sept as vague band", () => {
    const r = parseFlightDatesFromMessage("mid of sept", OPTS.today);
    expect(r?.departureDate).toBeUndefined();
    expect(r?.vague?.label.toLowerCase()).toMatch(/mid/);
    expect(r?.vague?.rangeStart).toBe("2026-09-11");
    expect(r?.vague?.rangeEnd).toBe("2026-09-20");
  });

  it("parses tomorrow", () => {
    expect(parseFlightDatesFromMessage("tomorrow", OPTS.today)).toMatchObject({
      departureDate: "2026-09-02",
    });
  });

  it("parses 09/10/2026 as September 10", () => {
    expect(parseFlightDatesFromMessage("09/10/2026", OPTS.today)).toEqual({
      departureDate: "2026-09-10",
    });
  });

  it("parses round-trip range", () => {
    expect(
      parseFlightDatesFromMessage(
        "from September 10 to September 15, 2026",
        OPTS.today,
      ),
    ).toEqual({
      departureDate: "2026-09-10",
      returnDate: "2026-09-15",
    });
  });
});

describe("extractTravelPlanDeterministic", () => {
  it("1. Lahore → Dubai + explicit date", () => {
    const q = flightQuery(
      extractTravelPlanDeterministic(
        "I want to fly from Lahore to Dubai on September 10, 2026. Show me available flights.",
        OPTS,
      ),
    );
    expect(q).toMatchObject({
      origin: "LHE",
      destination: "DXB",
      departureDate: "2026-09-10",
    });
  });

  it("2. Lahore → Karachi + explicit date", () => {
    const q = flightQuery(
      extractTravelPlanDeterministic(
        "I want to fly from Lahore to Karachi on September 10, 2026.",
        OPTS,
      ),
    );
    expect(q).toMatchObject({
      origin: "LHE",
      destination: "KHI",
      departureDate: "2026-09-10",
    });
  });

  it("3. Lahore → Istanbul + explicit date", () => {
    const q = flightQuery(
      extractTravelPlanDeterministic(
        "I want to fly from Lahore to Istanbul on September 11, 2026.",
        OPTS,
      ),
    );
    expect(q).toMatchObject({
      origin: "LHE",
      destination: "IST",
      departureDate: "2026-09-11",
    });
  });

  it("4. Lahore → Dubai round trip", () => {
    const q = flightQuery(
      extractTravelPlanDeterministic(
        "I want a return flight from Lahore to Dubai from September 10 to September 15, 2026.",
        OPTS,
      ),
    );
    expect(q).toMatchObject({
      origin: "LHE",
      destination: "DXB",
      departureDate: "2026-09-10",
      returnDate: "2026-09-15",
    });
  });

  it("5. IATA input LHE → DXB", () => {
    const q = flightQuery(
      extractTravelPlanDeterministic("Fly LHE to DXB on September 10, 2026.", OPTS),
    );
    expect(q).toMatchObject({
      origin: "LHE",
      destination: "DXB",
      departureDate: "2026-09-10",
    });
  });

  it("6. missing destination → clarify", () => {
    const r = extractTravelPlanDeterministic(
      "I want to fly from Lahore on September 10, 2026.",
      OPTS,
    );
    expect(r.kind).toBe("clarify");
    if (r.kind === "clarify") {
      expect(r.plan.missing).toContain("destination");
    }
  });

  it("7. missing origin uses default when flying to named city", () => {
    const q = flightQuery(
      extractTravelPlanDeterministic("Flights to Dubai on September 10, 2026.", OPTS),
    );
    expect(q).toMatchObject({
      origin: "LHE",
      destination: "DXB",
      departureDate: "2026-09-10",
    });
  });

  it("8. same origin/destination → clarify", () => {
    const r = extractTravelPlanDeterministic(
      "Fly from Lahore to Lahore on September 10, 2026.",
      OPTS,
    );
    expect(r.kind).toBe("clarify");
  });

  it("9. invalid IATA → clarify", () => {
    const r = extractTravelPlanDeterministic(
      "Fly from XYZ to DXB on September 10, 2026.",
      OPTS,
    );
    expect(r.kind).toBe("clarify");
  });

  it("10. invalid date → clarify", () => {
    const r = extractTravelPlanDeterministic(
      "Fly from Lahore to Dubai soon.",
      OPTS,
    );
    expect(r.kind).toBe("clarify");
    if (r.kind === "clarify") {
      expect(r.plan.missing).toContain("departureDate");
    }
  });

  it("11. return date before departure → clarify", () => {
    const r = extractTravelPlanDeterministic(
      "Return flight Lahore to Dubai depart September 15 and return September 10, 2026.",
      OPTS,
    );
    expect(r.kind).toBe("clarify");
    if (r.kind === "clarify") {
      expect(r.plan.missing).toContain("returnDate");
    }
  });

  it("12. natural wording variations", () => {
    const messages = [
      "flight from Islamabad to Dubai on September 10, 2026",
      "flying from Lahore to Dubai on Sep 10 2026",
      "need a return flight from Lahore to Dubai from September 10 to September 15, 2026",
      "LHE-DXB September 11, 2026",
    ];
    const r0 = extractTravelPlanDeterministic(messages[0], {
      ...OPTS,
      defaultOriginPlace: "Islamabad",
      defaultOriginIata: "ISB",
    });
    expect(flightQuery(r0)).toMatchObject({
      origin: "ISB",
      destination: "DXB",
      departureDate: "2026-09-10",
    });

    expect(flightQuery(extractTravelPlanDeterministic(messages[1], OPTS))).toMatchObject({
      origin: "LHE",
      destination: "DXB",
      departureDate: "2026-09-10",
    });

    expect(flightQuery(extractTravelPlanDeterministic(messages[2], OPTS))).toMatchObject({
      origin: "LHE",
      destination: "DXB",
      departureDate: "2026-09-10",
      returnDate: "2026-09-15",
    });

    expect(flightQuery(extractTravelPlanDeterministic(messages[3], OPTS))).toMatchObject({
      origin: "LHE",
      destination: "DXB",
      departureDate: "2026-09-11",
    });
  });
});

describe("extractFlightRouteFromMessage", () => {
  it("resolves from/to city names", () => {
    expect(
      extractFlightRouteFromMessage("fly from Lahore to Dubai", OPTS),
    ).toEqual({ origin: "LHE", destination: "DXB" });
  });
});
