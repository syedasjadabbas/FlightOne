"use client";

import { useState } from "react";
import type { ItinerarySummary } from "@/lib/consultant/types";
import type { FlightSegment } from "@/lib/inventory/types";
import { iataToPlace } from "@/lib/inventory/places";
import {
  baggageAllowanceLabel,
  cabinLabel,
  formatDayLabel,
  formatDurationLabel,
  formatLayover,
  refundableFareLabel,
  stopsLabel,
} from "../flightOfferFormat";

type TripLeg = NonNullable<ItinerarySummary["legs"]>[number];

function formatLegPrice(minor?: number, currency?: string): string | null {
  if (minor == null || !currency) return null;
  const major = Math.round(minor / 100);
  return `${currency} ${major.toLocaleString()}`;
}

function AirlineMark({ code, size = 36 }: { code: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://images.kiwi.com/airlines/64/${code}.png`}
      alt=""
      width={size}
      height={size}
      className="rounded-lg bg-white object-contain p-0.5"
      style={{ width: size, height: size }}
      onError={(e) => {
        e.currentTarget.style.display = "none";
        const sibling = e.currentTarget.nextElementSibling as HTMLElement | null;
        if (sibling) sibling.hidden = false;
      }}
    />
  );
}

function AirlineBadge({ code, name, size = 40 }: { code: string; name: string; size?: number }) {
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl ring-1 ring-[var(--line)]"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <AirlineMark code={code} size={size} />
      <span
        hidden
        className="absolute inset-0 inline-flex items-center justify-center bg-[var(--mist)] text-[11px] font-bold text-[var(--signal)]"
      >
        {code.slice(0, 2)}
      </span>
      <span className="sr-only">{name}</span>
    </span>
  );
}

function legSegments(leg: TripLeg): FlightSegment[] {
  if (leg.segments?.length) return leg.segments;
  return [
    {
      carrier: leg.airlineCode,
      flightNumber: leg.flightNumber || leg.airlineCode,
      aircraft: leg.aircraft ?? null,
      originCode: leg.originCode,
      destinationCode: leg.destinationCode,
      departureDate: leg.departureDate || "",
      departTimeLocal: leg.departTimeLocal,
      arrivalDate: leg.departureDate || "",
      arriveTimeLocal: leg.arriveTimeLocal || "",
      durationMinutes: leg.durationMinutes,
    },
  ];
}

