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
  type PaymentMethodOption,
} from "./_components/CheckoutQuotedActions";

function CheckoutProgressBar({ status }: { status: string }) {
  const isQuoted = status === "QUOTED";
  const isReserved = status === "RESERVED";
  const isTicketed = status === "TICKETED" || status === "ACTIVE" || status === "COMPLETED";

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-4 py-3 sm:py-4 border-y border-slate-200/80">
      {/* Step 1: Traveller */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <div
          className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full text-[12px] sm:text-[13px] font-bold transition-colors ${
            isReserved || isTicketed
              ? "bg-emerald-600 text-white"
              : "bg-blue-600 text-white ring-4 ring-blue-50"
          }`}
        >
          {isReserved || isTicketed ? (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          )}
        </div>
        <div className="min-w-0">
          <p className={`text-[12px] sm:text-[13px] font-bold truncate ${isQuoted ? "text-slate-900" : "text-slate-700"}`}>
            1. Traveller
          </p>
          <p className="text-[11px] text-slate-500 truncate hidden sm:block">Passenger details</p>
        </div>
      </div>

      {/* Step 2: Payment */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <div
          className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full text-[12px] sm:text-[13px] font-bold transition-colors ${
            isTicketed
              ? "bg-emerald-600 text-white"
              : isReserved
                ? "bg-blue-600 text-white ring-4 ring-blue-50"
                : "bg-slate-100 text-slate-400 border border-slate-200"
          }`}
        >
          {isTicketed ? (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          )}
        </div>
        <div className="min-w-0">
          <p className={`text-[12px] sm:text-[13px] font-bold truncate ${isReserved ? "text-slate-900" : "text-slate-500"}`}>
            2. Payment
          </p>
          <p className="text-[11px] text-slate-500 truncate hidden sm:block">Secure payment</p>
        </div>
      </div>

      {/* Step 3: Ticket */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <div
          className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full text-[12px] sm:text-[13px] font-bold transition-colors ${
            isTicketed
              ? "bg-emerald-600 text-white ring-4 ring-emerald-50"
              : "bg-slate-100 text-slate-400 border border-slate-200"
          }`}
        >
          {isTicketed ? (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 5l-3 3-3-3" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          )}
        </div>
        <div className="min-w-0">
          <p className={`text-[12px] sm:text-[13px] font-bold truncate ${isTicketed ? "text-slate-900" : "text-slate-500"}`}>
            3. Ticket
          </p>
          <p className="text-[11px] text-slate-500 truncate hidden sm:block">Confirmation</p>
        </div>
      </div>
    </div>
  );
}

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
  const [payMethod, setPayMethod] = useState<PaymentMethodOption>("card");
  const [accountNumber, setAccountNumber] = useState("");

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
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
        <Spinner label="Loading session…" />
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-4 shadow-xs">
        <p className="text-[15px] text-slate-700">
          Sign in to continue checkout. Guests cannot book.
        </p>
        <Link
          href={`/login?redirect=${encodeURIComponent(`/checkout/${bookingId}`)}`}
          className="inline-block rounded-xl bg-blue-600 px-6 py-2.5 text-[14px] font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          Log in
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
        <Spinner label="Loading booking details…" />
      </div>
    );
  }

  if (isError || !booking) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-8 text-center space-y-4 shadow-xs">
        <p className="text-[15px] font-medium text-red-600" role="alert">
          {apiErrorMessage(error) || "Booking not found"}
        </p>
        <Button variant="secondary" onClick={() => void refetch()}>
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

  const pendingPayment = booking?.payments?.find((p) => p.status === "PENDING");

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
    if (["jazzcash", "easypaisa"].includes(payMethod) && !accountNumber.trim()) {
      setLocalError("Enter your mobile account number (03XXXXXXXXX)");
      return;
    }
    if (corporateBlocked) {
      setLocalError("Corporate approval required before payment");
      return;
    }
    try {
      const payRes = await pay({
        id: bookingId,
        paymentMethodToken: payMethod === "card" ? paymentToken.trim() : undefined,
        accountNumber: ["jazzcash", "easypaisa"].includes(payMethod) ? accountNumber.trim() : undefined,
        method: payMethod,
      }).unwrap();

      if (booking?.status === "QUOTED") {
        const travellerSnapshot = buildTravellerSnapshot(formData);
        await reserve({
          id: bookingId,
          clientAmountMinor: serverAmountMinor,
          travellerSnapshot,
        }).unwrap();

        // 1Link IBFT creates a PENDING hold — ticketing is NOT triggered until bank confirmation
        if (supplierCap?.canTicket && payRes.status !== "PENDING") {
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
    <div className="w-full space-y-6 pb-12">
      {/* ── 1. PAGE HEADER ───────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4 pt-1">
        <div className="space-y-1.5">
          <Link
            href="/chat"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to search
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Complete Your Reservation
          </h1>
          <p className="text-[13px] sm:text-[14px] text-slate-500 max-w-2xl">
            Almost there! Review your details and complete the payment to confirm your booking.
          </p>
        </div>

        {/* Security indicator badge */}
        <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-2xs">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div>
            <p className="text-[12px] font-bold text-slate-900 leading-tight">Your information is secure</p>
            <p className="text-[11px] text-slate-500">Encrypted and protected</p>
          </div>
        </div>
      </div>

      {/* ── 2. BOOKING PROGRESS BAR ──────────────────────── */}
      <CheckoutProgressBar status={booking.status} />

      {/* ── 3. MAIN RESPONSIVE TWO-COLUMN LAYOUT ──────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ── LEFT COLUMN (~65%) ─────────────────────────── */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
          {approvalGate ? (
            <CheckoutCorporateSection
              bookingId={bookingId}
              bookingStatus={booking.status}
              bookingMetadata={booking.metadata}
              approvalGate={approvalGate}
              corpCompanyId={corpCompanyId}
              corpMode={corpMode}
              payMethod={payMethod === "corporate_credit" ? "corporate_credit" : "card"}
              setPayMethod={(m) => setPayMethod(m)}
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
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-800">
              Payment gateway unconfigured — live card capture is unavailable until credentials are set.
            </div>
          ) : null}

          {actionError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-700" role="alert">
              {actionError}
            </div>
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
              accountNumber={accountNumber}
              setAccountNumber={setAccountNumber}
              payMethod={payMethod}
              setPayMethod={setPayMethod}
              busy={busy}
              checkoutBlockedByPriceChange={checkoutBlockedByPriceChange}
              corporateBlocked={corporateBlocked}
              canCapture={Boolean(payCap?.canCapture)}
              paying={payState.isLoading}
              reserving={reserveState.isLoading}
              onPay={() => void onPay()}
              onReserve={() => void onReserve()}
              amountMinor={booking.amountMinor}
              currency={booking.currency}
            />
          ) : null}

          {booking.status === "RESERVED" ? (
            <CheckoutReservedActions
              busy={busy}
              canTicket={Boolean(supplierCap?.canTicket)}
              hasPayment={hasSuccessfulPayment}
              pendingPaymentDetails={pendingPayment?.metadata || null}
              checkoutBlockedByPriceChange={checkoutBlockedByPriceChange}
              corporateBlocked={corporateBlocked}
              payMethod={payMethod}
              setPayMethod={setPayMethod}
              paymentToken={paymentToken}
              setPaymentToken={setPaymentToken}
              accountNumber={accountNumber}
              setAccountNumber={setAccountNumber}
              canCapture={Boolean(payCap?.canCapture)}
              paying={payState.isLoading}
              ticketing={ticketState.isLoading}
              onPay={() => void onPay()}
              onTicket={() => void onTicket()}
              amountMinor={booking.amountMinor}
              currency={booking.currency}
            />
          ) : null}

          {booking.status === "TICKETED" ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 text-center space-y-2">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-2">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 className="text-[17px] font-bold text-emerald-950">Ticket Successfully Issued!</h3>
              <p className="text-[13px] text-emerald-800 max-w-md mx-auto">
                Confirmed with supplier {booking.externalRef ? `(PNR: ${booking.externalRef})` : ""}.
                Your e-tickets and receipt have been delivered to your email and stored in your Traveller Vault.
              </p>
              <div className="pt-3">
                <Link
                  href="/journey"
                  className="inline-block rounded-xl bg-emerald-600 px-6 py-2.5 text-[14px] font-semibold text-white hover:bg-emerald-700 transition-colors shadow-xs"
                >
                  View in My Journey →
                </Link>
              </div>
            </div>
          ) : null}
        </div>

        {/* ── RIGHT COLUMN (~35%, Sticky) ────────────────── */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6 lg:sticky lg:top-6">
          <CheckoutBookingSummary
            booking={booking}
            tickets={tickets}
            vouchers={vouchers}
          />
        </div>
      </div>
    </div>
  );
}
