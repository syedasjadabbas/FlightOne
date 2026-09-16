import type { CabinClass, SupplierSearchBody } from "@/lib/inventory/supplierSearch";
import type { PlanningTravelPlan, SearchBudget } from "./types";
import { DEFAULT_SEARCH_BUDGET } from "./types";

export type SearchTaskPurpose =
  | "outbound"
  | "stopover"
  | "main_destination"
  | "positioning"
  | "return"
  | "alternative";

export interface SearchTask {
  id: string;
  type: "flight" | "hotel" | "package";
  origins: string[];
  destinations: string[];
  departureDate?: string;
  returnDate?: string;
  passengers: number;
  cabin?: CabinClass;
  purpose: SearchTaskPurpose;
  priority: number;
  required: boolean;
  /** Index into PlanningTravelPlan.legs this task serves. */
  legIndex: number;
}

export interface SearchPlan {
  tasks: SearchTask[];
  budget: SearchBudget;
}

export function searchKey(task: SearchTask): string {
  return [
    task.type,
    task.origins.slice().sort().join(","),
    task.destinations.slice().sort().join(","),
    task.departureDate ?? "",
    task.returnDate ?? "",
    String(task.passengers),
    task.cabin ?? "",
    task.purpose,
  ].join("|");
}

/**
 * Expand a planning model into discrete GDS search tasks.
 * Multi-origin legs fan into one task per origin (same dest/date).
 */
export function buildSearchPlan(
  plan: PlanningTravelPlan,
  budget: SearchBudget = DEFAULT_SEARCH_BUDGET,
): SearchPlan {
  const tasks: SearchTask[] = [];
  let seq = 0;

  for (let legIndex = 0; legIndex < plan.legs.length; legIndex++) {
    const leg = plan.legs[legIndex];
    const purpose = leg.purpose ?? (legIndex === 0 ? "outbound" : "positioning");
    const origins =
      leg.origin
        ? [leg.origin]
        : plan.origins.length > 0
          ? plan.origins
          : [];
    if (!origins.length || !leg.destination) continue;

    // Prefer a single-origin task when the previous leg already fixed continuity
    // (origin set on the leg). Multi-origin only on the first hop / alternate start.
    const originList =
      leg.origin || legIndex > 0 ? [origins[0]] : origins;

    for (const origin of originList) {
      if (origin === leg.destination) continue;
      tasks.push({
        id: `t${++seq}`,
        type: "flight",
        origins: [origin],
        destinations: [leg.destination],
        departureDate: leg.date,
        passengers: plan.passengers,
        cabin: plan.cabin as CabinClass | undefined,
        purpose,
        priority: legIndex + 1,
        required: true,
        legIndex,
      });
    }
  }

  return {
    tasks: tasks.slice(0, budget.maxSearches),
    budget,
  };
}

/** Map tasks back to supplier search bodies (one origin/dest per body). */
export function tasksToSupplierBodies(tasks: SearchTask[]): SupplierSearchBody[] {
  const bodies: SupplierSearchBody[] = [];
  for (const t of tasks) {
    if (t.type !== "flight") continue;
    const origin = t.origins[0];
    const destination = t.destinations[0];
    if (!origin || !destination || !t.departureDate) continue;
    bodies.push({
      product: "FLIGHT",
      query: {
        origin,
        destination,
        departureDate: t.departureDate,
        ...(t.returnDate ? { returnDate: t.returnDate } : {}),
        passengers: t.passengers,
        ...(t.cabin ? { cabinClass: t.cabin } : {}),
      },
    });
  }
  return bodies;
}
