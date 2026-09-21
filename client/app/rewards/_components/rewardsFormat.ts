export function labelize(id: string): string {
  return id.replace(/_/g, " ");
}

export function formatPts(points: number): string {
  return points >= 0 ? `+${points}` : String(points);
}
