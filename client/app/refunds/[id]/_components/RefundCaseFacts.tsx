import { FileWarning, Truck } from "lucide-react";

export function RefundCaseFacts({
  bookingId,
  paymentRefundStatus,
  supplierOperationNote,
  failureReason,
}: {
  bookingId: string;
  paymentRefundStatus?: string | null;
  supplierOperationNote?: string | null;
  failureReason?: string | null;
}) {
  return (
    <>
      <dl className="fo-refund-detail__facts">
        <div className="fo-refund-detail__fact">
          <dt>Booking</dt>
          <dd className="mono">{bookingId}</dd>
        </div>
        {paymentRefundStatus ? (
          <div className="fo-refund-detail__fact">
            <dt>Payment refund</dt>
            <dd>{paymentRefundStatus}</dd>
          </div>
        ) : null}
      </dl>

      {supplierOperationNote || failureReason ? (
        <div className="fo-refund-detail__notes">
          {supplierOperationNote ? (
            <p className="fo-refund-detail__note">
              <Truck size={14} strokeWidth={1.75} aria-hidden />
              <span>Supplier: {supplierOperationNote}</span>
            </p>
          ) : null}
          {failureReason ? (
            <p className="fo-refund-detail__note fo-refund-detail__note--warn">
              <FileWarning size={14} strokeWidth={1.75} aria-hidden />
              <span>{failureReason}</span>
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
