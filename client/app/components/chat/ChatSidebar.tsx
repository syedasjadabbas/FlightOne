"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Archive,
  BedDouble,
  Briefcase,
  Check,
  Clock,
  Copy,
  Eye,
  FileText,
  LifeBuoy,
  Loader2,
  Lock,
  MoreHorizontal,
  Mountain,
  Plus,
  Search,
  Trash2,
  Users,
  X,
  Plane,
} from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { useGetProfileQuery } from "@/lib/api/profile.api";
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

/** Ragged title widths — uniform bars read as a loading grid, not as chat titles. */
const SKELETON_ROW_WIDTHS = ["68%", "52%", "74%", "45%", "61%"] as const;

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

function ConversationIcon({ title }: { title: string }) {
  const t = title.toLowerCase();
  const cls = "h-3.5 w-3.5";
  if (t.includes("hotel") || t.includes("stay") || t.includes("resort")) {
    return <BedDouble className={cls} strokeWidth={1.8} aria-hidden />;
  }
  if (t.includes("family") || t.includes("group") || t.includes("kids")) {
    return <Users className={cls} strokeWidth={1.8} aria-hidden />;
  }
  if (t.includes("business") || t.includes("corporate") || t.includes("work")) {
    return <Briefcase className={cls} strokeWidth={1.8} aria-hidden />;
  }
  if (t.includes("visa") || t.includes("passport") || t.includes("document") || t.includes("policy")) {
    return <FileText className={cls} strokeWidth={1.8} aria-hidden />;
  }
  if (t.includes("japan") || t.includes("mountain") || t.includes("ski") || t.includes("nature")) {
    return <Mountain className={cls} strokeWidth={1.8} aria-hidden />;
  }
  return <Plane className={`${cls} -rotate-45`} strokeWidth={1.8} aria-hidden />;
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

  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const { data: profile } = useGetProfileQuery(undefined, {
    skip: !hasHydrated || !accessToken,
  });

  const profileMeta = (
    profile?.metadata && typeof profile.metadata === "object" ? profile.metadata : {}
  ) as Record<string, unknown>;
  const avatarUrl =
    typeof profileMeta.avatarUrl === "string" && profileMeta.avatarUrl.trim()
      ? profileMeta.avatarUrl.trim()
      : undefined;

  const displayName = profile?.displayName || user?.name || "Traveller";
  const userInitials = useMemo(() => {
    if (!displayName) return "U";
    return displayName
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }, [displayName]);

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
        className={`fo-chat-sidebar z-50 flex h-full shrink-0 select-none flex-col border-r border-[color-mix(in_oklab,var(--electric)_12%,#0e2740)] bg-[var(--fo-nav-bg)] text-slate-200 transition-transform duration-300 ease-in-out ${
          isOpen
            ? "fixed inset-y-0 left-0 w-72 max-w-[85vw] translate-x-0 shadow-2xl lg:static lg:w-[260px] lg:shadow-none xl:w-[270px]"
            : "fixed inset-y-0 left-0 -translate-x-full lg:w-0 lg:translate-x-0 lg:overflow-hidden"
        }`}
        role="complementary"
        aria-label="Past conversations"
      >
        {/* Top Actions: New Chat & Search Input */}
        <div className="flex shrink-0 flex-col gap-2.5 border-b border-white/10 p-3">
          <button
            type="button"
            onClick={onNewChat}
            className="fo-conv-newchat group flex h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-[13px] font-semibold tracking-[0.01em] text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sky)]/40"
            aria-label="Start a new trip search"
          >
            <span className="fo-conv-newchat__glyph flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
              <Plus className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden />
            </span>
            <span>Where to next?</span>
          </button>

          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations…"
              className="h-9 w-full rounded-xl border border-white/10 bg-white/[0.05] pl-8 pr-7 text-[13px] text-slate-100 placeholder-slate-400 transition-colors focus:border-[var(--electric)] focus:bg-white/[0.08] focus:outline-none focus:ring-1 focus:ring-[var(--electric)]"
              aria-label="Search conversations"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-200"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              </button>
            ) : null}
          </div>
        </div>

        {/* Scrollable Conversation List */}
        <div className="fo-scrollbar-subtle min-h-0 flex-1 space-y-4 overflow-y-auto px-2.5 py-3">
          {!accessToken ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
              <div className="mx-auto mb-2.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[color-mix(in_oklab,var(--electric)_18%,transparent)] text-[var(--electric)]">
                <Lock className="h-4 w-4" strokeWidth={1.8} aria-hidden />
              </div>
              <p className="text-[13px] font-semibold text-slate-100">Save your travel chats</p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-slate-400">
                Sign in to save trip searches, restore quotes, and access conversations across devices.
              </p>
              <Link
                href="/login?redirect=/chat"
                className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full border border-transparent bg-[var(--sky-solid)] px-4 text-[13px] font-semibold tracking-[0.01em] text-white shadow-[0_4px_14px_rgba(8,150,191,0.35),inset_0_1px_0_rgba(255,255,255,0.3)] transition-all duration-150 hover:-translate-y-px hover:bg-[#096fcf] hover:shadow-[0_8px_22px_rgba(0,122,229,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sky)]/40 active:translate-y-0 active:scale-[0.98]"
              >
                Log in to FlightOne
              </Link>
            </div>
          ) : isLoading ? (
            /* Mirrors the real row box model (h-7 chip + 13px title line at the
               same paddings) so the swap to real content doesn't shift layout. */
            <div role="status" aria-label="Loading conversations">
              {/* Matches the real group header's 16px line box, not just its glyph height. */}
              <div className="flex h-4 items-center px-2.5 pb-1.5 pt-1 box-content">
                <div className="fo-conv-skeleton__bar h-[10px] w-14 rounded-full" />
              </div>
              <div className="space-y-0.5">
                {SKELETON_ROW_WIDTHS.map((width, i) => (
                  <div key={i} className="flex items-center gap-2.5 rounded-xl py-2 pl-2.5 pr-2">
                    <div
                      className="fo-conv-skeleton__bar h-7 w-7 shrink-0 rounded-full"
                      style={{ animationDelay: `${i * 90}ms` }}
                    />
                    <div
                      className="fo-conv-skeleton__bar h-[13px] rounded-full"
                      style={{ width, animationDelay: `${i * 90}ms` }}
                    />
                  </div>
                ))}
              </div>
              <span className="sr-only">Loading conversations…</span>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="fo-conv-reveal px-3 py-12 text-center">
              <div className="mx-auto mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-slate-400">
                <Archive className="h-4 w-4" strokeWidth={1.9} aria-hidden />
              </div>
              <p className="text-[13px] font-semibold text-slate-200">
                {searchQuery ? `No chats matching "${searchQuery}"` : "No conversations yet"}
              </p>
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="mt-2.5 rounded-full px-3 py-1 text-[12px] font-semibold text-[#409bec] transition-colors duration-150 hover:bg-white/[0.06] hover:text-[#6fb4f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sky)]/40"
                >
                  Clear search
                </button>
              ) : (
                <p className="mx-auto mt-1.5 max-w-[210px] text-[12px] leading-relaxed text-slate-400">
                  Your trip searches and itineraries will appear here.
                </p>
              )}
            </div>
          ) : (
            /* Grouped Conversation Rows */
            groupedConversations.map((group) => (
              <div key={group.name} className="fo-conv-reveal space-y-0.5">
                <div className="px-2.5 pb-1.5 pt-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                  {group.name}
                </div>
                {group.items.map((conv) => {
                  const isActive = conv.id === activeConversationId;
                  const isResuming = conv.id === resumingId;
                  const isMenuOpen = conv.id === menuOpenId;
                  const title = conv.title || "FlightOne Chat";

                  return (
                    <div
                      key={conv.id}
                      className={`fo-conv-row group flex items-center justify-between rounded-xl ${
                        isActive ? "fo-conv-row--active text-white" : "text-slate-300"
                      } ${isMenuOpen ? "fo-conv-row--menu-open" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelect(conv.id)}
                        disabled={isResuming}
                        aria-current={isActive ? "true" : undefined}
                        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl py-2 pl-2.5 pr-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sky)]/40"
                        title={title}
                      >
                        <div
                          className={`fo-conv-row__icon flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                            isActive
                              ? "bg-[var(--electric)] text-white"
                              : "bg-white/[0.07] text-[#409bec] group-hover:bg-white/[0.12] group-hover:text-[#6fb4f1]"
                          }`}
                        >
                          {isResuming ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} aria-hidden />
                          ) : (
                            <ConversationIcon title={title} />
                          )}
                        </div>

                        <p
                          className={`min-w-0 flex-1 truncate text-[13px] leading-snug tracking-tight ${
                            isActive ? "font-semibold text-white" : "font-medium text-slate-200 group-hover:text-white"
                          }`}
                        >
                          {title}
                        </p>
                      </button>

                      {/* Timestamp & '...' Action Menu */}
                      <div className="shrink-0 pr-2 flex items-center justify-end relative fo-chat-sidebar__menu-container">
                        <span className={`text-[12px] text-slate-400 font-medium tabular-nums whitespace-nowrap ${isMenuOpen ? "hidden" : "group-hover:hidden group-focus-within:hidden"}`}>
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
                          className={`rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-white/[0.1] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sky)]/40 ${
                            isMenuOpen
                              ? "block bg-white/[0.15] text-white"
                              : "hidden group-hover:block group-focus-within:block focus:block"
                          }`}
                        >
                          <MoreHorizontal className="h-4 w-4" strokeWidth={2} aria-hidden />
                        </button>

                        {/* Popover Action Menu */}
                        {isMenuOpen && (
                          <div
                            className="fo-conv-menu pointer-events-auto shadow-2xl"
                            role="menu"
                            aria-orientation="vertical"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              role="menuitem"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelect(conv.id);
                              }}
                              className="fo-conv-menu__item"
                            >
                              <Eye className="h-3.5 w-3.5 text-slate-400" />
                              <span>Open chat</span>
                            </button>

                            <button
                              type="button"
                              role="menuitem"
                              onClick={(e) => void handleCopyId(conv.id, e)}
                              className="fo-conv-menu__item"
                            >
                              {copiedId === conv.id ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                                  <span className="text-emerald-400 font-semibold">Copied ID!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5 text-slate-400" />
                                  <span>Copy chat ID</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              role="menuitem"
                              onClick={(e) => void handleEscalate(conv.id, e)}
                              className="fo-conv-menu__item text-[#409bec] hover:text-[#6fb4f1]"
                            >
                              <LifeBuoy className="h-3.5 w-3.5 text-sky-400" />
                              <span>{escalatedId === conv.id ? "Support notified" : "Consultant help"}</span>
                            </button>

                            {onDeleteConversation && (
                              <div className="mt-1 border-t border-slate-700/60 pt-1">
                                {confirmDeleteId === conv.id ? (
                                  <div className="rounded-lg bg-rose-950/80 p-2 border border-rose-800/80 text-xs">
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
                                        {deletingId === conv.id ? "Deleting…" : "Delete"}
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
                                    className="fo-conv-menu__item fo-conv-menu__item--danger"
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-rose-400" />
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
        <div className="shrink-0 border-t border-[#0f2842] bg-[#06121d] px-3 pb-3.5 pt-3">
          {accessToken && user ? (
            <div className="flex items-center justify-between gap-2">
              <Link
                href="/profile"
                className="flex min-w-0 items-center gap-2.5 rounded-xl p-1.5 transition-colors duration-150 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sky)]/40"
                title="View Profile"
              >
                <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--sky-solid)] text-[12px] font-bold text-white">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    userInitials
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold leading-tight text-slate-200">
                    {displayName}
                  </p>
                  <p className="truncate text-[12px] leading-tight text-slate-400">{user.email}</p>
                </div>
              </Link>
              <div className="flex shrink-0 items-center gap-0.5">
              <Link
                href="/vault"
                className="rounded-lg p-2 text-slate-400 transition-colors duration-150 hover:bg-white/[0.08] hover:text-[#6fb4f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sky)]/40"
                title="Traveller Vault"
                aria-label="Open Traveller Vault"
              >
                <Lock className="h-4 w-4" strokeWidth={1.9} aria-hidden />
              </Link>
              <Link
                href="/concierge"
                className="rounded-lg p-2 text-slate-400 transition-colors duration-150 hover:bg-white/[0.08] hover:text-[#6fb4f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sky)]/40"
                title="Autonomous Concierge"
                aria-label="Open Autonomous Concierge"
              >
                <Clock className="h-4 w-4" strokeWidth={1.9} aria-hidden />
              </Link>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between px-1 text-[12px] text-slate-400">
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
