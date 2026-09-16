/**
 * Money — shared domain type (dev guide §5).
 *
 * Never use floats for money. Amounts are integer MINOR units (e.g. US cents),
 * and every amount carries its currency explicitly. Formatting happens only at
 * the edge (see `utils/money.ts`).
 */
export type Money = {
  /** Integer amount in minor units (e.g. 12599 === $125.99). */
  readonly amount: number;
  /** ISO-4217 currency code, e.g. "USD". */
  readonly currency: string;
};

/** Build Money from a MAJOR-unit number (e.g. 125.99 USD). Rounds to minor units. */
export function money(major: number, currency = "USD"): Money {
  return { amount: Math.round(major * 100), currency };
}

/** Build Money directly from minor units (e.g. 12599). */
export function minor(amount: number, currency = "USD"): Money {
  return { amount: Math.round(amount), currency };
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount: a.amount + b.amount, currency: a.currency };
}

export function subMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount: a.amount - b.amount, currency: a.currency };
}

/** Apply a percentage (e.g. 12 for +12%). Returns rounded minor units. */
export function applyPct(a: Money, pct: number): Money {
  return { amount: Math.round(a.amount * (1 + pct / 100)), currency: a.currency };
}

/** Positive when `a` is cheaper than `b` (i.e. how much you save choosing a). */
export function savings(a: Money, b: Money): Money {
  return subMoney(b, a);
}

/** Savings of `a` vs `b` as a whole-number percentage of `b`. */
export function savingsPct(a: Money, b: Money): number {
  assertSameCurrency(a, b);
  if (b.amount === 0) return 0;
  return Math.round(((b.amount - a.amount) / b.amount) * 100);
}

export const cmpMoney = (a: Money, b: Money): number => {
  assertSameCurrency(a, b);
  return a.amount - b.amount;
};
