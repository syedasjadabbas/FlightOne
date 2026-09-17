"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui";
import { useAuthStore } from "@/store/auth.store";
import { useLogoutMutation } from "@/lib/api/auth.api";

type NavItem = {
  href: string;
  label: string;
  /** Extra path prefixes that count as current (e.g. Support → /ops/escalations). */
  alsoMatch?: string[];
};

type NavGroup = {
  title: string;
  items: Array<{
    href: string;
    label: string;
    description: string;
    alsoMatch?: string[];
  }>;
};

const PRIMARY_LINKS: NavItem[] = [
  { href: "/", label: "Search" },
  { href: "/chat", label: "AI Consultant" },
  { href: "/journey", label: "Journey" },
  { href: "/vault", label: "Vault" },
];

const SECONDARY_GROUPS: NavGroup[] = [
  {
    title: "Travel Services",
    items: [
      { href: "/visa", label: "Visa Advisory", description: "Entry rules & held visa checks" },
      { href: "/refunds", label: "Refunds & Claims", description: "Cancellation & disruption status" },
      { href: "/rewards", label: "Rewards & Points", description: "Tier status & point redemption" },
    ],
  },
  {
    title: "Specialized Travel",
    items: [
      { href: "/corporate", label: "Corporate Desk", description: "Business policies & billing" },
      { href: "/groups", label: "Group Travel", description: "10+ passenger group bookings" },
      { href: "/mice", label: "MICE & Events", description: "Meetings & event logistics" },
    ],
  },
  {
    title: "Platform & Support",
    items: [
      { href: "/dashboard", label: "Management Dashboard", description: "Executive KPI & business analytics" },
      { href: "/ops", label: "Operations Desk", description: "Supplier queues & revalidations" },
      { href: "/escalations", label: "Support & Help", description: "Human assistance & tickets", alsoMatch: ["/ops/escalations"] },
    ],
  },
];

const SECONDARY_LINKS: NavItem[] = SECONDARY_GROUPS.flatMap((g) =>
  g.items.map((i) => ({ href: i.href, label: i.label, alsoMatch: i.alsoMatch })),
);

function isCurrentPath(pathname: string, href: string, alsoMatch?: string[]): boolean {
  if (href === "/") return pathname === "/";
  const prefixes = [href, ...(alsoMatch ?? [])];
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function navLinkClass(pathname: string, item: NavItem, extra = ""): string {
  const active = isCurrentPath(pathname, item.href, item.alsoMatch);
  return [
    "fo-site-nav__link",
    active ? "fo-site-nav__link--active" : "",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

function InfinityMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="26"
      height="18"
      viewBox="0 0 44 32"
      fill="none"
      aria-hidden
    >
      <path
        d="M12.5 7.5C7.253 7.5 3 11.753 3 17C3 22.247 7.253 26.5 12.5 26.5C18.5 26.5 24 16.5 31.5 16.5C36.747 16.5 41 20.753 41 26"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M31.5 26.5C36.747 26.5 41 22.247 41 17C41 11.753 36.747 7.5 31.5 7.5C25.5 7.5 20 17.5 12.5 17.5C7.253 17.5 3 13.247 3 8"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BrandLink() {
  return (
    <Link href="/" className="fo-site-nav__brand">
      <span className="fo-site-nav__brand-mark">
        <InfinityMark />
      </span>
      <span className="fo-site-nav__brand-text" aria-label="FlightOne">
        <span className="fo-site-nav__brand-flight">Flight</span>
        <span className="fo-site-nav__brand-accent">One</span>
      </span>
    </Link>
  );
}

function useDismissible(
  open: boolean,
  onClose: () => void,
  rootRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onPointer = (e: MouseEvent) => {
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) onClose();
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open, onClose, rootRef]);
}

