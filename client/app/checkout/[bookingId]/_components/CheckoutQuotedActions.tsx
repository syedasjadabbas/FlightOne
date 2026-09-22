"use client";

import { useState } from "react";
import {
  User,
  Check,
  ChevronDown,
  CreditCard,
  Smartphone,
  Landmark,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Clock,
} from "lucide-react";
import { Button, Input } from "@/components/ui";
import { formatMinor } from "@/lib/bookings/checkoutDisplay";
import type { Companion } from "@/lib/api/profile.api";
import {
  validateTravellerFormData,
  type TravellerFormData,
} from "@/lib/bookings/travellerAutoFill";

export type PaymentMethodOption =
  | "card"
  | "corporate_credit"
  | "jazzcash"
  | "easypaisa"
  | "onelink_ibft";

export type QuotedProgressionStep = "TRAVELLER" | "PAYMENT";

const payMethodClass = (active: boolean) =>
  `flex flex-col items-center text-center rounded-[var(--fo-desk-radius)] border p-3 transition-colors ${
    active
      ? "border-[var(--cyan)] bg-[var(--fo-desk-wash)] ring-1 ring-[var(--cyan)]"
      : "border-[var(--fo-desk-line)] bg-[var(--white)] hover:border-[var(--fo-desk-line-strong)]"
  }`;

