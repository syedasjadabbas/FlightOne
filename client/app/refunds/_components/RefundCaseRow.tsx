import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { TravellerChip } from "@/app/components/traveller";
import type { RefundCase } from "@/lib/api/refunds.api";
import { kindLabel, statusTone } from "./refundFormat";

export function RefundCaseRow({ refundCase }: { refundCase: RefundCase }) {
  return (
    <Link href={`/refunds/${refundCase.id}`} className="fo-traveller__row-link group">
      <div className="fo-traveller__row-top">
        <span className="fo-traveller__row-title">
          {kindLabel(refundCase.kind)} · #{refundCase.id.slice(0, 8)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <TravellerChip tone={statusTone(refundCase.status)}>
            {refundCase.status.replaceAll("_", " ")}
          </TravellerChip>
          <span className="text-[var(--ink-faint)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <ChevronRight size={14} strokeWidth={1.75} aria-hidden />
          </span>
        </span>
      </div>
      <p className="fo-traveller__row-body">
        Booking {refundCase.bookingId}
        {refundCase.reason ? ` · ${refundCase.reason}` : ""}
      </p>
      <p className="fo-traveller__row-meta">
        Submitted {new Date(refundCase.createdAt).toLocaleString()}
        {refundCase.paymentRefundStatus
          ? ` · Payment refund: ${refundCase.paymentRefundStatus}`
          : ""}
      </p>
    </Link>
  );
}
