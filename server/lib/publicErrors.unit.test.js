import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AppError } from "./customError.js";
import {
  isTechnicalErrorMessage,
  publicErrorMessage,
} from "./publicErrors.js";

describe("publicErrors", () => {
  it("flags Prisma / SQL messages as technical", () => {
    assert.equal(
      isTechnicalErrorMessage(
        "Invalid `prisma.user.findUnique()` invocation: The column `User.emailVerifiedAt` does not exist",
      ),
      true,
    );
  });

  it("keeps AppError product copy", () => {
    const err = new AppError(401, "Invalid credentials");
    assert.equal(publicErrorMessage(err), "Invalid credentials");
  });

  it("hides Prisma errors behind a friendly fallback", () => {
    const err = {
      code: "P2022",
      message:
        "Invalid `prisma.user.findUnique()` invocation:\nThe column `User.emailVerifiedAt` does not exist",
    };
    assert.match(publicErrorMessage(err), /try again/i);
    assert.equal(/prisma/i.test(publicErrorMessage(err)), false);
  });

  it("maps unique email conflicts", () => {
    const err = { code: "P2002", meta: { target: ["email"] } };
    assert.match(publicErrorMessage(err), /already registered/i);
  });
});