function MoreMenu({
  pathname,
  id,
}: {
  pathname: string;
  id: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useDismissible(open, close, rootRef);

  useEffect(() => {
    close();
  }, [pathname, close]);

  const onButtonKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" && !open) {
      e.preventDefault();
      setOpen(true);
    }
  };

  const isMoreActive =
    pathname === "/more" ||
    pathname.startsWith("/more/") ||
    SECONDARY_LINKS.some((i) => isCurrentPath(pathname, i.href, i.alsoMatch));

  return (
    <div className="fo-site-nav__more" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`fo-site-nav__more-trigger${isMoreActive ? " fo-site-nav__more-trigger--active" : ""}`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onButtonKeyDown}
      >
        More
        <span
          className={`fo-site-nav__more-caret${open ? " fo-site-nav__more-caret--open" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div id={id} role="menu" className="fo-site-nav__panel anim-panel">
          {SECONDARY_GROUPS.map((grp) => (
            <div key={grp.title} className="fo-site-nav__panel-col">
              <span className="fo-site-nav__panel-label">{grp.title}</span>
              {grp.items.map((item) => {
                const active = isCurrentPath(pathname, item.href, item.alsoMatch);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    className={`fo-site-nav__panel-link${active ? " fo-site-nav__panel-link--active" : ""}`}
                    onClick={close}
                  >
                    <span className="fo-site-nav__panel-link-title">
                      {item.label}
                      <span className="text-slate-400 text-xs" aria-hidden>
                        →
                      </span>
                    </span>
                    <span className="fo-site-nav__panel-link-desc">{item.description}</span>
                  </Link>
                );
              })}
            </div>
          ))}
          <div className="fo-site-nav__panel-footer">
            <span className="text-[12px] text-ink-soft">Looking for an account overview?</span>
            <Link
              href="/more"
              className="fo-site-nav__panel-footer-link"
              onClick={close}
            >
              Account & Platform Hub →
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MobileMenu({
  pathname,
  isAuthenticated,
  userLabel,
  isLoggingOut,
  onLogout,
}: {
  pathname: string;
  isAuthenticated: boolean;
  userLabel: string | null;
  isLoggingOut: boolean;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  useDismissible(open, close, rootRef);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="fo-site-nav__mobile" ref={rootRef}>
      {!isAuthenticated && (
        <Link
          href="/login"
          className="fo-site-nav__login fo-site-nav__login--ghost text-xs px-2.5 py-1 mr-2"
        >
          Log in
        </Link>
      )}
      <button
        ref={buttonRef}
        type="button"
        className="fo-site-nav__menu-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="fo-site-nav__menu-icon" aria-hidden data-open={open}>
          <span />
          <span />
          <span />
        </span>
      </button>
      {open ? (
        <div id={panelId} className="fo-site-nav__drawer anim-panel" role="dialog" aria-label="Site menu">
          <div className="fo-site-nav__drawer-section">
            <p className="fo-site-nav__drawer-label">Core Navigation</p>
            {PRIMARY_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={navLinkClass(pathname, item, "fo-site-nav__drawer-link")}
                onClick={close}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {SECONDARY_GROUPS.map((group) => (
            <div key={group.title} className="fo-site-nav__drawer-section pt-1">
              <p className="fo-site-nav__drawer-label">{group.title}</p>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={navLinkClass(pathname, item, "fo-site-nav__drawer-link")}
                  onClick={close}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ))}

          <div className="fo-site-nav__drawer-section pt-1">
            <p className="fo-site-nav__drawer-label">Platform</p>
            <Link
              href="/more"
              className={navLinkClass(pathname, { href: "/more", label: "Account Hub" }, "fo-site-nav__drawer-link font-semibold text-[var(--sky)]")}
              onClick={close}
            >
              Platform Overview & Hub →
            </Link>
          </div>

          <div className="fo-site-nav__drawer-section fo-site-nav__drawer-section--auth">
            {isAuthenticated ? (
              <>
                {userLabel ? (
                  <p className="fo-site-nav__user fo-site-nav__user--drawer">{userLabel}</p>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isLoggingOut}
                  onClick={() => {
                    onLogout();
                    close();
                  }}
                  className="fo-site-nav__logout fo-site-nav__logout--drawer"
                >
                  {isLoggingOut ? "Logging out…" : "Log out"}
                </Button>
              </>
            ) : (
              <div className="fo-site-nav__auth fo-site-nav__auth--drawer flex flex-col gap-2">
                <Link
                  href="/login"
                  className="fo-site-nav__login fo-site-nav__login--ghost text-center py-2 text-sm"
                  onClick={close}
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="fo-site-nav__signup text-center py-2 text-sm font-semibold rounded"
                  onClick={close}
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AuthActions({
  hasHydrated,
  isAuthenticated,
  userLabel,
  isLoggingOut,
  onLogout,
  compact,
}: {
  hasHydrated: boolean;
  isAuthenticated: boolean;
  userLabel: string | null;
  isLoggingOut: boolean;
  onLogout: () => void;
  compact?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    {
      id: "1",
      title: "Welcome to FlightOne",
      message: "Ava is ready to search live flights, stays, and plan your itineraries.",
      time: "Just now",
      read: false,
    },
    {
      id: "2",
      title: "Live Price Tracking Active",
      message: "Real-time pricing is enabled for your route comparisons.",
      time: "10m ago",
      read: true,
    },
  ]);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const user = useAuthStore((s) => s.user);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markOneRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    if (menuOpen || notifOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen, notifOpen]);

  if (!hasHydrated) return null;

  if (isAuthenticated) {
    const displayName = userLabel || user?.name || "Traveler";
    const userEmail = user?.email || null;
    const initial = displayName.charAt(0).toUpperCase() || "A";

    return (
      <div className="fo-site-nav__auth flex items-center gap-3">
        {/* Notification Bell with Badge & Dropdown */}
        {!compact && (
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => {
                setNotifOpen((prev) => !prev);
                setMenuOpen(false);
              }}
              className="relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition-colors focus:outline-none"
              aria-label="Notifications"
              aria-expanded={notifOpen}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-cyan-500 text-[9px] font-bold text-slate-950 ring-2 ring-slate-900">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown Popover */}
            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-slate-700/80 bg-[#091b2e]/95 backdrop-blur-md shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 overflow-hidden text-slate-200">
                <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white tracking-tight">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-400">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/50 fo-scrollbar-subtle">
                  {notifications.length === 0 ? (
                    <div className="py-8 px-4 text-center text-xs text-slate-400">
                      No notifications right now
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => markOneRead(n.id)}
                        className={`group flex items-start gap-2.5 p-3 hover:bg-white/[0.05] transition-colors cursor-pointer ${
                          !n.read ? "bg-white/[0.03]" : ""
                        }`}
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-400 text-xs">
                          ✨
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-xs font-semibold text-white truncate">{n.title}</p>
                            <span className="text-[10px] text-slate-400 shrink-0">{n.time}</span>
                          </div>
                          <p className="text-[11px] text-slate-300 mt-0.5 leading-snug line-clamp-2">
                            {n.message}
                          </p>
                        </div>
                        {!n.read && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400 mt-1.5" />
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="p-2 border-t border-slate-800/80 bg-slate-950/40 text-center">
                  <Link
                    href="/profile"
                    onClick={() => setNotifOpen(false)}
                    className="text-[11px] font-medium text-slate-400 hover:text-cyan-300 transition-colors"
                  >
                    Manage Notification Settings →
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* User Pill with Dropdown Trigger */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(!menuOpen);
              setNotifOpen(false);
            }}
            className="flex items-center gap-2 rounded-lg py-1 px-1.5 hover:bg-white/10 transition-colors text-left focus:outline-none"
            aria-expanded={menuOpen}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-700 text-xs font-bold text-white shadow-xs">
              {initial}
            </div>
            {!compact && (
              <div className="hidden sm:flex items-center gap-1.5 leading-none">
                <span className="text-xs font-semibold text-white tracking-tight">{displayName}</span>
                <svg
                  className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            )}
          </button>

          {/* User Account Popover */}
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-md p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-2 border-b border-slate-800 text-xs">
                <p className="font-semibold text-white truncate">{displayName}</p>
                {userEmail && <p className="text-[10.5px] text-slate-400 truncate mt-0.5">{userEmail}</p>}
              </div>
              <div className="py-1">
                <Link
                  href="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Profile & Preferences
                </Link>
                <Link
                  href="/vault"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Travel Vault
                </Link>
                <Link
                  href="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <svg className="h-3.5 w-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Management Dashboard
                </Link>
                <button
                  type="button"
                  disabled={isLoggingOut}
                  onClick={() => {
                    setMenuOpen(false);
                    onLogout();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-500/15 hover:text-rose-200 transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  {isLoggingOut ? "Logging out…" : "Log out"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fo-site-nav__auth">
      <Link href="/login" className="fo-site-nav__login fo-site-nav__login--ghost">
        Log in
      </Link>
      <Link href="/signup" className="fo-site-nav__signup">
        Sign up
      </Link>
    </div>
  );
}

function MarketplaceMoreMenu({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismissible(open, close, rootRef);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-slate-700 hover:text-slate-950 font-medium transition-colors"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={id}
      >
        More
        <svg
          className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          id={id}
          className="absolute left-1/2 -translate-x-1/2 top-full mt-3 w-80 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150 text-slate-800"
        >
          <div className="space-y-4">
            {SECONDARY_GROUPS.map((grp) => (
              <div key={grp.title} className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block px-1">
                  {grp.title}
                </span>
                <div className="space-y-0.5">
                  {grp.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={close}
                      className="flex items-start justify-between p-2 rounded-xl hover:bg-slate-100/80 transition-colors group"
                    >
                      <div>
                        <p className="text-xs font-semibold text-slate-900 group-hover:text-[#0264d6] transition-colors">
                          {item.label}
                        </p>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          {item.description}
                        </p>
                      </div>
                      <span className="text-slate-400 group-hover:text-[#0264d6] group-hover:translate-x-0.5 transition-all text-xs">
                        →
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 text-center">
            <Link
              href="/more"
              onClick={close}
              className="text-xs font-semibold text-[#0264d6] hover:underline"
            >
              Platform Overview & Hub →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function MarketplaceAuthActions({
  hasHydrated,
  isAuthenticated,
  userLabel,
  isLoggingOut,
  onLogout,
}: {
  hasHydrated: boolean;
  isAuthenticated: boolean;
  userLabel: string | null;
  isLoggingOut: boolean;
  onLogout: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    {
      id: "1",
      title: "Welcome to FlightOne",
      message: "Ready to search live flights, curated stays, and global itineraries.",
      time: "Just now",
      read: false,
    },
    {
      id: "2",
      title: "Direct GDS Rates Active",
      message: "Direct airline inventory connected across 400+ carriers.",
      time: "15m ago",
      read: true,
    },
  ]);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const user = useAuthStore((s) => s.user);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    if (menuOpen || notifOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen, notifOpen]);

  if (!hasHydrated) return null;

  if (isAuthenticated) {
    const displayName = userLabel || user?.name || "Traveler";
    const initial = displayName.charAt(0).toUpperCase() || "T";

    return (
      <div className="flex items-center gap-2.5">
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => {
              setNotifOpen((v) => !v);
              setMenuOpen(false);
            }}
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Notifications"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-[#0264d6] ring-2 ring-white" />
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-slate-200 bg-white/98 backdrop-blur-xl shadow-2xl p-3 z-50 text-slate-800 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-900">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="text-[11px] font-semibold text-[#0264d6] hover:underline"
                  >
                    Mark all as read
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {notifications.map((n) => (
                  <div key={n.id} className="p-2 rounded-xl hover:bg-slate-50 transition-colors">
                    <p className="text-xs font-semibold text-slate-900">{n.title}</p>
                    <p className="text-[11px] text-slate-600 mt-0.5">{n.message}</p>
                    <span className="text-[10px] text-slate-600 mt-1 block">{n.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => {
              setMenuOpen((v) => !v);
              setNotifOpen(false);
            }}
            className="flex items-center gap-2 p-1 rounded-full hover:bg-slate-100 transition-colors"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white text-xs font-bold shadow-xs">
              {initial}
            </div>
            <span className="hidden sm:inline text-xs font-semibold text-slate-900 pr-1">
              {displayName}
            </span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-slate-200 bg-white/98 backdrop-blur-xl p-2 shadow-2xl z-50 text-slate-800 animate-in fade-in zoom-in-95">
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-900 truncate">{displayName}</p>
                {user?.email && <p className="text-[11px] text-slate-600 truncate">{user.email}</p>}
              </div>
              <div className="py-1 space-y-0.5">
                <Link
                  href="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-950 font-medium"
                >
                  Profile & Preferences
                </Link>
                <Link
                  href="/vault"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-950 font-medium"
                >
                  Travel Vault
                </Link>
                <Link
                  href="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-[#0264d6] hover:bg-sky-50 font-semibold"
                >
                  Management Dashboard
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-rose-600 hover:bg-rose-50 font-semibold"
                >
                  {isLoggingOut ? "Logging out…" : "Log out"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-slate-200/90 hover:border-slate-300 text-slate-800 hover:text-slate-950 text-xs font-semibold bg-white/70 hover:bg-slate-50 transition-colors shadow-xs"
      >
        <svg className="h-3.5 w-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        Log in
      </Link>
      <Link
        href="/signup"
        className="inline-flex items-center px-4 py-1.5 rounded-full bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-bold transition-colors shadow-xs"
      >
        Sign up
      </Link>
    </div>
  );
}

function MarketplaceMobileMenu({
  pathname,
  isAuthenticated,
  userLabel,
  isLoggingOut,
  onLogout,
}: {
  pathname: string;
  isAuthenticated: boolean;
  userLabel: string | null;
  isLoggingOut: boolean;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismissible(open, close, rootRef);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition-colors"
        aria-label={open ? "Close menu" : "Open menu"}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {open ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {open && (
        <div className="absolute top-full right-0 w-[calc(100vw-2rem)] max-w-sm bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl p-5 z-50 text-slate-800 animate-in fade-in zoom-in-95 mt-2">
          <div className="space-y-3 pb-4 border-b border-slate-100">
            <Link
              href="/"
              onClick={close}
              className="block text-sm font-semibold text-slate-900 hover:text-[#0264d6]"
            >
              Search
            </Link>
            <a
              href="#destinations"
              onClick={close}
              className="block text-sm font-semibold text-slate-900 hover:text-[#0264d6]"
            >
              Destinations
            </a>
            <a
              href="#stays"
              onClick={close}
              className="block text-sm font-semibold text-slate-900 hover:text-[#0264d6]"
            >
              Hotels
            </a>
            <Link
              href="/corporate"
              onClick={close}
              className="block text-sm font-semibold text-slate-900 hover:text-[#0264d6]"
            >
              Corporate Desk
            </Link>
            <Link
              href="/journey"
              onClick={close}
              className="block text-sm font-semibold text-slate-900 hover:text-[#0264d6]"
            >
              Journey Planner
            </Link>
          </div>

          <div className="py-3 border-b border-slate-100">
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-2">
              Services & Tools
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Link href="/visa" onClick={close} className="text-slate-700 hover:text-slate-950 py-1">Visa Advisory</Link>
              <Link href="/refunds" onClick={close} className="text-slate-700 hover:text-slate-950 py-1">Refunds & Claims</Link>
              <Link href="/groups" onClick={close} className="text-slate-700 hover:text-slate-950 py-1">Group Travel</Link>
              <Link href="/more" onClick={close} className="text-slate-700 hover:text-slate-950 py-1">Platform Hub</Link>
            </div>
          </div>

          <div className="pt-4 flex flex-col gap-2">
            {isAuthenticated ? (
              <>
                <div className="text-xs font-semibold text-slate-900 mb-1">
                  Signed in as {userLabel || "Traveler"}
                </div>
                <Link
                  href="/dashboard"
                  onClick={close}
                  className="text-center py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-900"
                >
                  Management Dashboard
                </Link>
                <button
                  type="button"
                  disabled={isLoggingOut}
                  onClick={() => {
                    close();
                    onLogout();
                  }}
                  className="text-center py-2 px-4 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50"
                >
                  {isLoggingOut ? "Logging out…" : "Log out"}
                </button>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                <Link
                  href="/login"
                  onClick={close}
                  className="text-center py-2.5 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  onClick={close}
                  className="text-center py-2.5 px-4 rounded-xl bg-[#0f172a] text-xs font-bold text-white"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Shared site chrome — brand wordmark, primary links, More / mobile menu, auth.
 */
export function SiteNav({
  variant = "bar",
}: {
  variant?: "bar" | "compact" | "marketplace";
}) {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const isAuthenticated = useAuthStore((s) => Boolean(s.accessToken));
  const userLabel = useAuthStore((s) => s.user?.name ?? s.user?.email ?? null);
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();
  const pathname = usePathname();
  const moreId = useId();

  const onLogout = () => {
    void logout();
  };

  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (variant === "marketplace") {
    return (
      <header
        className={`sticky top-0 z-40 w-full transition-all duration-200 ${
          scrolled
            ? "bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs"
            : "bg-white/35 backdrop-blur-[2px] border-b border-slate-900/5"
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-[#0264d6] group-hover:scale-105 transition-transform flex items-center">
              <InfinityMark className="h-5 w-auto" />
            </span>
            <span className="text-lg font-bold tracking-tight text-slate-900">
              Flight<span className="text-[#0264d6]">One</span>
            </span>
          </Link>

          {/* Center Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-700">
            <Link
              href="/"
              className={`transition-colors hover:text-slate-950 ${pathname === "/" ? "text-[#0264d6] font-semibold" : ""}`}
            >
              Search
            </Link>
            <a
              href="#destinations"
              className="transition-colors hover:text-slate-950"
            >
              Destinations
            </a>
            <a
              href="#stays"
              className="transition-colors hover:text-slate-950"
            >
              Hotels
            </a>
            <Link
              href="/corporate"
              className={`transition-colors hover:text-slate-950 ${pathname === "/corporate" ? "text-[#0264d6] font-semibold" : ""}`}
            >
              Corporate
            </Link>
            <Link
              href="/journey"
              className={`transition-colors hover:text-slate-950 ${pathname === "/journey" ? "text-[#0264d6] font-semibold" : ""}`}
            >
              Journey
            </Link>
            <MarketplaceMoreMenu id={moreId} />
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById("search-panel");
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "center" });
                }
              }}
              aria-label="Search"
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            <MarketplaceAuthActions
              hasHydrated={hasHydrated}
              isAuthenticated={isAuthenticated}
              userLabel={userLabel}
              isLoggingOut={isLoggingOut}
              onLogout={onLogout}
            />

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <MarketplaceMobileMenu
                pathname={pathname}
                isAuthenticated={isAuthenticated}
                userLabel={userLabel}
                isLoggingOut={isLoggingOut}
                onLogout={onLogout}
              />
            </div>
          </div>
        </div>
      </header>
    );
  }

  if (variant === "compact") {
    if (!hasHydrated || !isAuthenticated) return null;

    return (
      <nav
        aria-label="Account shortcuts"
        className="fo-site-nav fo-site-nav--compact anim-fade"
      >
        <div className="fo-site-nav__links fo-site-nav__links--compact">
          {PRIMARY_LINKS.map((item) => (
            <Link key={item.href} href={item.href} className={navLinkClass(pathname, item)}>
              {item.label}
            </Link>
          ))}
          <MoreMenu pathname={pathname} id={`${moreId}-compact`} />
        </div>
        <AuthActions
          hasHydrated={hasHydrated}
          isAuthenticated={isAuthenticated}
          userLabel={userLabel}
          isLoggingOut={isLoggingOut}
          onLogout={onLogout}
          compact
        />
      </nav>
    );
  }

  return (
    <nav aria-label="Primary" className="fo-site-nav anim-fade relative z-20 w-full min-w-0">
      <div className="fo-site-nav__inner">
        <BrandLink />

        {/* Desktop navbar: always render primary links & more dropdown */}
        <div className="fo-site-nav__desktop">
          <div className="fo-site-nav__links">
            {PRIMARY_LINKS.map((item) => (
              <Link key={item.href} href={item.href} className={navLinkClass(pathname, item)}>
                {item.label}
              </Link>
            ))}
            <MoreMenu pathname={pathname} id={moreId} />
          </div>
          <AuthActions
            hasHydrated={hasHydrated}
            isAuthenticated={isAuthenticated}
            userLabel={userLabel}
            isLoggingOut={isLoggingOut}
            onLogout={onLogout}
          />
        </div>

        {/* Mobile menu toggle & drawer */}
        <MobileMenu
          pathname={pathname}
          isAuthenticated={isAuthenticated}
          userLabel={userLabel}
          isLoggingOut={isLoggingOut}
          onLogout={onLogout}
        />
      </div>
    </nav>
  );
}
