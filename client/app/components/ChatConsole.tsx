"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { formatPriceMinor } from "@/lib/ask-ai/sidebarFilters";
import {
  canShowResultsWorkspace,
  countPanelInventory,
  deriveChatResultsState,
} from "@/lib/ask-ai/chatResultsState";
import { useTravellerLocation } from "./useTravellerLocation";
import { AskAiShell, useAskAiChat, type AskAiView } from "./ask-ai";
import { ChatLayout } from "./ChatLayout";
import { useAuthStore } from "@/store/auth.store";
import { useCorporateProfileStore } from "@/store/corporateProfile.store";
import { offerHasQuoteSnapshot, quotePayloadFromOffer } from "@/lib/bookings/quoteFromOffer";
import {
  useListConversationsQuery,
  useDeleteConversationMutation,
} from "@/lib/api/conversations.api";
import { ChatSidebar } from "./chat/ChatSidebar";

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
          onBookOffer={(offer) => {
            if (!offerHasQuoteSnapshot(offer)) {
              setView("chat");
              chat.send(
                `I'd like to book ${offer.title} at ${offer.price}. This option isn't quote-ready yet — search while signed in so we can lock a live fare.`,
              );
              return;
            }
            const accessToken = useAuthStore.getState().accessToken;
            if (!accessToken) {
              window.location.href = `/login?redirect=${encodeURIComponent("/chat")}`;
              return;
            }
            void (async () => {
              try {
                const corp = useCorporateProfileStore.getState();
                const payload = quotePayloadFromOffer(
                  offer,
                  corp.mode === "CORPORATE" && corp.companyId
                    ? { companyId: corp.companyId }
                    : undefined,
                );
                const res = await fetch("/api/bookings/quote", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                  },
                  body: JSON.stringify(payload),
                });
                const json = await res.json().catch(() => null);
                if (!res.ok) {
                  setView("chat");
                  chat.send(
                    `I couldn't start checkout for ${offer.title}: ${json?.error || json?.message || "quote failed"}.`,
                  );
                  return;
                }
                const bookingId = json?.data?.id;
                if (!bookingId) {
                  setView("chat");
                  chat.send(`Quote succeeded but no booking id was returned for ${offer.title}.`);
                  return;
                }
                window.location.href = `/checkout/${bookingId}`;
              } catch (err) {
                setView("chat");
                chat.send(
                  `I couldn't start checkout for ${offer.title}: ${err instanceof Error ? err.message : "quote failed"}.`,
                );
              }
            })();
          }}
          onBookTrip={(itinerary) => {
            setView("chat");
            chat.send(
              `I'd like to book this complete trip (${itinerary.hops.join(" → ")}) at ${itinerary.totalPrice}`,
            );
          }}
          chat={
            <ChatLayout
              messages={chat.messages}
              busy={chat.busy}
              searchPhase={chat.searchPhase}
              onSend={chat.send}
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
            />
          }
        />
      </div>
    </div>
  );
}
