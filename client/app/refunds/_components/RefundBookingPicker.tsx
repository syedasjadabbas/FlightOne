import type { ReactNode } from "react";
import { Ticket } from "lucide-react";
import { Input, Spinner } from "@/components/ui";
import {
  TravellerChip,
  TravellerSection,
  TravellerState,
} from "@/app/components/traveller";
import { formatMinor } from "./refundFormat";

export type RefundableBookingItem = {
  bookingId: string;
  status: string;
  product: string;
  currency: string;
  eligible: boolean;
  eligibilityStatus: string;
  refundableMinor: number | null;
  confirmed: boolean;
};

type RefundBookingPickerProps = {
  bookings: RefundableBookingItem[];
  loading: boolean;
  eligibilityLoading?: boolean;
  bookingId: string;
  onSelect: (bookingId: string) => void;
  onBookingIdChange: (value: string) => void;
  children?: ReactNode;
};

export function RefundBookingPicker({
  bookings,
  loading,
  eligibilityLoading,
  bookingId,
  onSelect,
  onBookingIdChange,
  children,
}: RefundBookingPickerProps) {
  return (
    <TravellerSection
      title="Select a booking"
      note="Quoted, reserved, ticketed, or active bookings you own. Completed or already refunded bookings are not listed."
      panel
    >
      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner label="Loading bookings" />
          </div>
        ) : null}

        {!loading && bookings.length === 0 ? (
          <TravellerState title="No refundable bookings">
            Bookings you own that can still be serviced will appear here.
          </TravellerState>
        ) : null}

        {bookings.length > 0 ? (
          <ul className="fo-traveller__list">
            {bookings.map((b) => {
              const selected = bookingId === b.bookingId;
              return (
                <li key={b.bookingId}>
                  <button
                    type="button"
                    className={`fo-traveller__row fo-refunds__booking ${
                      selected ? "fo-refunds__booking--selected" : ""
                    }`}
                    onClick={() => onSelect(b.bookingId)}
                    aria-pressed={selected}
                  >
                    <div className="fo-traveller__row-top">
                      <span className="fo-traveller__row-title inline-flex items-center gap-1.5">
                        <Ticket size={14} strokeWidth={1.75} className="text-[var(--sky)]" aria-hidden />
                        {b.product} · {b.status}
                      </span>
                      <TravellerChip tone={b.eligible ? "warn" : "muted"}>
                        {b.eligibilityStatus}
                      </TravellerChip>
                    </div>
                    <p className="fo-traveller__row-meta font-mono">
                      {b.bookingId}
                      {b.confirmed && b.refundableMinor != null
                        ? ` · confirmed refundable ${formatMinor(b.refundableMinor, b.currency)}`
                        : " · amount shown only after fare-rule confirmation"}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        <Input
          value={bookingId}
          onChange={(e) => onBookingIdChange(e.target.value)}
          placeholder="Or paste a booking ID you own"
          aria-label="Booking ID"
        />

        {eligibilityLoading && !children ? (
          <div className="flex justify-center py-4">
            <Spinner label="Checking eligibility" />
          </div>
        ) : null}

        {children}
      </div>
    </TravellerSection>
  );
}
