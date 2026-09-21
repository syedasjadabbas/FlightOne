"use client";

import Link from "next/link";
import { ClipboardList, HandHelping, LayoutGrid, LogIn } from "lucide-react";
import { Button } from "@/components/ui";

export function MiceGuestGate() {
  return (
    <div className="fo-gm-page">
      <header className="fo-gm-masthead">
        <div className="fo-gm-masthead__inner">
          <p className="fo-gm-kicker">MICE &amp; Events</p>
          <h1 className="fo-gm-title">FlightOne MICE desk</h1>
          <p className="fo-gm-lede">
            Submit a meetings, incentives, conferences, or exhibitions enquiry. The desk reviews
            requests manually — nothing is held or ticketed until a supplier confirms it.
          </p>
          <div className="fo-gm-actions">
            <Link href="/login?redirect=%2Fmice">
              <Button size="sm" icon={<LogIn size={14} strokeWidth={2} />}>
                Sign in to submit
              </Button>
            </Link>
            <Link href="/chat">
              <Button size="sm" variant="secondary">
                Ask Ava
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="fo-gm-ledger">
        <div className="fo-gm-section">
          <h2 className="fo-gm-section__title">How the desk works</h2>
          <ul className="fo-gm-guest-points">
            <li>
              <span className="fo-gm-guest-points__icon" aria-hidden>
                <ClipboardList size={16} strokeWidth={2} />
              </span>
              <span>
                <strong>Structured enquiry</strong>
                Dates, attendees, travel, accommodation, and meeting needs are stored as your
                request — not as live supplier bookings.
              </span>
            </li>
            <li>
              <span className="fo-gm-guest-points__icon" aria-hidden>
                <HandHelping size={16} strokeWidth={2} />
              </span>
              <span>
                <strong>Manual review</strong>
                Availability and pricing are confirmed only when a supplier actually confirms them.
              </span>
            </li>
            <li>
              <span className="fo-gm-guest-points__icon" aria-hidden>
                <LayoutGrid size={16} strokeWidth={2} />
              </span>
              <span>
                <strong>Event workspace</strong>
                After submit, open a workspace for delegates, agenda, and transfers while the desk
                works the enquiry.
              </span>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
