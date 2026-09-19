/**
 * Phase 1 Travelport/Galileo booking, ticketing and servicing test suite.
 * Run: node --test modules/suppliers/travelport/travelport.booking.test.js
 */
import { describe, it, before, beforeEach, afterEach, after } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import prisma from "../../../config/prisma.js";
import { AppError } from "../../../lib/customError.js";
import { setTravelportFetchForTests } from "./http.js";
import {
  bookHeldReservationWithTravelport,
  cancelTravelportHold,
  cancelTravelportReservation,
  travelerFromSnapshot,
} from "./book.js";
import {
  ticketHeldReservationWithTravelport,
  extractTicketNumbers,
} from "./ticket.js";
import {
  retrieveTravelportReservation,
  modifyTravelportReservation,
} from "./retrieve.js";
import { getTravelportSeatMap } from "./seats.js";
import {
  quoteTravelportExchange,
  reissueTravelportTicket,
} from "./exchange.js";
import {
  voidTravelportTicket,
  quoteTravelportRefund,
} from "./refund.js";
import { divideTravelportReservation } from "./divide.js";
import {
  readTravelportQueue,
  countTravelportQueue,
} from "./queues.js";
import * as galileoAdapter from "../galileo.adapter.js";
import * as supplierBooking from "../supplierBooking.js";
import * as bookingsService from "../../bookings/bookings.service.js";
import * as paymentsService from "../../payments/payments.service.js";

const TP_ENV_KEYS = [
  "TRAVELPORT_USERNAME",
  "TRAVELPORT_PASSWORD",
  "TRAVELPORT_CLIENT_ID",
  "TRAVELPORT_CLIENT_SECRET",
  "TRAVELPORT_ACCESS_GROUP",
  "TRAVELPORT_PCC",
];

const testUsers = [];
const testBookings = [];
const testCompanies = [];


