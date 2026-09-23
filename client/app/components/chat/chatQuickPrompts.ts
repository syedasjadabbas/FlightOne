/**
 * Starter routes on the empty chat.
 *
 * Each `prompt` is a query from the demo fare corpus (lib/demo/galileo-fares.json),
 * word for word, so every card lands on exact fares — one per search shape the
 * demo shows off: one-way, round trip, multi-city. Hard-coded rather than read
 * from the corpus because this runs in the browser and the corpus is 7 MB;
 * chatQuickPrompts.test.ts fails if a prompt drifts out of the corpus.
 *
 * The origin is fixed to Lahore on purpose: the corpus is priced from Lahore,
 * and substituting the traveller's city would break the exact match.
 */
export const STARTER_ROUTES = [
  {
    title: "Lahore → Dubai",
    subtitle: "Cheapest one-way · 15 Oct",
    label: "Cheapest Lahore to Dubai on 15 October",
    prompt: "Cheapest Lahore to Dubai on 15 October",
  },
  {
    title: "Lahore ⇄ London",
    subtitle: "Round trip · 18 Oct – 2 Nov",
    label: "Round trip Lahore to London, 18 October to 2 November",
    prompt: "Round trip Lahore to London, out 18 October back 2 November",
  },
  {
    title: "London & Paris",
    subtitle: "Multi-city Europe · 5–14 Nov",
    label: "Multi-city Lahore, London, Paris, 5 to 14 November",
    prompt:
      "Multi-city: Lahore to London on 5 November, London to Paris on 9 November, Paris back to Lahore on 14 November",
  },
] as const;

export const COMPOSER_QUICK_ACTIONS = [
  {
    label: "Flexible dates",
    prompt: (originCity: string) =>
      `Search flexible dates ±3 days from ${originCity === "your city" ? "Lahore" : originCity}`,
  },
  {
    label: "Add a hotel stay",
    prompt: (originCity: string) =>
      `Add a hotel stay to this trip from ${originCity === "your city" ? "Lahore" : originCity}`,
  },
  {
    label: "Nonstop only",
    prompt: () => "Nonstop flights only",
  },
] as const;

/** Shown after a live inventory failure — change the ask, don't pretend search worked. */
export const RECOVERY_QUICK_ACTIONS = [
  {
    label: "Flexible dates",
    prompt: (originCity: string) =>
      `Retry with flexible dates ±3 days from ${originCity === "your city" ? "Lahore" : originCity}`,
  },
  {
    label: "Simpler one-way",
    prompt: (originCity: string) =>
      `Search a simple one-way flight from ${originCity === "your city" ? "Lahore" : originCity}`,
  },
  {
    label: "Different city",
    prompt: () => "I want to change the destination — ask me where to fly",
  },
] as const;
