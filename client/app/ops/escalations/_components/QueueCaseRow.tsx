import Link from "next/link";
import type { EscalationTicket } from "@/lib/api/escalations.api";
import { formatOpsRoutingLabel } from "@/lib/escalations/routingDisplay";

function priorityTone(priority: number): "hot" | "warm" | "default" {
  if (priority <= 2) return "hot";
  if (priority <= 4) return "warm";
  return "default";
}

function statusClass(ticket: EscalationTicket): string {
  if (ticket.routingStatus === "UNROUTED_NO_ELIGIBLE") {
    return "fo-desk__status fo-desk__status--warn";
  }
  if (ticket.status === "RESOLVED" || ticket.status === "CANCELLED") {
    return "fo-desk__status fo-desk__status--ok";
  }
  if (ticket.status === "OPEN") {
    return "fo-desk__status fo-desk__status--warn";
  }
  return "fo-desk__status";
}

export function QueueCaseRow({ ticket }: { ticket: EscalationTicket }) {
  const href = `/ops/escalations/${ticket.id}`;
  const tone = priorityTone(ticket.priority);
  const priorityCls =
    tone === "hot"
      ? "fo-ops-eq__priority fo-ops-eq__priority--hot"
      : tone === "warm"
        ? "fo-ops-eq__priority fo-ops-eq__priority--warm"
        : "fo-ops-eq__priority";
  const routing = formatOpsRoutingLabel(ticket.routing);
  const needsManual = ticket.routingStatus === "UNROUTED_NO_ELIGIBLE";

  return (
    <tr>
      <td>
        <Link href={href}>
          <span className={priorityCls}>P{ticket.priority}</span>
        </Link>
      </td>
      <td>
        <Link href={href} className="fo-ops-eq__trigger">
          {ticket.trigger.replaceAll("_", " ")}
        </Link>
      </td>
      <td>
        <span className={statusClass(ticket)}>{ticket.status.replaceAll("_", " ")}</span>
      </td>
      <td>
        <time className="fo-ops-eq__when" dateTime={ticket.createdAt}>
          {new Date(ticket.createdAt).toLocaleString()}
        </time>
      </td>
      <td>
        <span className={`fo-ops-eq__routing${needsManual ? " fo-ops-eq__routing--alert" : ""}`}>
          {routing || "—"}
          {needsManual ? " · needs manual Ops" : ""}
        </span>
      </td>
    </tr>
  );
}
