import type { RefundCalculation } from "@/lib/api/refunds.api";
import { formatMinor, labelize } from "./refundFormat";

export function RefundCalcLedger({ calc }: { calc: RefundCalculation }) {
  const unconfirmed = calc.dataStatus !== "OK";

  return (
    <div className="fo-refund-detail__ledger">
      <div className="fo-refund-detail__payout">
        <div>
          <p className="fo-refund-detail__payout-label">Refundable</p>
          <p className="fo-refund-detail__payout-value">
            {formatMinor(calc.refundableMinor, calc.currency)}
          </p>
        </div>
        {unconfirmed ? (
          <p className="fo-refund-detail__payout-hint">
            Unconfirmed — data status is {labelize(calc.dataStatus)}
          </p>
        ) : null}
      </div>

      <dl className="fo-refund-detail__facts">
        <div className="fo-refund-detail__fact">
          <dt>Data status</dt>
          <dd>{labelize(calc.dataStatus)}</dd>
        </div>
        <div className="fo-refund-detail__fact">
          <dt>Gross paid</dt>
          <dd>{formatMinor(calc.grossPaidMinor, calc.currency)}</dd>
        </div>
        <div className="fo-refund-detail__fact">
          <dt>Supplier penalty</dt>
          <dd>{formatMinor(calc.supplierPenaltyMinor, calc.currency)}</dd>
        </div>
        <div className="fo-refund-detail__fact">
          <dt>Agency fee</dt>
          <dd>{formatMinor(calc.agencyFeeMinor, calc.currency)}</dd>
        </div>
        <div className="fo-refund-detail__fact">
          <dt>Travel credit</dt>
          <dd>{formatMinor(calc.travelCreditMinor, calc.currency)}</dd>
        </div>
        <div className="fo-refund-detail__fact">
          <dt>Timeline</dt>
          <dd>
            {labelize(calc.processingTimelineStatus)}
            {calc.processingTimelineNote ? ` — ${calc.processingTimelineNote}` : ""}
          </dd>
        </div>
      </dl>
    </div>
  );
}
