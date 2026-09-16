import type { IntentFilters } from "@/lib/consultant/types";

export type TripType =
  | "one_way"
  | "round_trip"
  | "multi_city"
  | "open_jaw"
  | "hotel"
  | "package";

export type OptimizationGoal =
  | "best_value"
  | "cheapest"
  | "fastest"
  | "premium"
  | "balanced";

export interface PlanningTravelPlan {
  tripType: TripType;
  /** IATA origins to evaluate (e.g. LHE + ISB). */
  origins: string[];
  legs: PlanningLeg[];
  passengers: number;
  cabin?: string;
  hardConstraints: TravelConstraint[];
  softPreferences: TravelPreference[];
  optimizationGoal: OptimizationGoal;
  flexible?: {
    dates?: boolean;
    airports?: boolean;
    airlines?: boolean;
  };
  /** Original consultant filters (preferred airlines, nonstop, …). */
  filters?: IntentFilters;
  datesAssumed?: boolean;
}

export interface PlanningLeg {
  origin?: string;
  destination: string;
  date?: string;
  stay?: {
    nights?: number;
    days?: number;
    exact: boolean;
  };
  purpose?:
    | "outbound"
    | "stopover"
    | "main_destination"
    | "positioning"
    | "return"
    | "alternative";
}

export interface TravelConstraint {
  type: string;
  value: unknown;
  hard: true;
  description: string;
}

export interface TravelPreference {
  type: string;
  value: unknown;
  weight?: number;
  description: string;
}

export interface SearchBudget {
  maxSearches: number;
  maxRounds: number;
  maxOffersPerTask: number;
}

export interface SearchState {
  searchesPerformed: number;
  searchRounds: number;
  executedSearchKeys: string[];
}

export const DEFAULT_SEARCH_BUDGET: SearchBudget = {
  maxSearches: 12,
  maxRounds: 2,
  maxOffersPerTask: Number(process.env.TRAVELPORT_MAX_OFFERS) || 12,
};
