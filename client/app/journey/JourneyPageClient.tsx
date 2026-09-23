"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronRight,
  Clock,
  Info,
  MessageCircle,
  Plane,
  Plus,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Ticket,
  Vault,
} from "lucide-react";
import { Button, Spinner, BrandedLoader } from "@/components/ui";
import {
  TravellerPagination,
  TravellerSection,
  TravellerState,
  TravellerStatStrip,
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
import "./journey.css";

const PAGE_SIZE = 20;

type Flash = { text: string; type: "success" | "error" | "info" };
type JourneyCategory = "ALL" | "ACTIVE" | "UPCOMING" | "COMPLETED";

export function JourneyPageClient() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const skip = !hasHydrated || !accessToken;

  const [page, setPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<JourneyCategory>("ALL");

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

  const { inProgress, upcoming, completed, allItems } = useMemo(() => {
    const items = data?.items || [];
    const inProg: JourneyWatch[] = [];
    const up: JourneyWatch[] = [];
    const done: JourneyWatch[] = [];
    for (const w of items) {
      if (w.phase === "COMPLETED" || w.status === "COMPLETED") done.push(w);
      else if (w.phase === "IN_PROGRESS") inProg.push(w);
      else up.push(w);
    }
    return { inProgress: inProg, upcoming: up, completed: done, allItems: items };
  }, [data?.items]);

  const displayedWatches = useMemo(() => {
    if (selectedCategory === "ACTIVE") return inProgress;
    if (selectedCategory === "UPCOMING") return upcoming;
    if (selectedCategory === "COMPLETED") return completed;
    return allItems;
  }, [selectedCategory, inProgress, upcoming, completed, allItems]);

  // First active or upcoming flight for hero preview
  const previewWatch = inProgress[0] || upcoming[0] || null;
  const previewLeg = (previewWatch?.itinerary || []).find((i) => i.kind === "FLIGHT");
  const previewOrigin = previewLeg?.origin || "LHR";
  const previewDest = previewLeg?.destination || "JFK";
  const previewFlightNum = previewWatch?.flightNumber || "PK 785";

  // Dynamic radar score
  const activeFlightsCount = inProgress.length;
  const upcomingFlightsCount = upcoming.length;
  const completedFlightsCount = completed.length;
  const radarPercent = activeFlightsCount > 0 ? 100 : upcomingFlightsCount > 0 ? 80 : completedFlightsCount > 0 ? 50 : 0;

  // Geometry for Circular Radar Dial
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (radarPercent / 100) * circumference;

  async function handlePoll(watchId: string) {
    setActiveWatchId(watchId);
    setMsg(null);
    try {
      const r = await poll(watchId).unwrap();
      setMsg({
        text: r.isFact
          ? `Verified status: ${r.dataStatus}. Telemetry synchronized.`
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

  if (!hasHydrated || (accessToken && isLoading)) {
    return (
      <BrandedLoader
        title="Synchronizing flight radar…"
        subtitle="Tracking live satellite telemetry, gate changes & verified flight updates."
        badge="LIVE RADAR ACTIVE"
      />
    );
  }

  if (!accessToken) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center py-16">
        <div className="max-w-md w-full rounded-3xl border border-white/95 bg-white/90 p-8 text-center shadow-xl backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-sky/10 text-sky">
            <Radio size={26} strokeWidth={2} />
          </div>
          <h2 className="font-hero text-2xl font-bold text-navy">Authentication Required</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Sign in to track ticketed trips you own — real-time satellite radar, automated gate notifications, and verified delays.
          </p>
          <Button
            size="lg"
            className="mt-6 w-full rounded-full font-semibold shadow-lg"
            onClick={() => {
              window.location.href = "/login?redirect=/journey";
            }}
          >
            Sign In to My Journey
          </Button>
        </div>
      </div>
    );
  }

  const empty = inProgress.length === 0 && upcoming.length === 0 && completed.length === 0;

  return (
    <div className="fo-journey__master-stage">
      {/* ── Top Navigation Rail ──────────────────────────────────────── */}
      <div className="fo-journey__nav-rail">
        <div className="fo-journey__brand-badge">
          <span className="fo-journey__brand-dot" aria-hidden />
          <span className="font-semibold tracking-wider text-xs uppercase">
            LIVE RADAR · ACTIVE ITINERARY
          </span>
        </div>

        <div className="fo-journey__nav-center">
          <div className="fo-journey__nav-tabs">
            <button
              type="button"
              className={`fo-journey__tab-pill${selectedCategory === "ALL" ? " fo-journey__tab-pill--active" : ""}`}
              onClick={() => setSelectedCategory("ALL")}
            >
              <Plane size={14} strokeWidth={2} className="fo-journey__tab-icon" />
              <span>All Trips ({allItems.length})</span>
            </button>
            <button
              type="button"
              className={`fo-journey__tab-pill${selectedCategory === "ACTIVE" ? " fo-journey__tab-pill--active" : ""}`}
              onClick={() => setSelectedCategory("ACTIVE")}
            >
              <Radio size={14} strokeWidth={2} className="fo-journey__tab-icon text-emerald" />
              <span>Active Now ({inProgress.length})</span>
            </button>
            <button
              type="button"
              className={`fo-journey__tab-pill${selectedCategory === "UPCOMING" ? " fo-journey__tab-pill--active" : ""}`}
              onClick={() => setSelectedCategory("UPCOMING")}
            >
              <Clock size={14} strokeWidth={2} className="fo-journey__tab-icon" />
              <span>Upcoming ({upcoming.length})</span>
            </button>
            <button
              type="button"
              className={`fo-journey__tab-pill${selectedCategory === "COMPLETED" ? " fo-journey__tab-pill--active" : ""}`}
              onClick={() => setSelectedCategory("COMPLETED")}
            >
              <ShieldCheck size={14} strokeWidth={2} className="fo-journey__tab-icon" />
              <span>Completed ({completed.length})</span>
            </button>
          </div>
        </div>

      </div>

      {/* ── Master Hero Showcase Section ─────────────────────────────── */}
      <div className="fo-journey__hero-showcase">
        {/* Left Column: Bold Typography & Action Controls */}
        <div className="fo-journey__hero-left">
          <div className="fo-journey__hero-eyebrow">
            <Radio size={13} strokeWidth={2.2} className="text-emerald" />
            <span>LIVE MISSION CONTROL &amp; ROUTE RADAR</span>
          </div>

          <h1 className="fo-journey__hero-title">
            YOUR JOURNEYS<br />
            <span className="fo-journey__hero-title-accent">TRACKED LIVE</span>
          </h1>

          <p className="fo-journey__hero-lede">
            Real-time flight radar feeds, automated gate notifications, verified delay telemetry, and one-tap AI rebooking assistance.
          </p>

          <div className="fo-journey__hero-cta-group">
            <Link href="/chat" className="fo-journey__cta-primary">
              <span>Plan Trip with Ava</span>
              <span className="fo-journey__cta-icon-circle">
                <ChevronRight size={14} strokeWidth={2.5} />
              </span>
            </Link>

            <Link href="/vault" className="fo-journey__cta-secondary">
              <Vault size={14} strokeWidth={2} className="text-sky" />
              <span>Travel Vault</span>
            </Link>
          </div>

          {/* Bottom 3 Feature Pills */}
          <div className="fo-journey__feature-pills">
            <div className="fo-journey__feature-pill">
              <span className="fo-journey__feature-pill-dot fo-journey__feature-pill-dot--cyan" />
              <span>Verified Radar Feeds</span>
            </div>
            <div className="fo-journey__feature-pill">
              <span className="fo-journey__feature-pill-dot fo-journey__feature-pill-dot--emerald" />
              <span>Gate &amp; Terminal Tracking</span>
            </div>
            <div className="fo-journey__feature-pill">
              <span className="fo-journey__feature-pill-dot fo-journey__feature-pill-dot--amber" />
              <span>Instant Disruption Assist</span>
            </div>
          </div>
        </div>

        {/* Right Column: Scenic Canvas with Floating Radar Dial */}
        <div className="fo-journey__hero-right">
          <div className="fo-journey__canvas-container">
            <div className="fo-journey__canvas-backdrop">
              <div className="fo-journey__canvas-glow" />
              <div className="fo-journey__canvas-image" />
              <div className="fo-journey__canvas-sweep" aria-hidden />

              {/* Dynamic Flight Route SVG Arc */}
              <svg className="fo-journey__canvas-route" viewBox="0 0 500 300" fill="none" preserveAspectRatio="none">
                <path
                  d="M 50 210 Q 230 40 450 140"
                  stroke="rgba(255, 255, 255, 0.45)"
                  strokeWidth="2.5"
                  strokeDasharray="6 6"
                />
                <circle cx="50" cy="210" r="4.5" fill="#00D2FF" />
                <circle cx="450" cy="140" r="5" fill="#25D366" />
              </svg>
            </div>

            <div className="fo-journey__canvas-tags">
              <div className="fo-journey__canvas-tag fo-journey__canvas-tag--mid">
                <Radio size={12} strokeWidth={2.2} className="text-emerald" />
                <span>{canPollLive ? "Live Radar Online" : "Itinerary Mode"}</span>
              </div>
              <div className="fo-journey__canvas-tag fo-journey__canvas-tag--top">
                <Plane size={12} strokeWidth={2.2} className="text-sky" />
                <span>Real-Time Telemetry</span>
              </div>
            </div>

            <div className="fo-journey__canvas-instruments">
            {/* Floating Flight Radar Dial */}
            <div className="fo-journey__dial-widget">
              <div className="fo-journey__dial-head">
                <span className="fo-journey__dial-label">RADAR SYNC</span>
                <span className="fo-journey__dial-arrow">↗</span>
              </div>

              <div className="fo-journey__dial-circle-wrap">
                <svg className="fo-journey__dial-svg" viewBox="0 0 96 96">
                  <circle
                    cx="48"
                    cy="48"
                    r={radius}
                    className="fo-journey__dial-track"
                    strokeWidth="6"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r={radius}
                    className="fo-journey__dial-progress"
                    strokeWidth="6"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeOffset}
                    strokeLinecap="round"
                    transform="rotate(-90 48 48)"
                  />
                </svg>

                <div className="fo-journey__dial-value">
                  <span className="fo-journey__dial-number">{radarPercent}</span>
                  <span className="fo-journey__dial-percent">%</span>
                </div>
              </div>

              <div className="fo-journey__dial-status-pills">
                <span className={`fo-journey__dial-status-pill${radarPercent === 100 ? " fo-journey__dial-status-pill--active" : ""}`}>
                  En Route
                </span>
                <span className={`fo-journey__dial-status-pill${radarPercent < 100 && radarPercent >= 50 ? " fo-journey__dial-status-pill--active" : ""}`}>
                  Ticketed
                </span>
                <span className={`fo-journey__dial-status-pill${radarPercent < 50 ? " fo-journey__dial-status-pill--active" : ""}`}>
                  Standby
                </span>
              </div>
            </div>

            {/* Floating Active Flight Widget (Bottom Right) */}
            <div className="fo-journey__flight-widget">
              <div className="fo-journey__flight-icon">
                <Plane size={18} strokeWidth={2.2} className="rotate-45" />
              </div>
              <div className="fo-journey__flight-info">
                <p className="fo-journey__flight-name">
                  {previewOrigin} → {previewDest}
                </p>
                <p className="fo-journey__flight-sub">
                  Flight {previewFlightNum}
                </p>
                <div className="fo-journey__flight-status">
                  <span className="fo-journey__flight-dot" />
                  <span>{activeFlightsCount > 0 ? "In Flight Live" : upcomingFlightsCount > 0 ? "Scheduled" : "Radar Ready"}</span>
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Summary Strip (shared with /vault) ───────────────────────── */}
      {!isLoading && !isError ? (
        <TravellerStatStrip
          aria-label="Journey summary"
          stats={[
            {
              key: "active",
              icon: <Radio size={12} strokeWidth={2} aria-hidden />,
              label: "Active Now",
              value: inProgress.length,
              note: "In the air or at gate",
              tone: "sky",
            },
            {
              key: "upcoming",
              icon: <Clock size={12} strokeWidth={2} aria-hidden />,
              label: "Upcoming",
              value: upcoming.length,
              note: "Ticketed & ahead",
              tone: "amber",
            },
            {
              key: "completed",
              icon: <ShieldCheck size={12} strokeWidth={2.2} aria-hidden />,
              label: "Completed",
              value: completed.length,
              note: "Safely arrived",
              tone: "emerald",
            },
            {
              key: "radar",
              icon: <Radio size={12} strokeWidth={2} aria-hidden />,
              label: "Radar Feed",
              value: canPollLive ? "Live" : "Itinerary",
              note: canPollLive ? "Automated satellite sync" : "Standard timetable",
              tone: "sky",
              small: true,
            },
          ]}
        />
      ) : null}

      {/* ── Flash Notifications ──────────────────────────────────────── */}
      {msg ? (
        <div
          className={`fo-journey__flash fo-journey__flash--${msg.type}`}
          role="status"
        >
          <span className="flex items-center gap-2">
            {msg.type === "success" ? (
              <Check size={15} strokeWidth={2.5} className="text-emerald" />
            ) : msg.type === "error" ? (
              <AlertCircle size={15} strokeWidth={2.5} className="text-danger" />
            ) : (
              <Info size={15} strokeWidth={2.5} className="text-sky" />
            )}
            <span>{msg.text}</span>
          </span>
          <button
            type="button"
            onClick={() => setMsg(null)}
            className="fo-journey__flash-dismiss"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {/* ── Content / Error / Empty States ───────────────────────────── */}
      {isError ? (
        <TravellerState
          variant="error"
          title="Could not load your journeys"
          action={
            <Button size="md" variant="secondary" onClick={() => refetch()}>
              Try again
            </Button>
          }
        >
          This is an error loading watches you own — not a flight status.
        </TravellerState>
      ) : empty ? (
        <div className="rounded-3xl border border-black/8 bg-white/85 p-12 text-center shadow-sm backdrop-blur-md">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky/10 text-sky">
            <Plane size={26} strokeWidth={1.75} />
          </div>
          <h3 className="font-hero text-lg font-bold text-navy">
            No Ticketed Journeys Yet
          </h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">
            When you ticket a flight or hotel booking with Ava, it automatically appears here with live radar feeds, gate numbers, and verified delay alerts.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/chat" className="inline-flex">
              <Button size="md" className="h-10" icon={<MessageCircle size={15} strokeWidth={2} />}>
                Plan Trip with Ava
              </Button>
            </Link>
            <Link href="/vault" className="inline-flex">
              <Button size="md" variant="secondary" className="h-10" icon={<Vault size={15} strokeWidth={2} />}>
                Open Travel Vault
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {selectedCategory === "ALL" ? (
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
            </>
          ) : (
            <TravellerSection
              title={`${selectedCategory === "ACTIVE" ? "Active Now" : selectedCategory === "UPCOMING" ? "Upcoming Trips" : "Completed Trips"} · ${displayedWatches.length}`}
            >
              {displayedWatches.length === 0 ? (
                <p className="text-center text-sm py-8 text-ink-soft">
                  No trips currently found in this category.
                </p>
              ) : (
                <div className="fo-journey__stack">{displayedWatches.map(renderWatch)}</div>
              )}
            </TravellerSection>
          )}

          {data ? (
            <TravellerPagination
              page={page}
              pageSize={PAGE_SIZE}
              total={data.total}
              onPageChange={setPage}
              label="Journey pages"
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
