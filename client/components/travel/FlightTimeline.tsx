"use client";

import type { FlightSegment } from "@/lib/inventory/types";
import type { ConnectionWarning } from "@/lib/inventory/fareTypes";
import { iataToPlace } from "@/lib/inventory/places";
import { formatDayLabel, formatDurationLabel } from "@/app/components/flightOfferFormat";

function normCode(code: string | undefined): string {
  return (code ?? "").trim().toUpperCase();
}

function overnightOffset(departDate?: string, arriveDate?: string): string | null {
  if (!departDate || !arriveDate || departDate === arriveDate) return null;
  const a = Date.parse(`${departDate}T12:00:00`);
  const b = Date.parse(`${arriveDate}T12:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const days = Math.round((b - a) / 86400000);
  if (days <= 0) return null;
  return `+${days}`;
}

function warningsAtAirport(
  warnings: ConnectionWarning[] | undefined,
  airportCode: string,
): ConnectionWarning[] {
  if (!warnings?.length) return [];
  const at = normCode(airportCode);
  return warnings.filter((w) => normCode(w.atAirportCode) === at);
}

function ConnectionNode({
  afterSegment,
  nextSegment,
  warnings,
  variant,
}: {
  afterSegment: FlightSegment;
  nextSegment: FlightSegment;
  warnings?: ConnectionWarning[];
  variant: "full" | "compact" | "rail";
}) {
  const layover = afterSegment.layoverMinutesAfter ?? 0;
  const arriveCode = afterSegment.destinationCode;
  const nextOrigin = nextSegment.originCode;
  const airportChange = normCode(nextOrigin) !== normCode(arriveCode);
  const place = iataToPlace(arriveCode);
  const nodeWarnings = warningsAtAirport(warnings, arriveCode);

  if (layover <= 0 && !airportChange && nodeWarnings.length === 0) return null;

  if (variant === "rail") {
    return (
      <div
        className={`fo-rail-connection${airportChange ? " fo-rail-connection--change" : ""}`}
      >
        <div className="fo-rail-connection__gutter" aria-hidden>
          <span className="fo-rail-connection__dash" />
        </div>
        <div className="fo-rail-connection__body">
          <p className="fo-rail-connection__label">Connection</p>
          {layover > 0 ? (
            <p className="fo-rail-connection__detail">
              {formatDurationLabel(layover, "long")} layover · {place} ({arriveCode})
            </p>
          ) : null}
          {airportChange ? (
            <p className="fo-rail-connection__change">
              Airport change · {arriveCode} → {nextOrigin}
            </p>
          ) : null}
          {nodeWarnings.map((w) => (
            <p
              key={`${w.kind}-${w.atAirportCode}-${w.message}`}
              className={`fo-rail-connection__warning fo-rail-connection__warning--${w.kind}`}
            >
              {w.message}
            </p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fo-timeline-connection fo-timeline-connection--${variant}${
        airportChange ? " fo-timeline-connection--airport-change" : ""
      }`}
    >
      <div className="fo-timeline-connection__rail" aria-hidden>
        <span className="fo-timeline-connection__dot" />
        <span className="fo-timeline-connection__line" />
        <span className="fo-timeline-connection__dot fo-timeline-connection__dot--hollow" />
      </div>
      <div className="fo-timeline-connection__body">
        <p className="fo-timeline-connection__label">Connection</p>
        {layover > 0 ? (
          <p className="fo-timeline-connection__detail">
            {formatDurationLabel(layover, "long")} layover · {place} ({arriveCode})
          </p>
        ) : null}
        {airportChange ? (
          <div className="fo-timeline-connection__change">
            <p className="fo-timeline-connection__change-title">Airport change</p>
            <p className="fo-timeline-connection__change-detail">
              Arrive {arriveCode} · Next departure {nextOrigin}
            </p>
          </div>
        ) : null}
        {nodeWarnings.length > 0 ? (
          <ul className="fo-timeline-connection__warnings">
            {nodeWarnings.map((w) => (
              <li
                key={`${w.kind}-${w.atAirportCode}-${w.message}`}
                className={`fo-timeline-connection__warning fo-timeline-connection__warning--${w.kind}`}
              >
                {w.message}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function RailStop({
  time,
  date,
  code,
  overnight,
  end,
}: {
  time: string;
  date?: string | null;
  code: string;
  overnight?: string | null;
  end?: boolean;
}) {
  return (
    <div className={`fo-rail-stop${end ? " fo-rail-stop--end" : ""}`}>
      <div className="fo-rail-stop__time-col">
        {date ? <span className="fo-rail-stop__date">{date}</span> : null}
        <time className="fo-rail-stop__time tabular-nums">{time || "—"}</time>
        {overnight ? (
          <span className="fo-rail-stop__overnight" title="Arrives next day">
            {overnight}
          </span>
        ) : null}
      </div>
      <div className="fo-rail-stop__axis" aria-hidden>
        <span className={`fo-rail-stop__node${end ? " fo-rail-stop__node--end" : ""}`} />
      </div>
      <div className="fo-rail-stop__place">
        <span className="fo-rail-stop__code">{code}</span>
        <span className="fo-rail-stop__city">{iataToPlace(code)}</span>
      </div>
    </div>
  );
}

function RailFlightLeg({ seg }: { seg: FlightSegment }) {
  const duration =
    seg.durationMinutes && seg.durationMinutes > 0
      ? formatDurationLabel(seg.durationMinutes, "long")
      : null;
  const flightId = seg.flightNumber || null;
  const aircraft = seg.aircraft || null;

  return (
    <div className="fo-rail-leg">
      <div className="fo-rail-leg__spacer" aria-hidden />
      <div className="fo-rail-leg__axis" aria-hidden>
        <span className="fo-rail-leg__line" />
        <span className="fo-rail-leg__plane">✈</span>
        <span className="fo-rail-leg__line" />
      </div>
      <div className="fo-rail-leg__meta">
        {flightId ? <span className="fo-rail-leg__flight">{flightId}</span> : null}
        {duration ? <span className="fo-rail-leg__dur">{duration}</span> : null}
        {aircraft ? <span className="fo-rail-leg__aircraft">{aircraft}</span> : null}
      </div>
    </div>
  );
}

function RailSegmentBlock({
  seg,
  index,
  boundLabel,
  isLast,
}: {
  seg: FlightSegment;
  index: number;
  boundLabel?: string;
  isLast: boolean;
}) {
  const dayOut = formatDayLabel(seg.departureDate);
  const dayIn = formatDayLabel(seg.arrivalDate);
  const plus = overnightOffset(seg.departureDate, seg.arrivalDate);

  return (
    <div className="fo-rail-block">
      {boundLabel && index === 0 ? <p className="fo-rail-block__bound">{boundLabel}</p> : null}
      <RailStop time={seg.departTimeLocal} date={dayOut} code={seg.originCode} />
      <RailFlightLeg seg={seg} />
      <RailStop
        time={seg.arriveTimeLocal || "—"}
        date={dayIn}
        code={seg.destinationCode}
        overnight={plus}
        end={isLast}
      />
    </div>
  );
}

function SegmentNode({
  seg,
  index,
  variant,
  boundLabel,
}: {
  seg: FlightSegment;
  index: number;
  variant: "full" | "compact" | "rail";
  boundLabel?: string;
}) {
  const dayOut = formatDayLabel(seg.departureDate);
  const dayIn = formatDayLabel(seg.arrivalDate);
  const plus = overnightOffset(seg.departureDate, seg.arrivalDate);
  const duration =
    seg.durationMinutes && seg.durationMinutes > 0
      ? formatDurationLabel(seg.durationMinutes, variant === "compact" ? "short" : "long")
      : null;
  const flightMeta = [seg.flightNumber, seg.aircraft].filter(Boolean).join(" · ");

  return (
    <article className={`fo-timeline-segment fo-timeline-segment--${variant}`}>
      {variant === "full" && boundLabel ? (
        <p className="fo-timeline-segment__bound">
          {boundLabel} · Flight {index + 1}
        </p>
      ) : null}

      <div className="fo-timeline-segment__grid">
        <div className="fo-timeline-segment__endpoint fo-timeline-segment__endpoint--dep">
          {dayOut ? <span className="fo-timeline-segment__date">{dayOut}</span> : null}
          <time className="fo-timeline-segment__time tabular-nums">{seg.departTimeLocal}</time>
          <span className="fo-timeline-segment__code">{seg.originCode}</span>
          <span className="fo-timeline-segment__city">{iataToPlace(seg.originCode)}</span>
        </div>

        <div className="fo-timeline-segment__mid" aria-hidden={variant === "compact"}>
          {duration ? <span className="fo-timeline-segment__duration">{duration}</span> : null}
          <span className="fo-timeline-segment__route-line">
            <span className="fo-timeline-segment__route-node fo-timeline-segment__route-node--start" />
            <span className="fo-timeline-segment__route-plane" aria-hidden>
              ✈
            </span>
            <span className="fo-timeline-segment__route-node fo-timeline-segment__route-node--end" />
          </span>
          {flightMeta ? <span className="fo-timeline-segment__flight">{flightMeta}</span> : null}
        </div>

        <div className="fo-timeline-segment__endpoint fo-timeline-segment__endpoint--arr">
          <div className="fo-timeline-segment__arr-head">
            {dayIn ? <span className="fo-timeline-segment__date">{dayIn}</span> : null}
            {plus ? (
              <span className="fo-timeline-segment__overnight" title="Arrives next day">
                {plus}
              </span>
            ) : null}
          </div>
          <time className="fo-timeline-segment__time tabular-nums">
            {seg.arriveTimeLocal || "—"}
          </time>
          <span className="fo-timeline-segment__code">{seg.destinationCode}</span>
          <span className="fo-timeline-segment__city">{iataToPlace(seg.destinationCode)}</span>
        </div>
      </div>
    </article>
  );
}

export function FlightTimeline({
  segments,
  connectionWarnings,
  hubStitched = false,
  variant = "full",
  boundLabel,
}: {
  segments: FlightSegment[];
  connectionWarnings?: ConnectionWarning[];
  hubStitched?: boolean;
  variant?: "full" | "compact" | "rail";
  boundLabel?: string;
}) {
  if (segments.length === 0) return null;

  if (variant === "rail") {
    return (
      <div className="fo-timeline fo-timeline--rail">
        {hubStitched ? (
          <p className="fo-timeline__multi-ticket">
            <span className="fo-timeline__multi-ticket-title">Multi-ticket</span>
            <span className="fo-timeline__multi-ticket-hint">Separate tickets may apply.</span>
          </p>
        ) : null}
        <div className="fo-rail">
          {segments.map((seg, i) => {
            const next = segments[i + 1];
            return (
              <div
                key={`${seg.flightNumber}-${seg.originCode}-${seg.destinationCode}-${i}`}
                className="fo-rail__chunk"
              >
                <RailSegmentBlock
                  seg={seg}
                  index={i}
                  boundLabel={boundLabel}
                  isLast={!next}
                />
                {next ? (
                  <ConnectionNode
                    afterSegment={seg}
                    nextSegment={next}
                    warnings={connectionWarnings}
                    variant="rail"
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={`fo-timeline fo-timeline--${variant}`}>
      {hubStitched ? (
        <p className="fo-timeline__multi-ticket">
          <span className="fo-timeline__multi-ticket-title">Multi-ticket</span>
          <span className="fo-timeline__multi-ticket-hint">Separate tickets may apply.</span>
        </p>
      ) : null}

      <ol className="fo-timeline__list">
        {segments.map((seg, i) => {
          const next = segments[i + 1];
          return (
            <li key={`${seg.flightNumber}-${seg.originCode}-${seg.destinationCode}-${i}`}>
              <SegmentNode
                seg={seg}
                index={i}
                variant={variant}
                boundLabel={boundLabel}
              />
              {next ? (
                <ConnectionNode
                  afterSegment={seg}
                  nextSegment={next}
                  warnings={connectionWarnings}
                  variant={variant}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
