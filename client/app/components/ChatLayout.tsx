"use client";

import { useMemo, useRef, useState, useEffect, type ReactNode } from "react";
import { HeroScene } from "@/components/travel/TravelDoodles";
import type { SearchPhase } from "@/lib/ask-ai/types";
import type { LoadingRouteCodes } from "@/lib/ask-ai/loadingRoute";
import type { ChatResultsState } from "@/lib/ask-ai/chatResultsState";
import type { TravellerLocation } from "@/lib/geo/types";
import { MessageBubble } from "./MessageBubble";
import { ThinkingProgress, useThinkingStep } from "./ThinkingProgress";
import type { UiMessage } from "./chat.types";
import { useChatAutoScroll } from "./useChatAutoScroll";
import { useChatViewportLayout } from "./useChatViewportLayout";
import { useLandingDocumentFit } from "./useLandingDocumentFit";
import { BrandMark } from "./chat/BrandMark";
import { ResultsMessageFooter } from "./chat/ResultsMessageFooter";
import { SearchErrorFooter, isTravelSearchError } from "./chat/SearchErrorFooter";
const DESTINATION_CARDS = [
  {
    id: "dubai",
    category: "Explore",
    title: "Dubai",
    actionText: "Flights, hotels & more →",
    image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=600&q=80",
    prompt: "I want to explore flights and hotel options for a trip to Dubai",
    icon: (
      <svg className="h-4 w-4 -rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    ),
  },
  {
    id: "istanbul",
    category: "Discover",
    title: "Istanbul",
    actionText: "City breaks & experiences →",
    image: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=600&q=80",
    prompt: "Plan a weekend city break to Istanbul with best flight options and stays",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    id: "family-trip",
    category: "Plan a",
    title: "Family Trip",
    actionText: "Flights, hotels & activities →",
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80",
    prompt: "Plan a relaxing family vacation trip with flights, resort stays, and activities",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: "japan",
    category: "Visit",
    title: "Japan",
    actionText: "Itineraries & travel tips →",
    image: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80",
    prompt: "Best itinerary, flight deals, and travel recommendations for Japan",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
      </svg>
    ),
  },
];

