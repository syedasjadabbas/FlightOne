"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MessageCircle, Radio, Vault } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import {
  TravellerChip,
  TravellerPageHeader,
  TravellerPagination,
  TravellerSection,
  TravellerState,
} from "@/app/components/traveller";
import {
  useEscalateJourneyMutation,
  useGetJourneyCapabilityQuery,
  useJourneyAlternativesMutation,
  useJourneyRebookHandoffMutation,
  useListJourneyWatchesQuery,
  usePollJourneyWatchMutation,
  type JourneyWatch,
} from "@/lib/api/journey.api";
import { useAuthStore } from "@/store/auth.store";
import {
  JourneyWatchCard,
  type JourneyAlts,
} from "./_components/JourneyWatchCard";

const PAGE_SIZE = 20;

type Flash = { text: string; type: "success" | "error" | "info" };

export function JourneyPageClient() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const skip = !hasHydrated || !accessToken;

  const [page, setPage] = useState(1);
  const { data: capability } = useGetJourneyCapabilityQuery(undefined, { skip });
  const { data, isLoading, isError, refetch } = useListJourneyWatchesQuery(
    { page, pageSize: PAGE_SIZE },
    { skip },
  );

  const [poll, { isLoading: isPolling }] = usePollJourneyWatchMutation();
  const [escalate, { isLoading: isEscalating }] = useEscalateJourneyMutation();
  const [alternatives, { isLoading: isLoadingAlts }] = useJourneyAlternativesMutation();
  const [rebookHandoff, { isLoading: isRebooking }] = useJourneyRebookHandoffMutation();

  const [activeWatchId, setActiveWatchId] = useState<string | null>(null);
  const [msg, setMsg] = useState<Flash | null>(null);
  const [altsByWatch, setAltsByWatch] = useState<Record<string, JourneyAlts>>({});

  const liveCap = capability?.flightStatus || capability;
  const canPollLive = Boolean(liveCap?.canPollLive);

  const { inProgress, upcoming, completed } = useMemo(() => {
    const items = data?.items || [];
    const inProg: JourneyWatch[] = [];
    const up: JourneyWatch[] = [];
    const done: JourneyWatch[] = [];
    for (const w of items) {
      if (w.phase === "COMPLETED" || w.status === "COMPLETED") done.push(w);
      else if (w.phase === "IN_PROGRESS") inProg.push(w);
      else up.push(w);
    }
    return { inProgress: inProg, upcoming: up, completed: done };
  }, [data?.items]);

  async function handlePoll(watchId: string) {
    setActiveWatchId(watchId);
    setMsg(null);
    try {
      const r = await poll(watchId).unwrap();
      setMsg({
        text: r.isFact
          ? `Verified status: ${r.dataStatus}.`
          : `Poll finished (${r.dataStatus || "unavailable"}). No live status invented.`,
        type: r.isFact ? "success" : "info",
      });
      refetch();
    } catch {
      setMsg({
        text: "Could not poll this watch. Completed journeys cannot be polled.",
        type: "error",
      });
    } finally {
      setActiveWatchId(null);
    }
  }

  async function handleAlternatives(watchId: string) {
    setActiveWatchId(watchId);
    setMsg(null);
    try {
      const r = await alternatives(watchId).unwrap();
      setAltsByWatch((prev) => ({
        ...prev,
        [watchId]: {
          offers: Array.isArray(r.offers) ? r.offers : [],
          note: r.note,
          reason: r.reason,
        },
      }));
      setMsg({
        text: r.autoBooked
          ? "Unexpected auto-book flag — FlightOne does not auto-rebook."
          : r.note || r.reason || "Alternative search finished. Nothing was booked.",
        type: "info",
      });
    } catch {
      setMsg({ text: "Could not search alternatives.", type: "error" });
    } finally {
      setActiveWatchId(null);
    }
  }

  async function handleEscalate(watchId: string) {
    setActiveWatchId(watchId);
    setMsg(null);
    try {
      const r = await escalate({
        id: watchId,
        reason: "Traveller requested help from My Journey",
      }).unwrap();
      setMsg({
        text:
          r.message ||
          (r.auditOnly
            ? "Help request recorded. Open chat with Ava to create a consultant ticket."
            : "Disruption escalation recorded."),
        type: "info",
      });
    } catch {
      setMsg({ text: "Could not record a help request.", type: "error" });
    } finally {
      setActiveWatchId(null);
    }
  }

  async function handlePrepareQuote(watchId: string, supplierOfferSnapshotId: string) {
    setMsg(null);
    try {
      const r = await rebookHandoff({
        id: watchId,
        supplierOfferSnapshotId,
      }).unwrap();
      setMsg({
        text: r.message || "Quote handoff prepared. FlightOne did not rebook or charge.",
        type: "info",
      });
    } catch {
      setMsg({ text: "Could not prepare quote handoff.", type: "error" });
    }
  }

  function renderWatch(w: JourneyWatch) {
    return (
      <JourneyWatchCard
        key={w.id}
        watch={w}
        busy={activeWatchId === w.id}
        isPolling={isPolling}
        isLoadingAlts={isLoadingAlts}
        isEscalating={isEscalating}
        isRebooking={isRebooking}
        alternatives={altsByWatch[w.id]}
        onPoll={() => void handlePoll(w.id)}
        onFindAlternatives={() => void handleAlternatives(w.id)}
        onEscalate={() => void handleEscalate(w.id)}
        onPrepareQuote={(snapId) => void handlePrepareQuote(w.id, snapId)}
      />
    );
  }

  if (!hasHydrated) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="Loading journey" />
      </div>
    );
  }

  if (!accessToken) {
    return (
      <>
        <TravellerPageHeader
          title="My Journey"
          lede="Sign in to see ticketed itineraries you own. Live delays, gates, and cancellations appear only when a verified status feed returns them."
          actions={
            <div className="flex gap-2">
              <Link href="/login?redirect=/journey">
                <Button size="sm">Log in</Button>
              </Link>
              <Link href="/signup">
                <Button size="sm" variant="secondary">
                  Create account
                </Button>
              </Link>
            </div>
          }
        />
      </>
    );
  }

  const empty = inProgress.length === 0 && upcoming.length === 0 && completed.length === 0;

  return (
    <>
      <TravellerPageHeader
        title="My Journey"
        lede="Ticketed trips you own. Status, gates, and disruptions come only from stored itinerary data or a verified provider poll."
        actions={
          <TravellerChip tone={canPollLive ? "default" : "muted"}>
            <Radio size={11} strokeWidth={2} aria-hidden="true" />
            {canPollLive ? "Live feed configured" : "Live feed unavailable"}
          </TravellerChip>
        }
      />

      {msg ? (
        <div
          className={`fo-journey__flash fo-journey__flash--${msg.type}`}
          role="status"
        >
          <span>{msg.text}</span>
          <button type="button" onClick={() => setMsg(null)} className="fo-journey__flash-dismiss">
            Dismiss
          </button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner label="Loading your trips…" />
        </div>
      ) : isError ? (
        <TravellerState
          variant="error"
          title="Could not load your journeys"
          action={
            <Button size="sm" variant="secondary" onClick={() => refetch()}>
              Try again
            </Button>
          }
        >
          This is an error loading watches you own — not a flight status.
        </TravellerState>
      ) : empty ? (
        <TravellerState
          title="No monitored journeys"
          action={
            <div className="fo-journey__empty-actions">
              <Link href="/chat">
                <Button
                  size="sm"
                  icon={<MessageCircle size={13} strokeWidth={2} aria-hidden="true" />}
                >
                  Ask Ava
                </Button>
              </Link>
              <Link href="/vault">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Vault size={13} strokeWidth={2} aria-hidden="true" />}
                >
                  Travel vault
                </Button>
              </Link>
            </div>
          }
        >
          Ticketed or active bookings you own appear here. Quoted carts and other travellers’
          trips do not.
        </TravellerState>
      ) : (
        <>
          {inProgress.length > 0 ? (
            <TravellerSection title={`Active now · ${inProgress.length}`}>
              <div className="fo-journey__stack">{inProgress.map(renderWatch)}</div>
            </TravellerSection>
          ) : null}

          {upcoming.length > 0 ? (
            <TravellerSection title={`Upcoming · ${upcoming.length}`}>
              <div className="fo-journey__stack">{upcoming.map(renderWatch)}</div>
            </TravellerSection>
          ) : null}

          {completed.length > 0 ? (
            <TravellerSection title={`Completed · ${completed.length}`}>
              <div className="fo-journey__stack">{completed.map(renderWatch)}</div>
            </TravellerSection>
          ) : null}

          {data ? (
            <TravellerPagination
              page={page}
              pageSize={PAGE_SIZE}
              total={data.total}
              onPageChange={setPage}
              label="Journey pages"
            />
          ) : null}
        </>
      )}
    </>
  );
}
