"use client";

/** Parse IATA codes from a leg route string for the header ribbon. */
export function routeStopsFromLegRoute(legRoute: string | null | undefined): string[] {
  if (!legRoute) return [];
  const matches = legRoute.match(/\b[A-Z]{3}\b/g) ?? [];
  const out: string[] = [];
  for (const code of matches) {
    if (out[out.length - 1] !== code) out.push(code);
  }
  return out.slice(0, 8);
}

export function RouteRibbon({
  stops,
  loading,
}: {
  stops: string[];
  loading?: boolean;
}) {
  if (stops.length === 0) return null;

  const activeIdx = loading ? Math.max(0, stops.length - 2) : stops.length - 1;

  return (
    <p
      className="route-ribbon mt-2 font-mono text-[11px] tracking-tight text-[var(--ink-faint)]"
      aria-label={`Route ${stops.join(" to ")}`}
    >
      {stops.map((code, i) => (
        <span key={`${code}-${i}`} className="inline-flex items-center">
          {i > 0 ? (
            <span className="route-ribbon__dash mx-1.5 text-[var(--ink-faint)]/50" aria-hidden>
              —
            </span>
          ) : null}
          <span
            className={
              i === activeIdx
                ? "font-semibold text-[var(--signal)]"
                : i < activeIdx
                  ? "text-[var(--ink-soft)]"
                  : "text-[var(--ink-faint)]/60"
            }
          >
            {code}
          </span>
        </span>
      ))}
    </p>
  );
}
