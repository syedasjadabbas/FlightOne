import { airlineDisplayName } from "@/lib/consultant/airlines";
import type { ExtractedIntent } from "@/lib/consultant/types";
import type { FilterPill } from "./types";

function pill(
  id: string,
  label: string,
  kind: FilterPill["kind"],
  value?: string | number,
  active = true,
): FilterPill {
  return { id, label, kind, active, source: "nl", value };
}

/** Derive toggle pills from extracted intent — mirrors KAYAK Smart Filters. */
export function buildFilterPills(intent: ExtractedIntent): FilterPill[] {
  const pills: FilterPill[] = [];
  const f = intent.filters;

  if (f?.nonstopOnly) {
    pills.push(pill("nonstop", "Nonstop only", "nonstop"));
  } else if (f?.maxStops != null) {
    pills.push(
      pill(
        "max_stops",
        f.maxStops === 0 ? "Nonstop only" : `Max ${f.maxStops} stop${f.maxStops === 1 ? "" : "s"}`,
        "max_stops",
        f.maxStops,
      ),
    );
  }

  if (f?.airlinesOnly?.length) {
    for (const code of f.airlinesOnly) {
      pills.push(
        pill(`airline_only_${code}`, airlineDisplayName(code), "airline", code.toUpperCase()),
      );
    }
  } else if (f?.preferredAirlines?.length) {
    for (const code of f.preferredAirlines) {
      pills.push(pill(`airline_${code}`, airlineDisplayName(code), "airline", code.toUpperCase()));
    }
  }

  if (f?.refundableOnly) pills.push(pill("refundable", "Refundable", "refundable"));
  if (f?.checkedBagRequired) pills.push(pill("checked_bag", "Checked bag included", "checked_bag"));

  if (f?.departAfterLocal) {
    pills.push(pill("depart_after", `After ${f.departAfterLocal}`, "depart_after", f.departAfterLocal));
  }
  if (f?.departBeforeLocal) {
    pills.push(
      pill("depart_before", `Before ${f.departBeforeLocal}`, "depart_before", f.departBeforeLocal),
    );
  }
  if (f?.maxLayoverMinutes != null) {
    const hours = Math.round(f.maxLayoverMinutes / 60);
    pills.push(pill("max_layover", `Layover ≤ ${hours}h`, "max_layover", f.maxLayoverMinutes));
  }

  if (intent.minStars != null && intent.minStars > 0) {
    pills.push(pill("stars", `${intent.minStars}+ stars`, "stars", intent.minStars));
  }

  if (intent.maxBudgetMinor != null && intent.maxBudgetMinor > 0) {
    pills.push(pill("budget", "Within budget", "budget", intent.maxBudgetMinor));
  }

  if (intent.type) {
    const label =
      intent.type === "flight"
        ? "Flights"
        : intent.type === "hotel"
          ? "Stays"
          : intent.type === "package"
            ? "Packages"
            : "All products";
    pills.push(pill("product", label, "type", intent.type));
  }

  if (intent.departureDate) {
    const range =
      intent.returnDate && intent.returnDate !== intent.departureDate
        ? `${intent.departureDate} – ${intent.returnDate}`
        : intent.departureDate;
    pills.push(
      pill(
        "dates",
        intent.datesAssumed ? `Dates (assumed ${range})` : range,
        "dates",
        range,
      ),
    );
  }

  return pills;
}

export function buildQueryLabel(intent: ExtractedIntent, originPlace?: string): string {
  const parts: string[] = [];
  const from = intent.origin || originPlace;
  if (from && intent.destination) {
    parts.push(`${from} → ${intent.destination}`);
  } else if (intent.destination) {
    parts.push(intent.destination);
  } else if (intent.destinations?.length) {
    parts.push(intent.destinations.join(" · "));
  } else if (intent.hotelName) {
    parts.push(intent.hotelName);
  }

  if (intent.passengers && intent.passengers > 1) {
    parts.push(`${intent.passengers} travellers`);
  }

  if (intent.cabin && intent.cabin !== "economy") {
    parts.push(intent.cabin);
  }

  return parts.join(" · ") || "Live search";
}
