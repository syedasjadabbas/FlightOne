"use client";

import Link from "next/link";
import {
  ArrowLeft,
  LogIn,
  RefreshCw,
  Ticket,
} from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import {
  TravellerChip,
  TravellerPageHeader,
  TravellerSection,
  TravellerState,
} from "@/app/components/traveller";
import { useGetRefundCaseQuery } from "@/lib/api/refunds.api";
import { useAuthStore } from "@/store/auth.store";
import {
  RefundAuditList,
  RefundCalcLedger,
  RefundCaseFacts,
  RefundStatusStrip,
  labelize,
  statusTone,
} from "./_components";
import "./refund-case-detail.css";

export function RefundCaseDetailClient({ id }: { id: string }) {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const skip = !hasHydrated || !accessToken;
  const { data, isLoading, isError, refetch, error } = useGetRefundCaseQuery(id, { skip });

  if (!hasHydrated) {
    return (
      <div className="flex justify-center py-16" role="status" aria-label="Loading">
        <Spinner />
      </div>
    );
  }

  if (!accessToken) {
    return (
      <TravellerPageHeader
        title="Refund case"
        lede="Sign in to view this case."
        actions={
          <Link href="/login">
            <Button size="sm">
              <LogIn size={14} strokeWidth={1.75} aria-hidden />
              Sign in
            </Button>
          </Link>
        }
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16" role="status" aria-label="Loading case">
        <Spinner />
      </div>
    );
  }

  if (isError || !data) {
    const status = (error as { status?: number } | undefined)?.status;
    return (
      <TravellerState
        variant="error"
        title={status === 404 ? "Case not found" : "Case unavailable"}
        action={
          <div className="fo-refund-detail__actions">
            <Button size="sm" onClick={() => refetch()}>
              <RefreshCw size={14} strokeWidth={1.75} aria-hidden />
              Retry
            </Button>
            <Link href="/refunds" className="fo-refund-detail__link">
              <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
              Back to refunds
            </Link>
          </div>
        }
      >
        {status === 404
          ? "This case does not exist or belongs to another account."
          : "Could not load this refund case."}
      </TravellerState>
    );
  }

  const calc = data.calculation;
  const audit = data.audit?.length ? data.audit : null;

  return (
    <div className="fo-refund-detail">
      <Link href="/refunds" className="fo-refund-detail__back">
        <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
        Refunds
      </Link>

      <TravellerPageHeader
        title={labelize(data.kind || "REFUND")}
        lede={
          <span className="fo-refund-detail__lede">
            <Ticket size={13} strokeWidth={1.75} aria-hidden />
            {data.id}
          </span>
        }
        meta={
          <TravellerChip tone={statusTone(data.status)}>
            {labelize(data.status)}
          </TravellerChip>
        }
      />

      <RefundStatusStrip
        status={data.status}
        paymentRefundStatus={data.paymentRefundStatus}
      />

      <TravellerSection title="Case">
        <RefundCaseFacts
          bookingId={data.bookingId}
          paymentRefundStatus={data.paymentRefundStatus}
          supplierOperationNote={data.supplierOperationNote}
          failureReason={data.failureReason}
        />
      </TravellerSection>

      {calc ? (
        <TravellerSection title="Calculation">
          <RefundCalcLedger calc={calc} />
        </TravellerSection>
      ) : null}

      {audit ? (
        <TravellerSection
          title="History"
          note={`${audit.length} event${audit.length === 1 ? "" : "s"}`}
        >
          <RefundAuditList rows={audit} />
        </TravellerSection>
      ) : null}
    </div>
  );
}
