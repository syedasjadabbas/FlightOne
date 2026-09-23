"use client";

import { useEffect, useMemo } from "react";
import { useGetBookingQuery } from "@/lib/api/bookings.api";
import { useAuthStore } from "@/store/auth.store";
import { buildTicketDocument } from "@/lib/bookings/ticketDocument";
import { TicketDocumentView } from "../_components/TicketDocumentView";

export function TicketPrintClient({ bookingId }: { bookingId: string }) {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);

  const { data: booking, isLoading, isError } = useGetBookingQuery(bookingId, {
    skip: !hasHydrated || !accessToken,
  });

  const doc = useMemo(
    // BookingDetail omits supplierBookingRefs but the API returns it at runtime;
    // buildTicketDocument handles missing fields gracefully via nullish fallbacks.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => (booking ? buildTicketDocument(booking as any) : null),
    [booking],
  );


  // Auto-trigger print dialog once ticket is rendered
  useEffect(() => {
    if (!doc) return;
    const timer = setTimeout(() => {
      window.print();
    }, 800);
    return () => clearTimeout(timer);
  }, [doc]);

  if (!hasHydrated || isLoading) {
    return (
      <div className="fo-ticket-print-loading">
        <div className="fo-ticket-print-spinner" />
        <p>Loading your ticket…</p>
      </div>
    );
  }

  if (isError || !booking) {
    return (
      <div className="fo-ticket-print-error">
        <p>Unable to load ticket. Please try again or contact support.</p>
      </div>
    );
  }

  if (!doc) return null;

  return (
    <div className="fo-ticket-print-root">
      <div className="fo-ticket-print-actions no-print">
        <button
          type="button"
          onClick={() => window.print()}
          className="fo-ticket-print-btn"
        >
          ↓ Save as PDF / Print
        </button>
        <button
          type="button"
          onClick={() => window.close()}
          className="fo-ticket-print-btn fo-ticket-print-btn--secondary"
        >
          Close
        </button>
      </div>
      <TicketDocumentView doc={doc} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        * { box-sizing: border-box; }
        body {
          margin: 0;
          padding: 0;
          font-family: 'Inter', system-ui, sans-serif;
          background: #f3f4f6;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .fo-ticket-print-root {
          max-width: 900px;
          margin: 0 auto;
          padding: 24px 16px;
        }

        .fo-ticket-print-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
          padding: 12px 16px;
          background: #0b132b;
          border-radius: 12px;
        }

        .fo-ticket-print-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          border: none;
          background: #06b6d4;
          color: #0b132b;
          transition: opacity 0.15s;
        }
        .fo-ticket-print-btn:hover { opacity: 0.85; }
        .fo-ticket-print-btn--secondary {
          background: rgba(255,255,255,0.12);
          color: #fff;
        }

        .fo-ticket-print-loading,
        .fo-ticket-print-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 60vh;
          gap: 16px;
          font-size: 15px;
          color: #55606e;
        }

        .fo-ticket-print-spinner {
          width: 36px;
          height: 36px;
          border: 3px solid rgba(6,182,212,0.2);
          border-top-color: #06b6d4;
          border-radius: 50%;
          animation: fo-spin 0.8s linear infinite;
        }

        @keyframes fo-spin {
          to { transform: rotate(360deg); }
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm 8mm 10mm;
          }
          html, body {
            background: #ffffff !important;
            color: #020712 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print,
          .fo-ticket-print-actions {
            display: none !important;
          }
          .fo-ticket-print-root {
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
