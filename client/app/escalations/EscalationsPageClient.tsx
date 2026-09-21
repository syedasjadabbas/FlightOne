"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { PermissionGate } from "@/components/PermissionGate";
import {
  TravellerPageHeader,
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
import { useAuthStore } from "@/store/auth.store";
import {
  EscalationCaseRow,
  EscalationTicketForm,
  EscalationsTabs,
  KnowledgeBase,
  SUPPORT_CATEGORIES,
  SupportQuickLinks,
  type EscalationsTab,
} from "./_components";

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
      const res = await requestEscalation({
        conversationId: `support-ticket-${Date.now()}`,
        trigger: ticketTrigger,
        bookingId: ticketBookingId.trim() || undefined,
        note: ticketNote.trim(),
      }).unwrap();

      setTicketSuccess(`Case ${res.id.slice(0, 8)} opened. A consultant will review it shortly.`);
      setTicketNote("");
      setTicketBookingId("");
      void refetch();
    } catch {
      setTicketError("Could not submit the case. Try again, or chat with Ava.");
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
        title="Support"
        lede="Answers first. Open a consultant case when you need a human — or track ones already in flight."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/chat">
              <Button variant="secondary" size="sm" className="inline-flex items-center gap-1.5">
                <MessageCircle size={14} aria-hidden />
                Chat with Ava
              </Button>
            </Link>
            <PermissionGate anyOf={["ops:escalations:read"]}>
              <Link href="/ops/escalations">
                <Button variant="ghost" size="sm">
                  Consultant queue
                </Button>
              </Link>
            </PermissionGate>
          </div>
        }
      />

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
          className="max-w-2xl"
        >
          <EscalationTicketForm
            signedIn={signedIn}
            trigger={ticketTrigger}
            onTriggerChange={setTicketTrigger}
            bookingId={ticketBookingId}
            onBookingIdChange={setTicketBookingId}
            note={ticketNote}
            onNoteChange={setTicketNote}
            submitting={submittingTicket}
            error={ticketError}
            success={ticketSuccess}
            onSubmit={handleTicketSubmit}
            onViewCases={() => setActiveTab("mycases")}
            onResetSuccess={() => setTicketSuccess(null)}
          />
        </div>
      ) : null}

      {activeTab === "mycases" && signedIn ? (
        <div
          role="tabpanel"
          id="escalations-panel-mycases"
          aria-labelledby="escalations-tab-mycases"
          className="space-y-4"
        >
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : isError ? (
            <TravellerState
              variant="error"
              title="Cases unavailable"
              action={
                <Button size="sm" onClick={() => refetch()}>
                  Retry
                </Button>
              }
            >
              Could not load your support cases.
            </TravellerState>
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
