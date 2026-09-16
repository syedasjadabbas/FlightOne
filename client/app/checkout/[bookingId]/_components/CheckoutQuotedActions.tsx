"use client";

import { Button, Input } from "@/components/ui";
import type { Companion } from "@/lib/api/profile.api";
import type { TravellerFormData } from "@/lib/bookings/travellerAutoFill";

export function CheckoutQuotedActions({
  formData,
  setFormData,
  savedCompanions = [],
  onSelectPrimary,
  onSelectCompanion,
  paymentToken,
  setPaymentToken,
  payMethod,
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
  payMethod: "card" | "corporate_credit";
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
          placeholder="+1234567890"
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
        ) : (
          <p className="fo-checkout__note">
            Corporate credit selected — card token not required. Company credit is checked server-side.
          </p>
        )}
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
          {paying ? "Capturing…" : payMethod === "corporate_credit" ? "Pay with credit" : "Pay"}
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
  checkoutBlockedByPriceChange,
  ticketing,
  onTicket,
}: {
  busy: boolean;
  canTicket: boolean;
  checkoutBlockedByPriceChange: boolean;
  ticketing: boolean;
  onTicket: () => void;
}) {
  return (
    <div className="fo-desk__panel fo-checkout__actions">
      <p className="fo-desk__section-label">Issue ticket</p>
      <div className="fo-checkout__cta-row">
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
    </div>
  );
}
