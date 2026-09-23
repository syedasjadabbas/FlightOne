"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import type { OfferCard } from "@/lib/consultant/types";
import { formatPriceMinor } from "@/lib/ask-ai/sidebarFilters";
import {
  canShowResultsWorkspace,
  countPanelInventory,
  deriveChatResultsState,
} from "@/lib/ask-ai/chatResultsState";
import { useTravellerLocation } from "./useTravellerLocation";
import { AskAiShell, useAskAiChat, type AskAiView } from "./ask-ai";
import type { DetailSelection } from "./ask-ai/AskAiShell";
import {
  EMPTY_CHAT_URL_STATE,
  buildChatSearch,
  parseChatUrlState,
  rememberChatUrl,
} from "@/lib/ask-ai/chatUrlState";
import { ChatLayout } from "./ChatLayout";
import { useAuthStore } from "@/store/auth.store";
import {
  stashPendingCheckout,
  startCheckout,
  takePendingCheckout,
} from "@/lib/bookings/startCheckout";
import { offerCardFromItinerary } from "@/lib/bookings/offerFromItinerary";
import { useCorporateProfileStore } from "@/store/corporateProfile.store";
import {
  useListConversationsQuery,
  useDeleteConversationMutation,
} from "@/lib/api/conversations.api";
import { ChatSidebar } from "./chat/ChatSidebar";
import { GuestBanner } from "./GuestBanner";
import { VoiceMicButton } from "./voice/VoiceMicButton";
import { PredictiveSuggestions } from "./ask-ai/PredictiveSuggestions";

