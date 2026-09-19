"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { Button, Input, SearchableSelect, Spinner } from "@/components/ui";
import { PermissionGate } from "@/components/PermissionGate";
import {
  TravellerChip,
  TravellerPageHeader,
  TravellerPagination,
  TravellerSection,
  TravellerState,
  TRAVELLER_PAGE_SIZE,
  paginateItems,
} from "@/app/components/traveller";
import {
  useListMyEscalationsQuery,
  useRequestEscalationMutation,
  type EscalationTicket,
  type EscalationTrigger,
} from "@/lib/api/escalations.api";
import { useAuthStore } from "@/store/auth.store";

const SUPPORT_CATEGORIES = [
  {
    id: "booking",
    icon: "✈️",
    title: "Bookings & Itineraries",
    desc: "Flight changes, seat selection, passenger names, schedule updates, baggage allowances",
    faqs: [
      {
        q: "How do I change or correct passenger details?",
        a: "Names on confirmed tickets must match official passports exactly. Minor spelling corrections (up to 3 characters) can be processed through our support desk. Full passenger replacements depend on operating airline policy.",
      },
      {
        q: "What happens if an airline reschedules or delays my flight?",
        a: "When a schedule change exceeds 60 minutes or causes a missed connection, Ava and our operations team will automatically suggest alternative rebooking options or initiate an involuntary full refund without airline penalty fees.",
      },
      {
        q: "Where can I view all active flight legs and itinerary watches?",
        a: "Visit My Journey (/journey) to track live gate assignments, terminal updates, departure delays, and baggage carousel numbers.",
      },
    ],
  },
  {
    id: "payment",
    icon: "💳",
    title: "Payments & Invoicing",
    desc: "Credit cards, JazzCash/Easypaisa, 1Link IBFT, corporate invoicing, payment receipts",
    faqs: [
      {
        q: "Which payment methods are supported on FlightOne?",
        a: "FlightOne supports Visa, MasterCard, UnionPay cards, local Pakistan mobile wallets (JazzCash, Easypaisa), and 1Link IBFT bank transfers. Corporate accounts can also pay via approved corporate credit limits.",
      },
      {
        q: "How do I obtain a tax / GST invoice for business expenses?",
        a: "All completed bookings generate an official digital invoice available for download in your Profile and Vault. Corporate members can also export monthly consolidated statements from the Corporate Travel Desk.",
      },
    ],
  },
  {
    id: "refunds",
    icon: "↩️",
    title: "Cancellations & Refunds",
    desc: "Voluntary cancellations, refund eligibility, exchange calculations, travel credits",
    faqs: [
      {
        q: "How are refund amounts calculated?",
        a: "Refundable amounts are calculated strictly according to stored fare rules and supplier penalties. Check your booking on the Refunds Desk (/refunds) for an exact breakdown before submitting a claim.",
      },
      {
        q: "How long does it take to receive a refund payout?",
        a: "Once approved by the operating carrier, card and wallet refunds are processed within 5 to 10 business days. Direct bank transfers (IBFT) settle within 3 business days.",
      },
    ],
  },
  {
    id: "visa",
    icon: "🛂",
    title: "Visas & Travel Documents",
    desc: "Visa intelligence, passport validity rules, transit visas, embassy appointments",
    faqs: [
      {
        q: "How much passport validity is required for international travel?",
        a: "Most international destinations require at least 6 months of passport validity from your scheduled date of return. Check our Visa Advisory Desk (/visa) to evaluate requirements for your passport and route.",
      },
      {
        q: "Can FlightOne assist with embassy biometrics and appointments?",
        a: "Yes. Our Visa Advisory team assists with document verification, application checklists, and embassy tracking for tourist and business travel.",
      },
    ],
  },
  {
    id: "corporate",
    icon: "💼",
    title: "Corporate & Group Travel",
    desc: "Company travel policies, approval workflows, book-on-behalf, group fares (10+ pax)",
    faqs: [
      {
        q: "How do corporate booking approvals work?",
        a: "When an employee creates a booking exceeding company travel policy thresholds, it is automatically routed to designated corporate approvers with 1-click approval directly in the Corporate Desk.",
      },
      {
        q: "How do I book for a large group of 10 or more?",
        a: "Visit the Group Bookings Desk (/groups) to submit your route details, blocked seat requests, and date flexibility for negotiated group contracts.",
      },
    ],
  },
  {
    id: "special",
    icon: "🩺",
    title: "Special Services & Medical",
    desc: "Wheelchair assistance, unaccompanied minors, dietary meals, medical clearances",
    faqs: [
      {
        q: "How do I request wheelchair assistance or special meals?",
        a: "Special service requests (SSR) can be submitted during flight selection or added to your confirmed reservation at least 24 hours before flight departure by opening a support ticket.",
      },
    ],
  },
];

