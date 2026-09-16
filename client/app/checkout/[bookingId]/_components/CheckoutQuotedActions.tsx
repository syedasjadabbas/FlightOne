"use client";

import { Button, Input } from "@/components/ui";

export function CheckoutQuotedActions({
  givenName,
  setGivenName,
  surname,
  setSurname,
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
  givenName: string;
  setGivenName: (v: string) => void;
  surname: string;
  setSurname: (v: string) => void;
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
  return (
    <div className="fo-desk__panel fo-checkout__actions">
      <p className="fo-desk__section-label">Traveller & payment</p>
      <Input
        label="Given name"
        value={givenName}
        onChange={(e) => setGivenName(e.target.value)}
        disabled={busy || checkoutBlockedByPriceChange}
        required
      />
      <Input
        label="Surname"
        value={surname}
        onChange={(e) => setSurname(e.target.value)}
        disabled={busy || checkoutBlockedByPriceChange}
        required
      />
      {payMethod === "card" ? (
        <Input
          label="Payment method token"
          value={paymentToken}
          onChange={(e) => setPaymentToken(e.target.value)}
          placeholder="pm_… (tokenized — never enter PAN/CVV)"
          disabled={busy || !canCapture || checkoutBlockedByPriceChange || corporateBlocked}
        />
      ) : (
        <p className="fo-checkout__note">
          Corporate credit selected — card token not required. Company credit is checked server-side.
        </p>
      )}
      <div className="fo-checkout__cta-row">
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
          {reserving ? "Reserving…" : "Reserve"}
        </Button>
      </div>
      <p className="fo-checkout__note">
        Pay must succeed before reserve. Price is revalidated server-side; client amounts are not
        authoritative.
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
