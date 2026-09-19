export function fareActionLabel(action: string | null | undefined): string {
  switch (action) {
    case "BOOK_NOW":
      return "Book now may be useful";
    case "CONSIDER_WAIT":
      return "Consider waiting";
    default:
      return "Not enough data";
  }
}

export function fareStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "INFERENCE":
      return "Model inference — not a guarantee";
    case "INSUFFICIENT_DATA":
      return "Not enough verified fare history";
    default:
      return "Unavailable";
  }
}

export function formatFareMinor(amountMinor: number | null | undefined, currency?: string | null): string {
  if (amountMinor == null || !Number.isFinite(amountMinor)) return "—";
  const major = amountMinor / 100;
  const cur = (currency || "").toUpperCase();
  return `${cur} ${major.toLocaleString(undefined, { maximumFractionDigits: 0 })}`.trim();
}

export function isPrivatePredictiveKind(kind: string): boolean {
  return ["ROUTE_PATTERN", "SEASONAL_TRIP", "SEARCH_PATTERN", "UPCOMING_JOURNEY", "CALENDAR_EVENT"].includes(
    kind,
  );
}
