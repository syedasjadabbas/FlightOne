import {
  ArrowLeftRight,
  CalendarClock,
  CircleSlash,
  Percent,
  Undo2,
} from "lucide-react";
import { Button, Input, Spinner } from "@/components/ui";
import { TravellerChip } from "@/app/components/traveller";
import { formatMinor, type EligibilityPreview } from "./refundFormat";

type RefundActionPanelProps = {
  eligibility: {
    eligible: boolean;
    status: string;
    currency?: string;
  };
  preview: EligibilityPreview | undefined;
  eligLoading: boolean;
  cancellationReason: string;
  onCancellationReasonChange: (value: string) => void;
  partialRatio: string;
  onPartialRatioChange: (value: string) => void;
  busy: {
    calc: boolean;
    create: boolean;
    submit: boolean;
    cancel: boolean;
    exchange: boolean;
    schedule: boolean;
  };
  canAct: boolean;
  onSubmitRefund: () => void;
  onRequestCancel: () => void;
  onPartialRefund: () => void;
  onExchange: () => void;
  onScheduleChange: () => void;
};

export function RefundActionPanel({
  eligibility,
  preview,
  eligLoading,
  cancellationReason,
  onCancellationReasonChange,
  partialRatio,
  onPartialRatioChange,
  busy,
  canAct,
  onSubmitRefund,
  onRequestCancel,
  onPartialRefund,
  onExchange,
  onScheduleChange,
}: RefundActionPanelProps) {
  const amountsConfirmed = preview?.confirmed === true && preview.dataStatus === "OK";
  const primaryBusy = busy.calc || busy.create || busy.submit;

  return (
    <div className="fo-refunds__eligibility">
      {eligLoading ? (
        <div className="flex justify-center py-4">
          <Spinner label="Checking eligibility" />
        </div>
      ) : null}

      <div className="fo-refunds__elig-head">
        <div className="min-w-0">
          <p className="fo-refunds__elig-kicker">Booking status</p>
          <p className="fo-refunds__elig-status">{eligibility.status}</p>
        </div>
        <TravellerChip tone={eligibility.eligible ? "warn" : "muted"}>
          {eligibility.eligible ? "Eligible for servicing" : "Restricted / ineligible"}
        </TravellerChip>
      </div>

      {preview ? (
        <dl className="fo-traveller__facts">
          <div className="fo-traveller__fact">
            <dt>Data status</dt>
            <dd>{preview.dataStatus}</dd>
          </div>
          <div className="fo-traveller__fact">
            <dt>Applied rule</dt>
            <dd>{preview.formula?.rule || "Not attributed"}</dd>
          </div>
          {amountsConfirmed ? (
            <>
              <div className="fo-traveller__fact">
                <dt>Supplier penalty</dt>
                <dd>{formatMinor(preview.supplierPenaltyMinor, eligibility.currency)}</dd>
              </div>
              <div className="fo-traveller__fact">
                <dt>Agency fee</dt>
                <dd>{formatMinor(preview.agencyFeeMinor, eligibility.currency)}</dd>
              </div>
              <div className="fo-traveller__fact">
                <dt>Net refundable</dt>
                <dd className="fo-refunds__amount-ok">
                  {formatMinor(preview.refundableMinor, eligibility.currency)} (confirmed)
                </dd>
              </div>
              <div className="fo-traveller__fact">
                <dt>Travel credit</dt>
                <dd>{formatMinor(preview.travelCreditMinor, eligibility.currency)}</dd>
              </div>
            </>
          ) : (
            <div className="fo-traveller__fact">
              <dt>Expected amount</dt>
              <dd>Not shown — fare/refund data is {preview.dataStatus || "unavailable"}</dd>
            </div>
          )}
          <div className="fo-traveller__fact">
            <dt>Processing timeline</dt>
            <dd>
              {preview.processingTimelineStatus}
              {preview.processingTimelineNote ? ` — ${preview.processingTimelineNote}` : ""}
            </dd>
          </div>
        </dl>
      ) : null}

      <div className="space-y-3 pt-1">
        <Input
          label="Cancellation reason"
          value={cancellationReason}
          onChange={(e) => onCancellationReasonChange(e.target.value)}
          placeholder="e.g. Schedule conflict, medical emergency, voluntary change"
        />

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={primaryBusy || !canAct}
            icon={<Undo2 size={14} strokeWidth={1.75} aria-hidden />}
            onClick={onSubmitRefund}
          >
            Calculate & submit refund
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy.cancel || !canAct}
            icon={<CircleSlash size={14} strokeWidth={1.75} aria-hidden />}
            onClick={onRequestCancel}
          >
            Request voluntary cancellation
          </Button>
        </div>
      </div>

      <div className="fo-refunds__advanced">
        <p className="fo-refunds__advanced-title">Advanced servicing</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            label="Partial refund ratio (0.1–0.9)"
            value={partialRatio}
            onChange={(e) => onPartialRatioChange(e.target.value)}
            placeholder="e.g. 0.5 for return leg"
          />
          <div className="flex items-end">
            <Button
              size="sm"
              variant="secondary"
              disabled={busy.calc || !canAct || !partialRatio}
              icon={<Percent size={14} strokeWidth={1.75} aria-hidden />}
              onClick={onPartialRefund}
            >
              Request partial leg refund
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            size="sm"
            variant="ghost"
            disabled={busy.exchange || !canAct}
            icon={<ArrowLeftRight size={14} strokeWidth={1.75} aria-hidden />}
            onClick={onExchange}
          >
            Request flight exchange
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy.schedule || !canAct}
            icon={<CalendarClock size={14} strokeWidth={1.75} aria-hidden />}
            onClick={onScheduleChange}
          >
            Airline schedule change claim
          </Button>
        </div>
      </div>
    </div>
  );
}
