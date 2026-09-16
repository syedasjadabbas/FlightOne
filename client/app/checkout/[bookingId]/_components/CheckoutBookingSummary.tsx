"use client";

import { formatMinor } from "@/lib/bookings/checkoutDisplay";

type BookingLike = {
  id: string;
  status: string;
  product: string;
  supplierCode?: string | null;
  amountMinor: number;
  currency: string;
  externalRef?: string | null;
  metadata?: unknown;
};

function checkoutStepState(status: string): {
  traveller: "done" | "active" | "todo";
  payment: "done" | "active" | "todo";
  ticket: "done" | "active" | "todo";
} {
  if (status === "TICKETED" || status === "ACTIVE" || status === "COMPLETED") {
    return { traveller: "done", payment: "done", ticket: "done" };
  }
  if (status === "RESERVED") {
    return { traveller: "done", payment: "done", ticket: "active" };
  }
  if (status === "QUOTED") {
    return { traveller: "active", payment: "todo", ticket: "todo" };
  }
  return { traveller: "todo", payment: "todo", ticket: "todo" };
}

function stepClass(state: "done" | "active" | "todo") {
  if (state === "active") return "fo-checkout__step fo-checkout__step--active";
  if (state === "done") return "fo-checkout__step fo-checkout__step--done";
  return "fo-checkout__step";
}

export function CheckoutBookingSummary({
  booking,
  tickets,
  vouchers,
}: {
  booking: BookingLike;
  tickets: string[];
  vouchers: string[];
}) {
  const steps = checkoutStepState(booking.status);

  return (
    <>
      <header className="fo-desk__header" style={{ borderBottom: "none", paddingBottom: 0 }}>
        <h1 className="fo-desk__title">Reservation</h1>
        <p className="fo-desk__meta">Booking {booking.id}</p>
      </header>

      <ol className="fo-checkout__steps" aria-label="Checkout steps">
        <li className={stepClass(steps.traveller)}>1 · Traveller</li>
        <li className={stepClass(steps.payment)}>2 · Payment</li>
        <li className={stepClass(steps.ticket)}>3 · Ticket</li>
      </ol>

      <div className="fo-desk__panel">
        <p className="fo-desk__section-label">Amount due</p>
        <p className="fo-checkout__amount">
          {formatMinor(booking.amountMinor, booking.currency)}
        </p>
        <dl className="fo-checkout__dl" style={{ marginTop: "0.85rem" }}>
          <div>
            <dt>Status</dt>
            <dd>{booking.status}</dd>
          </div>
          <div>
            <dt>Product</dt>
            <dd>{booking.product}</dd>
          </div>
          <div>
            <dt>Supplier</dt>
            <dd>{booking.supplierCode || "—"}</dd>
          </div>
          {booking.metadata &&
          typeof booking.metadata === "object" &&
          (booking.metadata as { rewardCredit?: { creditMinor?: number; points?: number } })
            .rewardCredit ? (
            <div>
              <dt>Reward credit</dt>
              <dd>
                −
                {formatMinor(
                  (booking.metadata as { rewardCredit: { creditMinor: number } }).rewardCredit
                    .creditMinor,
                  booking.currency,
                )}{" "}
                (
                {(booking.metadata as { rewardCredit: { points: number } }).rewardCredit.points}{" "}
                pts)
              </dd>
            </div>
          ) : null}
          {booking.externalRef ? (
            <div>
              <dt>PNR / confirmation</dt>
              <dd className="fo-desk__mono">{booking.externalRef}</dd>
            </div>
          ) : null}
          {tickets.length > 0 ? (
            <div>
              <dt>Ticket numbers</dt>
              <dd className="fo-desk__mono">{tickets.join(", ")}</dd>
            </div>
          ) : null}
          {vouchers.length > 0 ? (
            <div>
              <dt>Voucher refs</dt>
              <dd className="fo-desk__mono">{vouchers.join(", ")}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </>
  );
}
