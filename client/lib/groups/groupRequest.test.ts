import { describe, expect, it } from "vitest";
import {
  formatGroupRequestSubmitError,
  isValidGroupPassengerCount,
  MIN_GROUP_PASSENGERS,
} from "./groupRequest";

describe("groupRequest", () => {
  it("enforces the 10-passenger minimum", () => {
    expect(MIN_GROUP_PASSENGERS).toBe(10);
    expect(isValidGroupPassengerCount(9)).toBe(false);
    expect(isValidGroupPassengerCount(10)).toBe(true);
    expect(isValidGroupPassengerCount(12)).toBe(true);
  });
});

describe("formatGroupRequestSubmitError", () => {
  it("maps group size below 10", () => {
    expect(
      formatGroupRequestSubmitError({
        status: 400,
        data: { message: "Group travel requires at least 10 passengers" },
      }),
    ).toBe("Group travel requests require at least 10 travellers.");
  });

  it("maps joined zod origin and passenger messages without dumping raw text", () => {
    const msg = formatGroupRequestSubmitError({
      status: 400,
      data: {
        message:
          "origin and destination must be 2–10 letters (IATA or city code); Number must be greater than or equal to 1",
      },
    });
    expect(msg).toContain("Please enter a valid origin and destination");
    expect(msg).not.toMatch(/IATA|zod|prisma/i);
  });

  it("maps missing required field copy", () => {
    expect(
      formatGroupRequestSubmitError({
        status: 400,
        data: { message: "String must contain at least 1 character(s)" },
      }),
    ).toBe("Please complete the required fields.");
  });

  it("maps invalid dates", () => {
    expect(
      formatGroupRequestSubmitError({
        status: 400,
        data: { message: "Invalid date" },
      }),
    ).toBe("Please select a valid travel date.");
  });

  it("maps duplicate idempotency / 409", () => {
    expect(
      formatGroupRequestSubmitError({
        status: 409,
        data: { message: "Idempotency key already used" },
      }),
    ).toBe("This request has already been submitted.");
  });

  it("maps unauthorized / expired session", () => {
    expect(
      formatGroupRequestSubmitError({
        status: 401,
        data: { message: "Authentication required" },
      }),
    ).toBe("Your session has expired. Please sign in again.");
  });

  it("maps network and 500 failures without internals", () => {
    expect(formatGroupRequestSubmitError({ status: "FETCH_ERROR" })).toBe(
      "We couldn’t submit your request right now. Please try again in a moment.",
    );
    expect(
      formatGroupRequestSubmitError({
        status: 500,
        data: { message: "prisma:error Unique constraint failed on the fields: (`id`)" },
      }),
    ).toBe("We couldn’t submit your request right now. Please try again in a moment.");
  });
});
