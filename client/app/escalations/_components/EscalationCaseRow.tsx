import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { TravellerChip } from "@/app/components/traveller";
import type { EscalationTicket } from "@/lib/api/escalations.api";
import { escalationStatusLabel, triggerLabel } from "./supportContent";

function statusTone(status: string): "default" | "warn" | "muted" {
  if (status === "RESOLVED" || status === "CANCELLED") return "muted";
  if (status === "OPEN") return "warn";
  return "default";
}

export function EscalationCaseRow({ ticket }: { ticket: EscalationTicket }) {
  return (
    <Link href={`/escalations/${ticket.id}`} className="fo-traveller__row-link group">
      <div className="fo-traveller__row-top">
        <p className="fo-traveller__row-title">{triggerLabel(ticket.trigger)}</p>
        <span className="inline-flex items-center gap-1.5">
          <TravellerChip tone={statusTone(ticket.status)}>
            {ticket.status.replaceAll("_", " ")}
          </TravellerChip>
          <span className="text-[var(--ink-faint)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <ChevronRight size={14} aria-hidden />
          </span>
        </span>
      </div>
      <p className="fo-traveller__row-body">{escalationStatusLabel(ticket.status)}</p>
      <p className="fo-traveller__row-meta">
        {ticket.id.slice(0, 10)}… · {new Date(ticket.createdAt).toLocaleString()}
        {ticket.bookingId ? ` · Booking ${ticket.bookingId}` : ""}
      </p>
    </Link>
  );
}
