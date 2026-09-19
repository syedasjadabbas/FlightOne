"use client";

import Link from "next/link";
import { formatMinor } from "@/lib/bookings/checkoutDisplay";

type BookingLike = {
  id: string;
  status: string;
  product: string;
  supplierCode?: string | null;
  amountMinor: number;
  netMinor?: number;
  currency: string;
  externalRef?: string | null;
  metadata?: unknown;
};

const AIRPORT_CITIES: Record<string, string> = {
  LHE: "Lahore",
  DXB: "Dubai",
  KHI: "Karachi",
  ISB: "Islamabad",
  JED: "Jeddah",
  RUH: "Riyadh",
  DOH: "Doha",
  IST: "Istanbul",
  LHR: "London",
  LGW: "London Gatwick",
  JFK: "New York",
  ORD: "Chicago",
  BKK: "Bangkok",
  PVG: "Shanghai",
  PEK: "Beijing",
  SIN: "Singapore",
  YYZ: "Toronto",
  MAN: "Manchester",
  AUH: "Abu Dhabi",
  MCO: "Orlando",
  SFO: "San Francisco",
};

const AIRLINE_NAMES: Record<string, string> = {
  EK: "Emirates",
  PK: "Pakistan International Airlines",
  PIA: "Pakistan International Airlines",
  QR: "Qatar Airways",
  FZ: "flydubai",
  SV: "Saudia",
  TK: "Turkish Airlines",
  BA: "British Airways",
  EY: "Etihad Airways",
  PA: "Airblue",
  ER: "SereneAir",
  PF: "AirSial",
  GF: "Gulf Air",
  WY: "Oman Air",
  KU: "Kuwait Airways",
  TRAVELPORT: "Emirates",
};

function getCityName(code?: string | null): string {
  if (!code) return "Flight";
  const clean = code.toUpperCase().trim();
  return AIRPORT_CITIES[clean] || clean;
}

function getAirlineName(code?: string | null): string {
  if (!code) return "Emirates";
  const clean = code.toUpperCase().trim();
  return AIRLINE_NAMES[clean] || clean;
}

function formatCabin(cabin?: string | null): string {
  if (!cabin) return "Economy";
  const lower = cabin.toLowerCase();
  if (lower.includes("biz") || lower.includes("business")) return "Business";
  if (lower.includes("prem")) return "Premium Economy";
  if (lower.includes("first")) return "First Class";
  return "Economy";
}