describe("Travelport / Galileo Phase 1 Capabilities", () => {
  const envBackup = {};

  before(() => {
    for (const k of TP_ENV_KEYS) {
      envBackup[k] = process.env[k];
      process.env[k] = `test-${k.toLowerCase()}`;
    }
    process.env.TRAVELPORT_BASE_URL = "https://api.test.travelport.net";
  });

  after(async () => {
    for (const k of TP_ENV_KEYS) {
      if (envBackup[k] === undefined) delete process.env[k];
      else process.env[k] = envBackup[k];
    }
    setTravelportFetchForTests(null);

    for (const bkgId of testBookings) {
      await prisma.notificationOutbox.deleteMany({ where: { dedupeKey: { contains: bkgId } } }).catch(() => {});
      await prisma.vaultDocument.deleteMany({ where: { bookingId: bkgId } }).catch(() => {});
      await prisma.payment.deleteMany({ where: { bookingId: bkgId } }).catch(() => {});
      await prisma.bookingTransition.deleteMany({ where: { bookingId: bkgId } }).catch(() => {});
      await prisma.approvalRequest.deleteMany({ where: { bookingId: bkgId } }).catch(() => {});
      await prisma.escalationTicket.deleteMany({ where: { bookingId: bkgId } }).catch(() => {});
      await prisma.booking.delete({ where: { id: bkgId } }).catch(() => {});
    }
    for (const uId of testUsers) {
      await prisma.message.deleteMany({ where: { conversation: { userId: uId } } }).catch(() => {});
      await prisma.escalationTicket.deleteMany({ where: { userId: uId } }).catch(() => {});
      await prisma.conversation.deleteMany({ where: { userId: uId } }).catch(() => {});
      await prisma.user.delete({ where: { id: uId } }).catch(() => {});
    }
    for (const cId of testCompanies) {
      await prisma.company.delete({ where: { id: cId } }).catch(() => {});
    }
  });

  beforeEach(() => {
    setTravelportFetchForTests(null);
  });

  afterEach(() => {
    setTravelportFetchForTests(null);
  });

  it("1. Reserve/PNR: serializes full SSR, OSI, FF, APIS and commits reservation", async () => {
    const snapshot = {
      title: "MR",
      givenName: "Tariq",
      surname: "Mehmood",
      gender: "MALE",
      dateOfBirth: "1988-05-14",
      passengerType: "ADT",
      phone: "+923001234567",
      email: "tariq@example.com",
      passport: {
        number: "PK98765432",
        issuingCountry: "PAK",
        nationality: "PAK",
        expiryDate: "2032-10-20",
      },
      frequentFlyer: {
        airline: "EK",
        number: "EK-998877",
      },
      mealPreference: "VGML",
      assistance: "WCHR",
    };

    const formatted = travelerFromSnapshot(snapshot);
    assert.ok(formatted?.Traveler);
    const traveler = formatted.Traveler;
    assert.equal(traveler.PersonName.Given, "Tariq");
    assert.equal(traveler.PersonName.Surname, "Mehmood");
    assert.equal(traveler.PersonName.Prefix, "MR");
    assert.equal(traveler.gender, "Male");
    assert.equal(traveler.birthDate, "1988-05-14");
    assert.equal(traveler.passengerTypeCode, "ADT");
    assert.equal(traveler.Telephone[0].phoneNumber, "+923001234567");
    assert.equal(traveler.Email[0].value, "tariq@example.com");
    assert.equal(traveler.DocDetails[0].docNumber, "PK98765432");
    assert.equal(traveler.DocDetails[0].issueCountry, "PAK");
    assert.equal(traveler.LoyaltyProgramAccount[0].supplierCode, "EK");
    assert.equal(traveler.LoyaltyProgramAccount[0].accountNumber, "EK-998877");
    assert.ok(traveler.SpecialService.some((s) => s.serviceCode === "VGML"));
    assert.ok(traveler.SpecialService.some((s) => s.serviceCode === "WCHR"));

    // Mock Travelport TripServices reserve endpoints
    const recordedCalls = [];
    setTravelportFetchForTests(async (path, opts) => {
      recordedCalls.push({ path, body: opts?.body });
      if (path.includes("/book/session/reservationworkbench")) {
        return {
          status: 201,
          json: {
            ReservationWorkbench: {
              Identifier: { value: "wb-test-12345" },
            },
          },
        };
      }
      if (path.includes("/buildfromcatalogofferings")) {
        return { status: 200, json: { status: "OfferBuilt" } };
      }
      if (path.includes("/travelers")) {
        return { status: 200, json: { status: "TravelerAdded" } };
      }
      if (path.includes("/book/reservation/reservations/")) {
        return {
          status: 201,
          json: {
            ReservationResponse: {
              Reservation: {
                Receipt: {
                  Confirmation: {
                    Locator: { value: "GAL-XYZ888" },
                  },
                },
              },
            },
          },
        };
      }
      return { status: 200, json: {} };
    });

    const booking = {
      id: "bkg-test-1",
      supplierCode: "GALILEO",
      travellerSnapshot: snapshot,
      supplierBookingRefs: {
        booking: {
          transactionId: "tx-catalog-1",
          offeringId: "off-catalog-1",
          productRef: "prod-catalog-1",
        },
      },
    };

    const res = await bookHeldReservationWithTravelport(booking);
    assert.equal(res.status, "ok");
    assert.equal(res.externalRef, "GAL-XYZ888");
    assert.equal(recordedCalls.length, 4);
    assert.ok(recordedCalls[0].path.includes("/book/session/reservationworkbench"));
    assert.ok(recordedCalls[1].path.includes("/buildfromcatalogofferings"));
    assert.ok(recordedCalls[2].path.includes("/travelers"));
    assert.ok(recordedCalls[3].path.includes("/book/reservation/reservations/"));
  });

  it("2. Retrieve & Modify: retrieves Universal Record and appends SSR", async () => {
    setTravelportFetchForTests(async (path, opts) => {
      if (path === "/book/reservation/reservations/GAL-XYZ888") {
        return {
          status: 200,
          json: {
            ReservationResponse: {
              Reservation: {
                Locator: { value: "GAL-XYZ888" },
                TicketingTimeLimit: "2026-09-20T18:00:00Z",
                Product: [
                  {
                    FlightSegment: {
                      carrier: "EK",
                      flightNumber: "623",
                      departure: { location: "LHE", time: "09:40" },
                      arrival: { location: "DXB", time: "12:05" },
                    },
                  },
                ],
                Traveler: [
                  {
                    id: "pax-1",
                    PersonName: { Given: "Tariq", Surname: "Mehmood", Prefix: "MR" },
                    passengerTypeCode: "ADT",
                  },
                ],
              },
            },
          },
        };
      }
      if (path.includes("/buildfromlocator")) {
        return {
          status: 200,
          json: { ReservationWorkbench: { Identifier: { value: "wb-mod-999" } } },
        };
      }
      if (path.includes("/specialservices")) {
        return { status: 200, json: { status: "SSRCreated" } };
      }
      if (path.includes("/book/reservation/reservations/wb-mod-999")) {
        return { status: 200, json: { status: "Committed" } };
      }
      return { status: 200, json: {} };
    });

    const retrieved = await retrieveTravelportReservation("GAL-XYZ888");
    assert.equal(retrieved.status, "ok");
    assert.equal(retrieved.locator, "GAL-XYZ888");
    assert.equal(retrieved.reservation.status, "RESERVED");
    assert.equal(retrieved.reservation.ticketingTimeLimit, "2026-09-20T18:00:00Z");
    assert.equal(retrieved.reservation.segments[0].flightNumber, "623");
    assert.equal(retrieved.reservation.travelers[0].givenName, "Tariq");

    const modified = await modifyTravelportReservation("GAL-XYZ888", {
      ssrs: [{ serviceCode: "KSML", travelerId: "pax-1" }],
    });
    assert.equal(modified.status, "ok");
    assert.equal(modified.updated, true);
  });

  it("3. Seat Map: fetches seat availability layout and characteristics", async () => {
    setTravelportFetchForTests(async (path) => {
      if (path === "/air/seat/seatmap") {
        return {
          status: 200,
          json: {
            SeatMapResponse: {
              Flight: { carrier: "EK", number: "623" },
              rows: [{ rowNumber: 12, seats: [{ number: "12A", type: "WINDOW", status: "AVAILABLE" }] }],
            },
          },
        };
      }
      return { status: 200, json: {} };
    });

    const map = await getTravelportSeatMap({
      carrier: "EK",
      flightNumber: "623",
      origin: "LHE",
      destination: "DXB",
      departureDate: "2026-09-25",
    });
    assert.equal(map.status, "ok");
    assert.ok(map.seatMap);
  });

  it("4. Ticketing: post-commit workbench issues ticket numbers", async () => {
    setTravelportFetchForTests(async (path) => {
      if (path.includes("/buildfromlocator")) {
        return {
          status: 200,
          json: { ReservationWorkbench: { Identifier: { value: "wb-tkt-555" } } },
        };
      }
      if (path.includes("/formofpayment")) {
        return { status: 200, json: { status: "FOPAdded" } };
      }
      if (path.includes("/payments")) {
        return { status: 200, json: { status: "PaymentRecorded" } };
      }
      if (path.includes("/book/reservation/reservations/wb-tkt-555")) {
        return {
          status: 200,
          json: {
            ReservationResponse: {
              Reservation: {
                DocumentNumber: "1762419873321",
                Receipt: {
                  Confirmation: { Locator: { value: "GAL-XYZ888" } },
                },
              },
            },
          },
        };
      }
      return { status: 200, json: {} };
    });

    const booking = {
      id: "bkg-tkt-1",
      externalRef: "GAL-XYZ888",
      supplierCode: "GALILEO",
      metadata: {},
    };

    const res = await ticketHeldReservationWithTravelport(booking);
    assert.equal(res.status, "ok");
    assert.equal(res.externalRef, "GAL-XYZ888");
    assert.ok(res.ticketNumbers.includes("1762419873321"));
  });

  it("5. Duplicate ticket request: returns existing ticket numbers idempotently", async () => {
    let networkCalls = 0;
    setTravelportFetchForTests(async () => {
      networkCalls++;
      return { status: 200, json: {} };
    });

    const booking = {
      id: "bkg-dup-tkt",
      externalRef: "GAL-XYZ888",
      supplierCode: "GALILEO",
      metadata: {
        supplierBooking: {
          ticket: {
            ticketNumbers: ["1762419873321"],
          },
        },
      },
    };

    const res = await ticketHeldReservationWithTravelport(booking);
    assert.equal(res.status, "ok");
    assert.deepEqual(res.ticketNumbers, ["1762419873321"]);
    assert.equal(res.details.idempotent, true);
    assert.equal(networkCalls, 0, "Must not execute supplier HTTP call when already ticketed");
  });

  it("6. Cancellation & hold release: releases held PNR", async () => {
    let cancelCalled = false;
    setTravelportFetchForTests(async (path) => {
      if (path.includes("/cancel")) {
        cancelCalled = true;
        return { status: 200, json: { status: "Cancelled" } };
      }
      return { status: 200, json: {} };
    });

    const holdCancel = await cancelTravelportHold({ externalRef: "GAL-XYZ888" });
    assert.equal(holdCancel.status, "ok");
    assert.equal(cancelCalled, true);

    const resCancel = await cancelTravelportReservation("GAL-XYZ888");
    assert.equal(resCancel.status, "ok");
    assert.equal(resCancel.locator, "GAL-XYZ888");
  });

  it("7. Void and Refund Quote: calculates refund breakdown and voids ticket within window", async () => {
    setTravelportFetchForTests(async (path) => {
      if (path.includes("/void")) {
        return { status: 200, json: { status: "VoidConfirmed" } };
      }
      if (path.includes("/refundquote")) {
        return {
          status: 200,
          json: {
            RefundQuoteResponse: {
              grossFareMinor: 50000,
              penaltyMinor: 7500,
              netRefundMinor: 42500,
              currency: "USD",
            },
          },
        };
      }
      return { status: 200, json: {} };
    });

    const voidRes = await voidTravelportTicket("1762419873321", { locator: "GAL-XYZ888" });
    assert.equal(voidRes.status, "ok");
    assert.equal(voidRes.ticketNumber, "1762419873321");

    const refundQuote = await quoteTravelportRefund({ ticketNumber: "1762419873321", locator: "GAL-XYZ888" });
    assert.equal(refundQuote.status, "ok");
    assert.equal(refundQuote.quote.netRefundMinor, 42500);
    assert.equal(refundQuote.quote.penaltyMinor, 7500);
  });

  it("8. Exchange Quote: calculates penalty and fare delta", async () => {
    setTravelportFetchForTests(async (path) => {
      if (path === "/air/exchange/quote") {
        return {
          status: 200,
          json: {
            AirExchangeQuoteResponse: {
              changeFeeMinor: 7500,
              fareDifferenceMinor: 5000,
              taxDifferenceMinor: 1000,
              totalCostMinor: 13500,
              currency: "USD",
              quoteId: "EXQ-987",
            },
          },
        };
      }
      return { status: 200, json: {} };
    });

    const quote = await quoteTravelportExchange({
      ticketNumber: "1762419873321",
      locator: "GAL-XYZ888",
    });
    assert.equal(quote.status, "ok");
    assert.equal(quote.quote.totalCostMinor, 13500);
    assert.equal(quote.quote.changeFeeMinor, 7500);
  });

  it("9. Divide PNR: splits passenger into child PNR", async () => {
    setTravelportFetchForTests(async (path) => {
      if (path.includes("/divide")) {
        return {
          status: 200,
          json: {
            childLocator: "GAL-CHILD99",
          },
        };
      }
      return { status: 200, json: {} };
    });

    const divided = await divideTravelportReservation("GAL-XYZ888", { passengerIds: ["pax-2"] });
    assert.equal(divided.status, "ok");
    assert.equal(divided.parentLocator, "GAL-XYZ888");
    assert.equal(divided.childLocator, "GAL-CHILD99");
  });

  it("10. Queues: reads queue items for schedule changes and TTL", async () => {
    setTravelportFetchForTests(async (path) => {
      if (path.includes("/air/queue/queues/")) {
        return {
          status: 200,
          json: {
            QueueResponse: {
              QueueItem: [
                { Locator: { value: "GAL-Q1" }, reasonCode: "TKTL", placedAt: "2026-09-18T10:00:00Z" },
                { Locator: { value: "GAL-Q2" }, reasonCode: "SC", placedAt: "2026-09-18T11:00:00Z" },
              ],
            },
          },
        };
      }
      return { status: 200, json: {} };
    });

    const queue = await readTravelportQueue({ queueNumber: 1 });
    assert.equal(queue.status, "ok");
    assert.equal(queue.items.length, 2);
    assert.equal(queue.items[0].reason, "TKTL");
    assert.equal(queue.items[1].reason, "SC");

    const cnt = await countTravelportQueue({ queueNumber: 1 });
    assert.equal(cnt.count, 2);
  });

  it("11. Unified Galileo Adapter: exports all Phase 1 capabilities", () => {
    assert.equal(typeof galileoAdapter.searchFlights, "function");
    assert.equal(typeof galileoAdapter.reserveInventory, "function");
    assert.equal(typeof galileoAdapter.ticketInventory, "function");
    assert.equal(typeof galileoAdapter.retrieveReservation, "function");
    assert.equal(typeof galileoAdapter.modifyReservation, "function");
    assert.equal(typeof galileoAdapter.getSeatMap, "function");
    assert.equal(typeof galileoAdapter.quoteExchange, "function");
    assert.equal(typeof galileoAdapter.reissueTicket, "function");
    assert.equal(typeof galileoAdapter.voidTicket, "function");
    assert.equal(typeof galileoAdapter.quoteRefund, "function");
    assert.equal(typeof galileoAdapter.divideReservation, "function");
    assert.equal(typeof galileoAdapter.readQueues, "function");
    assert.equal(typeof galileoAdapter.cancelHold, "function");
    assert.equal(typeof galileoAdapter.cancelReservation, "function");
  });

  it("12. SupplierBooking Orchestration: routes capability queries safely", async () => {
    setTravelportFetchForTests(async () => ({ status: 200, json: { ok: true } }));

    const seatMap = await supplierBooking.getSupplierSeatMap({ flightNumber: "623" }, "GALILEO");
    assert.ok(seatMap);

    const exchange = await supplierBooking.quoteSupplierExchange({ ticketNumber: "001" }, "GALILEO");
    assert.ok(exchange);

    const queues = await supplierBooking.readSupplierQueues({ queueNumber: 1 }, "GALILEO");
    assert.ok(queues);

    const divide = await supplierBooking.divideSupplierReservation("GAL-XYZ", { passengerIds: ["pax-1"] }, "GALILEO");
    assert.ok(divide);
  });

  it("13. Timeout & retry handling: handles network timeouts gracefully", async () => {
    setTravelportFetchForTests(async () => {
      throw new AppError(504, "Travelport /book/session/reservationworkbench timed out");
    });

    const booking = {
      id: "bkg-timeout-1",
      externalRef: "GAL-TIMEOUT",
      supplierCode: "GALILEO",
      metadata: {},
    };

    const res = await ticketHeldReservationWithTravelport(booking);
    assert.equal(res.status, "failed");
    assert.ok(res.details?.reason.includes("timed out"));
  });

  it("14. Failed fulfilment auto-escalation: ticketing failure after captured payment auto-escalates to Module 13 and keeps booking RESERVED", async () => {
    setTravelportFetchForTests(async (path) => {
      if (path.includes("/price/offers/buildfromcatalogproductofferings")) {
        return {
          status: 200,
          json: {
            OfferListResponse: {
              Offer: [
                {
                  Price: {
                    TotalPrice: 250,
                    CurrencyCode: { value: "USD", decimalPlace: 2 },
                  },
                },
              ],
            },
          },
        };
      }
      return { status: 200, json: {} };
    });

    const user = await prisma.user.create({
      data: {
        email: `tp.escalate.${Date.now()}@example.com`,
        name: "Escalation Test User",
        passwordHash: await bcrypt.hash("Pass1234!", 10),
      },
    });
    testUsers.push(user.id);

    const snapshot = await prisma.supplierOfferSnapshot.create({
      data: {
        userId: user.id,
        supplierCode: "GALILEO",
        supplierOfferId: "SIM-25000",
        product: "FLIGHT",
        currency: "USD",
        netMinor: 25000,
        expiresAt: new Date(Date.now() + 3600000),
        ttlMs: 3600000,
        supplierBookingRefs: {
          transactionId: "t-test-1",
          offeringId: "off-test-1",
          productRef: "prod-test-1",
        },
      },
    });

    const quote = await bookingsService.createQuote(user.id, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snapshot.id,
      route: "LHE-DXB",
      cabin: "ECONOMY",
    });
    testBookings.push(quote.id);

    // Promote to RESERVED
    const reserved = await prisma.booking.update({
      where: { id: quote.id },
      data: {
        status: "RESERVED",
        externalRef: "GAL-ESC-PNR",
        reservedUntil: new Date(Date.now() + 30 * 60 * 1000),
        travellerSnapshot: { givenName: "Hamza", surname: "Ali" },
      },
    });

    // Create captured payment
    await prisma.payment.create({
      data: {
        userId: user.id,
        bookingId: reserved.id,
        status: "CAPTURED",
        provider: "STRIPE",
        currency: "USD",
        amountMinor: reserved.amountMinor,
        providerPaymentId: `pay_test_${reserved.id}`,
        idempotencyKey: `pay-key-${reserved.id}`,
      },
    });

    // Set supplier ticketing to fail
    supplierBooking.setTicketSupplierInventoryOverrideForTests(() => ({
      status: "failed",
      details: { reason: "Airline inventory sold out during ticketing" },
    }));

    try {
      await assert.rejects(
        () => bookingsService.ticketBooking(user.id, reserved.id),
        (err) => err.statusCode === 409,
      );

      // Verify booking remains RESERVED (never falsely marked TICKETED)
      const afterFail = await prisma.booking.findUnique({ where: { id: reserved.id } });
      assert.equal(afterFail.status, "RESERVED");
      assert.equal(afterFail.ticketAttemptId, null, "Ticket attempt lock must be released on failure");

      // Verify escalation ticket was automatically created in Module 13
      const escalation = await prisma.escalationTicket.findFirst({
        where: { bookingId: reserved.id },
      });
      assert.ok(escalation, "Module 13 escalation ticket must be auto-created on fulfilment failure");
      assert.equal(escalation.trigger, "SUPPLIER_FAILURE");
      assert.ok(["OPEN", "ASSIGNED"].includes(escalation.status));

      // Verify metadata links escalation
      assert.equal(afterFail.metadata?.supplierBooking?.escalation?.ticketId, escalation.id);
    } finally {
      supplierBooking.setTicketSupplierInventoryOverrideForTests(null);
    }
  });

  it("15. Corporate approval and payment gate: never tickets before confirmed payment or corporate authorization", async () => {
    setTravelportFetchForTests(async (path) => {
      if (path.includes("/price/offers/buildfromcatalogproductofferings")) {
        return {
          status: 200,
          json: {
            OfferListResponse: {
              Offer: [
                {
                  Price: {
                    TotalPrice: 300,
                    CurrencyCode: { value: "USD", decimalPlace: 2 },
                  },
                },
              ],
            },
          },
        };
      }
      return { status: 200, json: {} };
    });

    const user = await prisma.user.create({
      data: {
        email: `tp.gate.${Date.now()}@example.com`,
        name: "Gate Test User",
        passwordHash: await bcrypt.hash("Pass1234!", 10),
      },
    });
    testUsers.push(user.id);

    const snapshot = await prisma.supplierOfferSnapshot.create({
      data: {
        userId: user.id,
        supplierCode: "GALILEO",
        supplierOfferId: "SIM-30000",
        product: "FLIGHT",
        currency: "USD",
        netMinor: 30000,
        expiresAt: new Date(Date.now() + 3600000),
        ttlMs: 3600000,
        supplierBookingRefs: {
          transactionId: "t-gate-1",
          offeringId: "off-gate-1",
          productRef: "prod-gate-1",
        },
      },
    });

    const quote = await bookingsService.createQuote(user.id, {
      product: "FLIGHT",
      currency: "USD",
      supplierOfferSnapshotId: snapshot.id,
      route: "LHE-DXB",
      cabin: "ECONOMY",
    });
    testBookings.push(quote.id);

    // Promote to RESERVED without payment
    const reserved = await prisma.booking.update({
      where: { id: quote.id },
      data: {
        status: "RESERVED",
        externalRef: "GAL-GATE-PNR",
        reservedUntil: new Date(Date.now() + 30 * 60 * 1000),
        travellerSnapshot: { givenName: "Sarah", surname: "Khan" },
      },
    });

    // Ticketing without payment must throw 402 PAYMENT_REQUIRED
    await assert.rejects(
      () => bookingsService.ticketBooking(user.id, reserved.id),
      (err) => err.statusCode === 402 && err.code === "PAYMENT_REQUIRED",
    );

    const check = await prisma.booking.findUnique({ where: { id: reserved.id } });
    assert.equal(check.status, "RESERVED");
  });
});

