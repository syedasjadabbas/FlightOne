"use client";

import type { SearchPhase } from "@/lib/ask-ai/types";
import type { LoadingRouteCodes } from "@/lib/ask-ai/loadingRoute";
import { LoadingRouteTrack } from "@/components/travel/TravelDoodles";

type DeskStepId = "extract" | "search" | "reply";

const DESK_STEPS: ReadonlyArray<{ id: DeskStepId; label: string }> = [
  { id: "extract", label: "Read trip" },
  { id: "search", label: "Search fares" },
  { id: "reply", label: "Write reply" },
];

function phaseRank(phase: SearchPhase): number {
  switch (phase) {
    case "search":
      return 1;
    case "reply":
    case "done":
      return 2;
    case "extract":
    case "idle":
    default:
      return 0;
  }
}

function routeLabel(route: LoadingRouteCodes | null | undefined): string | null {
  if (!route?.origin || !route?.destination) return null;
  return `${route.origin}→${route.destination}`;
}

/** Header status line — one label per backend phase, no fake rotation. */
export function useThinkingStep(
  phase: SearchPhase,
  active: boolean,
  loadingRoute?: LoadingRouteCodes | null,
): string {
  if (!active) return "";
  return loadingBubbleCopy(phase, loadingRoute).primary;
}

export function loadingBubbleCopy(
  phase: SearchPhase,
  loadingRoute?: LoadingRouteCodes | null,
): {
  primary: string;
  secondary?: string;
} {
  const route = routeLabel(loadingRoute);

  switch (phase) {
    case "search":
      return {
        primary: route
          ? `Searching live fares (${route})…`
          : "Searching live fares…",
        secondary: "Building complete trips",
      };
    case "reply":
      return {
        primary: "Writing reply…",
        secondary: "Packaging options for you",
      };
    case "extract":
    default:
      return {
        primary: "Reading your trip…",
        secondary: "Cities, dates & travellers",
      };
  }
}

function DeskTimeline({ phase }: { phase: SearchPhase }) {
  const activeRank = phaseRank(phase);

  return (
    <ol className="thinking-desk" aria-hidden>
      {DESK_STEPS.map((step, index) => {
        const state =
          index < activeRank ? "done" : index === activeRank ? "active" : "pending";
        return (
          <li
            key={step.id}
            className={`thinking-desk__step thinking-desk__step--${state}`}
          >
            <span className="thinking-desk__marker">
              {state === "done" ? (
                <svg viewBox="0 0 12 12" width="9" height="9" aria-hidden>
                  <path
                    d="M2.5 6.2 4.8 8.5 9.5 3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : null}
            </span>
            <span className="thinking-desk__label">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Temporary Ava assistant bubble while a turn is in flight (hidden once content streams). */
export function ThinkingProgress({
  phase,
  loadingRoute = null,
}: {
  phase: SearchPhase;
  loadingRoute?: LoadingRouteCodes | null;
  label?: string;
}) {
  const { primary, secondary } = loadingBubbleCopy(phase, loadingRoute);
  const isSearch = phase === "search";
  const showRoute = isSearch && Boolean(loadingRoute?.origin && loadingRoute?.destination);

  return (
    <div
      className="message-row message-row--assistant flex flex-col items-start msg-enter"
      role="status"
      aria-live="polite"
      aria-label={primary}
    >
      <span className="message-row__label mb-1.5 pl-1">
        Ava
        <span className="chat-page__ava-role">Travel consultant</span>
      </span>
      <div
        className={`thinking-bubble message-bubble message-bubble--assistant thinking-bubble--${phase}${
          isSearch ? " thinking-bubble--search" : ""
        }`}
      >
        <div className="thinking-bubble__top">
          <div className="thinking-bubble__copy">
            <p className="thinking-bubble__text">{primary}</p>
            {secondary ? <p className="thinking-bubble__sub">{secondary}</p> : null}
          </div>
          <span className="thinking-bubble__pulse" aria-hidden />
        </div>
        <DeskTimeline phase={phase} />
        {showRoute && loadingRoute ? (
          <LoadingRouteTrack from={loadingRoute.origin} to={loadingRoute.destination} />
        ) : null}
      </div>
    </div>
  );
}
