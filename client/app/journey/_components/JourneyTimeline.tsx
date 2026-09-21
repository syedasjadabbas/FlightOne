import { CircleAlert, CircleDot, Info } from "lucide-react";
import type { JourneyEvent } from "@/lib/api/journey.api";
import { cn } from "@/utils/cn";
import { eventTone, formatDateTime, type EventTone } from "./journeyFormat";

const TONE_ICON = {
  calm: Info,
  attention: CircleDot,
  critical: CircleAlert,
} as const satisfies Record<EventTone, typeof Info>;

export function JourneyTimeline({ events }: { events: JourneyEvent[] }) {
  if (events.length === 0) {
    return <p className="fo-journey__muted">No monitoring events yet.</p>;
  }

  return (
    <ol className="fo-journey__timeline" aria-label="Journey timeline">
      {events.map((ev, index) => {
        const tone = eventTone(ev.type, ev.severity);
        const Icon = TONE_ICON[tone];
        const isLast = index === events.length - 1;
        return (
          <li
            key={ev.id}
            className={cn(
              "fo-journey__timeline-item",
              `fo-journey__timeline-item--${tone}`,
              isLast && "fo-journey__timeline-item--last",
            )}
          >
            <span className="fo-journey__timeline-rail" aria-hidden="true">
              <span className="fo-journey__timeline-node">
                <Icon size={12} strokeWidth={2} />
              </span>
            </span>
            <div className="fo-journey__timeline-body">
              <p className="fo-journey__timeline-title">{ev.title}</p>
              {ev.body ? <p className="fo-journey__timeline-copy">{ev.body}</p> : null}
              <p className="fo-journey__timeline-meta">
                {ev.type.replace(/_/g, " ")} · {formatDateTime(ev.createdAt)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
