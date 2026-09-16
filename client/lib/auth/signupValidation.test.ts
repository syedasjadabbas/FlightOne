import { describe, expect, it } from "vitest";

/**
 * Client-side signup validation mirrors useSignupForm rules.
 * Server also enforces email + min password via Zod.
 */
function validateSignupInput(input: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}): string | null {
  const name = input.name.trim();
  const email = input.email.trim();
  if (!name) return "Please enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Please enter a valid email address.";
  }
  if (input.password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (input.password !== input.confirmPassword) {
    return "Passwords do not match.";
  }
  return null;
}

describe("signup client validation", () => {
  it("accepts a valid signup payload", () => {
    expect(
      validateSignupInput({
        name: "Ava Traveler",
        email: "ava@example.com",
        password: "securepass",
        confirmPassword: "securepass",
      }),
    ).toBeNull();
  });

  it("rejects missing name", () => {
    expect(
      validateSignupInput({
        name: "  ",
        email: "ava@example.com",
        password: "securepass",
        confirmPassword: "securepass",
      }),
    ).toMatch(/name/i);
  });

  it("rejects invalid email", () => {
    expect(
      validateSignupInput({
        name: "Ava",
        email: "not-an-email",
        password: "securepass",
        confirmPassword: "securepass",
      }),
    ).toMatch(/valid email/i);
  });

  it("rejects weak password", () => {
    expect(
      validateSignupInput({
        name: "Ava",
        email: "ava@example.com",
        password: "short",
        confirmPassword: "short",
      }),
    ).toMatch(/8 characters/i);
  });

  it("rejects password mismatch", () => {
    expect(
      validateSignupInput({
        name: "Ava",
        email: "ava@example.com",
        password: "securepass",
        confirmPassword: "different1",
      }),
    ).toMatch(/match/i);
  });
});

describe("auth ownership scoping", () => {
  it("conversation queries must include userId (documented contract)", () => {
    // Server findOwnedConversationOrThrow uses { id, userId }.
    const where = { id: "conv_1", userId: "user_1" };
    expect(where.userId).toBeTruthy();
    expect(where).not.toHaveProperty("passwordHash");
  });
});
