import type { JourneyPhase } from "@/lib/api/journey.api";

export function formatTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function phaseLabel(phase: JourneyPhase | string | undefined, fallbackStatus: string) {
  switch (phase) {
    case "IN_PROGRESS":
      return "In progress";
    case "UPCOMING":
      return "Upcoming";
    case "COMPLETED":
      return "Completed";
    case "PAUSED":
      return "Monitoring paused";
    default:
      return fallbackStatus;
  }
}

export type EventTone = "calm" | "attention" | "critical";

export function eventTone(type: string, severity: number): EventTone {
  if (type === "CANCELLED" || severity >= 3) return "critical";
  if (
    type === "DELAY" ||
    type === "GATE_CHANGE" ||
    type === "TERMINAL_CHANGE" ||
    type === "WEATHER"
  ) {
    return "attention";
  }
  return "calm";
}

export function phaseChipTone(
  phase: JourneyPhase | string | undefined,
): "default" | "warn" | "muted" {
  if (phase === "IN_PROGRESS") return "default";
  if (phase === "PAUSED") return "warn";
  if (phase === "COMPLETED") return "muted";
  return "muted";
}
