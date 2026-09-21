import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  Headphones,
  type LucideIcon,
} from "lucide-react";
import type { EscalationTicket } from "@/lib/api/escalations.api";

function labelize(value: string) {
  return value.replaceAll("_", " ");
}

function statusHeadline(data: EscalationTicket): string {
  switch (data.status) {
    case "RESOLVED":
      return "Resolved";
    case "CANCELLED":
      return "Cancelled";
    case "IN_PROGRESS":
      return "In progress";
    case "ASSIGNED":
      return "Assigned";
    default:
      return "Open — awaiting claim";
  }
}

function StatusIcon({ Icon }: { Icon: LucideIcon }) {
  return (
    <span className="fo-ops-case__strip-icon" aria-hidden>
      <Icon className="h-4 w-4" strokeWidth={2} />
    </span>
  );
}

export function CaseStatusStrip({ data }: { data: EscalationTicket }) {
  const unrouted = data.routingStatus === "UNROUTED_NO_ELIGIBLE";
  const warn = unrouted || data.status === "CANCELLED";

  let Icon: LucideIcon = Clock3;
  if (data.status === "RESOLVED") Icon = CheckCircle2;
  else if (data.status === "CANCELLED" || unrouted) Icon = CircleAlert;
  else if (data.assignedToUserId || data.status === "ASSIGNED" || data.status === "IN_PROGRESS") {
    Icon = Headphones;
  }

  const routingReason =
    data.routing?.reason ||
    (data.routingPool ? `Pool ${data.routingPool}` : null) ||
    "Pool routing from trigger and permissions";

  const copy = unrouted
    ? "No eligible consultant in this pool — keep visible for manual Ops claim (`ops:escalations:write`)."
    : data.assignedToUserId
      ? `Assigned to ${data.assignedToUserId}`
      : "Unassigned. Claim from queue actions when ready.";

  const metaParts = [
    data.routing?.pool || data.routingPool
      ? `Pool ${data.routing?.pool || data.routingPool}`
      : null,
    data.routing?.status || data.routingStatus || null,
    typeof data.routing?.eligibleConsultantCount === "number"
      ? `${data.routing.eligibleConsultantCount} eligible`
      : null,
    `Handoff ${data.handoff?.mode || data.handoffMode || "COLD"}`,
  ].filter(Boolean);

  return (
    <div
      className={`fo-ops-case__strip${warn ? " fo-ops-case__strip--warn" : ""}`}
      role="status"
    >
      <StatusIcon Icon={Icon} />
      <div className="fo-ops-case__strip-body">
        <p className="fo-ops-case__strip-title">{statusHeadline(data)}</p>
        <p className="fo-ops-case__strip-copy">{copy}</p>
        <p className="fo-ops-case__strip-meta">
          {metaParts.join(" · ")}
          {" · "}
          {routingReason}
          {" · availability not claimed · auto-assign off"}
        </p>
        {data.handoff?.note || data.handoff?.warmStatus ? (
          <p className="fo-ops-case__strip-meta">
            Warm {labelize(data.handoff?.warmStatus || "PRODUCT_DECISION_DEFERRED")}
            {data.handoff?.note ? ` — ${data.handoff.note}` : ""}
          </p>
        ) : null}
      </div>
    </div>
  );
}
