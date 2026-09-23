import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildJourneyItinerary, buildJourneySummary } from "./journey.details.js";

const seg = (o, d, over = {}) => ({
  carrier: "TK",
  flightNumber: "TK310",
  originCode: o,
  destinationCode: d,
  departureDate: "2026-10-18",
  departTimeLocal: "07:15",
  arrivalDate: "2026-10-18",
  arriveTimeLocal: "11:30",
  durationMinutes: 375,
  ...over,
});

describe("buildJourneyItinerary", () => {
  it("reads flown sectors from supplierBookingRefs, not just metadata", () => {
    // The real demo booking shape: metadata has no route fields at all.
    const booking = {
      product: "FLIGHT",
      metadata: { pricing: { input: { route: "LHE-LHR", cabin: "ECONOMY" } } },
      supplierBookingRefs: {
        itinerary: {
          origin: "LHE",
          destination: "LHR",
          cabin: "economy",
          segments: [
            seg("LHE", "IST", { layoverMinutesAfter: 290 }),
            seg("IST", "LHR", {
              flightNumber: "TK92",
              departTimeLocal: "16:20",
              arriveTimeLocal: "18:20",
              durationMinutes: 240,
            }),
          ],
        },
      },
    };
    const [leg] = buildJourneyItinerary({ watch: {}, booking });
    assert.equal(leg.kind, "FLIGHT");
    assert.equal(leg.origin, "LHE");
    assert.equal(leg.destination, "LHR");
    assert.equal(leg.flightNumber, "TK310");
    assert.equal(leg.departTimeLocal, "07:15");
    assert.equal(leg.arriveTimeLocal, "18:20");
    assert.equal(leg.stops, 1);
    // Flight time + the connection, not flight time alone.
    assert.equal(leg.durationMinutes, 375 + 290 + 240);
    assert.equal(leg.segments.length, 2);
  });

  it("splits a round trip into outbound and return", () => {
    const booking = {
      product: "FLIGHT",
      metadata: {},
      supplierBookingRefs: {
        itinerary: {
          segments: [seg("LHE", "DXB")],
          returnSegments: [seg("DXB", "LHE", { departureDate: "2026-10-25" })],
        },
      },
    };
    const items = buildJourneyItinerary({ watch: {}, booking });
    assert.deepEqual(items.map((i) => i.label), ["Outbound", "Return"]);
    assert.equal(buildJourneySummary({ booking, itinerary: items }).tripType, "round_trip");
  });

  it("lists every multi-city leg, attaching sectors only where they match", () => {
    const booking = {
      product: "FLIGHT",
      metadata: {
        tripLegs: [
          { originCode: "LHE", destinationCode: "LHR", departureDate: "2026-11-05", airlineCode: "EK" },
          { originCode: "LHR", destinationCode: "CDG", departureDate: "2026-11-09", airlineCode: "BA" },
          { originCode: "CDG", destinationCode: "LHE", departureDate: "2026-11-14", airlineCode: "QR" },
        ],
      },
      supplierBookingRefs: {
        itinerary: { origin: "LHE", destination: "LHE", segments: [seg("LHE", "LHR")] },
      },
    };
    const items = buildJourneyItinerary({ watch: {}, booking });
    assert.equal(items.length, 3);
    assert.equal(items[0].segments.length, 1);
    // Leg 2 and 3 have no persisted sectors — never borrow leg 1's.
    assert.equal(items[1].segments.length, 0);
    assert.equal(items[1].origin, "LHR");
    assert.equal(items[2].carrier, "QR");
    const summary = buildJourneySummary({ booking, itinerary: items });
    assert.equal(summary.tripType, "multi_city");
    assert.deepEqual(summary.stops, ["LHE", "LHR", "CDG", "LHE"]);
  });

  it("renders a hotel as a stay, not a flight", () => {
    const booking = {
      product: "HOTEL",
      externalRef: "HTL-884201",
      metadata: {
        route: "Dubai · 3 nights",
        hotel: { name: "Rove Downtown Dubai", checkInDate: "2026-10-14", checkOutDate: "2026-10-17" },
      },
    };
    const items = buildJourneyItinerary({ watch: {}, booking });
    assert.equal(items.length, 1);
    assert.equal(items[0].kind, "HOTEL");
    assert.equal(items[0].hotelName, "Rove Downtown Dubai");
    assert.equal(items[0].nights, 3);
    assert.equal(items[0].city, "Dubai");
    assert.equal(buildJourneySummary({ booking, itinerary: items }).tripType, "stay");
  });

  it("reads nights from the legacy route text when there is no hotel record", () => {
    const booking = { product: "HOTEL", metadata: { route: "Dubai · 3 nights" } };
    const [stay] = buildJourneyItinerary({ watch: {}, booking });
    assert.equal(stay.nights, 3);
    assert.equal(stay.hotelName, null);
  });

  it("returns nothing it cannot back up", () => {
    assert.deepEqual(buildJourneyItinerary({ watch: {}, booking: null }), []);
  });
});

describe("multi-city legs without sectors", () => {
  it("uses the leg's own times instead of leaving them blank", () => {
    // Shape of the stored tripLegs on real demo bookings.
    const booking = {
      product: "FLIGHT",
      metadata: {
        tripLegs: [
          { originCode: "LHE", destinationCode: "LHR", departureDate: "2026-11-05", airlineCode: "EK" },
          {
            originCode: "LHR",
            destinationCode: "CDG",
            departureDate: "2026-11-09",
            airlineCode: "BA",
            flightNumber: "BA676",
            departTimeLocal: "01:00",
            arriveTimeLocal: "03:20",
            durationMinutes: 80,
            cabin: "economy",
          },
        ],
      },
    };
    const [, second] = buildJourneyItinerary({ watch: {}, booking });
    assert.equal(second.flightNumber, "BA676");
    assert.equal(second.departTimeLocal, "01:00");
    assert.equal(second.arriveTimeLocal, "03:20");
    assert.equal(second.durationMinutes, 80);
    assert.equal(second.cabin, "economy");
    // Stop count is not stored — do not claim "non-stop".
    assert.equal(second.stops, null);
    assert.equal(second.segments.length, 0);
  });
});