const QUICK_ACTION_BUTTONS = [
  {
    label: "Search flights",
    prompt: (origin: string) => `Find best flight fares from ${origin}`,
    icon: (
      <svg className="h-4 w-4 text-[#009ee2] -rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    ),
  },
  {
    label: "Find hotels",
    prompt: () => "Find top-rated hotels and stays for my next destination",
    icon: (
      <svg className="h-4 w-4 text-[#009ee2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: "Plan an itinerary",
    prompt: () => "Help me plan a multi-city travel itinerary with stopovers",
    icon: (
      <svg className="h-4 w-4 text-[#009ee2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
  },
  {
    label: "Compare options",
    prompt: () => "Compare flight options and cabin classes for my trip",
    icon: (
      <svg className="h-4 w-4 text-[#009ee2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
  {
    label: "More",
    prompt: () => "What travel tools, visa rules, and services can Ava assist with?",
    icon: (
      <svg className="h-4 w-4 text-[#009ee2]" fill="currentColor" viewBox="0 0 20 20">
        <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
      </svg>
    ),
  },
];

const COMPOSER_QUICK_ACTIONS = [
  {
    label: "Compare alternatives",
    prompt: (origin: string) => `What other flight options or airlines fly from ${origin}?`,
  },
  {
    label: "Filter by direct flights",
    prompt: () => "Show me only non-stop direct flights with shortest duration",
  },
  {
    label: "Hotel recommendations",
    prompt: () => "What are the best hotel and resort areas near the city center?",
  },
];

const RECOVERY_QUICK_ACTIONS = [
  {
    label: "Try flexible dates (±3 days)",
    prompt: (origin: string) => `Search with flexible dates ±3 days from ${origin}`,
  },
  {
    label: "Try nearby airports",
    prompt: (origin: string) => `Search nearby departure and arrival airports for ${origin}`,
  },
];

/** Conversational panel — full-viewport messaging workspace. */
export function ChatLayout({
  messages,
  busy,
  searchPhase = "idle",
  onSend,
  banner,
  location,
  locationReady,
  followUpSuggestions = [],
  chatResultsState = "idle",
  resultCount = 0,
  resultNoun = "flights",
  destinationLabel = null,
  fromPrice = null,
  onOpenResults,
  loadingRoute = null,
  onToggleSidebar,
  isSidebarOpen,
  onDeleteChat,
}: {
  messages: UiMessage[];
  busy: boolean;
  searchPhase?: SearchPhase;
  onSend: (text: string) => void;
  banner?: ReactNode;
  location?: TravellerLocation | null;
  locationReady?: boolean;
  followUpSuggestions?: string[];
  chatResultsState?: ChatResultsState;
  resultCount?: number;
  resultNoun?: string;
  destinationLabel?: string | null;
  fromPrice?: string | null;
  onOpenResults?: () => void;
  loadingRoute?: LoadingRouteCodes | null;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  onDeleteChat?: () => void;
}) {
  const [input, setInput] = useState("");
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const composerDockRef = useRef<HTMLElement>(null);

  const originCity = location?.place || location?.city || "your city";
  const isActiveChat = messages.some((m) => m.role === "user");
  const showHero = !isActiveChat && messages.length === 1;

  useEffect(() => {
    if (!isActiveChat) {
      setShowConfirmDelete(false);
    }
  }, [isActiveChat]);

  const thinkingPhase: SearchPhase =
    !busy || searchPhase === "idle" || searchPhase === "done" ? "extract" : searchPhase;
  const thinkingLabel = useThinkingStep(thinkingPhase, busy, loadingRoute);
  const lastMessage = messages[messages.length - 1];

  const resultsTick =
    chatResultsState === "results"
      ? resultCount + (fromPrice?.length ?? 0)
      : chatResultsState === "searching"
        ? 1
        : 0;

  const { scrollRef, bottomRef, showJumpToLatest, jumpToLatest } = useChatAutoScroll({
    messageCount: messages.length,
    lastMessageRole: lastMessage?.role,
    lastMessageLength: lastMessage?.content?.length ?? 0,
    busy,
    resultsTick,
    searchPhase: thinkingPhase,
  });

  const latestAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === "assistant") return messages[i].id;
    }
    return null;
  }, [messages]);

  const showResultsOnLatest =
    (chatResultsState === "results" || resultCount > 0) &&
    latestAssistantId != null;

  const lastUserText = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === "user" && messages[i].content?.trim()) {
        return messages[i].content.trim();
      }
    }
    return null;
  }, [messages]);

  const latestIsSearchError =
    !busy &&
    lastMessage?.role === "assistant" &&
    Boolean(lastMessage.content) &&
    isTravelSearchError(lastMessage.content);

  const showErrorOnLatest =
    latestIsSearchError && latestAssistantId != null && Boolean(lastUserText);

  const showLoadingBubble =
    busy && (lastMessage?.role !== "assistant" || !lastMessage.content?.trim());

  const followUps =
    !busy &&
    isActiveChat &&
    lastMessage?.role === "assistant" &&
    Boolean(lastMessage.content) &&
    !latestIsSearchError
      ? followUpSuggestions.slice(0, 3)
      : [];

  const showStaticQuickActions =
    !busy &&
    isActiveChat &&
    lastMessage?.role === "assistant" &&
    Boolean(lastMessage.content) &&
    followUps.length === 0 &&
    !latestIsSearchError;

  const showRecoveryActions = latestIsSearchError && !busy;

  function submit(text: string) {
    if (!text.trim() || busy) return;
    onSend(text);
    setInput("");
    inputRef.current?.focus();
  }

  function retryLastSearch() {
    if (!lastUserText || busy) return;
    submit(lastUserText);
  }

  const locationLabel = !locationReady
    ? "Finding your city…"
    : `From ${originCity}${location?.currency ? ` · ${location.currency}` : ""}`;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("fo-chat-active", isActiveChat);
    document.body.classList.toggle("fo-chat-active", isActiveChat);
    root.classList.toggle("fo-chat-landing", !isActiveChat);
    return () => {
      root.classList.remove("fo-chat-active", "fo-chat-landing");
      document.body.classList.remove("fo-chat-active");
    };
  }, [isActiveChat]);

  useChatViewportLayout(isActiveChat, composerDockRef);
  useLandingDocumentFit(!isActiveChat);

  return (
    <div
      className={`ava-chat chat-page relative flex min-h-0 w-full min-w-0 flex-col bg-gradient-to-b from-[#eef6fc] via-[#f5f9fd] to-[#f8fafc] overflow-hidden ${
        isActiveChat ? "chat-page--active" : "chat-page--landing"
      }`}
    >
      {/* Background Travel Atmosphere Visual (Landing & Chatting) */}
      <div
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none"
        aria-hidden="true"
      >
        {/* Airplane wing visual clearly visible in upper-right fading softly leftward */}
        <div
          className="absolute top-0 right-0 w-full sm:w-[75%] md:w-[64%] lg:w-[54%] xl:w-[48%] h-[80%] max-h-[600px] opacity-80 sm:opacity-90 lg:opacity-95 transition-opacity duration-500 ease-out"
          style={{
            backgroundImage: `url('/images/chat-bg-airplane.jpg')`,
            backgroundPosition: "top right",
            backgroundSize: "cover",
            backgroundRepeat: "no-repeat",
            maskImage:
              "radial-gradient(ellipse 90% 85% at 90% 15%, black 45%, rgba(0,0,0,0.65) 70%, rgba(0,0,0,0.15) 90%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 90% 85% at 90% 15%, black 45%, rgba(0,0,0,0.65) 70%, rgba(0,0,0,0.15) 90%, transparent 100%)",
          }}
        />
        {/* Soft ambient gradient overlay ensuring left-side text has 100% contrast */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#eef6fc] via-[#eef6fc]/50 to-transparent pointer-events-none" />
      </div>

      <div className="chat-page__inner relative z-10 flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
        {/* Chat Header Status Bar */}
        <header className="chat-page__header shrink-0 min-w-0 px-4 sm:px-6 lg:px-8 xl:px-10 pt-3 pb-1.5 sm:pt-4 sm:pb-2">
          <div className="w-full max-w-6xl mx-auto flex items-center justify-between">
            {isActiveChat ? (
              <>
                <div className="flex items-center gap-3">
                  {onToggleSidebar && (
                    <button
                      type="button"
                      onClick={onToggleSidebar}
                      className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-500 hover:bg-slate-200/80 hover:text-slate-900 transition-colors focus:outline-none"
                      aria-label={isSidebarOpen ? "Close past chats sidebar" : "Open past chats sidebar"}
                      title={isSidebarOpen ? "Close past chats" : "Open past chats"}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <rect x="3" y="3" width="18" height="18" rx="3" strokeWidth="2" />
                        <path d="M9 3v18" strokeWidth="2" />
                      </svg>
                    </button>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white">
                      <span className="text-cyan-400">✨</span> Ava
                    </span>
                    <span className="text-xs text-slate-500 font-medium hidden sm:inline">Your Travel Consultant</span>
                    {resultCount > 0 && onOpenResults ? (
                      <button
                        type="button"
                        onClick={onOpenResults}
                        className="ml-1 inline-flex items-center gap-1 rounded-full bg-cyan-600 hover:bg-cyan-700 text-white px-2.5 py-0.5 text-[11px] font-bold shadow-2xs transition-colors cursor-pointer"
                        title="View search results"
                      >
                        <span>View results ({resultCount})</span>
                        <span aria-hidden="true">→</span>
                      </button>
                    ) : null}
                  </div>
                  {busy && (
                    <span className="text-xs text-cyan-700 font-semibold animate-pulse">
                      · {thinkingLabel}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  {banner ? <div className="flex items-center">{banner}</div> : null}
                  {onDeleteChat && (
                    showConfirmDelete ? (
                      <div className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50/95 px-2.5 py-1 text-xs shadow-xs animate-in fade-in duration-150">
                        <span className="text-rose-700 font-medium text-[11px] sm:text-xs">Delete chat?</span>
                        <button
                          type="button"
                          onClick={() => setShowConfirmDelete(false)}
                          className="rounded px-1.5 py-0.5 text-[11px] sm:text-xs text-slate-600 hover:bg-rose-100 hover:text-slate-900 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowConfirmDelete(false);
                            onDeleteChat();
                          }}
                          className="rounded bg-rose-600 px-2 py-0.5 text-[11px] sm:text-xs font-medium text-white hover:bg-rose-700 transition-colors shadow-2xs"
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowConfirmDelete(true)}
                        className="group inline-flex items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white/90 px-2.5 py-1 text-xs font-medium text-slate-600 shadow-2xs hover:border-rose-300 hover:bg-rose-50/80 hover:text-rose-700 transition-all"
                        title="Delete current conversation"
                        aria-label="Delete chat"
                      >
                        <svg
                          className="h-3.5 w-3.5 text-slate-400 group-hover:text-rose-600 transition-colors"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.8"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                        <span className="hidden sm:inline">Delete chat</span>
                      </button>
                    )
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-end gap-3 w-full">
                {onToggleSidebar && (
                  <button
                    type="button"
                    onClick={onToggleSidebar}
                    className="lg:hidden mr-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
                    aria-label="Open past chats"
                  >
                    <svg className="h-4 w-4 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <rect x="3" y="3" width="18" height="18" rx="3" strokeWidth="2" />
                      <path d="M9 3v18" strokeWidth="2" />
                    </svg>
                    <span>Past chats</span>
                  </button>
                )}
                {banner ? <div className="ml-auto flex items-center justify-end">{banner}</div> : null}
              </div>
            )}
          </div>
        </header>

        {/* Scrollable Messages / Hero Area */}
        <div
          ref={scrollRef}
          className={`chat-page__messages min-h-0 min-w-0 flex-1 px-4 sm:px-6 lg:px-8 xl:px-10 ${
            isActiveChat
              ? "chat-scroll overflow-y-auto overscroll-y-contain fo-scrollbar-subtle"
              : "overflow-hidden flex flex-col justify-between"
          }`}
        >
          <div className={`w-full max-w-6xl mx-auto ${isActiveChat ? "py-3 sm:py-4" : "h-full flex flex-col justify-between py-1 sm:py-2.5 min-h-0"}`}>
            {showHero ? (
              <div className="flex flex-col justify-between h-full min-h-0 space-y-2.5 sm:space-y-3.5 lg:space-y-4 animate-in fade-in duration-300">
                {/* Hero Header Area (Two Columns on Large Desktop) */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-2 sm:gap-4 items-center shrink-0">
                  <div className="xl:col-span-8 space-y-1 sm:space-y-1.5">
                    {/* Ava Badge */}
                    <div className="inline-flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#081a2e] px-2.5 py-0.5 text-xs font-bold text-white shadow-xs">
                        <span className="text-cyan-400 text-xs">✨</span> Ava
                      </span>
                      <span className="text-xs sm:text-sm font-semibold text-slate-700 tracking-tight">
                        Your AI Travel Consultant
                      </span>
                    </div>

                    {/* Display Title */}
                    <h1 className="text-2xl sm:text-3xl lg:text-[clamp(1.65rem,2.8vh,2.4rem)] font-serif font-normal tracking-tight text-slate-900 leading-[1.12]">
                      Where are you<br />
                      going <span className="text-[#009ee2] italic font-serif">next?</span>
                    </h1>

                    {/* Lede Subtitle */}
                    <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed line-clamp-2 sm:line-clamp-none">
                      Tell me your travel plans in plain language. I can search live flights,
                      find the best stays, suggest itineraries, and help you compare options.
                    </p>
                  </div>

                  {/* Right-side Quote Motif (Reference Style) */}
                  <div className="hidden xl:flex xl:col-span-4 items-center justify-end select-none pointer-events-none">
                    <div className="space-y-1 max-w-[180px] text-right">
                      <p className="font-serif text-xs sm:text-sm text-slate-800 leading-snug">
                        New places.<br />
                        Brighter perspectives.
                      </p>
                      <p className="text-[10.5px] text-slate-400 font-medium">— FlightOne</p>
                    </div>
                  </div>
                </div>

                {/* 4 Destination Cards Grid (Dubai, Istanbul, Family Trip, Japan) */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 lg:gap-3.5 shrink-0">
                  {DESTINATION_CARDS.map((card) => (
                    <div
                      key={card.id}
                      onClick={() => submit(card.prompt)}
                      className="group relative h-[clamp(120px,18vh,168px)] rounded-2xl sm:rounded-3xl overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-0.5 border border-slate-200/80 bg-slate-900"
                    >
                      {/* Card Background Image with Smooth Zoom */}
                      <img
                        src={card.image}
                        alt={card.title}
                        className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                        loading="lazy"
                      />

                      {/* Subtle Dark Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/15 group-hover:via-black/30 transition-colors" />

                      {/* Top Category Badge & Icon */}
                      <div className="relative p-2.5 sm:p-3 flex items-start justify-between">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-950/45 backdrop-blur-md text-cyan-200 border border-white/20 shadow-xs">
                          {card.icon}
                        </div>
                      </div>

                      {/* Bottom Text Content */}
                      <div className="absolute inset-x-0 bottom-0 p-2.5 sm:p-3 space-y-0.5">
                        <span className="text-[10px] sm:text-[10.5px] font-bold text-slate-300/95 uppercase tracking-wider block">
                          {card.category}
                        </span>
                        <h3 className="text-sm sm:text-base lg:text-lg font-bold text-white font-[var(--font-sora)] leading-tight">
                          {card.title}
                        </h3>
                        <p className="text-[10px] sm:text-[11px] font-medium text-cyan-300 pt-0.5 flex items-center gap-1 group-hover:text-cyan-200 group-hover:underline">
                          {card.actionText}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick Action Pills Row */}
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
                  {QUICK_ACTION_BUTTONS.map((act) => (
                    <button
                      key={act.label}
                      type="button"
                      disabled={busy}
                      onClick={() => submit(act.prompt(originCity))}
                      className="flex items-center gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-xs px-3 sm:px-3.5 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs hover:border-cyan-400 hover:bg-slate-50 hover:text-cyan-900 active:scale-95 transition-all"
                    >
                      {act.icon}
                      <span>{act.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Active Chat Conversation Thread */}
            <div className={`chat-thread${isActiveChat ? " chat-thread--active" : ""}`}>
              {messages.map((m, i) => {
                const isLatestAssistant = m.id === latestAssistantId;
                const prev = messages[i - 1];
                const showIdentity =
                  m.role === "assistant" && (i === 0 || prev?.role !== "assistant");
                const shouldShowFooter =
                  (isLatestAssistant && showResultsOnLatest) ||
                  (m.role === "assistant" &&
                    resultCount > 0 &&
                    m.content &&
                    (m.content.toLowerCase().includes("options for") ||
                      m.content.toLowerCase().includes("live options") ||
                      m.content.toLowerCase().includes("live flights")));

                const footer =
                  shouldShowFooter ? (
                    <ResultsMessageFooter
                      chatResultsState="results"
                      resultCount={resultCount}
                      resultNoun={resultNoun}
                      destinationLabel={destinationLabel}
                      fromPrice={fromPrice}
                      onOpenResults={onOpenResults ?? (() => {})}
                    />
                  ) : isLatestAssistant && showErrorOnLatest ? (
                    <SearchErrorFooter onRetry={retryLastSearch} disabled={busy} />
                  ) : undefined;

                return (
                  <div key={m.id} className="chat-thread__item">
                    <MessageBubble
                      message={m}
                      index={i}
                      hideWelcome={showHero && i === 0}
                      showIdentity={showIdentity}
                      identityFull={showIdentity}
                      footer={footer}
                    />
                  </div>
                );
              })}

              {showLoadingBubble ? (
                <ThinkingProgress phase={thinkingPhase} loadingRoute={loadingRoute} />
              ) : null}
            </div>

            <div ref={bottomRef} className="chat-scroll-anchor" aria-hidden />
          </div>

          {showJumpToLatest && isActiveChat ? (
            <div className="chat-jump-latest-wrap pointer-events-none">
              <button
                type="button"
                onClick={jumpToLatest}
                className="chat-jump-latest pointer-events-auto"
              >
                Jump to latest
                <span aria-hidden>↓</span>
              </button>
            </div>
          ) : null}
        </div>

        {/* Bottom Chat Composer */}
        <footer
          ref={composerDockRef}
          className="chat-page__footer min-w-0 shrink-0 px-4 sm:px-6 lg:px-8 xl:px-10 pb-2.5 sm:pb-3 pt-1"
        >
          <div className="w-full max-w-6xl mx-auto space-y-1.5">
            {followUps.length > 0 ? (
              <div
                className="flex flex-wrap items-center gap-2"
                aria-label="Suggested follow-ups"
              >
                {followUps.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => submit(suggestion)}
                    className="rounded-full border border-cyan-200/80 bg-cyan-50/70 px-3 py-0.5 text-xs font-medium text-cyan-900 shadow-2xs hover:bg-cyan-100 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}

            {showStaticQuickActions ? (
              <div className="flex flex-wrap items-center gap-2" aria-label="Quick actions">
                {COMPOSER_QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    disabled={busy}
                    onClick={() => submit(action.prompt(originCity))}
                    className="rounded-full border border-slate-200 bg-white px-3 py-0.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}

            {showRecoveryActions ? (
              <div className="flex flex-wrap items-center gap-2" aria-label="Recovery actions">
                {RECOVERY_QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    disabled={busy}
                    onClick={() => submit(action.prompt(originCity))}
                    className="rounded-full border border-rose-200 bg-rose-50 px-3 py-0.5 text-xs font-medium text-rose-900 shadow-2xs hover:bg-rose-100 transition-colors"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}

            {/* Composer Box (Clean Streamlined Design) */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit(input);
              }}
              className="w-full min-w-0"
            >
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white p-2 sm:p-2.5 shadow-xs hover:shadow-sm focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-400/20 transition-all">
                <label htmlFor="fo-chat-composer" className="sr-only">
                  Ask Ava anything about your trip
                </label>
                <textarea
                  id="fo-chat-composer"
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit(input);
                    }
                  }}
                  placeholder="Ask Ava anything about your trip..."
                  className="w-full resize-none bg-transparent px-1 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none min-h-[30px] max-h-20 leading-normal"
                  disabled={busy}
                  autoComplete="off"
                />

                {/* Send button with arrow up */}
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#00a8e8] text-white shadow-xs hover:bg-[#0095d1] active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all"
                  aria-label="Send message"
                >
                  <svg className="h-4 w-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        </footer>
      </div>
    </div>
  );
}
