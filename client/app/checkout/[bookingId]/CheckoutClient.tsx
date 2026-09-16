"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, Spinner } from "@/components/ui";
import {
  parsePriceChangedError,
  ticketNumbersFromMetadata,
  voucherRefsFromMetadata,
  type PriceChangedDetails,
} from "@/lib/bookings/checkoutDisplay";
import { visaWarningFromMetadata } from "@/lib/bookings/visaCheckoutWarning";
import { useAuthStore } from "@/store/auth.store";
import {
  useAcceptPriceChangeMutation,
  useGetBookingQuery,
  usePayBookingMutation,
  useReserveBookingMutation,
  useTicketBookingMutation,
} from "@/lib/api/bookings.api";
import {
  useGetProfileQuery,
  useListDocumentsQuery,
  useListCompanionsQuery,
  type Companion,
} from "@/lib/api/profile.api";
import {
  useApplyCheckoutCreditMutation,
  useGetRewardsSummaryQuery,
} from "@/lib/api/rewards.api";
import {
  useCreateApprovalMutation,
  useGetBookingApprovalGateQuery,
} from "@/lib/api/corporate.api";
import { useCorporateProfileStore } from "@/store/corporateProfile.store";
import {
  buildTravellerSnapshot,
  resolveCompanionTraveller,
  resolvePrimaryTraveller,
  validateTravellerFormData,
  type TravellerFormData,
} from "@/lib/bookings/travellerAutoFill";
import { apiErrorMessage } from "./_components/apiErrorMessage";
import { CheckoutBookingSummary } from "./_components/CheckoutBookingSummary";
import { CheckoutCorporateSection } from "./_components/CheckoutCorporateSection";
import { CheckoutRewardsSection } from "./_components/CheckoutRewardsSection";
import { CheckoutVisaWarning } from "./_components/CheckoutVisaWarning";
import { CheckoutPriceChangeAlert } from "./_components/CheckoutPriceChangeAlert";
import {
  CheckoutQuotedActions,
  CheckoutReservedActions,
} from "./_components/CheckoutQuotedActions";

