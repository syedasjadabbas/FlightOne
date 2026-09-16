"use client";

type BrandMarkSize = "compact" | "default" | "hero";

/** FlightOne wordmark — Sora always; cyan “One” is the brand signal. */
export function BrandMark({
  compact = false,
  size,
}: {
  compact?: boolean;
  size?: BrandMarkSize;
}) {
  const resolved: BrandMarkSize = size ?? (compact ? "compact" : "default");
  const sizeClass =
    resolved === "hero"
      ? "brand-wordmark--hero chat-page__brand chat-page__brand--hero"
      : resolved === "compact"
        ? "brand-wordmark--compact chat-page__brand chat-page__brand--compact"
        : "brand-wordmark--compact chat-page__brand";

  return (
    <div className={`brand-wordmark ${sizeClass}`}>
      <p aria-label="FlightOne">
        <span className="brand-wordmark__flight">Flight</span>
        <span className="brand-wordmark__one">One</span>
      </p>
    </div>
  );
}
