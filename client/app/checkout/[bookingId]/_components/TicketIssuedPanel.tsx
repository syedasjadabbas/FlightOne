"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Download, Eye, EyeOff } from "lucide-react";
import { Button, buttonClassName } from "@/components/ui";
import { buildTicketDocument } from "@/lib/bookings/ticketDocument";
import { TicketDocumentView } from "./TicketDocumentView";

type BookingLike = Parameters<typeof buildTicketDocument>[0] & { status: string };

/**
 * Post-ticketing terminal state: confirm, let the traveller read and keep the
 * e-ticket, then hand them back to chat.
 *
 * "Download" prints the ticket via the browser's own print-to-PDF rather than
 * pulling in a PDF library — checkout.css hides everything except `.fo-ticket`
 * under @media print, so the output is the ticket alone.
 */
export function TicketIssuedPanel({ booking }: { booking: BookingLike }) {
  const doc = useMemo(() => buildTicketDocument(booking), [booking]);
  const [open, setOpen] = useState(true);

  return (
    <div className="space-y-4">
      <div className="fo-desk__panel space-y-3 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[var(--fo-desk-wash)] text-[var(--cyan)]">
          <Check className="h-5 w-5" aria-hidden />
        </div>
        <h3 className="m-0 text-[16px] font-semibold text-[var(--navy)]">Ticket issued</h3>
        <p className="mx-auto m-0 max-w-md text-[13px] text-[var(--ink-soft)]">
          {doc.pnr ? `Confirmed under PNR ${doc.pnr}. ` : "Confirmed. "}
          A copy is in your email and Traveller Vault.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <Button variant="secondary" size="md" onClick={() => setOpen((v) => !v)}>
            {open ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            {open ? "Hide ticket" : "View ticket"}
          </Button>
          <Button variant="secondary" size="md" onClick={() => window.print()}>
            <Download className="h-4 w-4" aria-hidden />
            Download
          </Button>
          <Link href="/chat" className={buttonClassName({ size: "md" })}>
            Continue to chat
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <p className="m-0 pt-1 text-[12px] text-[var(--ink-soft)]">
          <Link href="/journey" className="underline underline-offset-2">
            View in My Journey
          </Link>
        </p>
      </div>

      {open ? <TicketDocumentView doc={doc} /> : null}
    </div>
  );
}
