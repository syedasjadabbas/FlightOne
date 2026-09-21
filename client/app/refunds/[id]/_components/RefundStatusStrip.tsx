import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FilePenLine,
} from "lucide-react";
import type { RefundCaseStatus } from "@/lib/api/refunds.api";
import { statusCopy, statusHeadline, statusIconTone } from "./refundFormat";

function StatusIcon({ status }: { status: RefundCaseStatus }) {
  const common = { size: 16, strokeWidth: 1.75, "aria-hidden": true as const };
  const tone = statusIconTone(status);
  const cls =
    tone === "ok"
      ? "fo-refund-detail__status-icon fo-refund-detail__status-icon--ok"
      : tone === "wait"
        ? "fo-refund-detail__status-icon fo-refund-detail__status-icon--wait"
        : tone === "warn"
          ? "fo-refund-detail__status-icon fo-refund-detail__status-icon--warn"
          : "fo-refund-detail__status-icon";

  let Icon = Clock3;
  if (status === "COMPLETED") Icon = CheckCircle2;
  else if (status === "REQUIRES_HUMAN" || status === "FAILED" || status === "REJECTED")
    Icon = CircleAlert;
  else if (status === "DRAFT" || status === "QUOTED") Icon = FilePenLine;
  else if (status === "NOT_ELIGIBLE") Icon = AlertTriangle;

  return (
    <span className={cls}>
      <Icon {...common} />
    </span>
  );
}

export function RefundStatusStrip({
  status,
  paymentRefundStatus,
}: {
  status: RefundCaseStatus;
  paymentRefundStatus?: string | null;
}) {
  return (
    <div className="fo-refund-detail__status" role="status">
      <StatusIcon status={status} />
      <div className="fo-refund-detail__status-body">
        <p className="fo-refund-detail__status-title">{statusHeadline(status)}</p>
        <p className="fo-refund-detail__status-copy">{statusCopy(status)}</p>
        {paymentRefundStatus ? (
          <p className="fo-refund-detail__status-meta">
            Payment refund · {paymentRefundStatus}
          </p>
        ) : null}
      </div>
    </div>
  );
}
