"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  User,
  CreditCard,
  Ticket,
  AlertCircle,
} from "lucide-react";
import { Button, buttonClassName } from "@/components/ui";
import {
  isBookingTicketed,
  parsePriceChangedError,
  ticketNumbersFromMetadata,
  voucherRefsFromMetadata,
  type PriceChangedDetails,
} from "@/lib/bookings/checkoutDisplay";
import { visaWarningFromMetadata } from "@/lib/bookings/visaCheckoutWarning";
import { useAuthStore } from "@/store/auth.store";
import { useLastChatUrl } from "@/lib/ask-ai/useLastChatUrl";
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
import { CheckoutBrandedLoader } from "./_components/CheckoutBrandedLoader";
import { TicketIssuedPanel } from "./_components/TicketIssuedPanel";
import {
  CheckoutQuotedActions,
  CheckoutReservedActions,
  type PaymentMethodOption,
} from "./_components/CheckoutQuotedActions";

function CheckoutProgressBar({
  status,
  quotedStep = "TRAVELLER",
}: {
  status: string;
  quotedStep?: "TRAVELLER" | "PAYMENT";
}) {
  const isQuoted = status === "QUOTED";
  const isReserved = status === "RESERVED";
  const isTicketed =
    status === "TICKETED" || status === "ACTIVE" || status === "COMPLETED";

  const isStep1Done = (isQuoted && quotedStep === "PAYMENT") || isReserved || isTicketed;
  const isStep1Active = isQuoted && quotedStep === "TRAVELLER";
  const isStep2Done = isTicketed;
  const isStep2Active = (isQuoted && quotedStep === "PAYMENT") || isReserved;

  const steps = [
    {
      label: "Traveller",
      done: isStep1Done,
      active: isStep1Active,
      Icon: User,
    },
    {
      label: "Payment",
      done: isStep2Done,
      active: isStep2Active,
      Icon: CreditCard,
    },
    {
      label: "Ticket",
      done: isTicketed,
      active: false,
      Icon: Ticket,
    },
  ] as const;

  return (
    <ol className="fo-checkout__steps" aria-label="Checkout progress">
      {steps.map(({ label, done, active, Icon }, index) => (
        <li
          key={label}
          className={`fo-checkout__step ${
            done ? "fo-checkout__step--done" : active ? "fo-checkout__step--active" : ""
          }`}
          aria-current={active ? "step" : undefined}
        >
          <span className="fo-checkout__step-row">
            <span className="fo-checkout__step-marker" aria-hidden>
              {done ? (
                <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
              ) : active ? (
                <Icon className="h-3.5 w-3.5" strokeWidth={2.4} />
              ) : (
                index + 1
              )}
            </span>
            <span className="fo-checkout__step-label">{label}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function CheckoutClient({ bookingId }: { bookingId: string }) {
  const [quotedStep, setQuotedStep] = useState<"TRAVELLER" | "PAYMENT">("TRAVELLER");
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  // Back to the exact chat state (conversation, results, open deal) this
  // booking was started from — not a bare /chat that resets the search.
  const backToSearchHref = useLastChatUrl();

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
      <CheckoutBrandedLoader
        title="Restoring secure session…"
        subtitle="Verifying traveller credentials and encrypted Galileo GDS channel."
      />
    );
  }

  if (!accessToken) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center py-12">
        <div className="fo-desk__panel w-full max-w-md space-y-4 p-8 text-center">
          <p className="m-0 text-[14px] text-ink-soft">
            Sign in to continue checkout. Guests cannot book.
          </p>
          <Link
            href={`/login?redirect=${encodeURIComponent(`/checkout/${bookingId}`)}`}
            className={buttonClassName({ size: "md" })}
          >
            Log in
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <CheckoutBrandedLoader
        title="Retrieving your reservation…"
        subtitle="Verifying live Galileo GDS fare locks, baggage allowances & airline seat locks."
      />
    );
  }

  if (isError || !booking) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center py-12">
        <div className="fo-desk__panel w-full max-w-md space-y-4 border-[color-mix(in_oklab,var(--danger)_28%,var(--fo-desk-line))] p-8 text-center">
          <p className="m-0 flex items-center justify-center gap-2 text-[14px] font-medium text-danger" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
            {apiErrorMessage(error) || "Booking not found"}
          </p>
          <Button variant="secondary" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
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
        accountNumber: ["jazzcash", "easypaisa"].includes(payMethod)
          ? accountNumber.trim()
          : undefined,
        method: payMethod,
      }).unwrap();

      if (booking?.status === "QUOTED") {
        const travellerSnapshot = buildTravellerSnapshot(formData);
        await reserve({
          id: bookingId,
          clientAmountMinor: serverAmountMinor,
          travellerSnapshot,
        }).unwrap();

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
    <div className="fo-checkout w-full pb-10">
      <header className="fo-desk__header">
        <Link
          href={backToSearchHref}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-soft transition-colors hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to search
        </Link>
        <h1 className="fo-desk__title">Checkout</h1>
        <p className="fo-desk__lede">
          Confirm traveller details and payment for this booking.
        </p>
      </header>

      <CheckoutProgressBar status={booking.status} quotedStep={quotedStep} />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="flex flex-col gap-4 lg:col-span-7 xl:col-span-8">
          {/* Ticketing is terminal — the approval gate and payment-method
              picker are spent at that point and only add noise. */}
          {approvalGate &&
          !isBookingTicketed(booking.status) &&
          (booking.status !== "QUOTED" || quotedStep === "PAYMENT") ? (
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

          {booking.status === "QUOTED" && quotedStep === "PAYMENT" ? (
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

          {!payCap?.configured && !isBookingTicketed(booking.status) ? (
            <div className="fo-checkout__notice text-[13px] text-ink-soft">
              Payment gateway unconfigured — live card capture is unavailable until credentials are
              set.
            </div>
          ) : null}

          {actionError ? (
            <div className="fo-checkout__alert text-[13px] text-danger" role="alert">
              {actionError}
            </div>
          ) : null}

          {booking.status === "QUOTED" ? (
            <CheckoutQuotedActions
              quotedStep={quotedStep}
              onContinueToCheckout={() => {
                setLocalError(null);
                setQuotedStep("PAYMENT");
                if (typeof window !== "undefined") {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
              onBackToTraveller={() => {
                setLocalError(null);
                setQuotedStep("TRAVELLER");
                if (typeof window !== "undefined") {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
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

          {isBookingTicketed(booking.status) ? (
            <TicketIssuedPanel booking={booking} />
          ) : null}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:col-span-5 xl:col-span-4">
          <CheckoutBookingSummary booking={booking} tickets={tickets} vouchers={vouchers} />
        </aside>
      </div>
    </div>
  );
}