export function CheckoutQuotedActions({
  formData,
  setFormData,
  savedCompanions = [],
  onSelectPrimary,
  onSelectCompanion,
  paymentToken,
  setPaymentToken,
  accountNumber = "",
  setAccountNumber,
  payMethod,
  setPayMethod,
  busy,
  checkoutBlockedByPriceChange,
  corporateBlocked,
  canCapture,
  paying,
  reserving,
  onPay,
  onReserve,
  amountMinor = 0,
  currency = "PKR",
  quotedStep = "TRAVELLER",
  onContinueToCheckout,
  onBackToTraveller,
}: {
  formData: TravellerFormData;
  setFormData: React.Dispatch<React.SetStateAction<TravellerFormData>>;
  savedCompanions?: Companion[];
  onSelectPrimary: () => void;
  onSelectCompanion: (companion: Companion) => void;
  paymentToken: string;
  setPaymentToken: (v: string) => void;
  accountNumber?: string;
  setAccountNumber?: (v: string) => void;
  payMethod: PaymentMethodOption;
  setPayMethod?: (v: PaymentMethodOption) => void;
  busy: boolean;
  checkoutBlockedByPriceChange: boolean;
  corporateBlocked: boolean;
  canCapture: boolean;
  paying: boolean;
  reserving: boolean;
  onPay: () => void;
  onReserve: () => void;
  amountMinor?: number;
  currency?: string;
  quotedStep?: QuotedProgressionStep;
  onContinueToCheckout?: () => void;
  onBackToTraveller?: () => void;
}) {
  const hasCompanions = savedCompanions.length > 0;
  const [isPassengerOpen, setIsPassengerOpen] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);

  const formattedPayAmount = amountMinor > 0 ? formatMinor(amountMinor, currency) : "";
  const fieldDisabled = busy || checkoutBlockedByPriceChange;

  const inputFocus =
    "w-full rounded-[var(--fo-desk-radius)] border border-[var(--fo-desk-line)] bg-[var(--white)] px-3.5 py-2.5 text-[13px] text-[var(--navy)] placeholder:text-[var(--ink-faint)] outline-none transition-colors focus:border-[var(--cyan)] focus:ring-1 focus:ring-[var(--cyan)]";

  if (quotedStep === "TRAVELLER") {
    return (
      <div className="fo-desk__panel space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-[var(--fo-desk-line)] pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--fo-desk-radius)] bg-[var(--fo-desk-wash)] text-[var(--cyan)]">
              <User className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="m-0 text-[16px] font-semibold leading-9 tracking-tight text-[var(--navy)]">
                Traveller details
              </h2>
              <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--ink-soft)]">
                Must match the passport or travel document used for ticketing.
              </p>
            </div>
          </div>

          {formData.isAutoFilled ? (
            <span className="fo-desk__status fo-desk__status--ok inline-flex items-center gap-1">
              <Check className="h-3 w-3" aria-hidden />
              From {formData.sourceLabel || "Profile & Vault"}
            </span>
          ) : null}
        </div>

        {hasCompanions ? (
          <div className="flex flex-wrap items-center gap-2 rounded-[var(--fo-desk-radius)] border border-[var(--fo-desk-line)] bg-[var(--fo-desk-wash)] p-2">
            <span className="pl-1 text-[12px] font-medium text-[var(--ink-soft)]">Traveller:</span>
            <button
              type="button"
              disabled={fieldDisabled}
              onClick={onSelectPrimary}
              className={`fo-desk__chip ${!formData.companionId ? "fo-desk__chip--active" : ""}`}
            >
              Primary
            </button>
            {savedCompanions.map((comp) => (
              <button
                key={comp.id}
                type="button"
                disabled={fieldDisabled}
                onClick={() => onSelectCompanion(comp)}
                className={`fo-desk__chip ${
                  formData.companionId === comp.id ? "fo-desk__chip--active" : ""
                }`}
              >
                {comp.fullName}
                {comp.relationship ? ` (${comp.relationship})` : ""}
              </button>
            ))}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-[var(--fo-desk-radius)] border border-[var(--fo-desk-line)]">
          <button
            type="button"
            onClick={() => setIsPassengerOpen((v) => !v)}
            className="flex w-full cursor-pointer items-center justify-between bg-[var(--fo-desk-wash)] p-3.5 text-left transition-colors hover:bg-[color-mix(in_oklab,var(--cyan)_8%,var(--white))]"
            aria-expanded={isPassengerOpen}
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--navy)] text-[11px] font-bold text-[var(--white)]">
                1
              </span>
              <div>
                <span className="text-[13px] font-semibold text-[var(--navy)]">Passenger 1</span>
                <span className="ml-2 text-[12px] font-medium text-[var(--ink-soft)]">Adult</span>
              </div>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-[var(--ink-soft)] transition-transform ${
                isPassengerOpen ? "rotate-180" : ""
              }`}
              aria-hidden
            />
          </button>

          {isPassengerOpen ? (
            <div className="space-y-4 bg-[var(--white)] p-4 sm:p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Given name *"
                  value={formData.givenName}
                  onChange={(e) => {
                    setValidationError(null);
                    setFormData((prev) => ({ ...prev, givenName: e.target.value }));
                  }}
                  placeholder="First / given names"
                  disabled={fieldDisabled}
                  required
                />
                <Input
                  label="Surname *"
                  value={formData.surname}
                  onChange={(e) => {
                    setValidationError(null);
                    setFormData((prev) => ({ ...prev, surname: e.target.value }));
                  }}
                  placeholder="Last / family name"
                  disabled={fieldDisabled}
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-[var(--navy)]">
                    Nationality *
                  </label>
                  <input
                    type="text"
                    value={formData.nationality}
                    onChange={(e) => {
                      setValidationError(null);
                      setFormData((prev) => ({
                        ...prev,
                        nationality: e.target.value.toUpperCase().slice(0, 3),
                      }));
                    }}
                    placeholder="e.g. PK, US, GB"
                    disabled={fieldDisabled}
                    className={inputFocus}
                  />
                </div>
                <Input
                  label="Date of birth *"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => {
                    setValidationError(null);
                    setFormData((prev) => ({ ...prev, dateOfBirth: e.target.value }));
                  }}
                  disabled={fieldDisabled}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Passport number *"
                  value={formData.passportNumber}
                  onChange={(e) => {
                    setValidationError(null);
                    setFormData((prev) => ({
                      ...prev,
                      passportNumber: e.target.value.toUpperCase(),
                    }));
                  }}
                  placeholder="Passport / document ID"
                  disabled={fieldDisabled}
                />
                <Input
                  label="Passport expiry *"
                  type="date"
                  value={formData.passportExpiry}
                  onChange={(e) => {
                    setValidationError(null);
                    setFormData((prev) => ({ ...prev, passportExpiry: e.target.value }));
                  }}
                  disabled={fieldDisabled}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Phone *"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => {
                    setValidationError(null);
                    setFormData((prev) => ({ ...prev, phone: e.target.value }));
                  }}
                  placeholder="+92 300 1234567"
                  disabled={fieldDisabled}
                />
                <Input
                  label="Email *"
                  type="email"
                  value={formData.email}
                  onChange={(e) => {
                    setValidationError(null);
                    setFormData((prev) => ({ ...prev, email: e.target.value }));
                  }}
                  placeholder="traveller@example.com"
                  disabled={fieldDisabled}
                />
              </div>
            </div>
          ) : null}
        </div>

        {validationError ? (
          <div
            className="fo-checkout__alert flex items-center gap-2 text-[12px] font-medium text-[var(--danger)]"
            role="alert"
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
            <span>{validationError}</span>
          </div>
        ) : null}

        <div className="fo-checkout__actions flex-row flex-wrap items-center justify-between gap-3">
          <p className="fo-checkout__note m-0">
            Review passenger details before payment.
          </p>
          <Button
            type="button"
            className="inline-flex min-w-[200px] items-center justify-center gap-2"
            disabled={fieldDisabled}
            onClick={() => {
              const validation = validateTravellerFormData(formData);
              if (!validation.isValid) {
                setValidationError("Given name and surname are required");
                return;
              }
              setValidationError(null);
              onContinueToCheckout?.();
            }}
          >
            Continue to payment
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="fo-checkout__traveller fo-desk__panel flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="fo-checkout__traveller-avatar">
            <User className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="m-0 text-[15px] font-semibold tracking-tight text-[var(--navy)]">
                {formData.givenName} {formData.surname}
              </p>
              <span className="fo-desk__status fo-desk__status--ok inline-flex items-center gap-1">
                <Check className="h-3 w-3" aria-hidden />
                Ready
              </span>
            </div>
            <p className="m-0 text-[12px] text-[var(--ink-soft)]">
              {[
                formData.nationality ? formData.nationality : null,
                formData.passportNumber ? `Passport ${formData.passportNumber}` : null,
                formData.phone || null,
              ]
                .filter(Boolean)
                .join(" · ") || "Passenger on file"}
            </p>
          </div>
        </div>
        {onBackToTraveller ? (
          <button
            type="button"
            onClick={onBackToTraveller}
            className="fo-checkout__traveller-edit"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Edit traveller
          </button>
        ) : null}
      </div>

      <div className="fo-desk__panel space-y-4">
        <div className="flex items-start gap-3 border-b border-[var(--fo-desk-line)] pb-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--fo-desk-radius)] bg-[var(--fo-desk-wash)] text-[var(--cyan)]">
            <CreditCard className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <h2 className="m-0 text-[16px] font-semibold tracking-tight text-[var(--navy)]">
              Payment
            </h2>
            <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">
              Choose a method to pay or hold this booking.
            </p>
          </div>
        </div>

        {setPayMethod ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button
              type="button"
              disabled={busy || corporateBlocked}
              onClick={() => setPayMethod("card")}
              className={payMethodClass(payMethod === "card")}
            >
              <CreditCard className="mb-1.5 h-4 w-4 text-[var(--cyan)]" aria-hidden />
              <span className="text-[13px] font-semibold text-[var(--navy)]">Card</span>
              <span className="mt-0.5 text-[12px] text-[var(--ink-soft)]">Visa / Mastercard</span>
            </button>
            <button
              type="button"
              disabled={busy || corporateBlocked}
              onClick={() => setPayMethod("jazzcash")}
              className={payMethodClass(payMethod === "jazzcash")}
            >
              <Smartphone className="mb-1.5 h-4 w-4 text-[var(--cyan)]" aria-hidden />
              <span className="text-[13px] font-semibold text-[var(--navy)]">JazzCash</span>
              <span className="mt-0.5 text-[12px] text-[var(--ink-soft)]">Mobile wallet</span>
            </button>
            <button
              type="button"
              disabled={busy || corporateBlocked}
              onClick={() => setPayMethod("easypaisa")}
              className={payMethodClass(payMethod === "easypaisa")}
            >
              <Smartphone className="mb-1.5 h-4 w-4 text-[var(--cyan)]" aria-hidden />
              <span className="text-[13px] font-semibold text-[var(--navy)]">Easypaisa</span>
              <span className="mt-0.5 text-[12px] text-[var(--ink-soft)]">Mobile account</span>
            </button>
            <button
              type="button"
              disabled={busy || corporateBlocked}
              onClick={() => setPayMethod("onelink_ibft")}
              className={payMethodClass(payMethod === "onelink_ibft")}
            >
              <Landmark className="mb-1.5 h-4 w-4 text-[var(--cyan)]" aria-hidden />
              <span className="text-[13px] font-semibold text-[var(--navy)]">1Link IBFT</span>
              <span className="mt-0.5 text-[12px] text-[var(--ink-soft)]">1Bill transfer</span>
            </button>
          </div>
        ) : null}

        <div className="space-y-4">
          {payMethod === "card" ? (
            <Input
              label="Card token *"
              value={paymentToken}
              onChange={(e) => setPaymentToken(e.target.value)}
              placeholder="pm_card_visa or test token"
              disabled={busy || !canCapture || checkoutBlockedByPriceChange || corporateBlocked}
            />
          ) : null}

          {payMethod === "jazzcash" ? (
            <div className="space-y-2">
              <Input
                label="JazzCash mobile number *"
                value={accountNumber}
                onChange={(e) => setAccountNumber?.(e.target.value)}
                placeholder="03001234567"
                disabled={busy || checkoutBlockedByPriceChange || corporateBlocked}
              />
              <p className="fo-checkout__note">
                You will receive an MPIN prompt on this number.
              </p>
            </div>
          ) : null}

          {payMethod === "easypaisa" ? (
            <div className="space-y-2">
              <Input
                label="Easypaisa mobile number *"
                value={accountNumber}
                onChange={(e) => setAccountNumber?.(e.target.value)}
                placeholder="03451234567"
                disabled={busy || checkoutBlockedByPriceChange || corporateBlocked}
              />
              <p className="fo-checkout__note">
                You will receive an OTP / PIN prompt on this number.
              </p>
            </div>
          ) : null}

          {payMethod === "onelink_ibft" ? (
            <div className="fo-checkout__notice space-y-1 text-[12px]">
              <p className="m-0 font-semibold text-[var(--navy)]">1Bill / 1Link bank transfer</p>
              <p className="m-0 text-[var(--ink-soft)]">
                Pay generates a 1Bill consumer number. Complete transfer via any Pakistani banking
                app within the hold window to issue the ticket.
              </p>
            </div>
          ) : null}

          {payMethod === "corporate_credit" ? (
            <div className="fo-checkout__notice text-[12px] text-[var(--ink-soft)]">
              Corporate credit selected — verified server-side.
            </div>
          ) : null}

          <div className="fo-checkout__cta-row pt-1">
            <Button
              type="button"
              className="flex-1"
              disabled={
                busy ||
                (!canCapture && payMethod === "card") ||
                checkoutBlockedByPriceChange ||
                corporateBlocked
              }
              onClick={onPay}
            >
              {paying
                ? "Processing…"
                : formattedPayAmount
                  ? `Pay ${formattedPayAmount}`
                  : "Pay & confirm"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy || checkoutBlockedByPriceChange || corporateBlocked}
              onClick={onReserve}
            >
              {reserving ? "Holding…" : "Hold seat"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CheckoutReservedActions({
  busy,
  canTicket,
  hasPayment,
  pendingPaymentDetails,
  checkoutBlockedByPriceChange,
  corporateBlocked = false,
  payMethod,
  setPayMethod,
  paymentToken,
  setPaymentToken,
  accountNumber = "",
  setAccountNumber,
  canCapture,
  paying,
  ticketing,
  onPay,
  onTicket,
  amountMinor = 0,
  currency = "PKR",
}: {
  busy: boolean;
  canTicket: boolean;
  hasPayment: boolean;
  pendingPaymentDetails?: Record<string, any> | null;
  checkoutBlockedByPriceChange: boolean;
  corporateBlocked?: boolean;
  payMethod: PaymentMethodOption;
  setPayMethod?: (v: PaymentMethodOption) => void;
  paymentToken: string;
  setPaymentToken: (v: string) => void;
  accountNumber?: string;
  setAccountNumber?: (v: string) => void;
  canCapture: boolean;
  paying: boolean;
  ticketing: boolean;
  onPay: () => void;
  onTicket: () => void;
  amountMinor?: number;
  currency?: string;
}) {
  const isPending1Link = Boolean(pendingPaymentDetails?.consumerNumber);
  const formattedPayAmount = amountMinor > 0 ? formatMinor(amountMinor, currency) : "";

  return (
    <div className="fo-desk__panel space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--fo-desk-line)] pb-4">
        <div>
          <h2 className="m-0 text-[16px] font-semibold text-[var(--navy)]">
            {hasPayment
              ? "Issue ticket"
              : isPending1Link
                ? "Awaiting 1Link clearance"
                : "Pay reserved hold"}
          </h2>
          <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">
            {hasPayment
              ? "Payment authorized. Issue the supplier ticket."
              : isPending1Link
                ? "Seat held. Complete bank transfer to confirm."
                : "Seat held with supplier. Complete payment to ticket."}
          </p>
        </div>

        {hasPayment ? (
          <span className="fo-desk__status fo-desk__status--ok inline-flex items-center gap-1">
            <Check className="h-3 w-3" aria-hidden />
            Paid
          </span>
        ) : isPending1Link ? (
          <span className="fo-desk__status inline-flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden />
            Pending bank
          </span>
        ) : (
          <span className="fo-desk__status fo-desk__status--warn">Payment required</span>
        )}
      </div>

      {isPending1Link ? (
        <div className="fo-checkout__notice space-y-3 text-[13px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-[var(--navy)]">1Bill consumer number</span>
            <span className="rounded-[var(--fo-desk-radius)] bg-[var(--navy)] px-3 py-1 font-mono text-[14px] font-bold text-[var(--white)]">
              {pendingPaymentDetails?.consumerNumber}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 border-t border-[var(--fo-desk-line)] pt-2 text-[12px] sm:grid-cols-2">
            <div>
              <span className="text-[var(--ink-soft)]">Bank:</span>{" "}
              {pendingPaymentDetails?.bankName}
            </div>
            <div>
              <span className="text-[var(--ink-soft)]">Account:</span>{" "}
              {pendingPaymentDetails?.accountTitle}
            </div>
            <div className="sm:col-span-2">
              <span className="text-[var(--ink-soft)]">IBAN:</span>{" "}
              <span className="font-mono font-semibold text-[var(--navy)]">
                {pendingPaymentDetails?.iban}
              </span>
            </div>
          </div>
          <p className="m-0 text-[12px] text-[var(--ink-soft)]">
            Ticket issues automatically once the bank confirms the transfer.
          </p>
        </div>
      ) : null}

      {!hasPayment && !isPending1Link ? (
        <div className="space-y-4">
          {setPayMethod ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  ["card", "Card", CreditCard],
                  ["jazzcash", "JazzCash", Smartphone],
                  ["easypaisa", "Easypaisa", Smartphone],
                  ["onelink_ibft", "1Link", Landmark],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  disabled={busy || corporateBlocked}
                  onClick={() => setPayMethod(id)}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-[var(--fo-desk-radius)] border p-2.5 text-[12px] font-semibold transition-colors ${
                    payMethod === id
                      ? "border-[var(--cyan)] bg-[var(--fo-desk-wash)] text-[var(--navy)]"
                      : "border-[var(--fo-desk-line)] bg-[var(--white)] text-[var(--ink-soft)] hover:border-[var(--fo-desk-line-strong)]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          {payMethod === "card" ? (
            <Input
              label="Card token *"
              value={paymentToken}
              onChange={(e) => setPaymentToken(e.target.value)}
              placeholder="pm_… (tokenized)"
              disabled={busy || !canCapture || checkoutBlockedByPriceChange || corporateBlocked}
            />
          ) : null}

          {payMethod === "jazzcash" ? (
            <Input
              label="JazzCash mobile number *"
              value={accountNumber}
              onChange={(e) => setAccountNumber?.(e.target.value)}
              placeholder="03001234567"
              disabled={busy || checkoutBlockedByPriceChange || corporateBlocked}
            />
          ) : null}

          {payMethod === "easypaisa" ? (
            <Input
              label="Easypaisa mobile number *"
              value={accountNumber}
              onChange={(e) => setAccountNumber?.(e.target.value)}
              placeholder="03451234567"
              disabled={busy || checkoutBlockedByPriceChange || corporateBlocked}
            />
          ) : null}

          {payMethod === "onelink_ibft" ? (
            <div className="fo-checkout__notice text-[12px] text-[var(--ink-soft)]">
              Generates a 1Bill number for bank transfer before the hold expires.
            </div>
          ) : null}

          <Button
            type="button"
            className="w-full"
            disabled={
              busy ||
              (!canCapture && payMethod === "card") ||
              checkoutBlockedByPriceChange ||
              corporateBlocked
            }
            onClick={onPay}
          >
            {paying
              ? "Processing…"
              : formattedPayAmount
                ? `Pay ${formattedPayAmount}`
                : "Pay to issue ticket"}
          </Button>
        </div>
      ) : hasPayment ? (
        <div className="space-y-3">
          <Button
            type="button"
            className="w-full"
            disabled={busy || !canTicket || checkoutBlockedByPriceChange}
            onClick={onTicket}
          >
            {ticketing ? "Issuing…" : "Issue ticket"}
          </Button>
          {!canTicket ? (
            <p className="fo-checkout__note text-center">
              Ticketing stays blocked until the supplier can issue a live ticket.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
