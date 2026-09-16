export function quickPrompts(originCity: string) {
  const origin = originCity === "your city" ? "Lahore" : originCity;
  return [
    {
      title: `${origin} → Dubai`,
      subtitle: "Flights & skyline stays",
      label: `Flights from ${origin} to Dubai`,
      prompt: `Flights from ${origin} to Dubai`,
    },
    {
      title: "Weekend in Istanbul",
      subtitle: "City break with hotel options",
      label: "Weekend in Istanbul",
      prompt: `Weekend trip to Istanbul from ${originCity} — flights and hotel`,
    },
    {
      title: "Family escape to Malaysia",
      subtitle: "Flights & hotels for the group",
      label: "Family holiday in Malaysia",
      prompt: `Family holiday in Malaysia from ${originCity} — flights and hotels for 4`,
    },
  ];
}

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
