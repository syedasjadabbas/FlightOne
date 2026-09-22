"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button, Input, SearchableSelect } from "@/components/ui";
import { TravellerSection } from "@/app/components/traveller";
import type { EscalationTrigger } from "@/lib/api/escalations.api";
import { TRIGGER_OPTIONS } from "./supportContent";

export function EscalationTicketForm({
  signedIn,
  trigger,
  onTriggerChange,
  bookingId,
  onBookingIdChange,
  note,
  onNoteChange,
  submitting,
  error,
  success,
  onSubmit,
  onViewCases,
  onResetSuccess,
}: {
  signedIn: boolean;
  trigger: EscalationTrigger;
  onTriggerChange: (v: EscalationTrigger) => void;
  bookingId: string;
  onBookingIdChange: (v: string) => void;
  note: string;
  onNoteChange: (v: string) => void;
  submitting: boolean;
  error: string | null;
  success: string | null;
  onSubmit: (e: React.FormEvent) => void;
  onViewCases: () => void;
  onResetSuccess: () => void;
}) {
  return (
    <TravellerSection
      title="Open a support case"
      note="For airline intervention, medical clearance, or complex itinerary work — a consultant will take it from here."
      panel
    >
      {!signedIn ? (
        <div className="space-y-3">
          <p className="text-[13px] text-ink-soft">
            Sign in so we can link this to your bookings and send status updates to your account.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/login?redirect=%2Fescalations">
              <Button size="sm">Sign in</Button>
            </Link>
            <Link href="/chat">
              <Button size="sm" variant="secondary">
                Chat with Ava
              </Button>
            </Link>
          </div>
        </div>
      ) : success ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 shrink-0 text-sky">
              <CheckCircle2 size={16} aria-hidden />
            </span>
            <div className="min-w-0 space-y-1">
              <p className="text-[13px] font-semibold text-navy">{success}</p>
              <p className="text-[12px] text-ink-soft">
                Track status under My cases, or continue in chat.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={onViewCases}>
              View my cases
            </Button>
            <Button size="sm" variant="ghost" onClick={onResetSuccess}>
              Open another
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <SearchableSelect
            label="Category"
            options={TRIGGER_OPTIONS}
            value={trigger}
            onChange={(v) => onTriggerChange(v as EscalationTrigger)}
            searchable={false}
          />

          <Input
            label="Booking ID (optional)"
            value={bookingId}
            onChange={(e) => onBookingIdChange(e.target.value)}
            placeholder="e.g. bk_12345678"
          />

          <div className="fo-traveller__field">
            <label htmlFor="escalation-note">What do you need?</label>
            <textarea
              id="escalation-note"
              rows={4}
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Flights, dates, passenger names, and the change or help required…"
              required
              className="w-full rounded-[0.65rem] border border-[var(--line)] bg-white p-3 text-[13px] text-[var(--ink)] outline-none transition-[border-color,box-shadow] focus-visible:border-[var(--sky)] focus-visible:shadow-[0_0_0_3px_color-mix(in_oklab,var(--sky)_28%,transparent)]"
            />
          </div>

          {error ? (
            <p className="text-[12px] text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit case"}
            </Button>
            <Link href="/chat">
              <Button type="button" variant="ghost">
                Chat with Ava
              </Button>
            </Link>
          </div>
        </form>
      )}
    </TravellerSection>
  );
}
