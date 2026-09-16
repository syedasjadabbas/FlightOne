/**
 * Module 13 — customer-facing routing status copy (honest, no fabricated assignment).
 */
export type PublicEscalationRouting = {
  pool?: string | null;
  status?: string | null;
  eligibleConsultantCount?: number | null;
  availabilityClaimed?: boolean;
  autoAssigned?: boolean;
} | null | undefined;

export function customerRoutingStatusMessage(args: {
  status: string;
  assignedToUserId?: string | null;
  routing?: PublicEscalationRouting;
}): string {
  if (args.assignedToUserId) {
    return "A consultant has been assigned to this case.";
  }
  const routing = args.routing;
  if (routing?.status === "UNROUTED_NO_ELIGIBLE") {
    return "Your request is visible to Operations for manual handling. No specialist pool was available to auto-route — we will not claim a consultant is assigned until the system shows it.";
  }
  if (routing?.pool === "VIP" || routing?.pool === "MEDICAL") {
    return "Connecting you to a specialist queue. Assignment has not been confirmed yet.";
  }
  if (args.status === "OPEN") {
    return "Request received. Assignment has not been confirmed yet — we will not claim a consultant has replied until the system shows it.";
  }
  return "Handoff in progress.";
}

export function formatOpsRoutingLabel(routing: PublicEscalationRouting): string | null {
  if (!routing?.pool && !routing?.status) return null;
  const pool = routing?.pool || "—";
  const status = routing?.status || "—";
  const count =
    typeof routing?.eligibleConsultantCount === "number"
      ? ` · eligible ${routing.eligibleConsultantCount}`
      : "";
  return `${pool} · ${status}${count}`;
}
