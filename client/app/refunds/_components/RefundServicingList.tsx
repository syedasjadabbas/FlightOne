import { Wrench } from "lucide-react";
import { TravellerChip, TravellerSection } from "@/app/components/traveller";
import type { ServicingRequest } from "@/lib/api/refunds.api";
import { statusTone } from "./refundFormat";

export function RefundServicingList({ items }: { items: ServicingRequest[] }) {
  if (!items.length) return null;

  return (
    <TravellerSection title="Active servicing requests">
      <ul className="fo-traveller__list">
        {items.map((s) => (
          <li key={s.id} className="fo-traveller__row">
            <div className="fo-traveller__row-top">
              <p className="fo-traveller__row-title inline-flex items-center gap-1.5">
                <Wrench size={14} strokeWidth={1.75} className="text-[var(--sky)]" aria-hidden />
                {s.kind.replaceAll("_", " ")} · {s.bookingId.slice(0, 10)}…
              </p>
              <TravellerChip tone={statusTone(s.status)}>
                {s.status.replaceAll("_", " ")}
              </TravellerChip>
            </div>
            <p className="fo-traveller__row-meta">
              {s.status === "REQUIRES_HUMAN"
                ? "Queued for human consultant servicing (no live ticket mutation without confirmation)"
                : null}
              {s.message ? `${s.status === "REQUIRES_HUMAN" ? " — " : ""}${s.message}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </TravellerSection>
  );
}