const TRIGGER_OPTIONS = [
  { value: "CUSTOMER_REQUEST", label: "General Booking & Itinerary Assistance" },
  { value: "REFUND_DISPUTE", label: "Cancellation & Refund Claim Inquiry" },
  { value: "VISA_UNCERTAIN", label: "Visa & Entry Requirements Review" },
  { value: "SPECIAL_SERVICE_REQUEST", label: "Special Service Request (Wheelchair, Meals, SSR)" },
  { value: "MEDICAL_ASSISTANCE", label: "Medical Assistance & Fit-to-Fly Support" },
  { value: "COMPLEX_ITINERARY", label: "Complex Multi-City & Group Coordination" },
  { value: "OTHER", label: "Other Support Inquiry" },
];

function statusLabel(status: string) {
  switch (status) {
    case "OPEN":
      return "Requested — Queued for Consultant Review";
    case "ASSIGNED":
      return "Consultant Assigned to Case";
    case "IN_PROGRESS":
      return "Consultant Actively Working on Resolution";
    case "RESOLVED":
      return "Case Successfully Resolved";
    case "CANCELLED":
      return "Case Cancelled";
    default:
      return status;
  }
}

function EscalationRow({ ticket }: { ticket: EscalationTicket }) {
  return (
    <Link href={`/escalations/${ticket.id}`} className="fo-traveller__row-link">
      <div className="fo-traveller__row-top">
        <p className="fo-traveller__row-title">{ticket.trigger.replaceAll("_", " ")}</p>
        <TravellerChip tone={ticket.status === "RESOLVED" ? "muted" : ticket.status === "OPEN" ? "warn" : "default"}>
          {ticket.status.replaceAll("_", " ")}
        </TravellerChip>
      </div>
      <p className="fo-traveller__row-body">{statusLabel(ticket.status)}</p>
      <p className="fo-traveller__row-meta">
        Case ID: {ticket.id.slice(0, 10)}… · Created: {new Date(ticket.createdAt).toLocaleString()}
        {ticket.bookingId ? ` · Booking: ${ticket.bookingId}` : ""}
      </p>
    </Link>
  );
}

