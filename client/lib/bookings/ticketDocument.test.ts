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

  it("extracts multi-city legs and hops for complex multi-trip itineraries", () => {
    const multiCityBooking = {
      id: "bk_multi",
      currency: "PKR",
      amountMinor: 48225900,
      externalRef: "DEMO-MULTI7",
      metadata: {
        hops: ["LHE", "LHR", "SFO", "MCO", "LHE"],
        tripLegs: [
          {
            originCode: "LHE",
            destinationCode: "LHR",
            airlineCode: "RX",
            flightNumber: "RX101",
            departureDate: "2026-11-05",
            departTimeLocal: "09:30",
            arriveTimeLocal: "14:15",
            durationMinutes: 525,
            cabin: "economy",
          },
          {
            originCode: "LHR",
            destinationCode: "SFO",
            airlineCode: "B6",
            flightNumber: "B642",
            departureDate: "2026-11-07",
            departTimeLocal: "11:00",
            arriveTimeLocal: "14:30",
            durationMinutes: 630,
            cabin: "economy",
          },
          {
            originCode: "MCO",
            destinationCode: "LHE",
            airlineCode: "QR",
            flightNumber: "QR732",
            departureDate: "2026-11-22",
            departTimeLocal: "18:00",
            arriveTimeLocal: "22:45",
            durationMinutes: 945,
            cabin: "economy",
          },
        ],
      },
      supplierBookingRefs: {},
      travellerSnapshot: { firstName: "Ahmad", lastName: "Khan" },
    };

    const doc = buildTicketDocument(multiCityBooking);
    expect(doc.isMultiCity).toBe(true);
    expect(doc.hops).toEqual(["LHE", "LHR", "SFO", "MCO", "LHE"]);
    expect(doc.legs).toHaveLength(3);
    expect(doc.legs?.[0]?.originCode).toBe("LHE");
    expect(doc.legs?.[0]?.destinationCode).toBe("LHR");
    expect(doc.legs?.[1]?.originCode).toBe("LHR");
    expect(doc.legs?.[1]?.destinationCode).toBe("SFO");
    expect(doc.legs?.[2]?.originCode).toBe("MCO");
    expect(doc.legs?.[2]?.destinationCode).toBe("LHE");
    expect(doc.segments).toHaveLength(3);
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