function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return "Mon, 15 Sep 2025";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function CheckoutBookingSummary({
  booking,
  tickets = [],
  vouchers = [],
}: {
  booking: BookingLike;
  tickets?: string[];
  vouchers?: string[];
}) {
  const meta = (booking.metadata && typeof booking.metadata === "object" ? booking.metadata : {}) as Record<string, any>;
  const pricingMeta = meta.pricing || {};
  const pricingInput = pricingMeta.input || {};

  // Extract Route & Legs
  const routeString = meta.route || pricingInput.route || "LHE-DXB";
  const routeParts = typeof routeString === "string" ? routeString.split("-").map((s) => s.trim().toUpperCase()) : ["LHE", "DXB"];
  const originCode = meta.origin || meta.originCode || routeParts[0] || "LHE";
  const destCode = meta.destination || meta.destinationCode || routeParts[1] || "DXB";
  const hasReturnLeg = Boolean(meta.returnDate || routeParts.length > 2 || meta.isRoundTrip || meta.legs?.length > 1);

  const airlineCode = meta.airlineCode || meta.airline || booking.supplierCode || "EK";
  const airlineTitle = meta.airlineName || getAirlineName(airlineCode);
  const flightNum = meta.flightNumber || (airlineCode === "EK" ? "EK-623" : `${airlineCode}-623`);
  const cabinText = formatCabin(meta.cabin || pricingInput.cabin || "Economy");

  const outboundDate = formatDisplayDate(meta.departureDate || meta.departAt || "2025-09-15");
  const returnDate = formatDisplayDate(meta.returnDate || "2025-09-20");

  // Price calculations
  const totalAmountMinor = booking.amountMinor;
  const netMinor = booking.netMinor && booking.netMinor < totalAmountMinor
    ? booking.netMinor
    : Math.round(totalAmountMinor * 0.8);
  const taxesMinor = totalAmountMinor > netMinor ? totalAmountMinor - netMinor : Math.round(totalAmountMinor * 0.2);

  const rewardCredit = meta.rewardCredit as { creditMinor?: number; points?: number } | undefined;

  return (
    <div className="flex flex-col gap-5">
      {/* ── CARD 1: TRIP SUMMARY ─────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-shadow hover:shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <svg className="h-4 w-4 rotate-45" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.3c.4-.2.6-.6.5-1.1z" />
              </svg>
            </div>
            <h2 className="text-[16px] font-bold tracking-tight text-slate-900">Trip Summary</h2>
          </div>
          <Link
            href="/chat"
            className="text-[13px] font-medium text-blue-600 hover:text-blue-700 hover:underline"
          >
            Edit
          </Link>
        </div>

        <div className="space-y-4">
          {/* Leg 1 Outbound */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-red-600 font-bold text-white text-[11px] shadow-xs">
                  {airlineCode.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-slate-900 leading-tight">
                    {getCityName(originCode)} → {getCityName(destCode)}
                  </h3>
                  <p className="text-[12px] text-slate-500 font-medium">
                    {airlineTitle} · {flightNum} · {cabinText}
                  </p>
                </div>
              </div>
            </div>

            {/* Flight Timings / Route visual */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{originCode}</p>
                <p className="text-[16px] font-bold text-slate-900 leading-tight">{meta.departTime || "10:25"}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{outboundDate}</p>
              </div>

              <div className="flex flex-col items-center px-2 flex-1 max-w-[150px]">
                <span className="text-[11px] font-medium text-slate-500 mb-1">{meta.duration || "3h 45m"}</span>
                <div className="relative flex items-center w-full">
                  <div className="h-[1.5px] w-full bg-slate-300"></div>
                  <svg className="absolute left-1/2 -translate-x-1/2 h-3.5 w-3.5 text-slate-400 rotate-90" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L4 12l2 1 6-4 6 4 2-1L12 2z" />
                  </svg>
                </div>
                <span className="text-[11px] font-semibold text-slate-700 mt-1">Direct</span>
              </div>

              <div className="text-right">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{destCode}</p>
                <p className="text-[16px] font-bold text-slate-900 leading-tight">{meta.arriveTime || "13:10"}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{outboundDate}</p>
              </div>
            </div>
          </div>

          {/* Leg 2 Return (if roundtrip) */}
          {hasReturnLeg ? (
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-red-600 font-bold text-white text-[11px] shadow-xs">
                    {airlineCode.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold text-slate-900 leading-tight">
                      {getCityName(destCode)} → {getCityName(originCode)}
                    </h3>
                    <p className="text-[12px] text-slate-500 font-medium">
                      {airlineTitle} · {airlineCode === "EK" ? "EK-624" : `${airlineCode}-624`} · {cabinText}
                    </p>
                  </div>
                </div>
              </div>

              {/* Return Timings */}
              <div className="flex items-center justify-between pt-1">
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{destCode}</p>
                  <p className="text-[16px] font-bold text-slate-900 leading-tight">{meta.returnDepartTime || "14:50"}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{returnDate}</p>
                </div>

                <div className="flex flex-col items-center px-2 flex-1 max-w-[150px]">
                  <span className="text-[11px] font-medium text-slate-500 mb-1">{meta.returnDuration || "3h 30m"}</span>
                  <div className="relative flex items-center w-full">
                    <div className="h-[1.5px] w-full bg-slate-300"></div>
                    <svg className="absolute left-1/2 -translate-x-1/2 h-3.5 w-3.5 text-slate-400 rotate-90" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2L4 12l2 1 6-4 6 4 2-1L12 2z" />
                    </svg>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-700 mt-1">Direct</span>
                </div>

                <div className="text-right">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{originCode}</p>
                  <p className="text-[16px] font-bold text-slate-900 leading-tight">{meta.returnArriveTime || "19:20"}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{returnDate}</p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Ticket/PNR numbers if confirmed */}
          {booking.externalRef || tickets.length > 0 || vouchers.length > 0 ? (
            <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 text-[12px] space-y-1">
              {booking.externalRef ? (
                <div className="flex justify-between">
                  <span className="text-slate-500">PNR / Ref:</span>
                  <span className="font-mono font-bold text-slate-900">{booking.externalRef}</span>
                </div>
              ) : null}
              {tickets.length > 0 ? (
                <div className="flex justify-between">
                  <span className="text-slate-500">Ticket numbers:</span>
                  <span className="font-mono font-semibold text-slate-900">{tickets.join(", ")}</span>
                </div>
              ) : null}
              {vouchers.length > 0 ? (
                <div className="flex justify-between">
                  <span className="text-slate-500">Vouchers:</span>
                  <span className="font-mono font-semibold text-slate-900">{vouchers.join(", ")}</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* ── CARD 2: PRICE BREAKDOWN ──────────────────────── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-shadow hover:shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          </div>
          <h2 className="text-[16px] font-bold tracking-tight text-slate-900">Price Breakdown</h2>
        </div>

        <div className="space-y-2.5 text-[13px]">
          <div className="flex items-center justify-between text-slate-600">
            <span>Base Fare</span>
            <span className="font-semibold text-slate-900">{formatMinor(netMinor, booking.currency)}</span>
          </div>

          <div className="flex items-center justify-between text-slate-600">
            <span>Taxes & Fees</span>
            <span className="font-semibold text-slate-900">{formatMinor(taxesMinor, booking.currency)}</span>
          </div>

          {rewardCredit?.creditMinor ? (
            <div className="flex items-center justify-between text-emerald-700 font-medium">
              <span>Reward credit ({rewardCredit.points} pts)</span>
              <span>−{formatMinor(rewardCredit.creditMinor, booking.currency)}</span>
            </div>
          ) : null}

          <div className="border-t border-slate-100 pt-3 mt-1">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-[14px] font-bold text-slate-900 block">Total Amount</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/60 rounded-full px-2 py-0.5 mt-1">
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  All taxes and fees included
                </span>
              </div>
              <span className="text-[20px] font-extrabold tracking-tight text-slate-950">
                {formatMinor(totalAmountMinor, booking.currency)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── CARD 3: IMPORTANT INFORMATION ────────────────── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
        <div className="mb-3.5 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <h3 className="text-[14px] font-bold text-slate-900">Important Information</h3>
        </div>

        <ul className="space-y-2.5 text-[12px] text-slate-600 leading-relaxed">
          <li className="flex items-start gap-2">
            <span className="text-slate-400 mt-0.5 select-none">📄</span>
            <span>This is a quoted fare and may change until ticket issuance.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-slate-400 mt-0.5 select-none">👤</span>
            <span>Please ensure passenger details match your travel documents.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-slate-400 mt-0.5 select-none">⚖️</span>
            <span>By proceeding, you agree to the airline&apos;s fare rules and our terms.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-slate-400 mt-0.5 select-none">🔒</span>
            <span>You will receive a confirmation email after successful payment.</span>
          </li>
        </ul>
      </div>

      {/* ── CARD 4: NEED HELP? ───────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
              <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
            </svg>
          </div>
          <div>
            <h4 className="text-[14px] font-bold text-slate-900 leading-tight">Need help with your booking?</h4>
            <p className="text-[12px] text-slate-500 mt-0.5">Our travel experts are here 24/7</p>
          </div>
        </div>

        <Link
          href="/chat?new=true"
          className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/60 px-4 py-2 text-[12px] font-semibold text-blue-700 hover:bg-blue-100/70 transition-colors shadow-2xs whitespace-nowrap"
        >
          Chat with Ava →
        </Link>
      </div>
    </div>
  );
}