export function EscalationsPageClient() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const skip = !hasHydrated || !accessToken;

  const [activeTab, setActiveTab] = useState<"knowledge" | "ticket" | "mycases">("knowledge");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  // Ticket form state
  const [ticketTrigger, setTicketTrigger] = useState<EscalationTrigger>("CUSTOMER_REQUEST");
  const [ticketBookingId, setTicketBookingId] = useState("");
  const [ticketNote, setTicketNote] = useState("");
  const [ticketSuccess, setTicketSuccess] = useState<string | null>(null);
  const [ticketError, setTicketError] = useState<string | null>(null);

  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useListMyEscalationsQuery(undefined, { skip });
  const [requestEscalation, { isLoading: submittingTicket }] = useRequestEscalationMutation();

  const items = data?.items ?? [];
  const pageItems = paginateItems(items, page, TRAVELLER_PAGE_SIZE);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return SUPPORT_CATEGORIES;
    const q = searchQuery.toLowerCase();
    return SUPPORT_CATEGORIES.map((cat) => ({
      ...cat,
      faqs: cat.faqs.filter(
        (f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q) || cat.title.toLowerCase().includes(q),
      ),
    })).filter((cat) => cat.faqs.length > 0 || cat.title.toLowerCase().includes(q));
  }, [searchQuery]);

  async function handleTicketSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTicketError(null);
    setTicketSuccess(null);

    if (!ticketNote.trim()) {
      setTicketError("Please describe your issue or inquiry in detail.");
      return;
    }

    try {
      // In FlightOne architecture, requestEscalation attaches to a conversation or standalone case
      const res = await requestEscalation({
        conversationId: `support-ticket-${Date.now()}`,
        trigger: ticketTrigger,
        bookingId: ticketBookingId.trim() || undefined,
        note: ticketNote.trim(),
      }).unwrap();

      setTicketSuccess(`Support case #${res.id.slice(0, 8)} opened successfully. A consultant will review it shortly.`);
      setTicketNote("");
      setTicketBookingId("");
      void refetch();
    } catch {
      setTicketError("Could not submit support case. You can also connect directly with Ava in Chat.");
    }
  }

  if (!hasHydrated) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TravellerPageHeader
        title="Support & Help Center"
        lede="24/7 AI assistance with Ava, searchable travel knowledge base, and live human consultant escalation desk."
        actions={
          <div className="flex gap-2">
            <Link href="/chat">
              <Button variant="secondary" size="sm">
                Chat with Ava AI
              </Button>
            </Link>
            <PermissionGate anyOf={["ops:escalations:read"]}>
              <Link href="/ops/escalations">
                <Button variant="ghost" size="sm">
                  Consultant Queue
                </Button>
              </Link>
            </PermissionGate>
          </div>
        }
      />

      {/* Quick Access Tiles */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Link
          href="/chat"
          className="rounded-xl border border-slate-200/80 bg-white/80 p-4 shadow-2xs hover:border-sky-500 transition-colors group"
        >
          <div className="text-xl mb-1.5">💬</div>
          <p className="text-xs font-semibold text-slate-900 group-hover:text-sky-600 transition-colors">
            Chat with Ava
          </p>
          <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
            Instant AI travel assistant for live flight queries, stays, and booking modifications.
          </p>
        </Link>

        <Link
          href="/journey"
          className="rounded-xl border border-slate-200/80 bg-white/80 p-4 shadow-2xs hover:border-sky-500 transition-colors group"
        >
          <div className="text-xl mb-1.5">🗺️</div>
          <p className="text-xs font-semibold text-slate-900 group-hover:text-sky-600 transition-colors">
            My Journey
          </p>
          <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
            Real-time flight gate tracking, schedule change alerts, and digital travel boarding passes.
          </p>
        </Link>

        <Link
          href="/refunds"
          className="rounded-xl border border-slate-200/80 bg-white/80 p-4 shadow-2xs hover:border-sky-500 transition-colors group"
        >
          <div className="text-xl mb-1.5">↩️</div>
          <p className="text-xs font-semibold text-slate-900 group-hover:text-sky-600 transition-colors">
            Refunds & Claims
          </p>
          <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
            Check fare rule cancellation eligibility, calculate refunds, and file travel claims.
          </p>
        </Link>

        <Link
          href="/visa"
          className="rounded-xl border border-slate-200/80 bg-white/80 p-4 shadow-2xs hover:border-sky-500 transition-colors group"
        >
          <div className="text-xl mb-1.5">🛂</div>
          <p className="text-xs font-semibold text-slate-900 group-hover:text-sky-600 transition-colors">
            Visa Intelligence
          </p>
          <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
            Verify passport entry rules, embassy biometrics requirements, and visa applications.
          </p>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("knowledge")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "knowledge"
              ? "border-sky-600 text-sky-600 font-semibold"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          Knowledge Base & FAQs
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("ticket")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "ticket"
              ? "border-sky-600 text-sky-600 font-semibold"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          Open Support Case
        </button>
        {accessToken && (
          <button
            type="button"
            onClick={() => setActiveTab("mycases")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "mycases"
                ? "border-sky-600 text-sky-600 font-semibold"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            My Support Cases ({items.length})
          </button>
        )}
      </div>

      {/* TAB 1: KNOWLEDGE BASE & FAQS */}
      {activeTab === "knowledge" && (
        <div className="space-y-5">
          <div className="max-w-xl">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search help topics (e.g. refunds, seat changes, baggage, visa rules)…"
            />
          </div>

          <div className="space-y-4">
            {filteredCategories.map((cat) => (
              <div key={cat.id} className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs">
                <div className="flex items-center gap-2.5 pb-2 mb-3 border-b border-slate-100">
                  <span className="text-xl">{cat.icon}</span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{cat.title}</h3>
                    <p className="text-xs text-slate-500">{cat.desc}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {cat.faqs.map((faq, idx) => {
                    const faqId = `${cat.id}-${idx}`;
                    const isExpanded = expandedFaq === faqId;
                    return (
                      <div key={faqId} className="rounded-lg border border-slate-100 bg-slate-50/50">
                        <button
                          type="button"
                          onClick={() => setExpandedFaq(isExpanded ? null : faqId)}
                          className="w-full text-left px-3.5 py-2.5 flex items-center justify-between text-xs font-medium text-slate-800 hover:text-sky-600 transition-colors"
                        >
                          <span>{faq.q}</span>
                          <span className="text-slate-400 text-sm ml-2">{isExpanded ? "−" : "+"}</span>
                        </button>
                        {isExpanded && (
                          <div className="px-3.5 pb-3 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-2 bg-white rounded-b-lg">
                            {faq.a}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: OPEN SUPPORT CASE */}
      {activeTab === "ticket" && (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs max-w-2xl">
          <div className="border-b border-slate-100 pb-4 mb-4">
            <h2 className="text-base font-semibold text-slate-900">Request Human Consultant Assistance</h2>
            <p className="text-xs text-slate-500 mt-1">
              Need assistance that requires manual airline intervention, medical clearance, or complex itinerary restructuring? Submit a support case directly to our operations team.
            </p>
          </div>

          {!accessToken ? (
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-5 space-y-3">
              <p className="text-sm font-medium text-slate-800">Sign in to track your support cases</p>
              <p className="text-xs text-slate-600 leading-relaxed">
                Signing in allows us to securely associate your inquiry with your travel bookings and deliver resolution updates to your account.
              </p>
              <div className="flex gap-3 pt-1">
                <Link href="/login?redirect=%2Fescalations">
                  <Button size="sm">Sign In to Open Case</Button>
                </Link>
                <Link href="/chat">
                  <Button size="sm" variant="secondary">Chat with Ava as Guest</Button>
                </Link>
              </div>
            </div>
          ) : ticketSuccess ? (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 space-y-3">
              <p className="text-sm font-semibold text-emerald-900">✓ {ticketSuccess}</p>
              <p className="text-xs text-emerald-700 leading-relaxed">
                You can track the consultant assignment and status in the &quot;My Support Cases&quot; tab or discuss directly in Ava Chat.
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setActiveTab("mycases")}>
                  View My Cases
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setTicketSuccess(null)}>
                  Open Another Case
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleTicketSubmit} className="space-y-4">
              <div>
                <SearchableSelect
                  label="Inquiry Category *"
                  options={TRIGGER_OPTIONS}
                  value={ticketTrigger}
                  onChange={(v) => setTicketTrigger(v as EscalationTrigger)}
                  searchable={false}
                />
              </div>

              <div>
                <Input
                  label="Associated Booking ID (optional)"
                  value={ticketBookingId}
                  onChange={(e) => setTicketBookingId(e.target.value)}
                  placeholder="e.g. bk_12345678"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Detailed Description & Request *
                </label>
                <textarea
                  rows={4}
                  value={ticketNote}
                  onChange={(e) => setTicketNote(e.target.value)}
                  placeholder="Please describe the flight numbers, dates, passenger names, and specific changes or assistance required…"
                  className="w-full rounded-lg border border-slate-200 p-3 text-xs text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  required
                />
              </div>

              {ticketError && <p className="text-xs text-red-600">{ticketError}</p>}

              <div className="flex items-center gap-3 pt-2">
                <Button type="submit" disabled={submittingTicket}>
                  {submittingTicket ? "Submitting Case…" : "Submit Support Request"}
                </Button>
                <Link href="/chat">
                  <Button type="button" variant="ghost">
                    Chat with Ava
                  </Button>
                </Link>
              </div>
            </form>
          )}
        </div>
      )}

      {/* TAB 3: MY SUPPORT CASES */}
      {activeTab === "mycases" && accessToken && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : isError ? (
            <TravellerState
              variant="error"
              title="Escalations unavailable"
              action={
                <Button size="sm" onClick={() => refetch()}>
                  Retry
                </Button>
              }
            >
              Could not load support cases.
            </TravellerState>
          ) : !items.length ? (
            <TravellerState title="No active support cases">
              You do not have any open support tickets. You can open a ticket in the &quot;Open Support Case&quot; tab or ask Ava in Chat.
            </TravellerState>
          ) : (
            <>
              <ul className="fo-traveller__list">
                {pageItems.map((t) => (
                  <li key={t.id}>
                    <EscalationRow ticket={t} />
                  </li>
                ))}
              </ul>
              <TravellerPagination
                page={page}
                total={items.length}
                onPageChange={setPage}
                label="Escalations pages"
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