/** Ava — full chat workspace + full results workspace (state preserved). */
export function ChatConsole() {
  const { location, ready: locationReady } = useTravellerLocation();
  const chat = useAskAiChat(location);
  const [view, setView] = useState<AskAiView>("chat");
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [deleteConversation] = useDeleteConversationMutation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [resumingId, setResumingId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const initialQueryHandledRef = useRef(false);

  // --- URL state: Back from checkout lands on the same results + open deal ---
  // Read once at mount; the URL is rewritten below as the traveller moves.
  const [initialUrlState] = useState(() =>
    typeof window === "undefined"
      ? EMPTY_CHAT_URL_STATE
      : parseChatUrlState(window.location.search),
  );
  const [detail, setDetail] = useState<DetailSelection>({ offerId: null, tripId: null });
  const [restoreDetail, setRestoreDetail] = useState<DetailSelection | null>(null);
  /**
   * False until the URL's view / open deal has been re-applied (or ruled out).
   * URL writes wait on it — writing earlier would replace `view=results&offer=…`
   * with the empty mount state before it was ever read.
   */
  const [urlApplied, setUrlApplied] = useState(false);

  const handleDeleteConversation = async (id: string) => {
    try {
      await deleteConversation(id).unwrap();
      if (chat.conversationId === id) {
        chat.startNewChat();
        setView("chat");
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  const handleDeleteCurrentChat = async () => {
    if (chat.conversationId) {
      await handleDeleteConversation(chat.conversationId);
    } else {
      chat.startNewChat();
      setView("chat");
    }
  };

  // Handle new chat intent from navbar Ava click or query param
  useEffect(() => {
    const isNew = searchParams.get("new");
    if (isNew === "true" || isNew === "1") {
      chat.startNewChat();
      setView("chat");
    }
  }, [searchParams]);

  useEffect(() => {
    const handleNewChat = () => {
      chat.startNewChat();
      setView("chat");
    };
    window.addEventListener("flightone:new-chat", handleNewChat);
    return () => window.removeEventListener("flightone:new-chat", handleNewChat);
  }, [chat.startNewChat]);

  // Auto-run query passed from public travel homepage search widget or trending card
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !initialQueryHandledRef.current && !chat.busy) {
      initialQueryHandledRef.current = true;
      void chat.send(q);
    }
  }, [searchParams, chat.busy, chat.send]);

  // Default sidebar to open on desktop screens, close on tablet/mobile
  useEffect(() => {
    function handleResize() {
      if (typeof window !== "undefined") {
        if (window.innerWidth >= 1024) {
          setIsSidebarOpen(true);
        } else {
          setIsSidebarOpen(false);
        }
      }
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const { data: conversations, isLoading: conversationsLoading } = useListConversationsQuery(
    { page: 1, pageSize: 50 },
    { skip: !hasHydrated || !accessToken },
  );

  const resultCount = useMemo(
    () =>
      Math.max(
        countPanelInventory(chat.searchPanel, chat.activeOriginIdx),
        chat.displayedOffers.length,
      ),
    [chat.searchPanel, chat.activeOriginIdx, chat.displayedOffers.length],
  );

  const latestAssistantId = useMemo(() => {
    for (let i = chat.messages.length - 1; i >= 0; i -= 1) {
      if (chat.messages[i]?.role === "assistant") return chat.messages[i].id;
    }
    return null;
  }, [chat.messages]);

  const chatResultsState = useMemo(
    () =>
      deriveChatResultsState({
        busy: chat.busy,
        searchPhase: chat.searchPhase,
        searchPanel: chat.searchPanel,
        resultCount,
        searchResultMessageId: chat.searchResultMessageId,
        latestAssistantId,
      }),
    [
      chat.busy,
      chat.searchPhase,
      chat.searchPanel,
      resultCount,
      chat.searchResultMessageId,
      latestAssistantId,
    ],
  );

  const resultsWorkspaceAvailable = useMemo(
    () =>
      canShowResultsWorkspace({
        searchPanel: chat.searchPanel,
        resultCount,
        busy: chat.busy,
        searchPhase: chat.searchPhase,
      }),
    [chat.searchPanel, resultCount, chat.busy, chat.searchPhase],
  );

  // Re-apply the URL's view and open deal once the thread is back in memory.
  const urlRestoreStartedRef = useRef(false);
  useEffect(() => {
    if (!chat.restored || urlApplied || urlRestoreStartedRef.current) return;
    urlRestoreStartedRef.current = true;
    if (initialUrlState.view === "results" && resultsWorkspaceAvailable) {
      // Syncing from an external source (the URL) once the async session
      // restore lands — the case this rule carves out, run exactly once.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setView("results");
      if (initialUrlState.offerId || initialUrlState.tripId) {
        // AskAiShell reopens the modal, then reports back via onRestoreDetailDone.
        setRestoreDetail({
          offerId: initialUrlState.offerId,
          tripId: initialUrlState.tripId,
        });
        return;
      }
    }
    setUrlApplied(true);
  }, [chat.restored, urlApplied, initialUrlState, resultsWorkspaceAvailable]);

  // Mirror conversation / view / open deal into the URL. replaceState, not
  // push: moving around inside chat should not stack Back presses — the entry
  // that matters is the one checkout returns to.
  useEffect(() => {
    if (!urlApplied) return;
    const next = `${window.location.pathname}${buildChatSearch(
      {
        conversationId: chat.conversationId,
        view,
        offerId: detail.offerId,
        tripId: detail.tripId,
      },
      window.location.search,
    )}`;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, "", next);
    }
    rememberChatUrl(next);
  }, [urlApplied, chat.conversationId, view, detail]);

  const resultNoun = useMemo(() => {
    const panel = chat.searchPanel;
    const trips = panel?.itineraries?.length ?? 0;
    if (panel?.multiCity && trips > 0) return trips === 1 ? "trip" : "trips";
    return resultCount === 1 ? "flight" : "flights";
  }, [chat.searchPanel, resultCount]);

  const destinationLabel = useMemo(() => {
    const panel = chat.searchPanel;
    if (!panel) return null;
    const offers =
      panel.originVariants?.[chat.activeOriginIdx]?.offers ?? panel.offers ?? [];
    const city = offers.find((o) => o.flight?.destinationCity)?.flight?.destinationCity;
    if (city) return city;
    const route = panel.legRoute;
    if (!route) return null;
    const segment = route.split("→").pop()?.trim();
    return segment || null;
  }, [chat.searchPanel, chat.activeOriginIdx]);

  const fromPrice = useMemo(() => {
    const panel = chat.searchPanel;
    if (!panel) return null;
    const offers =
      panel.originVariants?.[chat.activeOriginIdx]?.offers ?? panel.offers ?? [];
    let min = Number.POSITIVE_INFINITY;
    let currency = "PKR";
    for (const offer of offers) {
      if (offer.priceMinor > 0 && offer.priceMinor < min) {
        min = offer.priceMinor;
        currency = offer.currency;
      }
    }
    if (!Number.isFinite(min)) {
      const trips = panel.itineraries ?? [];
      for (const trip of trips) {
        if (trip.totalPriceMinor > 0 && trip.totalPriceMinor < min) {
          min = trip.totalPriceMinor;
          currency = trip.currency;
        }
      }
    }
    if (!Number.isFinite(min)) return null;
    return formatPriceMinor(min, currency);
  }, [chat.searchPanel, chat.activeOriginIdx]);

  const handleQuoteAndCheckout = async (offerToBook: OfferCard, token: string) => {
    const corp = useCorporateProfileStore.getState();
    const result = await startCheckout(offerToBook, token, {
      ...(corp.mode === "CORPORATE" && corp.companyId ? { companyId: corp.companyId } : {}),
    });
    // Every failure path used to `return` after a console.error. The detail
    // modal had already closed, so the user landed back in chat with no
    // explanation and no way to tell a stale quote from a real outage.
    if (!result.ok) {
      chat.pushAssistantNotice(result.message);
      return { navigating: false };
    }
    window.location.href = `/checkout/${result.bookingId}`;
    // Navigation is scheduled, not immediate — tell the caller to keep its UI
    // mounted so nothing repaints before the browser leaves this page.
    return { navigating: true };
  };

  // Resume a checkout stashed before a login that landed somewhere other than
  // /checkout/resume (e.g. an old bookmarked redirect). The resume route is
  // the normal path; this is the safety net.
  useEffect(() => {
    if (!hasHydrated || !accessToken) return;
    const pendingOffer = takePendingCheckout();
    if (pendingOffer) void handleQuoteAndCheckout(pendingOffer, accessToken);
    // Resume fires once when auth settles. `handleQuoteAndCheckout` is
    // recreated each render, so listing it here would re-run the redirect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated, accessToken]);

  return (
    <div className="fo-chat-console relative flex min-h-0 min-w-0 w-full flex-row overflow-hidden">
      {view === "chat" && (
        <ChatSidebar
          conversations={conversations?.items ?? []}
          activeConversationId={chat.conversationId}
          isLoading={conversationsLoading}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onSelectConversation={(id) => {
            setResumingId(id);
            void chat.resumeConversationById(id).finally(() => {
              setResumingId(null);
              if (typeof window !== "undefined" && window.innerWidth < 1024) {
                setIsSidebarOpen(false);
              }
            });
          }}
          onNewChat={() => {
            chat.startNewChat();
            setView("chat");
            if (typeof window !== "undefined" && window.innerWidth < 1024) {
              setIsSidebarOpen(false);
            }
          }}
          onDeleteConversation={handleDeleteConversation}
          resumingId={resumingId}
        />
      )}

      <div className="flex-1 flex min-h-0 min-w-0 flex-col overflow-hidden">
        <AskAiShell
          panel={chat.searchPanel}
          displayedOffers={chat.displayedOffers}
          displayedItineraries={chat.displayedItineraries}
          sidebarFilters={chat.sidebarFilters}
          sidebarFacets={chat.sidebarFacets}
          onSidebarFiltersChange={chat.onSidebarFiltersChange}
          onClearSidebarFilters={chat.onClearSidebarFilters}
          busy={chat.busy}
          searchPhase={chat.searchPhase}
          filterPills={chat.filterPills}
          sortKey={chat.sortKey}
          activeOriginIdx={chat.activeOriginIdx}
          onOriginChange={chat.onOriginChange}
          onTogglePill={chat.onTogglePill}
          onSortChange={chat.onSortChange}
          onTripTitleChange={chat.onTripTitleChange}
          onSendFilter={chat.send}
          view={view}
          onViewChange={setView}
          resultsWorkspaceAvailable={resultsWorkspaceAvailable}
          conversationId={chat.conversationId}
          restoreDetail={restoreDetail}
          onRestoreDetailDone={() => {
            setRestoreDetail(null);
            setUrlApplied(true);
          }}
          onDetailChange={setDetail}
          onBookOffer={(offer) => {
            const currentToken = useAuthStore.getState().accessToken;
            if (!currentToken) {
              stashPendingCheckout(offer);
              // Return to the dedicated resume route, not /chat — landing on
              // chat mounted the whole console before bouncing to traveller
              // details, which read as "View Deal goes back to chat".
              window.location.href = `/login?redirect=${encodeURIComponent("/checkout/resume")}`;
              // Also a scheduled navigation — keep the modal up rather than
              // flashing the results screen on the way to login.
              return { navigating: true };
            }
            return handleQuoteAndCheckout(offer, currentToken);
          }}
          onBookTrip={(itinerary) => {
            // Same flow as a single-leg offer: quote and go to checkout. This
            // used to bounce back to chat and send a message, which is why
            // multi-city looked like a different product.
            const offer = offerCardFromItinerary(itinerary);
            if (!offer) {
              chat.pushAssistantNotice(
                "That trip has no bookable supplier fare on its first leg. Try a different trip or date.",
              );
              return { navigating: false };
            }
            const currentToken = useAuthStore.getState().accessToken;
            if (!currentToken) {
              stashPendingCheckout(offer);
              window.location.href = `/login?redirect=${encodeURIComponent("/checkout/resume")}`;
              return { navigating: true };
            }
            return handleQuoteAndCheckout(offer, currentToken);
          }}
          chat={
            <ChatLayout
              messages={chat.messages}
              busy={chat.busy}
              onStop={chat.stop}
              searchPhase={chat.searchPhase}
              onSend={chat.send}
              banner={<GuestBanner />}
              location={location}
              locationReady={locationReady}
              followUpSuggestions={chat.followUpSuggestions}
              chatResultsState={chatResultsState}
              resultCount={resultCount}
              resultNoun={resultNoun}
              destinationLabel={destinationLabel}
              fromPrice={fromPrice}
              onOpenResults={() => setView("results")}
              loadingRoute={chat.loadingRoute}
              onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
              isSidebarOpen={isSidebarOpen}
              onDeleteChat={handleDeleteCurrentChat}
              composerAccessory={
                <VoiceMicButton
                  conversationId={chat.conversationId}
                  onTranscript={(text) => chat.send(text)}
                />
              }
              heroAccessory={<PredictiveSuggestions onSearch={(text) => chat.send(text)} />}
            />
          }
        />
      </div>
    </div>
  );
}
