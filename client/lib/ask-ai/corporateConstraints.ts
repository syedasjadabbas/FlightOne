/**
 * Soft Ava hints from Module 06 corporate policy.
 * Explicit server policy evaluation remains authoritative.
 */

export type CorporateAvaConstraints = {
  maxCabin?: string | null;
  maxAmountMinor?: number | null;
  preferredAirlines?: string[];
  advanceBookingDays?: number | null;
  authoritative?: boolean;
  note?: string;
};

export function formatCorporateConstraintsForPrompt(
  constraints: CorporateAvaConstraints | null | undefined,
): string | null {
  if (!constraints) return null;
  const parts: string[] = [];
  if (constraints.maxCabin) parts.push(`max cabin ${constraints.maxCabin}`);
  if (typeof constraints.maxAmountMinor === "number") {
    parts.push(`max fare ${(constraints.maxAmountMinor / 100).toFixed(2)} (minor ${constraints.maxAmountMinor})`);
  }
  if (constraints.preferredAirlines?.length) {
    parts.push(`preferred airlines ${constraints.preferredAirlines.join(", ")}`);
  }
  if (typeof constraints.advanceBookingDays === "number") {
    parts.push(`book at least ${constraints.advanceBookingDays} days ahead`);
  }
  if (!parts.length) return null;
  return `Corporate travel policy (authoritative — do not suggest violating options): ${parts.join("; ")}.`;
}

/** Merge soft cabin preference under corporate maxCabin without inventing policy. */
export function applyCorporateConstraintsToPrefs<
  T extends { preferredCabin?: string | null; preferredAirlines?: string[] },
>(prefs: T | null, constraints: CorporateAvaConstraints | null | undefined): T | null {
  if (!prefs && !constraints) return null;
  const base = { ...(prefs || ({} as T)) };
  if (!constraints) return Object.keys(base).length ? base : null;

  if (constraints.maxCabin && !base.preferredCabin) {
    base.preferredCabin = constraints.maxCabin;
  }
  if (constraints.preferredAirlines?.length && !base.preferredAirlines?.length) {
    base.preferredAirlines = [...constraints.preferredAirlines];
  }
  return base;
}
