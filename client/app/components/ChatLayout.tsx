"use client";

import { useMemo, useRef, useState, useEffect, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUp,
  Square,
  BedDouble,
  GitCompareArrows,
  Map,
  MoreHorizontal,
  PanelLeft,
  Plane,
  Trash2,
} from "lucide-react";
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
import {
  COMPOSER_QUICK_ACTIONS,
  RECOVERY_QUICK_ACTIONS,
  STARTER_ROUTES,
} from "./chat/chatQuickPrompts";

const HERO_TOOLS = [
  {
    label: "Search flights",
    prompt: (origin: string) => `Find best flight fares from ${origin}`,
    Icon: Plane,
  },
  {
    label: "Find hotels",
    prompt: () => "Find top-rated hotels and stays for my next destination",
    Icon: BedDouble,
  },
  {
    label: "Plan an itinerary",
    prompt: () => "Help me plan a multi-city travel itinerary with stopovers",
    Icon: Map,
  },
  {
    label: "Compare options",
    prompt: () => "Compare flight options and cabin classes for my trip",
    Icon: GitCompareArrows,
  },
  {
    label: "More",
    prompt: () => "What travel tools, visa rules, and services can Ava assist with?",
    Icon: MoreHorizontal,
  },
] as const;

/** Conversational panel — full-viewport messaging workspace. */
export function ChatLayout({
  messages,
  busy,
  onStop,
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
  composerAccessory,
  heroAccessory,
}: {
  messages: UiMessage[];
  busy: boolean;
  /** Abandon the in-flight search. */
  onStop?: () => void;
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
  composerAccessory?: ReactNode;
  heroAccessory?: ReactNode;
}) {
  const [input, setInput] = useState("");
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const composerDockRef = useRef<HTMLElement>(null);

  const originCity = location?.place || location?.city || "your city";
  const isActiveChat = messages.some((m) => m.role === "user");
  const showHero = !isActiveChat && messages.length === 1;
  const inspire = STARTER_ROUTES;

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
    !busy &&
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

  // ⌘/Ctrl+K focuses the composer from anywhere; Escape stops an in-flight
  // search. The sidebar was keyboard-reachable but the chat itself was not.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }
      if (e.key === "Escape" && busy) {
        e.preventDefault();
        onStop?.();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onStop]);

  useChatViewportLayout(isActiveChat, composerDockRef);
  useLandingDocumentFit(!isActiveChat);

  return (
    <div
      className={`ava-chat chat-page relative flex min-h-0 w-full min-w-0 flex-col overflow-hidden ${
        isActiveChat ? "chat-page--active" : "chat-page--landing"
      }`}
      style={{ background: "var(--fo-atmosphere)" }}
    >
      {/* Soft runway atmosphere — no photo collage */}
      <div
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none"
        aria-hidden="true"
      >
        <div
          className="absolute -right-16 top-0 h-[55%] w-[70%] max-w-3xl opacity-90"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 70% 20%, color-mix(in oklab, var(--electric) 10%, transparent), transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-0 left-0 h-[40%] w-[50%] opacity-80"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 20% 90%, color-mix(in oklab, var(--bone) 55%, transparent), transparent 70%)",
          }}
        />
      </div>

      <div className="chat-page__inner relative z-10 flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
        <header className="chat-page__header shrink-0 min-w-0 px-4 sm:px-6 lg:px-8 xl:px-10 pt-3 pb-1.5 sm:pt-4 sm:pb-2">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
            {isActiveChat ? (
              <>
                <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                  {onToggleSidebar ? (
                    <button
                      type="button"
                      onClick={onToggleSidebar}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--ink-soft)] transition-colors hover:bg-[color-mix(in_oklab,var(--navy)_6%,transparent)] hover:text-[var(--navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--electric)]/35"
                      aria-label={isSidebarOpen ? "Close past chats sidebar" : "Open past chats sidebar"}
                      title={isSidebarOpen ? "Close past chats" : "Open past chats"}
                    >
                      <PanelLeft className="h-4 w-4" strokeWidth={1.9} />
                    </button>
                  ) : null}

                  <div className="flex min-w-0 items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--navy)] px-2 py-1 text-[11px] font-semibold tracking-tight text-white">
                      <Plane className="h-3 w-3 text-[var(--electric)]" strokeWidth={2.2} aria-hidden />
                      Ava
                    </span>
                    <span className="hidden text-xs font-medium text-[var(--ink-soft)] sm:inline">
                      Travel consultant
                    </span>
                    {!busy && resultCount > 0 && onOpenResults ? (
                      <button
                        type="button"
                        onClick={onOpenResults}
                        className="ml-0.5 inline-flex items-center gap-1 rounded-full bg-[var(--sky-solid)] px-2.5 py-1 text-[11px] font-semibold tracking-[0.01em] text-white shadow-[0_2px_8px_rgba(8,150,191,0.3),inset_0_1px_0_rgba(255,255,255,0.3)] transition-all duration-150 hover:-translate-y-px hover:bg-[color-mix(in_oklab,var(--electric)_90%,var(--navy))] hover:shadow-[0_5px_14px_rgba(0,122,229,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sky)]/40 active:translate-y-0 active:scale-[0.98]"
                        title="View search results"
                      >
                        Results ({resultCount})
                        <ArrowRight className="h-3 w-3" strokeWidth={2.4} aria-hidden />
                      </button>
                    ) : null}
                  </div>

                  {busy ? (
                    <span className="hidden truncate text-xs font-medium text-[var(--sky)] md:inline">
                      {thinkingLabel}
                    </span>
                  ) : null}
                </div>

                <div className="ml-auto flex items-center gap-2">
                  {banner ? <div className="flex items-center">{banner}</div> : null}
                  {onDeleteChat ? (
                    showConfirmDelete ? (
                      <div className="flex items-center gap-1.5 rounded-lg border border-[color-mix(in_oklab,var(--danger)_28%,var(--line))] bg-[color-mix(in_oklab,var(--danger)_6%,white)] px-2.5 py-1 text-xs">
                        <span className="text-[11px] font-medium text-[var(--danger)] sm:text-xs">
                          Delete chat?
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowConfirmDelete(false)}
                          className="rounded px-1.5 py-0.5 text-[11px] text-[var(--ink-soft)] transition-colors hover:bg-white hover:text-[var(--navy)] sm:text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowConfirmDelete(false);
                            onDeleteChat();
                          }}
                          className="rounded bg-[var(--danger)] px-2 py-0.5 text-[11px] font-medium text-white transition-colors hover:brightness-95 sm:text-xs"
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowConfirmDelete(true)}
                        className="group inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white/90 px-2.5 py-1 text-xs font-medium text-[var(--ink-soft)] transition-colors hover:border-[color-mix(in_oklab,var(--danger)_35%,var(--line))] hover:bg-[color-mix(in_oklab,var(--danger)_5%,white)] hover:text-[var(--danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--electric)]/30"
                        title="Delete current conversation"
                        aria-label="Delete chat"
                      >
                        <Trash2
                          className="h-3.5 w-3.5 text-[var(--ink-faint)] transition-colors group-hover:text-[var(--danger)]"
                          strokeWidth={1.9}
                        />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    )
                  ) : null}
                </div>
              </>
            ) : (
              <div className="flex w-full items-center justify-end gap-3">
                {onToggleSidebar ? (
                  <button
                    type="button"
                    onClick={onToggleSidebar}
                    className="mr-auto inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--navy)] transition-colors hover:border-[color-mix(in_oklab,var(--electric)_40%,var(--line))] hover:bg-[color-mix(in_oklab,var(--electric)_4%,white)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--electric)]/35 lg:hidden"
                    aria-label="Open past chats"
                  >
                    <PanelLeft className="h-3.5 w-3.5 text-[var(--sky)]" strokeWidth={1.9} />
                    Past chats
                  </button>
                ) : null}
                {banner ? <div className="ml-auto flex items-center justify-end">{banner}</div> : null}
              </div>
            )}
          </div>
        </header>

        <div
          ref={scrollRef}
          className={`chat-page__messages min-h-0 min-w-0 flex-1 px-4 sm:px-6 lg:px-8 xl:px-10 ${
            isActiveChat
              ? "chat-scroll overflow-y-auto overscroll-y-contain fo-scrollbar-subtle"
              : "flex flex-col justify-between overflow-hidden"
          }`}
        >
          <div
            className={`mx-auto w-full max-w-6xl ${
              isActiveChat
                ? "py-3 sm:py-4"
                : "flex h-full min-h-0 flex-col justify-between py-1 sm:py-2.5"
            }`}
          >
            {showHero ? (
              <div className="chat-empty flex h-full min-h-0 flex-col justify-between space-y-4 sm:space-y-5">
                <div className="shrink-0 space-y-3 sm:space-y-4">
                  <div className="space-y-2.5 sm:space-y-3">
                    <BrandMark size="hero" />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-tight text-[var(--navy)]">
                        <Plane className="h-3.5 w-3.5 text-[var(--electric)]" strokeWidth={2} aria-hidden />
                        Ava
                        <span className="font-medium text-[var(--ink-soft)]">· Travel consultant</span>
                      </span>
                      <span className="text-[11px] font-medium text-[var(--ink-faint)] sm:text-xs">
                        {locationLabel}
                      </span>
                    </div>

                    <h1 className="max-w-xl font-(--font-hero) text-[clamp(1.75rem,4.2vh,2.55rem)] leading-[1.12] tracking-tight text-navy">
                      Where are you going{" "}
                      <span className="text-electric">next?</span>
                    </h1>

                    <p className="max-w-xl text-sm leading-relaxed text-[var(--ink-soft)] sm:text-[15px]">
                      Describe the trip in plain language. Ava searches live flights and stays,
                      then helps you compare real options — never invented fares.
                    </p>
                  </div>

                  {heroAccessory}

                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-faint)]">
                      Start with a route
                    </p>
                    <ul className="flex flex-col gap-2">
                      {inspire.map((item) => (
                        <li key={item.title}>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => submit(item.prompt)}
                            className="chat-route-card group flex w-full items-center justify-between gap-3 text-left disabled:opacity-50"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold tracking-tight text-[var(--navy)]">
                                {item.title}
                              </span>
                              <span className="mt-0.5 block truncate text-xs text-[var(--ink-soft)]">
                                {item.subtitle}
                              </span>
                            </span>
                            <ArrowRight
                              className="h-4 w-4 shrink-0 text-[var(--ink-faint)] transition-colors group-hover:text-[var(--electric)]"
                              strokeWidth={1.9}
                              aria-hidden
                            />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:gap-2">
                  {HERO_TOOLS.map(({ label, prompt, Icon }) => (
                    <button
                      key={label}
                      type="button"
                      disabled={busy}
                      onClick={() => submit(prompt(originCity))}
                      className="quick-chip quick-chip--action inline-flex items-center gap-1.5"
                    >
                      <Icon className="h-3.5 w-3.5 text-[var(--sky)]" strokeWidth={1.9} aria-hidden />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className={`chat-thread${isActiveChat ? " chat-thread--active" : ""}`}>
              {messages.map((m, i) => {
                const isLatestAssistant = m.id === latestAssistantId;
                const prev = messages[i - 1];
                const showIdentity =
                  m.role === "assistant" && (i === 0 || prev?.role !== "assistant");
                const shouldShowFooter =
                  !busy &&
                  ((isLatestAssistant && showResultsOnLatest) ||
                    (m.role === "assistant" &&
                      resultCount > 0 &&
                      m.content &&
                      (m.content.toLowerCase().includes("options for") ||
                        m.content.toLowerCase().includes("live options") ||
                        m.content.toLowerCase().includes("live flights"))));

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
                className="chat-jump-latest pointer-events-auto inline-flex items-center gap-1.5"
              >
                Jump to latest
                <span aria-hidden>↓</span>
              </button>
            </div>
          ) : null}
        </div>

        <footer
          ref={composerDockRef}
          className="chat-page__footer min-w-0 shrink-0 px-4 pb-2.5 pt-1 sm:px-6 sm:pb-3 lg:px-8 xl:px-10"
        >
          <div className="mx-auto w-full max-w-6xl space-y-1.5">
            {followUps.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5" aria-label="Suggested follow-ups">
                {followUps.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => submit(suggestion)}
                    className="rounded-lg border border-[color-mix(in_oklab,var(--electric)_22%,var(--line))] bg-[color-mix(in_oklab,var(--electric)_6%,white)] px-2.5 py-1 text-xs font-medium text-[var(--navy)] transition-colors hover:bg-[color-mix(in_oklab,var(--electric)_10%,white)]"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}

            {showStaticQuickActions ? (
              <div className="flex flex-wrap items-center gap-1.5" aria-label="Quick actions">
                {COMPOSER_QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    disabled={busy}
                    onClick={() => submit(action.prompt(originCity))}
                    className="rounded-lg border border-[var(--line)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--ink-soft)] transition-colors hover:border-[color-mix(in_oklab,var(--electric)_35%,var(--line))] hover:text-[var(--navy)] disabled:opacity-50"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}

            {showRecoveryActions ? (
              <div className="flex flex-wrap items-center gap-1.5" aria-label="Recovery actions">
                {RECOVERY_QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    disabled={busy}
                    onClick={() => submit(action.prompt(originCity))}
                    className="rounded-lg border border-[color-mix(in_oklab,var(--danger)_22%,var(--line))] bg-[color-mix(in_oklab,var(--danger)_5%,white)] px-2.5 py-1 text-xs font-medium text-[color-mix(in_oklab,var(--danger)_75%,var(--navy))] transition-colors hover:bg-[color-mix(in_oklab,var(--danger)_9%,white)] disabled:opacity-50"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit(input);
              }}
              className="w-full min-w-0"
            >
              <div className="flex items-end gap-2 rounded-2xl border border-[var(--line)] bg-white p-2 shadow-[var(--shadow-soft)] transition-[border-color,box-shadow] focus-within:border-[color-mix(in_oklab,var(--electric)_55%,var(--line))] focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--electric)_14%,transparent)] sm:p-2.5">
                <label htmlFor="fo-chat-composer" className="sr-only">
                  Ask Ava about your trip
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
                  placeholder="Ask Ava about your trip…"
                  className="min-h-[32px] max-h-24 w-full resize-none bg-transparent px-1 py-1.5 text-sm leading-normal text-[var(--navy)] placeholder:text-[var(--ink-faint)] focus:outline-none disabled:opacity-60"
                  disabled={busy}
                  autoComplete="off"
                />

                <div className="flex shrink-0 items-center gap-1.5 pb-0.5">
                  {composerAccessory}

                  {/* While a search runs this becomes Stop. Previously it was a
                      disabled spinner, so a mistyped destination meant waiting
                      out the full supplier round-trip with no way to abandon it. */}
                  <button
                    type={busy ? "button" : "submit"}
                    onClick={busy ? onStop : undefined}
                    disabled={busy ? false : !input.trim()}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sky-solid)] text-white shadow-[0_4px_14px_rgba(8,150,191,0.35),inset_0_1px_0_rgba(255,255,255,0.3)] transition-all duration-150 hover:-translate-y-px hover:bg-[#096fcf] hover:shadow-[0_8px_22px_rgba(0,122,229,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sky)]/40 active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none disabled:hover:translate-y-0"
                    aria-label={busy ? "Stop search" : "Send message"}
                  >
                    {busy ? (
                      <Square className="h-3 w-3 fill-current" strokeWidth={0} aria-hidden />
                    ) : (
                      <ArrowUp className="h-4 w-4" strokeWidth={2.4} aria-hidden />
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </footer>
      </div>
    </div>
  );
}
