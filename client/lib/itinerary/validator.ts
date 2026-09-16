import type { PlanningTravelPlan } from "@/lib/travel-planner/types";
import type { ItineraryCandidate } from "./types";
import { validateHardConstraints, type ConstraintResult } from "./constraints";

export function validateCandidate(
  candidate: ItineraryCandidate,
  plan: PlanningTravelPlan,
): ConstraintResult {
  return validateHardConstraints(candidate, plan);
}
