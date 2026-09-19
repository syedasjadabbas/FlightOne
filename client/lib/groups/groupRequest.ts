export const MIN_GROUP_PASSENGERS = 10;

export function isValidGroupPassengerCount(value: unknown): boolean {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isInteger(n) && n >= MIN_GROUP_PASSENGERS && n <= 500;
}
