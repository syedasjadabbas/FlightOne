"use client";

import type { ItinerarySummary } from "@/lib/consultant/types";

const ANGLE_LABEL: Record<string, string> = {
  best_value: "Best",
  cheapest: "Cheapest",
  fastest: "Fastest",
  premium: "Premium",
  top_rated: "Top rated",
  recommended: "Recommended",
};

function formatDuration(minutes: number): string {
  if (minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function AirlineMark({ code }: { code: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://images.kiwi.com/airlines/32/${code}.png`}
      alt=""
      width={28}
      height={28}
      className="rounded-md bg-white object-contain p-0.5"
      onError={(e) => {
        e.currentTarget.style.display = "none";
        const sibling = e.currentTarget.nextElementSibling as HTMLElement | null;
        if (sibling) sibling.hidden = false;
      }}
    />
  );
}

function LegRow({
  leg,
  index,
  isLast,
}: {
  leg: NonNullable<ItinerarySummary["legs"]>[number];
  index: number;
  isLast: boolean;
}) {
  return (
    <div className="trip-leg-row group relative">
      {!isLast ? (
        <span
          className="trip-leg-row__connector absolute left-[13px] top-[2rem] bottom-0 w-px bg-[var(--line)]"
          aria-hidden
        />
      ) : null}

      <div className="relative flex gap-3 py-2.5 sm:grid sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-4">
        <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:gap-1">
          <span className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg ring-1 ring-[var(--line)]">
            <AirlineMark code={leg.airlineCode} />
            <span
              hidden
              className="absolute inset-0 flex items-center justify-center bg-[var(--mist)] text-[9px] font-bold text-[var(--signal)]"
            >
              {leg.airlineCode.slice(0, 2)}
            </span>
          </span>
          <span className="hidden text-[10px] font-medium text-[var(--ink-faint)] sm:block">
            Leg {index + 1}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <p className="font-mono text-[13px] font-semibold tracking-tight text-[var(--ink)]">
              {leg.originCode}
              <span className="mx-1.5 text-[var(--ink-faint)]">→</span>
              {leg.destinationCode}
            </p>
            <p className="text-[12px] tabular-nums text-[var(--ink-soft)]">
              {leg.departTimeLocal}
              {leg.arriveTimeLocal ? (
                <>
                  <span className="mx-1 text-[var(--ink-faint)]">–</span>
                  {leg.arriveTimeLocal}
                </>
              ) : null}
            </p>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--ink-soft)]">
            <span>{leg.airline}</span>
            <span className="text-[var(--ink-faint)]">·</span>
            <span>
              {leg.stops <= 0 ? "Nonstop" : leg.stops === 1 ? "1 stop" : `${leg.stops} stops`}
            </span>
            {leg.stopCodes?.map((code) => (
              <span
                key={code}
                className="rounded bg-[var(--mist)] px-1.5 py-px font-mono text-[10px] font-medium text-[var(--ink-soft)]"
              >
                {code}
              </span>
            ))}
          </div>
        </div>

        <p className="shrink-0 self-start text-[12px] font-medium tabular-nums text-[var(--ink-soft)] sm:self-center">
          {formatDuration(leg.durationMinutes)}
        </p>
      </div>
    </div>
  );
}

export function ItinerarySummaryCard({
  itinerary,
  index = 0,
  onSelect,
}: {
  itinerary: ItinerarySummary;
  index?: number;
  onSelect?: (itinerary: ItinerarySummary) => void;
}) {
  const angle = ANGLE_LABEL[itinerary.angle] ?? itinerary.angle;
  const isMultiTicket = itinerary.construction === "multiple_tickets";
  const hasMarketReference =
    itinerary.hasMarketReferenceLeg ||
    (itinerary.legs?.some((leg) => leg.marketReference) ?? false);
  const legs = itinerary.legs ?? [];
  const parts = itinerary.totalPrice.trim().split(/\s+/);
  const currency = parts.length > 1 ? parts[0] : itinerary.currency;
  const amount = parts.length > 1 ? parts.slice(1).join(" ") : itinerary.totalPrice;
  const totalDuration = legs.reduce((sum, leg) => sum + (leg.durationMinutes || 0), 0);

  return (
    <article
      className="trip-card offer-enter offer-surface w-full overflow-hidden rounded-2xl border border-transparent bg-[var(--surface)]"
      style={{
        animationDelay: `${60 + index * 50}ms`,
        boxShadow: "var(--shadow-soft), inset 0 1px 0 #ffffff",
      }}
    >
      {/* Header — badges + price across full width */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)]/80 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-[var(--signal)]/14 px-2 py-0.5 text-[11px] font-semibold text-[var(--signal-bright)]">
            {angle}
          </span>
          {isMultiTicket ? (
            <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              Self-transfer
            </span>
          ) : null}
          {hasMarketReference ? (
            <span className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-800">
              Market reference
            </span>
          ) : null}
          {!itinerary.constraintsSatisfied ? (
            <span className="text-[11px] font-medium text-[var(--ember-soft)]">Partial match</span>
          ) : null}
          {totalDuration > 0 ? (
            <span className="text-[11px] tabular-nums text-[var(--ink-faint)]">
              {formatDuration(totalDuration)} total
            </span>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--ink-faint)]">
            {currency}
          </p>
          <p className="offer-price text-[1.35rem] font-semibold leading-tight tracking-[-0.03em] text-[var(--ink)] sm:text-[1.5rem]">
            {amount}
          </p>
        </div>
      </div>

      {/* Legs — full width timeline */}
      <div className="px-4 py-1 sm:px-5">
        {legs.length > 0 ? (
          legs.map((leg, i) => (
            <LegRow
              key={`${leg.originCode}-${leg.destinationCode}-${i}`}
              leg={leg}
              index={i}
              isLast={i === legs.length - 1}
            />
          ))
        ) : (
          <p className="py-3 text-[13px] leading-relaxed text-[var(--ink-soft)]">
            {itinerary.hops.join(" → ")}
          </p>
        )}
      </div>

      {/* Footer — CTA spans card width */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)]/80 px-4 py-3 sm:px-5">
        <p className="text-[12px] text-[var(--ink-soft)]">
          {isMultiTicket ? "Separate tickets · allow time between legs" : "Single ticket"}
        </p>
        {onSelect ? (
          <button
            type="button"
            onClick={() => onSelect(itinerary)}
            className="book-btn min-w-[9rem] flex-1 cursor-pointer rounded-full bg-[var(--sky-solid)] px-4 py-2.5 text-[13px] font-semibold tracking-[-0.01em] text-white hover:bg-[color-mix(in_oklab,var(--electric)_90%,var(--navy))] sm:flex-none sm:px-6"
          >
            View deal
          </button>
        ) : (
          <span className="inline-flex min-w-[9rem] flex-1 items-center justify-center rounded-full bg-[var(--sky-solid)] px-4 py-2.5 text-[13px] font-semibold text-white sm:flex-none">
            View deal
          </span>
        )}
      </div>
    </article>
  );
}