function overnightOffset(departDate?: string, arriveDate?: string): string | null {
  if (!departDate || !arriveDate || departDate === arriveDate) return null;
  const a = Date.parse(`${departDate}T12:00:00`);
  const b = Date.parse(`${arriveDate}T12:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const days = Math.round((b - a) / 86400000);
  return days > 0 ? `+${days}` : null;
}

function DurationBar({ segments }: { segments: FlightSegment[] }) {
  const blocks: { kind: "flight" | "layover"; minutes: number; label: string }[] = [];
  for (const seg of segments) {
    blocks.push({
      kind: "flight",
      minutes: seg.durationMinutes || 60,
      label: `${seg.originCode}→${seg.destinationCode}`,
    });
    if (seg.layoverMinutesAfter && seg.layoverMinutesAfter > 0) {
      blocks.push({
        kind: "layover",
        minutes: seg.layoverMinutesAfter,
        label: `${seg.destinationCode} layover`,
      });
    }
  }
  const total = blocks.reduce((s, b) => s + b.minutes, 0) || 1;

  return (
    <div className="trip-duration-bar" aria-label="Flight and layover timeline">
      <div className="flex h-2 overflow-hidden rounded-full bg-[var(--mist)]">
        {blocks.map((b, i) => (
          <div
            key={`${b.label}-${i}`}
            className={`trip-duration-bar__seg trip-duration-bar__seg--${b.kind}`}
            style={{ width: `${Math.max(8, (b.minutes / total) * 100)}%` }}
            title={`${b.label} · ${formatDurationLabel(b.minutes, "long")}`}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-[var(--ink-faint)]">
        <span>Flight time</span>
        <span>Layover</span>
      </div>
    </div>
  );
}

function SegmentDetail({
  seg,
  index,
  expanded,
}: {
  seg: FlightSegment;
  index: number;
  expanded: boolean;
}) {
  const dayOut = formatDayLabel(seg.departureDate);
  const dayIn = formatDayLabel(seg.arrivalDate);
  const plus = overnightOffset(seg.departureDate, seg.arrivalDate);

  return (
    <div
      className={`trip-segment rounded-xl border border-[var(--line)]/80 bg-[var(--surface)]/40 transition-colors ${
        expanded ? "border-[var(--signal)]/25 bg-[var(--signal)]/5" : ""
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <AirlineBadge code={seg.carrier} name={seg.carrier} size={28} />
          <div>
            <p className="text-[12px] font-semibold text-[var(--ink)]">
              {seg.flightNumber}
              {seg.aircraft ? (
                <span className="ml-1.5 font-normal text-[var(--ink-faint)]">· {seg.aircraft}</span>
              ) : null}
            </p>
            <p className="text-[11px] text-[var(--ink-soft)]">
              Sector {index + 1} · {formatDurationLabel(seg.durationMinutes || 0, "long")}
            </p>
          </div>
        </div>
        <p className="font-mono text-[12px] font-medium text-[var(--ink-soft)]">
          {seg.originCode} → {seg.destinationCode}
        </p>
      </div>

      {expanded ? (
        <div className="grid gap-3 border-t border-[var(--line)]/60 px-3.5 py-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <div>
            {dayOut ? (
              <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--ink-faint)]">
                {dayOut}
              </p>
            ) : null}
            <p className="text-xl font-semibold tabular-nums text-[var(--ink)]">{seg.departTimeLocal}</p>
            <p className="mt-1 text-[13px] font-semibold">{seg.originCode}</p>
            <p className="text-[11px] text-[var(--ink-soft)]">{iataToPlace(seg.originCode)}</p>
          </div>
          <div className="hidden flex-col items-center sm:flex" aria-hidden>
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--signal)]" />
            <span className="my-1 w-10 border-t border-dashed border-[var(--line-strong)]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--ink-faint)]" />
          </div>
          <div className="sm:text-right">
            <div className="mb-0.5 flex items-center gap-1 sm:justify-end">
              {dayIn ? (
                <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--ink-faint)]">
                  {dayIn}
                </p>
              ) : null}
              {plus ? (
                <span className="rounded bg-[var(--signal)]/15 px-1 py-px text-[9px] font-bold text-[var(--signal)]">
                  {plus}
                </span>
              ) : null}
            </div>
            <p className="text-xl font-semibold tabular-nums text-[var(--ink)]">
              {seg.arriveTimeLocal || "—"}
            </p>
            <p className="mt-1 text-[13px] font-semibold">{seg.destinationCode}</p>
            <p className="text-[11px] text-[var(--ink-soft)]">{iataToPlace(seg.destinationCode)}</p>
          </div>
        </div>
      ) : null}

      {seg.layoverMinutesAfter && seg.layoverMinutesAfter > 0 ? (
        <div className="border-t border-[var(--line)]/50 px-3.5 py-2">
          <p className="inline-flex items-center gap-2 rounded-full border border-[var(--signal)]/20 bg-[var(--signal)]/8 px-2.5 py-1 text-[11px] font-medium text-[var(--signal-bright)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--signal)]" />
            {formatLayover(seg.layoverMinutesAfter)} in {iataToPlace(seg.destinationCode)} (
            {seg.destinationCode})
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function TripLegDetailCard({
  leg,
  index,
  showTransferAfter,
}: {
  leg: TripLeg;
  index: number;
  showTransferAfter?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [activeSeg, setActiveSeg] = useState(0);
  const segments = legSegments(leg);
  const legPrice = formatLegPrice(leg.priceMinor, leg.currency);
  const day = formatDayLabel(leg.departureDate);

  return (
    <div className="space-y-0">
      <article className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--surface)]/30"
          aria-expanded={open}
        >
          <AirlineBadge code={leg.airlineCode} name={leg.airline} size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-[var(--mist)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
                Leg {index + 1}
              </span>
              <span className="font-mono text-[13px] font-semibold text-[var(--ink)]">
                {leg.originCode} → {leg.destinationCode}
              </span>
              {legPrice ? (
                <span className="ml-auto text-[12px] font-semibold tabular-nums text-[var(--ink-soft)] sm:ml-0">
                  {legPrice}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
              {leg.airline}
              {leg.flightNumber ? ` · ${leg.flightNumber}` : ""}
              {" · "}
              {stopsLabel(leg.stops)}
              {day ? ` · ${day}` : ""}
            </p>
            <p className="mt-0.5 text-[12px] tabular-nums text-[var(--ink-faint)]">
              {leg.departTimeLocal} – {leg.arriveTimeLocal || "—"} ·{" "}
              {formatDurationLabel(leg.durationMinutes, "long")}
            </p>
          </div>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            className={`mt-1 shrink-0 text-[var(--ink-faint)] transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        {open ? (
          <div className="space-y-4 border-t border-[var(--line)] px-4 py-4 sm:px-5">
            <DurationBar segments={segments} />

            <div className="flex flex-wrap gap-2">
              {segments.map((seg, i) => (
                <button
                  key={`${seg.flightNumber}-${i}`}
                  type="button"
                  onClick={() => setActiveSeg(i)}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    activeSeg === i
                      ? "border-[var(--signal)]/40 bg-[var(--signal)]/12 text-[var(--signal-bright)]"
                      : "border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--line-strong)]"
                  }`}
                >
                  {seg.originCode}→{seg.destinationCode}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {segments.map((seg, i) => (
                <SegmentDetail key={`${seg.flightNumber}-${i}`} seg={seg} index={i} expanded={activeSeg === i} />
              ))}
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {leg.cabin ? (
                <div className="rounded-lg border border-[var(--line)]/70 bg-[var(--surface)]/50 px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--ink-faint)]">
                    Cabin
                  </p>
                  <p className="mt-0.5 text-[12px] font-medium text-[var(--ink)]">
                    {cabinLabel(leg.cabin)}
                  </p>
                </div>
              ) : null}
              <div className="rounded-lg border border-[var(--line)]/70 bg-[var(--surface)]/50 px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--ink-faint)]">
                  Baggage
                </p>
                <p
                  className={`mt-0.5 text-[12px] font-medium ${
                    leg.baggageKg != null ? "text-[var(--ink)]" : "text-[var(--ink-soft)]"
                  }`}
                >
                  {baggageAllowanceLabel(leg.baggageKg)}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--line)]/70 bg-[var(--surface)]/50 px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--ink-faint)]">
                  Fare rules
                </p>
                <p
                  className={`mt-0.5 text-[12px] font-medium ${
                    leg.refundable != null ? "text-[var(--ink)]" : "text-[var(--ink-soft)]"
                  }`}
                >
                  {refundableFareLabel(leg.refundable)}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </article>

      {showTransferAfter ? (
        <div className="flex items-center gap-3 py-3 pl-5">
          <span className="h-px flex-1 bg-[var(--line)]" aria-hidden />
          <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-3 py-1 text-[11px] font-medium text-amber-200/90">
            Self-transfer — allow time between tickets
          </span>
          <span className="h-px flex-1 bg-[var(--line)]" aria-hidden />
        </div>
      ) : null}
    </div>
  );
}
