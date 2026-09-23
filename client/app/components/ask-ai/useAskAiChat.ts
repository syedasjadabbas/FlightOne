"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ConsultantResponse } from "@/lib/consultant/types";
import type { TravelPlan } from "@/lib/consultant/travelPlan";
import type { ConsultantStreamEvent } from "@/lib/consultant/streamTypes";
import type { TravellerLocation } from "@/lib/geo/types";
import { applyFilterPills, togglePill } from "@/lib/ask-ai/applyFilters";
import {
  applySidebarFiltersToItineraries,
  applySidebarFiltersToOffers,
  buildSidebarFilterFacets,
  defaultSidebarFilters,
  seedSidebarFiltersFromPills,
  type SidebarFilterFacets,
  type SidebarFilterState,
} from "@/lib/ask-ai/sidebarFilters";
import { sortOffers } from "@/lib/ask-ai/sortOffers";
import type {
  FilterPill,
  ResultsSortKey,
  SearchPhase,
  SearchResultsPanel,
} from "@/lib/ask-ai/types";
import {
  previewLoadingRoute,
  routeCodesFromTravelPlan,
  type LoadingRouteCodes,
} from "@/lib/ask-ai/loadingRoute";
import { getPhaseSchedule } from "@/lib/ask-ai/processingTiming";
import {
  clearChatHandoff,
  loadChatHandoff,
  saveChatHandoff,
} from "@/lib/ask-ai/chatHandoff";
import { parseChatUrlState } from "@/lib/ask-ai/chatUrlState";
import {
  ensureConversationId,
  loadConversationResumeById,
  loadLatestConversationResume,
  recordAssistantMessage,
  recordGuestHandoffMessages,
  recordTurnMessages,
  requestConversationEscalation,
} from "@/lib/ask-ai/persistConversation";
import {
  detectEscalationIntent,
  honestHandoffReply,
} from "@/lib/ask-ai/escalationGuidance";
import { useAuthStore } from "@/store/auth.store";
import { useCorporateProfileStore } from "@/store/corporateProfile.store";
import { networkErrorReply } from "@/lib/consultant/serviceMessages";
import type { AskAiChatResult, UiMessage } from "../chat.types";
import { GREETING, buildGreeting } from "../chat.types";
import { isLiveSearchPanel } from "@/lib/ask-ai/chatResultsState";

const BEST_FARE_RE = /\b(best fare|cheapest|lowest price|best price)\b/i;

