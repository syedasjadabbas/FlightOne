/** Pure checkout display helpers — safe for unit tests without RTK. */

export function formatMinor(amountMinor: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
    }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currency}`;
  }
}

export function ticketNumbersFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): string[] {
  const ticket = (
    metadata as {
      supplierBooking?: { ticket?: { ticketNumbers?: string[] } };
    } | null
  )?.supplierBooking?.ticket;
  return Array.isArray(ticket?.ticketNumbers) ? ticket.ticketNumbers.filter(Boolean) : [];
}

export function voucherRefsFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): string[] {
  const ticket = (
    metadata as {
      supplierBooking?: { ticket?: { voucherRefs?: string[] } };
    } | null
  )?.supplierBooking?.ticket;
  return Array.isArray(ticket?.voucherRefs) ? ticket.voucherRefs.filter(Boolean) : [];
}

export type PriceChangedDetails = {
  previousAmountMinor: number;
  newAmountMinor: number;
  currency: string;
  reason?: string;
};

/** Parse Module 05 PRICE_CHANGED API error payload (RTK / fetch). */
export function parsePriceChangedError(err: unknown): PriceChangedDetails | null {
  if (!err || typeof err !== "object") return null;
  const e = err as {
    data?: {
      code?: string;
      message?: string;
      details?: Record<string, unknown>;
    };
    status?: number;
  };
  const code = e.data?.code;
  const details = e.data?.details;
  if (code !== "PRICE_CHANGED" && !/price changed/i.test(e.data?.message || "")) {
    return null;
  }
  if (!details || typeof details !== "object") return null;
  const previousAmountMinor = details.previousAmountMinor;
  const newAmountMinor = details.newAmountMinor;
  const currency = details.currency;
  if (
    typeof previousAmountMinor !== "number" ||
    typeof newAmountMinor !== "number" ||
    typeof currency !== "string"
  ) {
    return null;
  }
  return {
    previousAmountMinor,
    newAmountMinor,
    currency,
    reason: typeof details.reason === "string" ? details.reason : undefined,
  };
}
