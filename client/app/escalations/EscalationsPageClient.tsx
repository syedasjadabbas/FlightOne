"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertCircle, Lock, MessageCircle } from "lucide-react";
import { Button, Spinner, buttonClassName } from "@/components/ui";
import { PermissionGate } from "@/components/PermissionGate";
import {
  TravellerPagination,
  TravellerState,
  TRAVELLER_PAGE_SIZE,
  paginateItems,
} from "@/app/components/traveller";
import {
  useListMyEscalationsQuery,
  useRequestEscalationMutation,
  type EscalationTrigger,
} from "@/lib/api/escalations.api";
import { useCreateConversationMutation } from "@/lib/api/conversations.api";
import { apiErrorMessage } from "@/lib/api/apiErrorMessage";
import { useAuthStore } from "@/store/auth.store";
import {
  EscalationCaseRow,
  EscalationTicketForm,
  EscalationsTabs,
  KnowledgeBase,
  SUPPORT_CATEGORIES,
  SupportQuickLinks,
  TRIGGER_OPTIONS,
  type EscalationsTab,
} from "./_components";
import "./escalations.css";

export function EscalationsPageClient() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const skip = !hasHydrated || !accessToken;
  const signedIn = Boolean(accessToken);

  const [activeTab, setActiveTab] = useState<EscalationsTab>("knowledge");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const [ticketTrigger, setTicketTrigger] = useState<EscalationTrigger>("CUSTOMER_REQUEST");
  const [ticketBookingId, setTicketBookingId] = useState("");
  const [ticketNote, setTicketNote] = useState("");
  const [ticketSuccess, setTicketSuccess] = useState<string | null>(null);
  const [ticketError, setTicketError] = useState<string | null>(null);

  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useListMyEscalationsQuery(undefined, { skip });
  const [requestEscalation, { isLoading: submittingTicket }] = useRequestEscalationMutation();
  const [createConversation, { isLoading: creatingConversation }] = useCreateConversationMutation();

  const items = data?.items ?? [];
  const pageItems = paginateItems(items, page, TRAVELLER_PAGE_SIZE);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return SUPPORT_CATEGORIES;
    const q = searchQuery.toLowerCase();
    return SUPPORT_CATEGORIES.map((cat) => ({
      ...cat,
      faqs: cat.faqs.filter(
        (f) =>
          f.q.toLowerCase().includes(q) ||
          f.a.toLowerCase().includes(q) ||
          cat.title.toLowerCase().includes(q),
      ),
    })).filter((cat) => cat.faqs.length > 0 || cat.title.toLowerCase().includes(q));
  }, [searchQuery]);

  async function handleTicketSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTicketError(null);
    setTicketSuccess(null);

    if (!ticketNote.trim()) {
      setTicketError("Describe the issue so a consultant can act on it.");
      return;
    }

    try {
      // The escalation API anchors every ticket to a real conversation the
      // consultant can reply in — and verifies the caller owns it. A synthesised
      // `support-ticket-<timestamp>` id matched no row, so every submit 404'd.
      const conversation = await createConversation({
        title: `Support · ${TRIGGER_OPTIONS.find((o) => o.value === ticketTrigger)?.label ?? "Case"}`,
      }).unwrap();

      const res = await requestEscalation({
        conversationId: conversation.id,
        trigger: ticketTrigger,
        bookingId: ticketBookingId.trim() || undefined,
        note: ticketNote.trim(),
      }).unwrap();

      setTicketSuccess(`Case ${res.id.slice(0, 8)} opened. A consultant will review it shortly.`);
      setTicketNote("");
      setTicketBookingId("");
      void refetch();
    } catch (err) {
      setTicketError(apiErrorMessage(err, "Could not submit the case. Try again, or chat with Ava."));
    }
  }

  if (!hasHydrated) {
    return (
      <div className="fo-escalations__boot" role="status" aria-live="polite">
        <Spinner label="Loading support…" />
        <p className="fo-escalations__boot-label">Loading support</p>
      </div>
    );
  }

  return (
    <div className="fo-escalations__master-stage">
      <div className="fo-escalations__nav-rail">
        <span className="fo-escalations__brand-badge">
          <span className="fo-escalations__brand-dot" aria-hidden />
          Support
        </span>
        <div className="fo-escalations__rail-actions">
          <PermissionGate anyOf={["ops:escalations:read"]}>
            <Link href="/ops/escalations">
              <Button variant="ghost" size="sm">
                Consultant queue
              </Button>
            </Link>
          </PermissionGate>
        </div>
      </div>

      <header className="fo-escalations__hero">
        <h1 className="fo-escalations__title">Support</h1>
        <p className="fo-escalations__lede">
          Answers first. Open a consultant case when you need a human — or track ones already in
          flight.
        </p>
      </header>

      <SupportQuickLinks />

      <EscalationsTabs
        active={activeTab}
        onChange={setActiveTab}
        signedIn={signedIn}
        caseCount={items.length}
      />

      {activeTab === "knowledge" ? (
        <div
          role="tabpanel"
          id="escalations-panel-knowledge"
          aria-labelledby="escalations-tab-knowledge"
          className="fo-escalations__panel"
        >
          <KnowledgeBase
            categories={filteredCategories}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            expandedFaq={expandedFaq}
            onToggleFaq={setExpandedFaq}
          />
        </div>
      ) : null}

      {activeTab === "ticket" ? (
        <div
          role="tabpanel"
          id="escalations-panel-ticket"
          aria-labelledby="escalations-tab-ticket"
          className="fo-escalations__panel max-w-2xl"
        >
          {!signedIn ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="fo-escalations__gate-icon" aria-hidden>
                <Lock size={22} strokeWidth={2} />
              </div>
              <h2 className="fo-escalations__gate-title">Authentication Required</h2>
              <p className="fo-escalations__gate-desc max-w-sm">
                Sign in to open a consultant case so we can attach it to your account and bookings.
              </p>
              <Link
                href="/login?redirect=%2Fescalations"
                className={buttonClassName({ size: "md" })}
              >
                Sign In to FlightOne
              </Link>
            </div>
          ) : (
            <EscalationTicketForm
              signedIn={signedIn}
              trigger={ticketTrigger}
              onTriggerChange={setTicketTrigger}
              bookingId={ticketBookingId}
              onBookingIdChange={setTicketBookingId}
              note={ticketNote}
              onNoteChange={setTicketNote}
              submitting={submittingTicket || creatingConversation}
              error={ticketError}
              success={ticketSuccess}
              onSubmit={handleTicketSubmit}
              onViewCases={() => setActiveTab("mycases")}
              onResetSuccess={() => setTicketSuccess(null)}
            />
          )}
        </div>
      ) : null}

      {activeTab === "mycases" ? (
        <div
          role="tabpanel"
          id="escalations-panel-mycases"
          aria-labelledby="escalations-tab-mycases"
          className="space-y-4"
        >
          {!signedIn ? (
            <div className="fo-escalations__gate" style={{ minHeight: "auto" }}>
              <div className="fo-escalations__gate-box">
                <div className="fo-escalations__gate-icon" aria-hidden>
                  <Lock size={22} strokeWidth={2} />
                </div>
                <h2 className="fo-escalations__gate-title">Authentication Required</h2>
                <p className="fo-escalations__gate-desc">
                  Sign in to view support cases tied to your FlightOne account.
                </p>
                <Link
                  href="/login?redirect=%2Fescalations"
                  className={buttonClassName({ size: "md" })}
                >
                  Sign In to FlightOne
                </Link>
              </div>
            </div>
          ) : isLoading ? (
            <div className="fo-escalations__boot" style={{ minHeight: "24vh" }}>
              <Spinner label="Loading cases…" />
            </div>
          ) : isError ? (
            <div className="fo-escalations__gate" style={{ minHeight: "auto" }}>
              <div className="fo-escalations__gate-box">
                <div className="fo-escalations__gate-icon fo-escalations__gate-icon--warn" aria-hidden>
                  <AlertCircle size={22} strokeWidth={2} />
                </div>
                <h2 className="fo-escalations__gate-title">Cases Unavailable</h2>
                <p className="fo-escalations__gate-desc">Could not load your support cases.</p>
                <Button size="md" variant="secondary" onClick={() => void refetch()}>
                  Retry Connection
                </Button>
              </div>
            </div>
          ) : !items.length ? (
            <TravellerState
              title="No cases yet"
              action={
                <Button size="sm" onClick={() => setActiveTab("ticket")}>
                  Open a case
                </Button>
              }
            >
              Nothing open. Start a case here, or ask Ava in chat.
            </TravellerState>
          ) : (
            <>
              <ul className="fo-traveller__list">
                {pageItems.map((t) => (
                  <li key={t.id}>
                    <EscalationCaseRow ticket={t} />
                  </li>
                ))}
              </ul>
              <TravellerPagination
                page={page}
                total={items.length}
                onPageChange={setPage}
                label="Support cases"
              />
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