/** Ava guest chat — SSE to /api/chat with searchResults rail state. */
export function useAskAiChat(
  location: TravellerLocation | null,
): AskAiChatResult {
  const [messages, setMessages] = useState<UiMessage[]>([GREETING]);
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  const [greetedFor, setGreetedFor] = useState<string | null>(null);
  const [searchPanel, setSearchPanel] =
    useState<AskAiChatResult["searchPanel"]>(null);
  const [previousTravelPlan, setPreviousTravelPlan] = useState<TravelPlan | null>(
    null,
  );
  const [searchPhase, setSearchPhase] = useState<SearchPhase>("idle");
  const [filterPills, setFilterPills] = useState<FilterPill[]>([]);
  const [sidebarFilters, setSidebarFilters] =
    useState<SidebarFilterState | null>(null);
  const [sidebarFacets, setSidebarFacets] =
    useState<SidebarFilterFacets | null>(null);
  const [sortKey, setSortKey] = useState<ResultsSortKey>("angle");
  const [activeOriginIdx, setActiveOriginIdx] = useState(0);
  const [searchResultMessageId, setSearchResultMessageId] = useState<string | null>(
    null,
  );
  const [followUpSuggestions, setFollowUpSuggestions] = useState<string[]>([]);
  const [loadingRoute, setLoadingRoute] = useState<LoadingRouteCodes | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const searchPanelRef = useRef<SearchResultsPanel | null>(null);
  const previousTravelPlanRef = useRef<TravelPlan | null>(null);
  const sessionRestoredRef = useRef(false);
  /** True once the session restore (snapshot or server thread) has settled. */
  const [restored, setRestored] = useState(false);
  /** Synchronous double-submit guard — see the comment in `send()`. */
  const sendInFlightRef = useRef(false);
  /** Lets the user abandon an in-flight search instead of waiting it out. */
  const abortRef = useRef<AbortController | null>(null);
  const activeTurnTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  function clearActiveTurnTimers() {
    for (const t of activeTurnTimersRef.current) {
      clearTimeout(t);
    }
    activeTurnTimersRef.current = [];
  }
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydratedAuth = useAuthStore((s) => s.hasHydrated);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    previousTravelPlanRef.current = previousTravelPlan;
  }, [previousTravelPlan]);

  useEffect(() => {
    searchPanelRef.current = searchPanel;
  }, [searchPanel]);

  // Restore guest handoff (login nav) OR authenticated server conversation (cross-device).
  // Guests who refresh /chat start fresh — do not restore sessionStorage handoff.
  useEffect(() => {
    if (!hasHydratedAuth || sessionRestoredRef.current) return;
    sessionRestoredRef.current = true;
    // Every exit path below must flip this, or ChatConsole never reopens the
    // results view / detail modal the URL asked for.
    const done = () => setRestored(true);

    // `?c=` pins the thread this URL was showing (ChatConsole writes it), so
    // Back from checkout reopens THAT conversation, not merely the latest one.
    const urlConversationId =
      typeof window !== "undefined"
        ? parseChatUrlState(window.location.search).conversationId
        : null;

    const isExplicitNew =
      typeof window !== "undefined" &&
      (new URLSearchParams(window.location.search).get("new") === "true" ||
        new URLSearchParams(window.location.search).get("new") === "1");

    if (isExplicitNew) {
      clearChatHandoff();
      done();
      return;
    }

    const handoff = loadChatHandoff();

    // Unauthenticated full reload: wipe temporary guest handoff and keep landing state.
    if (!accessToken) {
      const nav = performance.getEntriesByType(
        "navigation",
      )[0] as PerformanceNavigationTiming | undefined;
      if (nav?.type === "reload") {
        clearChatHandoff();
        done();
        return;
      }
      if (!handoff) {
        done();
        return;
      }

      const restored = handoff.messages.filter((m) => m.content?.trim());
      if (restored.length > 0) setMessages(restored);
      if (handoff.previousTravelPlan) {
        setPreviousTravelPlan(handoff.previousTravelPlan);
      }
      if (handoff.conversationId) {
        setConversationId(handoff.conversationId);
        conversationIdRef.current = handoff.conversationId;
      }
      if (handoff.searchPanel) {
        setSearchPanel(handoff.searchPanel);
        if (handoff.searchResultMessageId) {
          setSearchResultMessageId(handoff.searchResultMessageId);
        }
        if (handoff.searchPhase) {
          setSearchPhase(handoff.searchPhase);
        }
        if (handoff.filterPills?.length) {
          setFilterPills(handoff.filterPills);
        }
      }
      done();
      return;
    }

    // Authenticated: prefer the in-tab snapshot — it is the freshest copy and
    // holds the live search panel — when it is the thread the URL asks for.
    // Otherwise load that thread from the server, else the latest one.
    const handoffMatchesUrl =
      !urlConversationId ||
      !handoff?.conversationId ||
      handoff.conversationId === urlConversationId;

    void (async () => {
      if (handoff && handoffMatchesUrl) {
        const restored = handoff.messages.filter((m) => m.content?.trim());
        if (restored.length > 0) setMessages(restored);
        if (handoff.previousTravelPlan) {
          setPreviousTravelPlan(handoff.previousTravelPlan);
        }
        if (handoff.searchPanel) {
          setSearchPanel(handoff.searchPanel);
          if (handoff.searchResultMessageId) {
            setSearchResultMessageId(handoff.searchResultMessageId);
          } else {
            const lastAssistant = restored
              .slice()
              .reverse()
              .find((m) => m.role === "assistant");
            if (lastAssistant) setSearchResultMessageId(lastAssistant.id);
          }
          if (handoff.searchPhase) {
            setSearchPhase(handoff.searchPhase);
          }
          if (handoff.filterPills?.length) {
            setFilterPills(handoff.filterPills);
          }
        }
        const title =
          restored.find((m) => m.role === "user")?.content.slice(0, 80) ||
          "FlightOne chat";
        const id = await ensureConversationId(handoff.conversationId, title);
        if (id) {
          setConversationId(id);
          conversationIdRef.current = id;
          if (!handoff.conversationId) {
            await recordGuestHandoffMessages(id, restored, handoff.searchPanel);
          }
        }
        clearChatHandoff();
        return;
      }

      const resume =
        (urlConversationId ? await loadConversationResumeById(urlConversationId) : null) ??
        (await loadLatestConversationResume());
      if (!resume) return;
      setConversationId(resume.conversationId);
      conversationIdRef.current = resume.conversationId;
      setMessages(resume.messages);
      if (resume.travelPlan) {
        setPreviousTravelPlan(resume.travelPlan);
      }
      if (resume.searchPanel) {
        setSearchPanel(resume.searchPanel);
        const lastAssistant = resume.messages
          .slice()
          .reverse()
          .find((m) => m.role === "assistant");
        if (lastAssistant) setSearchResultMessageId(lastAssistant.id);
        if (resume.searchPanel.filterPills?.length) {
          setFilterPills(resume.searchPanel.filterPills);
        }
      }
    })().finally(done);
  }, [hasHydratedAuth, accessToken]);

  // Keep a handoff snapshot so /login → /chat doesn't wipe the active thread.
  useEffect(() => {
    if (messages.length <= 1 && messages[0]?.id === "greet") return;
    saveChatHandoff({
      messages,
      previousTravelPlan,
      conversationId,
      searchPanel,
      searchResultMessageId,
      searchPhase,
      filterPills,
    });
  }, [
    messages,
    previousTravelPlan,
    conversationId,
    searchPanel,
    searchResultMessageId,
    searchPhase,
    filterPills,
  ]);

  useEffect(() => {
    if (!location) return;
    const key = `${location.place}|${location.source}`;
    if (greetedFor === key) return;
    setGreetedFor(key);
    setMessages((prev) => {
      if (prev.length === 1 && prev[0]?.id === "greet") {
        return [buildGreeting(location)];
      }
      return prev;
    });
  }, [location, greetedFor]);

  const displayedOffers = useMemo(() => {
    if (!searchPanel) return [];
    const variantOffers = searchPanel.originVariants?.[activeOriginIdx]?.offers;
    const base = variantOffers?.length ? variantOffers : searchPanel.offers;
    const pillFiltered = applyFilterPills(base, filterPills);
    const sidebarFiltered =
      sidebarFilters && sidebarFacets
        ? applySidebarFiltersToOffers(
            pillFiltered,
            sidebarFilters,
            sidebarFacets,
          )
        : pillFiltered;
    return sortOffers(sidebarFiltered, sortKey);
  }, [
    searchPanel,
    filterPills,
    sidebarFilters,
    sidebarFacets,
    sortKey,
    activeOriginIdx,
  ]);

  const displayedItineraries = useMemo(() => {
    if (!searchPanel?.itineraries?.length) return [];
    const list = searchPanel.itineraries;
    if (!sidebarFilters || !sidebarFacets) return list;
    return applySidebarFiltersToItineraries(
      list,
      sidebarFilters,
      sidebarFacets,
    );
  }, [searchPanel?.itineraries, sidebarFilters, sidebarFacets]);

  useEffect(() => {
    if (!searchPanel) {
      setSidebarFacets(null);
      setSidebarFilters(null);
      return;
    }
    const variantOffers = searchPanel.originVariants?.[activeOriginIdx]?.offers;
    const offers = variantOffers?.length ? variantOffers : searchPanel.offers;
    const facets = buildSidebarFilterFacets(
      offers,
      searchPanel.itineraries ?? [],
    );
    setSidebarFacets(facets);
    setSidebarFilters(
      facets
        ? seedSidebarFiltersFromPills(facets, searchPanel.filterPills)
        : null,
    );
  }, [searchPanel, activeOriginIdx]);

  useEffect(() => {
    setActiveOriginIdx(0);
  }, [searchPanel?.tripTitle, searchPanel?.legRoute]);

  const onTogglePill = useCallback(
    (pillId: string) => {
      setFilterPills((prev) => {
        const next = togglePill(prev, pillId);
        if (sidebarFacets) {
          setSidebarFilters(seedSidebarFiltersFromPills(sidebarFacets, next));
        }
        return next;
      });
    },
    [sidebarFacets],
  );

  const onSidebarFiltersChange = useCallback((next: SidebarFilterState) => {
    setSidebarFilters(next);
  }, []);

  const onClearSidebarFilters = useCallback(() => {
    if (!sidebarFacets) return;
    setSidebarFilters(defaultSidebarFilters(sidebarFacets));
    setFilterPills((prev) => prev.map((p) => ({ ...p, active: false })));
  }, [sidebarFacets]);

  const onSortChange = useCallback((sort: ResultsSortKey) => {
    setSortKey(sort);
  }, []);

  const onTripTitleChange = useCallback((title: string) => {
    setSearchPanel((prev) => (prev ? { ...prev, tripTitle: title } : prev));
  }, []);

  async function persistAuthenticatedTurn(
    userContent: string,
    assistantContent: string,
    replyProvider?: string | null,
    travelPlan?: TravelPlan | null,
    searchPanelData?: SearchResultsPanel | null,
  ) {
    if (!useAuthStore.getState().accessToken) return;
    if (!userContent.trim() || !assistantContent.trim()) return;
    const id = await ensureConversationId(
      conversationIdRef.current,
      userContent.slice(0, 80),
    );
    if (!id) return;
    conversationIdRef.current = id;
    setConversationId(id);
    await recordTurnMessages(
      id,
      userContent,
      assistantContent,
      replyProvider,
      travelPlan !== undefined ? travelPlan : previousTravelPlanRef.current,
      searchPanelData !== undefined ? searchPanelData : searchPanelRef.current,
    );
  }

  async function send(text: string) {
    const trimmed = text.trim();
    // `busy` is React state, so two submits in the same tick both read the
    // stale `false` and both proceed — which persisted the turn twice and
    // rendered duplicate user/assistant bubbles. A ref flips synchronously.
    if (!trimmed || busy || sendInFlightRef.current) return;
    sendInFlightRef.current = true;
    clearActiveTurnTimers();

    const turnId = crypto.randomUUID();
    if (process.env.NODE_ENV === "development") {
      console.log(`[chat] submit id=${turnId}`);
    }
 
    const wantsBestFare = BEST_FARE_RE.test(trimmed);
    if (wantsBestFare) setSortKey("price");

    const userMsg: UiMessage = { 
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: "assistant", content: "" },
    ]);
    setBusy(true);
    setSearchPhase("extract");
    setFollowUpSuggestions([]);

    const history = [...messages, userMsg]
      .filter((m) => m.id !== "greet")
      .map((m) => ({ role: m.role, content: m.content }));

    const defaultOriginPlace = location?.place || location?.city || "Lahore";
    const defaultOriginIata = location?.iata || "LHE";
    const routePreview = previewLoadingRoute(trimmed, {
      today: new Date().toISOString().slice(0, 10),
      defaultOriginIata,
      defaultOriginPlace,
      history,
      previousPlan: previousTravelPlan,
    });
    setLoadingRoute(routePreview);

    const schedule = getPhaseSchedule(trimmed, {
      hasRoute: Boolean(routePreview?.origin && routePreview?.destination),
      previousPlan: previousTravelPlan,
    });
    const startTime = Date.now();

    // Schedule natural state transitions across the processing duration
    const tSearch = setTimeout(() => {
      setSearchPhase("search");
    }, schedule.extractUntilMs);

    const tReply = setTimeout(() => {
      setSearchPhase("reply");
    }, schedule.searchUntilMs);

    activeTurnTimersRef.current = [tSearch, tReply];

    const keepPriceSort = (
      panel: NonNullable<AskAiChatResult["searchPanel"]>,
    ) => {
      if (
        wantsBestFare &&
        panel.multiCity &&
        (panel.itineraries?.length ?? 0) > 0
      ) {
        setSortKey((prev) => (prev === "angle" ? "price" : prev));
      }
    };

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (process.env.NODE_ENV === "development") {
        console.log(
          `[chat] request id=${turnId}, targetDuration=${schedule.totalDurationMs}ms`,
        );
      }
      const accessToken = useAuthStore.getState().accessToken;
      const escalationTrigger = accessToken ? detectEscalationIntent(trimmed) : null;
      if (escalationTrigger) {
        const id = await ensureConversationId(
          conversationIdRef.current,
          trimmed.slice(0, 80),
        );
        if (id) {
          conversationIdRef.current = id;
          setConversationId(id);
          // Persist prior turns + this user message BEFORE creating the ticket
          // so the handoff snapshot includes the request that triggered escalation.
          await recordGuestHandoffMessages(id, [...messages, userMsg]);
          const ticket = await requestConversationEscalation(id, {
            trigger: escalationTrigger,
            note: trimmed.slice(0, 500),
          });
          if (ticket) {
            const reply = honestHandoffReply({
              trigger: escalationTrigger,
              escalationId: ticket.id,
              status: ticket.status,
              deduplicated: ticket.deduplicated,
            });
            clearActiveTurnTimers();
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: reply, provider: "escalation" }
                  : m,
              ),
            );
            setBusy(false);
            setSearchPhase("done");
            setLoadingRoute(null);
            await recordAssistantMessage(id, reply, "escalation");
            return;
          }
        }
        // Fall through to Ava if escalate API failed (e.g. network) — guidance still applies.
      }
      const corp = useCorporateProfileStore.getState();
      const res = await fetch("/api/chat", {
        signal: controller.signal,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...(corp.mode === "CORPORATE" && corp.companyId
            ? {
                "X-FlightOne-Profile": "CORPORATE",
                "X-FlightOne-Company-Id": corp.companyId,
              }
            : {}),
        },
        body: JSON.stringify({
          message: trimmed,
          history,
          location,
          previousTravelPlan,
          stream: true,
          turnId,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      if (process.env.NODE_ENV === "development") {
        console.log(`[chat] response id=${turnId}`);
      }

      // Stage all incoming data during processing without premature reveal
      const staged = {
        reply: "",
        provider: null as string | null,
        searchPanel: null as SearchResultsPanel | null,
        travelPlan: undefined as TravelPlan | null | undefined,
        followUpSuggestions: [] as string[],
        error: null as string | null,
      };

      const ctype = res.headers.get("content-type") || "";
      if (!ctype.includes("text/event-stream") || !res.body) {
        const json = (await res.json()) as ConsultantResponse;
        staged.reply = json.reply;
        staged.provider = json.meta.provider;
        staged.searchPanel = json.searchPanel ?? null;
        staged.travelPlan = json.meta.travelPlan;
        staged.followUpSuggestions = json.searchPanel?.followUpSuggestions ?? [];
      } else {
        await readSse(res.body, (event) => {
          if (event.type === "searchResults") {
            const panel = event.panel;
            staged.searchPanel = panel;
            staged.followUpSuggestions = panel.followUpSuggestions ?? [];
            if (event.meta?.travelPlan !== undefined) {
              staged.travelPlan = event.meta.travelPlan ?? null;
              const fromPlan = routeCodesFromTravelPlan(event.meta.travelPlan ?? null);
              if (fromPlan) setLoadingRoute(fromPlan);
            }
            if (event.meta?.provider) {
              staged.provider = event.meta.provider;
            }
            return;
          }
          if (event.type === "token") {
            staged.reply += event.delta;
            return;
          }
          if (event.type === "done") {
            if (event.result.reply) staged.reply = event.result.reply;
            if (event.result.meta?.provider) staged.provider = event.result.meta.provider;
            if (event.result.meta?.travelPlan !== undefined) staged.travelPlan = event.result.meta.travelPlan ?? null;
            if (event.result.searchPanel) {
              staged.searchPanel = event.result.searchPanel;
              if (event.result.searchPanel.followUpSuggestions) {
                staged.followUpSuggestions = event.result.searchPanel.followUpSuggestions;
              }
            }
            return;
          }
          if (event.type === "error") {
            staged.error = event.message;
          }
        });
      }

      if (staged.error) {
        clearActiveTurnTimers();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: staged.error || networkErrorReply() }
              : m,
          ),
        );
        setSearchPhase("done");
        setLoadingRoute(null);
        return;
      }

      // Check remaining delay to provide realistic AI processing experience
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, schedule.totalDurationMs - elapsed);

      if (remaining > 0) {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(resolve, remaining);
          const onAbort = () => {
            clearTimeout(timeout);
            reject(new DOMException("Aborted", "AbortError"));
          };
          controller.signal.addEventListener("abort", onAbort, { once: true });
        });
      }

      // Completed naturally: clean up timers and commit staged results in one atomic reveal
      clearActiveTurnTimers();

      const finalReply = staged.reply || "Here are the best options for your trip.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: finalReply,
                provider: staged.provider,
              }
            : m,
        ),
      );

      if (staged.provider) setProvider(staged.provider);
      if (staged.travelPlan !== undefined) {
        setPreviousTravelPlan(staged.travelPlan ?? null);
        const fromPlan = routeCodesFromTravelPlan(staged.travelPlan ?? null);
        if (fromPlan) setLoadingRoute(fromPlan);
      }

      if (staged.searchPanel && isLiveSearchPanel(staged.searchPanel)) {
        const incomingCount =
          (staged.searchPanel.offers?.length ?? 0) + (staged.searchPanel.itineraries?.length ?? 0);
        setSearchPanel((prev) => {
          const prevCount =
            (prev?.offers?.length ?? 0) + (prev?.itineraries?.length ?? 0);
          if (incomingCount === 0 && prevCount > 0) return prev;
          return staged.searchPanel;
        });
        setSearchResultMessageId(assistantId);
        if (incomingCount > 0) {
          setFilterPills(staged.searchPanel.filterPills);
        }
        keepPriceSort(staged.searchPanel);
      }

      if (staged.followUpSuggestions.length > 0) {
        setFollowUpSuggestions(staged.followUpSuggestions);
      }

      setSearchPhase("done");
      setLoadingRoute(null);

      if (trimmed && finalReply.trim()) {
        void persistAuthenticatedTurn(
          trimmed,
          finalReply,
          staged.provider,
          staged.travelPlan !== undefined ? staged.travelPlan : previousTravelPlanRef.current,
          staged.searchPanel ?? searchPanelRef.current,
        );
      }
    } catch (err) {
      clearActiveTurnTimers();
      // A user-initiated stop is not a failure — replace the empty bubble with
      // an honest note rather than a network-error message they didn't cause.
      if ((err as Error)?.name === "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content || "Search stopped." }
              : m,
          ),
        );
        setSearchPhase("done");
        setLoadingRoute(null);
        return;
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: m.content || networkErrorReply() }
            : m,
        ),
      );
      setSearchPhase("done");
      setLoadingRoute(null);
    } finally {
      clearActiveTurnTimers();
      setBusy(false);
      sendInFlightRef.current = false;
      abortRef.current = null;
    }
  }

  /** Abandon the in-flight search. No-op when nothing is running. */
  function stop() {
    clearActiveTurnTimers();
    abortRef.current?.abort();
  }

  /**
   * Surface an out-of-band failure (e.g. checkout couldn't start) in the
   * transcript. Local-only — not persisted, since it isn't a model turn.
   */
  function pushAssistantNotice(text: string) {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "assistant", content: text },
    ]);
  }

  /**
   * Re-run a turn from an edited user message. Everything from that message
   * onward is dropped first, so the thread stays a truthful transcript rather
   * than accumulating an edited message beside its original answer.
   */
  function editAndResend(messageId: string, nextText: string) {
    const trimmed = nextText.trim();
    if (!trimmed || busy || sendInFlightRef.current) return;
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx < 0) return;
    setMessages((prev) => prev.slice(0, idx));
    void send(trimmed);
  }

  /** Re-ask the most recent user message — for a failed or unhelpful answer. */
  function retryLastTurn() {
    if (busy || sendInFlightRef.current) return;
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    editAndResend(lastUser.id, lastUser.content);
  }

  return {
    messages,
    busy,
    provider,
    send,
    stop,
    pushAssistantNotice,
    editAndResend,
    retryLastTurn,
    searchPanel,
    searchPhase,
    searchResultMessageId,
    filterPills,
    sortKey,
    displayedOffers,
    displayedItineraries,
    sidebarFilters,
    sidebarFacets,
    activeOriginIdx,
    onOriginChange: setActiveOriginIdx,
    followUpSuggestions,
    onTogglePill,
    onSidebarFiltersChange,
    onClearSidebarFilters,
    onSortChange,
    onTripTitleChange,
    loadingRoute,
    conversationId,
    restored,
    resumeConversationById: async (id: string) => {
      const resume = await loadConversationResumeById(id);
      if (!resume) return false;
      setConversationId(resume.conversationId);
      conversationIdRef.current = resume.conversationId;
      setMessages(resume.messages);
      if (resume.travelPlan) setPreviousTravelPlan(resume.travelPlan);
      if (resume.searchPanel) {
        setSearchPanel(resume.searchPanel);
        const lastAssistant = resume.messages
          .slice()
          .reverse()
          .find((m) => m.role === "assistant");
        if (lastAssistant) setSearchResultMessageId(lastAssistant.id);
        if (resume.searchPanel.filterPills?.length) {
          setFilterPills(resume.searchPanel.filterPills);
        }
      } else {
        setSearchPanel(null);
        setSearchResultMessageId(null);
        setFilterPills([]);
      }
      return true;
    },
    startNewChat: () => {
      setConversationId(null);
      conversationIdRef.current = null;
      setMessages([location ? buildGreeting(location) : GREETING]);
      setPreviousTravelPlan(null);
      previousTravelPlanRef.current = null;
      setSearchPanel(null);
      setSearchPhase("idle");
      setFilterPills([]);
      setSidebarFilters(null);
      setSidebarFacets(null);
      setFollowUpSuggestions([]);
      setLoadingRoute(null);
      setSearchResultMessageId(null);
      clearChatHandoff();
    },
  };
}

async function readSse(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: ConsultantStreamEvent) => void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      for (const rawLine of block.split("\n")) {
        const line = rawLine.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        try {
          onEvent(JSON.parse(payload) as ConsultantStreamEvent);
        } catch {
          // skip malformed
        }
      }
    }
  }
}
