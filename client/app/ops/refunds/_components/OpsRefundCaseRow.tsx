import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui";
import type { RefundCase } from "@/lib/api/refunds.api";
import {
  isActionable,
  kindLabel,
  shortId,
  statusClass,
} from "./refundOpsFormat";

type Props = {
  caseItem: RefundCase;
  canWrite: boolean;
  busy: boolean;
  onProcess: (id: string) => void;
  onReject: (id: string) => void;
};

export function OpsRefundCaseRow({
  caseItem,
  canWrite,
  busy,
  onProcess,
  onReject,
}: Props) {
  const actionable = isActionable(caseItem.status);
  const updated = caseItem.updatedAt
    ? new Date(caseItem.updatedAt).toLocaleString()
    : null;

  return (
    <tr>
      <td>
        <Link href={`/refunds/${caseItem.id}`} className="fo-ops-refunds__kind">
          {kindLabel(caseItem.kind)}
          <ExternalLink className="h-3 w-3" strokeWidth={2} aria-hidden />
        </Link>
        {caseItem.partial ? (
          <p className="fo-ops-refunds__meta">Partial</p>
        ) : null}
      </td>
      <td>
        <span className={statusClass(caseItem.status)}>{caseItem.status}</span>
        {caseItem.failureReason ? (
          <p className="fo-ops-refunds__meta">{caseItem.failureReason}</p>
        ) : null}
      </td>
      <td>
        <span className="fo-desk__mono">{caseItem.bookingId}</span>
      </td>
      <td>
        <span className="fo-desk__mono" title={caseItem.id}>
          {shortId(caseItem.id)}
        </span>
        {updated ? <p className="fo-ops-refunds__meta">{updated}</p> : null}
      </td>
      {canWrite ? (
        <td>
          {actionable ? (
            <div className="fo-ops-refunds__actions">
              <Button
                size="sm"
                disabled={busy}
                onClick={() => onProcess(caseItem.id)}
              >
                Process
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => onReject(caseItem.id)}
              >
                Reject
              </Button>
            </div>
          ) : (
            <span className="fo-ops-refunds__idle">—</span>
          )}
        </td>
      ) : null}
    </tr>
  );
}
