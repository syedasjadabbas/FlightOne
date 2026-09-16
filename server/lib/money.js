/**
 * Integer minor-units money helpers — no floats, ever (dev guide §5 / §7:
 * "pricing is computed and re-validated server-side"; a float fare is a
 * customer-facing bug waiting to happen).
 *
 * Every money value in this codebase is a whole number in the currency's
 * smallest unit (e.g. cents for USD, paisa for PKR) plus an explicit ISO 4217
 * currency code. Amounts are never divided/multiplied by non-integers in the
 * booking/pricing path — only compared, added, and subtracted as integers.
 * `formatMinorAsMajor` is display-only; never feed its output back into math.
 */
import { AppError } from "./customError.js";

const CURRENCY_CODE_RE = /^[A-Z]{3}$/;

export function isValidCurrencyCode(code) {
  return typeof code === "string" && CURRENCY_CODE_RE.test(code);
}

export function assertCurrencyCode(code, label = "currency") {
  if (!isValidCurrencyCode(code)) {
    throw new AppError(400, `${label} must be a 3-letter ISO 4217 currency code`);
  }
  return code;
}

/** True only for a finite, safe-integer number — never a float. */
export function isMinorAmount(value) {
  return typeof value === "number" && Number.isInteger(value) && Number.isSafeInteger(value);
}

export function assertMinorAmount(value, label = "amount") {
  if (!isMinorAmount(value)) {
    throw new AppError(400, `${label} must be an integer minor-unit amount (no floats)`);
  }
  return value;
}

export function assertNonNegativeMinorAmount(value, label = "amount") {
  assertMinorAmount(value, label);
  if (value < 0) {
    throw new AppError(400, `${label} must not be negative`);
  }
  return value;
}

/** Sum any number of integer minor-unit amounts. Throws on any non-integer input. */
export function addMinor(...values) {
  return values.reduce((sum, v, i) => sum + assertMinorAmount(v, `addend[${i}]`), 0);
}

export function subtractMinor(a, b) {
  assertMinorAmount(a, "a");
  assertMinorAmount(b, "b");
  return a - b;
}

/** amountMinor (customer price) - netMinor (supplier cost) = FlightOne's margin. */
export function marginMinor(amountMinor, netMinor) {
  assertNonNegativeMinorAmount(amountMinor, "amountMinor");
  assertNonNegativeMinorAmount(netMinor, "netMinor");
  return amountMinor - netMinor;
}

/** Strict equality check that also guards against float/NaN sneaking in. */
export function amountsEqual(a, b) {
  return assertMinorAmount(a, "a") === assertMinorAmount(b, "b");
}

/**
 * Display-only conversion: minor units -> a "12.34" major-unit string.
 * Never parse this back into a number for further arithmetic — keep all
 * booking/pricing math in integer minor units.
 */
export function formatMinorAsMajor(amountMinor, { decimals = 2 } = {}) {
  assertMinorAmount(amountMinor, "amountMinor");
  const negative = amountMinor < 0;
  const abs = Math.abs(amountMinor);
  const divisor = 10 ** decimals;
  const whole = Math.floor(abs / divisor);
  const fraction = String(abs % divisor).padStart(decimals, "0");
  return `${negative ? "-" : ""}${whole}${decimals > 0 ? `.${fraction}` : ""}`;
}

/** Build a `{ amountMinor, currency }` pair with validation applied to both. */
export function money(amountMinor, currency) {
  assertMinorAmount(amountMinor, "amountMinor");
  assertCurrencyCode(currency);
  return { amountMinor, currency };
}

/**
 * Basis-points helpers (Module 05 — pricing/margin engine). `bps` is an
 * integer, 1/100th of a percent (1250 = 12.5%). The intermediate
 * `amountMinor * bps` product and its `/ 10000` division are the one place
 * this codebase does non-integer arithmetic on money — by design: there is
 * no way to derive "12.5% of an integer" without a division step, and this
 * mirrors how every payment processor (Stripe included) computes bps-based
 * fees. The *result* is always rounded back to an integer minor-unit amount
 * via `Math.round`, so nothing fractional is ever stored, compared, or fed
 * back into further math — only this helper touches non-integer values, and
 * only transiently.
 */
export function assertBps(value, label = "bps") {
  if (typeof value !== "number" || !Number.isInteger(value) || !Number.isSafeInteger(value)) {
    throw new AppError(400, `${label} must be an integer number of basis points`);
  }
  return value;
}

export function assertNonNegativeBps(value, label = "bps") {
  assertBps(value, label);
  if (value < 0) {
    throw new AppError(400, `${label} must not be negative`);
  }
  return value;
}

/** amountMinor * (bps / 10000), rounded to the nearest integer minor unit. */
export function bpsOfMinor(amountMinor, bps) {
  assertMinorAmount(amountMinor, "amountMinor");
  assertBps(bps, "bps");
  return Math.round((amountMinor * bps) / 10000);
}

/** Clamp a bps value to `[0, maxBps]`. */
export function capBps(bps, maxBps) {
  assertNonNegativeBps(bps, "bps");
  assertNonNegativeBps(maxBps, "maxBps");
  return Math.min(bps, maxBps);
}
