import { describe, expect, it } from "vitest";
import {
  buildTicketDocument,
  formatDuration,
  formatFlightNumber,
  formatTicketDate,
} from "./ticketDocument";

const segment = {
  carrier: "EK",
  flightNumber: "EK826",
  originCode: "LHE",
  destinationCode: "DXB",
  departureDate: "2026-10-18",
  departTimeLocal: "02:20",
  arrivalDate: "2026-10-18",
  arriveTimeLocal: "04:40",
  durationMinutes: 200,
  layoverMinutesAfter: 164,
};

const booking = {
  id: "bk_1",
  currency: "PKR",
  amountMinor: 20791750,
  netMinor: 19075000,
  externalRef: "DEMO-DPTWZ7",
  metadata: {
    pricing: { input: { route: "LHE-LHR", cabin: "ECONOMY" } },
    supplierBooking: {
      ticket: {
        at: "2026-09-23T08:15:01.334Z",
        ticketNumbers: ["DEMO-EQDPTWZ7"],
        details: { demo: true },
      },
    },
  },
  supplierBookingRefs: {
    itinerary: {
      origin: "LHE",
      destination: "LHR",
      departureDate: "2026-10-18",
      cabin: "economy",
      carrier: "EK",
      segments: [segment],
    },
    fare: { priceBreakdown: { baseMinor: 19075000, taxesMinor: 1716750 } },
  },
  travellerSnapshot: { firstName: "Demo", lastName: "Traveller" },
};

describe("buildTicketDocument", () => {
  it("pulls PNR, tickets and passenger from a real booking", () => {
    const doc = buildTicketDocument(booking);
    expect(doc.pnr).toBe("DEMO-DPTWZ7");
    expect(doc.ticketNumbers).toEqual(["DEMO-EQDPTWZ7"]);
    expect(doc.passengerName).toBe("Demo Traveller");
    expect(doc.segments).toHaveLength(1);
    expect(doc.demo).toBe(true);
  });

  it("falls back to the route string when the itinerary has no codes", () => {
    const doc = buildTicketDocument({
      ...booking,
      supplierBookingRefs: { itinerary: {} },
    });
    expect(doc.originCode).toBe("LHE");
    expect(doc.destinationCode).toBe("LHR");
  });

  it("derives taxes from the total when no breakdown is present", () => {
    const doc = buildTicketDocument({ ...booking, supplierBookingRefs: {} });
    expect(doc.baseMinor).toBe(19075000);
    expect(doc.taxesMinor).toBe(20791750 - 19075000);
  });

  it("never claims a demo ticket when the supplier was real", () => {
    const doc = buildTicketDocument({
      ...booking,
      metadata: {
        supplierBooking: { ticket: { ticketNumbers: ["176-1234567890"], details: {} } },
      },
    });
    expect(doc.demo).toBe(false);
  });

  it("degrades to a usable document when metadata is empty", () => {
    const doc = buildTicketDocument({
      id: "bk_2",
      currency: "USD",
      amountMinor: 1000,
      metadata: null,
    });
    expect(doc.passengerName).toBe("Traveller");
    expect(doc.ticketNumbers).toEqual([]);
    expect(doc.segments).toEqual([]);
    expect(doc.totalMinor).toBe(1000);
  });

  it("drops malformed segments rather than rendering blank rows", () => {
    const doc = buildTicketDocument({
      ...booking,
      supplierBookingRefs: {
        itinerary: { segments: [segment, { carrier: "EK" }, null] },
      },
    });
    expect(doc.segments).toHaveLength(1);
  });
});

describe("formatters", () => {
  it("formats durations without producing 0h 0m", () => {
    expect(formatDuration(834)).toBe("13h 54m");
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(0)).toBeNull();
    expect(formatDuration(null)).toBeNull();
  });

  it("formats dates in UTC so the day never shifts", () => {
    expect(formatTicketDate("2026-10-18")).toBe("Sun, 18 Oct 2026");
    expect(formatTicketDate(null)).toBeNull();
    expect(formatTicketDate("nonsense")).toBeNull();
  });
});

describe("formatFlightNumber", () => {
  it("does not double a carrier prefix the supplier already applied", () => {
    // Real demo-corpus data: carrier "TK", flightNumber "TK745".
    expect(formatFlightNumber("TK", "TK745")).toBe("TK745");
  });

  it("adds the prefix when the number is bare", () => {
    expect(formatFlightNumber("EK", "826")).toBe("EK826");
  });

  it("degrades when either side is missing", () => {
    expect(formatFlightNumber("", "826")).toBe("826");
    expect(formatFlightNumber("EK", "")).toBe("EK");
  });
});