export function CheckoutClient({ bookingId }: { bookingId: string }) {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);

  const { data: booking, isLoading, isError, refetch, error } = useGetBookingQuery(bookingId, {
    skip: !hasHydrated || !accessToken,
  });

  const { data: profile } = useGetProfileQuery(undefined, {
    skip: !hasHydrated || !accessToken,
  });

  const { data: documents } = useListDocumentsQuery(undefined, {
    skip: !hasHydrated || !accessToken,
  });

  const { data: companions } = useListCompanionsQuery(
    { includePassport: true },
    { skip: !hasHydrated || !accessToken },
  );

  const [pay, payState] = usePayBookingMutation();
  const [reserve, reserveState] = useReserveBookingMutation();
  const [ticket, ticketState] = useTicketBookingMutation();
  const [acceptPrice, acceptState] = useAcceptPriceChangeMutation();

  const [formData, setFormData] = useState<TravellerFormData>({
    givenName: "",
    surname: "",
    nationality: "",
    dateOfBirth: "",
    passportNumber: "",
    passportExpiry: "",
    phone: "",
    email: "",
    companionId: null,
    isAutoFilled: false,
  });

  const [hasInitializedAutoFill, setHasInitializedAutoFill] = useState(false);

  // Auto-fill primary traveller from Profile & Vault once loaded
  useEffect(() => {
    if (!hasInitializedAutoFill && (profile || documents || user)) {
      const primary = resolvePrimaryTraveller(profile, documents, user);
      if (primary.givenName || primary.surname || primary.passportNumber || primary.nationality) {
        setFormData(primary);
        setHasInitializedAutoFill(true);
      }
    }
  }, [profile, documents, user, hasInitializedAutoFill]);

  const [paymentToken, setPaymentToken] = useState("");
  const [rewardPoints, setRewardPoints] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [priceChange, setPriceChange] = useState<PriceChangedDetails | null>(null);

  const { data: rewardsSummary } = useGetRewardsSummaryQuery(undefined, {
    skip: !hasHydrated || !accessToken,
  });

  const [applyCredit, creditState] = useApplyCheckoutCreditMutation();
  const corpMode = useCorporateProfileStore((s) => s.mode);
  const corpCompanyId = useCorporateProfileStore((s) => s.companyId);
  const { data: approvalGate, refetch: refetchGate } = useGetBookingApprovalGateQuery(bookingId, {
    skip: !hasHydrated || !accessToken,
  });
  const [createApproval, approvalState] = useCreateApprovalMutation();
  const [payMethod, setPayMethod] = useState<"card" | "corporate_credit">("card");

  const tickets = useMemo(
    () => ticketNumbersFromMetadata(booking?.metadata ?? null),
    [booking],
  );
  const vouchers = useMemo(
    () => voucherRefsFromMetadata(booking?.metadata ?? null),
    [booking],
  );
  const visaWarning = useMemo(
    () => visaWarningFromMetadata(booking?.metadata ?? null),
    [booking],
  );

  const busy =
    payState.isLoading ||
    reserveState.isLoading ||
    ticketState.isLoading ||
    acceptState.isLoading ||
    creditState.isLoading ||
    approvalState.isLoading;

  const corporateBlocked =
    Boolean(approvalGate?.corporate) && approvalGate?.canProceed === false;

  if (!hasHydrated) {
    return (
      <div className="fo-desk__panel">
        <Spinner label="Loading session…" />
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="fo-desk__panel fo-desk__stack">
        <p className="fo-desk__empty" style={{ padding: 0 }}>
          Sign in to continue checkout. Guests cannot book.
        </p>
        <Link
          href={`/login?redirect=${encodeURIComponent(`/checkout/${bookingId}`)}`}
          className="text-[14px] text-[var(--cyan)] underline"
        >
          Log in
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="fo-desk__panel">
        <Spinner label="Loading booking…" />
      </div>
    );
  }

  if (isError || !booking) {
    return (
      <div className="fo-desk__panel fo-desk__stack">
        <p className="text-[15px] text-[var(--danger)]" role="alert">
          {apiErrorMessage(error) || "Booking not found"}
        </p>
        <Button variant="ghost" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const payCap = booking.paymentCapability;
  const supplierCap = booking.supplierCapability;
  const serverAmountMinor = booking.amountMinor;
  const actionError =
    localError ||
    (payState.error && !parsePriceChangedError(payState.error)
      ? apiErrorMessage(payState.error)
      : null) ||
    (reserveState.error && !parsePriceChangedError(reserveState.error)
      ? apiErrorMessage(reserveState.error)
      : null) ||
    (ticketState.error && !parsePriceChangedError(ticketState.error)
      ? apiErrorMessage(ticketState.error)
      : null) ||
    (acceptState.error ? apiErrorMessage(acceptState.error) : null);

  function capturePriceChange(err: unknown) {
    const parsed = parsePriceChangedError(err);
    if (parsed) {
      setPriceChange(parsed);
      setLocalError(null);
      return true;
    }
    return false;
  }

  function handleSelectPrimary() {
    const primary = resolvePrimaryTraveller(profile, documents, user);
    setFormData(primary);
  }

  function handleSelectCompanion(companion: Companion) {
    const compData = resolveCompanionTraveller(companion, documents);
    setFormData(compData);
  }

  const hasSuccessfulPayment = Boolean(
    booking?.payments?.some(
      (p) => p.status === "CAPTURED" || p.status === "AUTHORIZED",
    ),
  );

  async function onPay() {
    setLocalError(null);
    if (priceChange) {
      setLocalError("Accept the updated price before continuing checkout");
      return;
    }
    if (booking?.status === "QUOTED") {
      const validation = validateTravellerFormData(formData);
      if (!validation.isValid) {
        setLocalError("Traveller given name and surname are required before payment");
        return;
      }
    }
    if (!payCap?.canCapture && payMethod === "card") {
      setLocalError(
        payCap?.reasons?.join("; ") || "Payment gateway is not configured — cannot capture payment",
      );
      return;
    }
    if (!paymentToken.trim() && payMethod === "card") {
      setLocalError("Enter a tokenized payment method (never a raw card number)");
      return;
    }
    if (corporateBlocked) {
      setLocalError("Corporate approval required before payment");
      return;
    }
    try {
      await pay({
        id: bookingId,
        paymentMethodToken: payMethod === "card" ? paymentToken.trim() : undefined,
        method: payMethod,
      }).unwrap();

      if (booking?.status === "QUOTED") {
        const travellerSnapshot = buildTravellerSnapshot(formData);
        await reserve({
          id: bookingId,
          clientAmountMinor: serverAmountMinor,
          travellerSnapshot,
        }).unwrap();

        if (supplierCap?.canTicket) {
          try {
            await ticket({ id: bookingId, clientAmountMinor: serverAmountMinor }).unwrap();
          } catch {
            // Keep in RESERVED if supplier ticketing is unconfigured or rejected
          }
        }
      }

      await refetch();
      await refetchGate();
    } catch (err) {
      if (!capturePriceChange(err)) setLocalError(apiErrorMessage(err));
    }
  }

  async function onReserve() {
    setLocalError(null);
    if (priceChange) {
      setLocalError("Accept the updated price before continuing checkout");
      return;
    }
    const validation = validateTravellerFormData(formData);
    if (!validation.isValid) {
      setLocalError("Traveller given name and surname are required before reservation");
      return;
    }
    if (corporateBlocked) {
      setLocalError("Corporate approval required before reservation");
      return;
    }
    if (!supplierCap?.canReserve) {
      setLocalError(supplierCap?.reasons?.join("; ") || "Supplier reservation is unavailable");
      return;
    }

    const travellerSnapshot = buildTravellerSnapshot(formData);

    try {
      await reserve({
        id: bookingId,
        clientAmountMinor: serverAmountMinor,
        travellerSnapshot,
      }).unwrap();
      await refetch();
      await refetchGate();
    } catch (err) {
      if (!capturePriceChange(err)) setLocalError(apiErrorMessage(err));
    }
  }

  async function onTicket() {
    setLocalError(null);
    if (priceChange) {
      setLocalError("Accept the updated price before continuing checkout");
      return;
    }
    if (!supplierCap?.canTicket) {
      setLocalError(
        supplierCap?.reasons?.join("; ") ||
          "Supplier ticketing is unavailable — refusing fabricated ticket success",
      );
      return;
    }
    try {
      await ticket({ id: bookingId, clientAmountMinor: serverAmountMinor }).unwrap();
      await refetch();
    } catch (err) {
      if (!capturePriceChange(err)) setLocalError(apiErrorMessage(err));
    }
  }

  async function onAcceptNewPrice() {
    if (!priceChange) return;
    setLocalError(null);
    try {
      await acceptPrice({
        id: bookingId,
        acceptedAmountMinor: priceChange.newAmountMinor,
      }).unwrap();
      setPriceChange(null);
      await refetch();
    } catch (err) {
      if (!capturePriceChange(err)) setLocalError(apiErrorMessage(err));
    }
  }

  const checkoutBlockedByPriceChange = Boolean(priceChange);

  return (
    <div className="fo-checkout">
      <CheckoutBookingSummary booking={booking} tickets={tickets} vouchers={vouchers} />

      {approvalGate ? (
        <CheckoutCorporateSection
          bookingId={bookingId}
          bookingStatus={booking.status}
          bookingMetadata={booking.metadata}
          approvalGate={approvalGate}
          corpCompanyId={corpCompanyId}
          corpMode={corpMode}
          payMethod={payMethod}
          setPayMethod={setPayMethod}
          busy={busy}
          onRequestApproval={async () => {
            setLocalError(null);
            try {
              await createApproval({
                bookingId,
                companyId: (corpCompanyId || approvalGate.companyId)!,
              }).unwrap();
              await refetchGate();
            } catch (err) {
              setLocalError(apiErrorMessage(err));
            }
          }}
        />
      ) : null}

      {booking.status === "QUOTED" ? (
        <CheckoutRewardsSection
          balance={rewardsSummary?.balance ?? 0}
          rewardPoints={rewardPoints}
          setRewardPoints={setRewardPoints}
          busy={busy}
          onApply={async () => {
            setLocalError(null);
            try {
              await applyCredit({
                bookingId,
                points: Number(rewardPoints),
                idempotencyKey: `checkout-${bookingId}-${rewardPoints}`,
              }).unwrap();
              await refetch();
            } catch (err) {
              setLocalError(apiErrorMessage(err));
            }
          }}
        />
      ) : null}

      <CheckoutVisaWarning visaWarning={visaWarning} />

      {priceChange ? (
        <CheckoutPriceChangeAlert
          priceChange={priceChange}
          busy={busy}
          accepting={acceptState.isLoading}
          onAccept={() => void onAcceptNewPrice()}
        />
      ) : null}

      {!payCap?.configured ? (
        <p className="fo-checkout__alert text-[13px] text-[var(--danger)]">
          Payment gateway unconfigured — live card capture is unavailable until credentials are set.
        </p>
      ) : null}

      {booking.status === "QUOTED" ? (
        <CheckoutQuotedActions
          formData={formData}
          setFormData={setFormData}
          savedCompanions={companions || []}
          onSelectPrimary={handleSelectPrimary}
          onSelectCompanion={handleSelectCompanion}
          paymentToken={paymentToken}
          setPaymentToken={setPaymentToken}
          payMethod={payMethod}
          busy={busy}
          checkoutBlockedByPriceChange={checkoutBlockedByPriceChange}
          corporateBlocked={corporateBlocked}
          canCapture={Boolean(payCap?.canCapture)}
          paying={payState.isLoading}
          reserving={reserveState.isLoading}
          onPay={() => void onPay()}
          onReserve={() => void onReserve()}
        />
      ) : null}

      {booking.status === "RESERVED" ? (
        <CheckoutReservedActions
          busy={busy}
          canTicket={Boolean(supplierCap?.canTicket)}
          hasPayment={hasSuccessfulPayment}
          checkoutBlockedByPriceChange={checkoutBlockedByPriceChange}
          corporateBlocked={corporateBlocked}
          payMethod={payMethod}
          paymentToken={paymentToken}
          setPaymentToken={setPaymentToken}
          canCapture={Boolean(payCap?.canCapture)}
          paying={payState.isLoading}
          ticketing={ticketState.isLoading}
          onPay={() => void onPay()}
          onTicket={() => void onTicket()}
        />
      ) : null}

      {booking.status === "TICKETED" ? (
        <p className="fo-checkout__notice">
          Ticketed with supplier confirmation
          {booking.externalRef ? ` (${booking.externalRef})` : ""}.
        </p>
      ) : null}

      {actionError ? (
        <p className="text-[13px] text-[var(--danger)]" role="alert">
          {actionError}
        </p>
      ) : null}

      <Link href="/chat" className="inline-block text-[13px] text-ink-faint underline">
        Back to chat
      </Link>
    </div>
  );
}
