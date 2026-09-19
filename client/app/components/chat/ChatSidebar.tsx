"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/auth.store";
import type { ConversationSummary } from "@/lib/api/conversations.api";
import { requestConversationEscalation } from "@/lib/ask-ai/persistConversation";

export interface ChatSidebarProps {
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  isLoading?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation?: (id: string) => Promise<void> | void;
  resumingId?: string | null;
}

type TimeframeGroup = "Today" | "Yesterday" | "Previous 7 Days" | "Older";

function getTimeframeGroup(dateString: string): TimeframeGroup {
  const date = new Date(dateString);
  const now = new Date();

  // Reset times to start of day for accurate calendar day comparison
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOf7DaysAgo = startOfToday - 7 * 24 * 60 * 60 * 1000;
  const targetTime = date.getTime();

  if (targetTime >= startOfToday) {
    return "Today";
  }
  if (targetTime >= startOfYesterday) {
    return "Yesterday";
  }
  if (targetTime >= startOf7DaysAgo) {
    return "Previous 7 Days";
  }
  return "Older";
}

function formatConversationTime(dateString: string): string {
  try {
    const d = new Date(dateString);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    if (isToday) {
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function getConversationIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes("hotel") || t.includes("stay") || t.includes("resort")) {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    );
  }
  if (t.includes("family") || t.includes("group") || t.includes("kids")) {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    );
  }
  if (t.includes("business") || t.includes("corporate") || t.includes("work")) {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    );
  }
  if (t.includes("visa") || t.includes("passport") || t.includes("document") || t.includes("policy")) {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }
  if (t.includes("japan") || t.includes("mountain") || t.includes("ski") || t.includes("nature")) {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    );
  }
  // Default flight / trip icon
  return (
    <svg className="h-4 w-4 -rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}

function getConversationSubtitle(title: string, summary?: string): string {
  if (summary && summary.trim().length > 0) return summary;
  const t = title.toLowerCase();
  if (t.includes("→") || t.includes("to ")) return "Flights & hotel options";
  if (t.includes("weekend") || t.includes("break")) return "City break recommendations";
  if (t.includes("family")) return "Flights, hotels & activities";
  if (t.includes("visa")) return "Requirements and timeline";
  if (t.includes("business") || t.includes("class")) return "Flight options & comparison";
  if (t.includes("hotel") || t.includes("luxury")) return "Luxury hotels near Downtown";
  return "Flights and attractions";
}

export function ChatSidebar({
  conversations,
  activeConversationId,
  isLoading = false,
  isOpen,
  onClose,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  resumingId = null,
}: ChatSidebarProps) {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [escalatedId, setEscalatedId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close ... menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest(".fo-chat-sidebar__menu-container")) {
        setMenuOpenId(null);
        setConfirmDeleteId(null);
      }
    }
    if (menuOpenId) {
      window.addEventListener("click", handleClickOutside);
      return () => window.removeEventListener("click", handleClickOutside);
    }
  }, [menuOpenId]);

  // Handle Escape key to close mobile drawer or close menu/confirm
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (confirmDeleteId) {
          setConfirmDeleteId(null);
        } else if (menuOpenId) {
          setMenuOpenId(null);
        } else if (isOpen) {
          onClose();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, menuOpenId, confirmDeleteId, onClose]);

  // Filter conversations based on search
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase().trim();
    return conversations.filter((c) => {
      const title = (c.title || "FlightOne Chat").toLowerCase();
      const dateStr = formatConversationTime(c.updatedAt).toLowerCase();
      return title.includes(q) || dateStr.includes(q) || c.id.toLowerCase().includes(q);
    });
  }, [conversations, searchQuery]);

  // Chronological grouping
  const groupedConversations = useMemo(() => {
    const groups: Record<TimeframeGroup, ConversationSummary[]> = {
      Today: [],
      Yesterday: [],
      "Previous 7 Days": [],
      Older: [],
    };

    for (const c of filteredConversations) {
      const group = getTimeframeGroup(c.updatedAt);
      groups[group].push(c);
    }

    return (["Today", "Yesterday", "Previous 7 Days", "Older"] as TimeframeGroup[]).filter(
      (g) => groups[g].length > 0,
    ).map((groupName) => ({
      name: groupName,
      items: groups[groupName],
    }));
  }, [filteredConversations]);

  const handleCopyId = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      setMenuOpenId(null);
    } catch {
      // ignore
    }
  };

  const handleEscalate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpenId(null);
    try {
      await requestConversationEscalation(id, { trigger: "CUSTOMER_REQUEST" });
      setEscalatedId(id);
      setTimeout(() => setEscalatedId(null), 3000);
    } catch {
      // best-effort
    }
  };

  const handleSelect = (id: string) => {
    onSelectConversation(id);
    setMenuOpenId(null);
  };

  const userInitials = useMemo(() => {
    if (!user?.name) return "U";
    return user.name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }, [user?.name]);

  return (
    <>
      {/* Mobile / Tablet Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden transition-opacity duration-200"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar Panel */}
      <aside
        className={`fo-chat-sidebar flex flex-col h-full bg-[#081726] border-r border-[#0e2740] text-slate-200 select-none z-50 transition-all duration-300 ease-in-out shrink-0 ${
          isOpen
            ? "translate-x-0 w-72 max-w-[85vw] lg:w-[260px] xl:w-[270px] lg:static fixed inset-y-0 left-0 shadow-2xl lg:shadow-none"
            : "-translate-x-full lg:translate-x-0 lg:w-0 lg:overflow-hidden fixed inset-y-0 left-0"
        }`}
        role="complementary"
        aria-label="Past conversations"
      >
        {/* Top Actions: New Chat & Search Input */}
        <div className="flex flex-col gap-2.5 p-3 border-b border-[#0f2842] shrink-0">
          {/* New Chat Button */}
          <button
            type="button"
            onClick={onNewChat}
            className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#009ee2] to-[#00b4d8] hover:from-[#008ecb] hover:to-[#00a3c4] px-3.5 py-2.5 text-xs font-bold text-white shadow-md shadow-cyan-950/40 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transition-all active:scale-[0.98]"
            aria-label="Start a new chat"
          >
            <svg className="h-4 w-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="tracking-tight text-[13px]">New Chat</span>
          </button>

          {/* Search Conversations Input */}
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full rounded-xl border border-white/10 bg-white/[0.05] py-1.5 pl-8 pr-7 text-xs text-slate-100 placeholder-slate-400 focus:border-cyan-500 focus:bg-white/[0.08] focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors"
              aria-label="Search conversations"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-200"
                aria-label="Clear search"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Conversation List */}
        <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4 fo-scrollbar-subtle min-h-0">
          {/* Guest State Callout */}
          {!accessToken ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <div className="mx-auto mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <p className="text-xs font-bold text-slate-100">Save Your Travel Chats</p>
              <p className="mt-1 text-[10.5px] leading-relaxed text-slate-400">
                Sign in to save trip searches, restore quotes, and access conversations across devices.
              </p>
              <Link
                href="/login?redirect=/chat"
                className="mt-2.5 inline-flex w-full items-center justify-center rounded-lg bg-cyan-600/20 border border-cyan-500/30 px-2.5 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/30 transition-colors"
              >
                Log In to FlightOne
              </Link>
            </div>
          ) : isLoading ? (
            /* Shimmer Loading Skeleton */
            <div className="space-y-3 px-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 rounded-xl bg-white/[0.04] animate-pulse" />
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            /* Empty State */
            <div className="py-12 px-3 text-center">
              <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] text-slate-500">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
              <p className="text-xs font-medium text-slate-400">
                {searchQuery ? `No chats matching "${searchQuery}"` : "No conversations yet"}
              </p>
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="mt-2 text-[11px] font-semibold text-cyan-400 hover:underline"
                >
                  Clear search
                </button>
              ) : (
                <p className="mt-1 text-[11px] text-slate-500">
                  Your trip searches and itineraries will appear here.
                </p>
              )}
            </div>
          ) : (
            /* Grouped Conversation Rows */
            groupedConversations.map((group) => (
              <div key={group.name} className="space-y-1.5">
                <div className="px-2.5 py-0.5 text-[11px] font-medium text-slate-400 tracking-tight">
                  {group.name}
                </div>
                {group.items.map((conv) => {
                  const isActive = conv.id === activeConversationId;
                  const isResuming = conv.id === resumingId;
                  const isMenuOpen = conv.id === menuOpenId;
                  const title = conv.title || "FlightOne Chat";
                  const subtitle = getConversationSubtitle(title);
                  const icon = getConversationIcon(title);

                  return (
                    <div
                      key={conv.id}
                      className={`group relative flex items-center justify-between rounded-xl transition-all ${
                        isActive
                          ? "bg-[#0d2a45] text-white shadow-xs ring-1 ring-cyan-500/30"
                          : "text-slate-300 hover:bg-white/[0.05] hover:text-slate-100"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelect(conv.id)}
                        disabled={isResuming}
                        aria-current={isActive ? "true" : undefined}
                        className="flex flex-1 min-w-0 items-center gap-3 p-2.5 text-left text-xs focus:outline-none"
                        title={title}
                      >
                        {/* Circular Icon Container */}
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
                            isActive
                              ? "bg-cyan-500 text-slate-950 font-bold shadow-xs"
                              : "bg-white/[0.07] text-cyan-300 group-hover:bg-cyan-500/20 group-hover:text-cyan-200"
                          }`}
                        >
                          {isResuming ? (
                            <svg className="h-4 w-4 animate-spin text-cyan-400" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                          ) : (
                            icon
                          )}
                        </div>

                        {/* Title & Subtitle */}
                        <div className="flex-1 min-w-0">
                          <p className={`truncate font-semibold tracking-tight text-[13px] leading-snug ${isActive ? "text-white" : "text-slate-200 group-hover:text-white"}`}>
                            {title}
                          </p>
                          <p className="truncate text-[11px] text-slate-400 mt-0.5 leading-tight">
                            {subtitle}
                          </p>
                        </div>
                      </button>

                      {/* Timestamp & '...' Action Menu */}
                      <div className="shrink-0 pr-2.5 flex items-center justify-end relative fo-chat-sidebar__menu-container">
                        <span className={`text-[10px] text-slate-400 font-medium whitespace-nowrap ${isMenuOpen ? "hidden" : "group-hover:hidden"}`}>
                          {formatConversationTime(conv.updatedAt)}
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isMenuOpen) {
                              setMenuOpenId(null);
                              setConfirmDeleteId(null);
                            } else {
                              setMenuOpenId(conv.id);
                              setConfirmDeleteId(null);
                            }
                          }}
                          aria-label={`Options for ${title}`}
                          aria-expanded={isMenuOpen}
                          className={`rounded-lg p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-all ${
                            isMenuOpen
                              ? "block bg-slate-700 text-slate-200"
                              : "hidden group-hover:block group-focus-within:block focus:block"
                          }`}
                        >
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                          </svg>
                        </button>

                        {/* Popover Action Menu */}
                        {isMenuOpen && (
                          <div
                            className="pointer-events-auto absolute right-0 top-full mt-1 w-48 rounded-xl border border-slate-700/80 bg-[#091e33] p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100"
                            role="menu"
                            aria-orientation="vertical"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => handleSelect(conv.id)}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800 transition-colors"
                            >
                              <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              <span>Open chat</span>
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={(e) => void handleCopyId(conv.id, e)}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800 transition-colors"
                            >
                              <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                                />
                              </svg>
                              <span>{copiedId === conv.id ? "Copied ID!" : "Copy chat ID"}</span>
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={(e) => void handleEscalate(conv.id, e)}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 hover:bg-slate-800 transition-colors"
                            >
                              <svg className="h-3.5 w-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
                                />
                              </svg>
                              <span>{escalatedId === conv.id ? "Support notified" : "Consultant help"}</span>
                            </button>

                            {onDeleteConversation && (
                              <div className="mt-1 border-t border-slate-700/60 pt-1">
                                {confirmDeleteId === conv.id ? (
                                  <div className="rounded-lg bg-rose-950/60 p-2 border border-rose-800/70 text-xs">
                                    <p className="text-[11px] font-semibold text-rose-200 mb-1.5 leading-tight">
                                      Delete this chat?
                                    </p>
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        type="button"
                                        disabled={deletingId === conv.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setConfirmDeleteId(null);
                                        }}
                                        className="rounded px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        disabled={deletingId === conv.id}
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          setDeletingId(conv.id);
                                          try {
                                            await onDeleteConversation(conv.id);
                                          } finally {
                                            setDeletingId(null);
                                            setConfirmDeleteId(null);
                                            setMenuOpenId(null);
                                          }
                                        }}
                                        className="rounded bg-rose-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-rose-500 disabled:opacity-50 transition-colors"
                                      >
                                        {deletingId === conv.id ? "Deleting..." : "Delete"}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmDeleteId(conv.id);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition-colors"
                                  >
                                    <svg className="h-3.5 w-3.5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                      />
                                    </svg>
                                    <span>Delete chat</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* User Account Footer */}
        <div className="p-2.5 px-3 border-t border-[#0f2842] shrink-0 bg-[#06121d]">
          {accessToken && user ? (
            <div className="flex items-center justify-between">
              <Link
                href="/profile"
                className="flex items-center gap-2.5 min-w-0 rounded-lg p-1 hover:bg-slate-800/80 transition-colors"
                title="View Profile"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-cyan-600 to-cyan-400 text-xs font-bold text-white shadow-sm">
                  {userInitials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-200">
                    {user.name || "Traveller"}
                  </p>
                  <p className="truncate text-[10px] text-slate-400">{user.email}</p>
                </div>
              </Link>
              <div className="flex items-center shrink-0">
              <Link
                href="/vault"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-cyan-400 transition-colors"
                title="Traveller Vault"
                aria-label="Open Traveller Vault"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </Link>
              <Link
                href="/concierge"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-cyan-400 transition-colors"
                title="Autonomous Concierge"
                aria-label="Open Autonomous Concierge"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </Link>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>Guest Session</span>
              <Link href="/login" className="text-cyan-400 font-medium hover:underline">
                Sign in →
              </Link>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
