import { Car, Hotel, Plane } from "lucide-react";
import type { JourneyItineraryItem } from "@/lib/api/journey.api";
import { formatDate, formatTime } from "./journeyFormat";

function legIcon(kind: string) {
  if (kind === "HOTEL") return Hotel;
  if (kind === "TRANSFER") return Car;
  return Plane;
}

function legLabel(item: JourneyItineraryItem) {
  if (item.kind === "FLIGHT") {
    return (
      <span className="flex flex-wrap items-center gap-1.5 font-medium text-navy">
        <span className="font-bold tracking-tight text-navy">
          Flight {item.flightNumber || "—"}
        </span>
        <span className="fo-journey__leg-sep">·</span>
        <span className="font-semibold text-sky">
          {item.origin || "—"} → {item.destination || "—"}
        </span>
      </span>
    );
  }
  if (item.kind === "HOTEL") {
    return (
      <span className="flex flex-wrap items-center gap-1.5 font-medium text-navy">
        <span>Hotel check-in</span>
        <span className="font-semibold text-sky">{formatDate(item.checkInDate)}</span>
        {item.confirmationRef ? (
          <>
            <span className="fo-journey__leg-sep">·</span>
            <span className="rounded bg-black/5 px-1.5 py-0.5 text-xs font-mono text-ink-soft">
              ref: {item.confirmationRef}
            </span>
          </>
        ) : null}
      </span>
    );
  }
  if (item.kind === "TRANSFER") {
    return (
      <span className="flex flex-wrap items-center gap-1.5 font-medium text-navy">
        <span>Transfer</span>
        {item.transferRef ? (
          <span className="font-bold text-navy">{item.transferRef}</span>
        ) : null}
        {item.pickupAt ? (
          <>
            <span className="fo-journey__leg-sep">·</span>
            <span className="text-ink-soft">
              pickup {formatDate(item.pickupAt)} at{" "}
              <span className="font-semibold text-navy">{formatTime(item.pickupAt)}</span>
            </span>
          </>
        ) : null}
      </span>
    );
  }
  return <>{item.kind}</>;
}

export function JourneyItinerary({ items }: { items: JourneyItineraryItem[] }) {
  if (items.length === 0) {
    return <p className="fo-journey__muted">No attributed itinerary on this booking.</p>;
  }

  return (
    <ul className="fo-journey__legs" aria-label="Itinerary">
      {items.map((item, idx) => {
        const Icon = legIcon(item.kind);
        return (
          <li key={`${item.kind}-${idx}`} className="fo-journey__leg">
            <span className="fo-journey__leg-icon" aria-hidden="true">
              <Icon size={14} strokeWidth={2} />
            </span>
            <span className="fo-journey__leg-text">{legLabel(item)}</span>
          </li>
        );
      })}
    </ul>
  );
}
