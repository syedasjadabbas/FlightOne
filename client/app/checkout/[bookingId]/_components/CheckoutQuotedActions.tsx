"use client";

import { Button, Input } from "@/components/ui";
import type { Companion } from "@/lib/api/profile.api";
import type { TravellerFormData } from "@/lib/bookings/travellerAutoFill";

export type PaymentMethodOption =
  | "card"
  | "corporate_credit"
  | "jazzcash"
  | "easypaisa"
  | "onelink_ibft";

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
}) {
  const hasCompanions = savedCompanions.length > 0;

  return (
    <div className="fo-desk__panel fo-checkout__actions">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="fo-desk__section-label" style={{ margin: 0 }}>
          Traveller & Passenger Details
        </p>
        {formData.isAutoFilled ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--cyan)_12%,transparent)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--cyan)]">
            <svg
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            Auto-filled from {formData.sourceLabel || "Vault"}
          </span>
        ) : null}
      </div>

      {hasCompanions ? (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[12px] text-ink-faint mr-1">Traveller:</span>
          <button
            type="button"
            disabled={busy || checkoutBlockedByPriceChange}
            onClick={onSelectPrimary}
            className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
              !formData.companionId
                ? "bg-[var(--cyan)] text-white shadow-sm"
                : "bg-surface-elevated text-ink-soft hover:text-ink"
            }`}
          >
            Primary (Self)
          </button>
          {savedCompanions.map((comp) => (
            <button
              key={comp.id}
              type="button"
              disabled={busy || checkoutBlockedByPriceChange}
              onClick={() => onSelectCompanion(comp)}
              className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                formData.companionId === comp.id
                  ? "bg-[var(--cyan)] text-white shadow-sm"
                  : "bg-surface-elevated text-ink-soft hover:text-ink"
              }`}
            >
              {comp.fullName}
              {comp.relationship ? ` (${comp.relationship})` : ""}
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Given name"
          value={formData.givenName}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, givenName: e.target.value }))
          }
          placeholder="First / Given names"
          disabled={busy || checkoutBlockedByPriceChange}
          required
        />
        <Input
          label="Surname"
          value={formData.surname}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, surname: e.target.value }))
          }
          placeholder="Last / Family name"
          disabled={busy || checkoutBlockedByPriceChange}
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Nationality (ISO code)"
          value={formData.nationality}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              nationality: e.target.value.toUpperCase().slice(0, 3),
            }))
          }
          placeholder="e.g. PK, US, GB"
          disabled={busy || checkoutBlockedByPriceChange}
        />
        <Input
          label="Date of birth"
          type="date"
          value={formData.dateOfBirth}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, dateOfBirth: e.target.value }))
          }
          disabled={busy || checkoutBlockedByPriceChange}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Passport number"
          value={formData.passportNumber}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              passportNumber: e.target.value.toUpperCase(),
            }))
          }
          placeholder="Passport / Document ID"
          disabled={busy || checkoutBlockedByPriceChange}
        />
        <Input
          label="Passport expiry date"
          type="date"
          value={formData.passportExpiry}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, passportExpiry: e.target.value }))
          }
          disabled={busy || checkoutBlockedByPriceChange}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Phone number"
          type="tel"
          value={formData.phone}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, phone: e.target.value }))
          }
          placeholder="+923001234567"
          disabled={busy || checkoutBlockedByPriceChange}
        />
        <Input
          label="Email address"
          type="email"
          value={formData.email}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, email: e.target.value }))
          }
          placeholder="traveller@example.com"
          disabled={busy || checkoutBlockedByPriceChange}
        />
      </div>

      <p className="fo-checkout__note">
        Fields are auto-populated from your Profile & Traveller Vault. You may edit any field prior to reservation.
      </p>

      <div className="border-t border-line/60 pt-3">
        <p className="fo-desk__section-label">Payment method</p>

        {setPayMethod ? (
          <div className="flex flex-wrap gap-1.5 pb-3">
            <button
              type="button"
              disabled={busy || corporateBlocked}
              onClick={() => setPayMethod("card")}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all ${
                payMethod === "card"
                  ? "bg-slate-900 text-white shadow-sm border border-slate-700"
                  : "bg-surface-elevated text-ink-soft hover:text-ink border border-transparent"
              }`}
            >
              💳 Card
            </button>
            <button
              type="button"
              disabled={busy || corporateBlocked}
              onClick={() => setPayMethod("jazzcash")}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all ${
                payMethod === "jazzcash"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-surface-elevated text-ink-soft hover:text-ink"
              }`}
            >
              📱 JazzCash
            </button>
            <button
              type="button"
              disabled={busy || corporateBlocked}
              onClick={() => setPayMethod("easypaisa")}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all ${
                payMethod === "easypaisa"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-surface-elevated text-ink-soft hover:text-ink"
              }`}
            >
              📱 Easypaisa
            </button>
            <button
              type="button"
              disabled={busy || corporateBlocked}
              onClick={() => setPayMethod("onelink_ibft")}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all ${
                payMethod === "onelink_ibft"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-surface-elevated text-ink-soft hover:text-ink"
              }`}
            >
              🏛️ 1Link IBFT
            </button>
            {payMethod === "corporate_credit" ? (
              <span className="rounded-lg bg-indigo-950/40 text-indigo-400 border border-indigo-800 px-3 py-1.5 text-[12px] font-medium">
                🏢 Corporate Credit
              </span>
            ) : null}
          </div>
        ) : null}

        {payMethod === "card" ? (
          <Input
            label="Payment method token"
            value={paymentToken}
            onChange={(e) => setPaymentToken(e.target.value)}
            placeholder="pm_… (tokenized — never enter raw PAN/CVV)"
            disabled={
              busy || !canCapture || checkoutBlockedByPriceChange || corporateBlocked
            }
          />
        ) : null}

        {payMethod === "jazzcash" ? (
          <div className="space-y-2">
            <Input
              label="JazzCash Mobile Account Number"
              value={accountNumber}
              onChange={(e) => setAccountNumber?.(e.target.value)}
              placeholder="03001234567"
              disabled={busy || checkoutBlockedByPriceChange || corporateBlocked}
            />
            <p className="fo-checkout__note text-amber-500/90">
              🔒 Direct Mobile Wallet: An authorization prompt with the exact fare will appear on your phone. Never enter your MPIN on any website.
            </p>
          </div>
        ) : null}

        {payMethod === "easypaisa" ? (
          <div className="space-y-2">
            <Input
              label="Easypaisa Mobile Account Number"
              value={accountNumber}
              onChange={(e) => setAccountNumber?.(e.target.value)}
              placeholder="03451234567"
              disabled={busy || checkoutBlockedByPriceChange || corporateBlocked}
            />
            <p className="fo-checkout__note text-emerald-500/90">
              🔒 Direct Mobile Account: Approve the incoming payment prompt in your Easypaisa app or on your handset. FlightOne never asks for your PIN.
            </p>
          </div>
        ) : null}

        {payMethod === "onelink_ibft" ? (
          <div className="rounded-lg border border-blue-900/50 bg-blue-950/20 p-3 space-y-1.5 text-[13px]">
            <p className="font-medium text-blue-300">🏛️ 1Bill / Interbank Funds Transfer (IBFT)</p>
            <p className="text-ink-soft text-[12px] leading-relaxed">
              Clicking Pay will generate a unique 1Bill Consumer Number and lock your seat reservation in hold. You can then transfer funds directly from any Pakistani bank app using 1Bill or IBFT.
            </p>
          </div>
        ) : null}

        {payMethod === "corporate_credit" ? (
          <p className="fo-checkout__note">
            Corporate credit selected — card token not required. Company credit is checked server-side.
          </p>
        ) : null}
      </div>

      <div className="fo-checkout__cta-row pt-2">
        <Button
          type="button"
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
            : payMethod === "corporate_credit"
              ? "Pay with credit"
              : payMethod === "onelink_ibft"
                ? "Initiate 1Link hold"
                : "Pay"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy || checkoutBlockedByPriceChange || corporateBlocked}
          onClick={onReserve}
        >
          {reserving ? "Reserving…" : "Reserve / Hold"}
        </Button>
      </div>
      <p className="fo-checkout__note">
        Pay or Reserve will hold your seat and revalidate live inventory with the supplier.
      </p>
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
}) {
  const isPending1Link = Boolean(pendingPaymentDetails?.consumerNumber);

  return (
    <div className="fo-desk__panel fo-checkout__actions">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="fo-desk__section-label" style={{ margin: 0 }}>
          {hasPayment
            ? "Supplier reservation & ticketing"
            : isPending1Link
              ? "1Link IBFT clearance pending"
              : "Payment for reserved hold"}
        </p>
        {hasPayment ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--cyan)_12%,transparent)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--cyan)]">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            Payment confirmed
          </span>
        ) : isPending1Link ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-medium text-blue-400">
            ⏳ Awaiting bank clearance
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-500">
            Payment required to ticket
          </span>
        )}
      </div>

      {isPending1Link ? (
        <div className="space-y-3 rounded-lg border border-blue-800/40 bg-blue-950/20 p-4 text-[13px]">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-blue-300">1Bill Consumer Number:</span>
            <span className="font-mono text-[14px] font-bold text-white bg-blue-900/60 px-2.5 py-1 rounded border border-blue-700">
              {pendingPaymentDetails?.consumerNumber}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px] pt-1 border-t border-blue-900/40">
            <div>
              <span className="text-ink-faint">Bank:</span> {pendingPaymentDetails?.bankName}
            </div>
            <div>
              <span className="text-ink-faint">Account Title:</span> {pendingPaymentDetails?.accountTitle}
            </div>
            <div className="sm:col-span-2">
              <span className="text-ink-faint">IBAN:</span>{" "}
              <span className="font-mono text-ink-strong">{pendingPaymentDetails?.iban}</span>
            </div>
          </div>
          <p className="text-[12px] text-blue-300/90">
            Your seat is reserved in hold. As soon as your bank confirms the 1Bill or IBFT transfer, your ticket will be issued automatically.
          </p>
        </div>
      ) : null}

      {!hasPayment && !isPending1Link ? (
        <>
          <p className="fo-checkout__note">
            Your seat is held with the supplier. Complete payment to issue the ticket before the hold expires.
          </p>

          {setPayMethod ? (
            <div className="flex flex-wrap gap-1.5 pb-2">
              <button
                type="button"
                disabled={busy || corporateBlocked}
                onClick={() => setPayMethod("card")}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all ${
                  payMethod === "card"
                    ? "bg-slate-900 text-white shadow-sm border border-slate-700"
                    : "bg-surface-elevated text-ink-soft hover:text-ink border border-transparent"
                }`}
              >
                💳 Card
              </button>
              <button
                type="button"
                disabled={busy || corporateBlocked}
                onClick={() => setPayMethod("jazzcash")}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all ${
                  payMethod === "jazzcash"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "bg-surface-elevated text-ink-soft hover:text-ink"
                }`}
              >
                📱 JazzCash
              </button>
              <button
                type="button"
                disabled={busy || corporateBlocked}
                onClick={() => setPayMethod("easypaisa")}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all ${
                  payMethod === "easypaisa"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-surface-elevated text-ink-soft hover:text-ink"
                }`}
              >
                📱 Easypaisa
              </button>
              <button
                type="button"
                disabled={busy || corporateBlocked}
                onClick={() => setPayMethod("onelink_ibft")}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all ${
                  payMethod === "onelink_ibft"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-surface-elevated text-ink-soft hover:text-ink"
                }`}
              >
                🏛️ 1Link IBFT
              </button>
            </div>
          ) : null}

          {payMethod === "card" ? (
            <Input
              label="Payment method token"
              value={paymentToken}
              onChange={(e) => setPaymentToken(e.target.value)}
              placeholder="pm_… (tokenized — never enter raw PAN/CVV)"
              disabled={busy || !canCapture || checkoutBlockedByPriceChange || corporateBlocked}
            />
          ) : null}

          {payMethod === "jazzcash" ? (
            <Input
              label="JazzCash Mobile Account Number"
              value={accountNumber}
              onChange={(e) => setAccountNumber?.(e.target.value)}
              placeholder="03001234567"
              disabled={busy || checkoutBlockedByPriceChange || corporateBlocked}
            />
          ) : null}

          {payMethod === "easypaisa" ? (
            <Input
              label="Easypaisa Mobile Account Number"
              value={accountNumber}
              onChange={(e) => setAccountNumber?.(e.target.value)}
              placeholder="03451234567"
              disabled={busy || checkoutBlockedByPriceChange || corporateBlocked}
            />
          ) : null}

          {payMethod === "onelink_ibft" ? (
            <div className="rounded-lg border border-blue-900/50 bg-blue-950/20 p-3 text-[12px] text-blue-300">
              Generates a 1Bill voucher number to complete your bank transfer before the hold expiration.
            </div>
          ) : null}

          {payMethod === "corporate_credit" ? (
            <p className="fo-checkout__note">
              Corporate credit selected — card token not required. Company credit is checked server-side.
            </p>
          ) : null}

          <div className="fo-checkout__cta-row pt-2">
            <Button
              type="button"
              disabled={
                busy ||
                (!canCapture && payMethod === "card") ||
                checkoutBlockedByPriceChange ||
                corporateBlocked
              }
              onClick={onPay}
            >
              {paying ? "Processing payment…" : "Pay to issue ticket"}
            </Button>
          </div>
        </>
      ) : hasPayment ? (
        <>
          <div className="fo-checkout__cta-row pt-2">
            <Button
              type="button"
              disabled={busy || !canTicket || checkoutBlockedByPriceChange}
              onClick={onTicket}
            >
              {ticketing ? "Ticketing…" : "Issue ticket / voucher"}
            </Button>
          </div>
          {!canTicket ? (
            <p className="fo-checkout__note">
              Ticketing stays blocked until the supplier can issue a real ticket or voucher.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
