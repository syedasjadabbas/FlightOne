export type RangeKey = "today" | "7d" | "30d" | "90d" | "custom";

export function rangeFor(
  key: RangeKey,
  customFrom?: string,
  customTo?: string,
): { from: string; to: string } {
  if (key === "custom" && customFrom && customTo) {
    const from = new Date(customFrom);
    const to = new Date(customTo);
    to.setHours(23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  const to = new Date();
  const from = new Date(to);
  if (key === "today") {
    from.setHours(0, 0, 0, 0);
  } else {
    const days = key === "7d" ? 7 : key === "30d" ? 30 : 90;
    from.setDate(from.getDate() - days);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

export function money(minor: number | undefined, currency?: string | null) {
  if (minor == null) return "—";
  const cur = currency || "";
  return `${cur} ${(minor / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`.trim();
}

export function pct(rate: number | null | undefined) {
  if (rate == null) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

export function clampPct(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}
