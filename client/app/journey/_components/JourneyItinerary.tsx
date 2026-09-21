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
      <>
        Flight {item.flightNumber || "—"}
        <span className="fo-journey__leg-sep">·</span>
        {item.origin || "—"} → {item.destination || "—"}
      </>
    );
  }
  if (item.kind === "HOTEL") {
    return (
      <>
        Hotel check-in {formatDate(item.checkInDate)}
        {item.confirmationRef ? (
          <>
            <span className="fo-journey__leg-sep">·</span>
            ref {item.confirmationRef}
          </>
        ) : null}
      </>
    );
  }
  if (item.kind === "TRANSFER") {
    return (
      <>
        Transfer{item.transferRef ? ` ${item.transferRef}` : ""}
        {item.pickupAt ? (
          <>
            <span className="fo-journey__leg-sep">·</span>
            pickup {formatDate(item.pickupAt)} {formatTime(item.pickupAt)}
          </>
        ) : null}
      </>
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
              <Icon size={14} strokeWidth={1.75} />
            </span>
            <span className="fo-journey__leg-text">{legLabel(item)}</span>
          </li>
        );
      })}
    </ul>
  );
}
