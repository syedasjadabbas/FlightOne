"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Briefcase,
  Car,
  Check,
  ChevronDown,
  ChevronRight,
  Globe,
  Hotel,
  KeyRound,
  LayoutDashboard,
  Lock,
  LogOut,
  Map,
  Menu,
  MessageCircle,
  Mic,
  Plane,
  ShieldCheck,
  Sparkles,
  Stamp,
  Star,
  Undo2,
  User,
  Users,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { useLogoutMutation } from "@/lib/api/auth.api";

/* ─────────────────────────────────────────────────────────────────────────────
   Types & Static Data
───────────────────────────────────────────────────────────────────────────── */
type DropdownId = "explore" | "services" | "account" | "notifications" | null;
type NavIcon = LucideIcon;

const EXPLORE_ITEMS: { label: string; href: string; icon: NavIcon; desc: string }[] = [
  { label: "Flights", href: "/flights", icon: Plane, desc: "Search & compare live fares" },
  { label: "Stays",   href: "/stays",   icon: Hotel, desc: "Hotels, luxury villas & resorts" },
  { label: "Cars",    href: "/cars",    icon: Car,   desc: "Hire at 1,000+ destinations" },
];

const SERVICE_ITEMS: { label: string; href: string; icon: NavIcon; desc: string }[] = [
  { label: "Visa Advisory",    href: "/visa",        icon: Stamp, desc: "End-to-end visa processing" },
  { label: "Corporate Travel", href: "/corporate",   icon: Briefcase, desc: "Managed business trips" },
  { label: "Group Bookings",   href: "/groups",      icon: Users, desc: "Parties of 10 or more" },
  { label: "MICE & Events",    href: "/mice",        icon: Mic, desc: "Conferences & incentives" },
  { label: "Rewards & Points", href: "/rewards",     icon: Star, desc: "Earn miles on every trip" },
  { label: "Support & Help",   href: "/escalations", icon: MessageCircle, desc: "Live agent assistance" },
  { label: "Refunds & Claims", href: "/refunds",     icon: Undo2, desc: "Manage cancellations" },
  { label: "Operations Desk",  href: "/ops",         icon: Zap, desc: "Supplier queues & revalidations" },
];

/* ─────────────────────────────────────────────────────────────────────────────
   Infinity Ribbon SVG Mark
───────────────────────────────────────────────────────────────────────────── */
function InfinityMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="30"
      height="22"
      viewBox="0 0 44 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12.5 7.5C7.253 7.5 3 11.753 3 17C3 22.247 7.253 26.5 12.5 26.5C18.5 26.5 24 16.5 31.5 16.5C36.747 16.5 41 20.753 41 26"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M31.5 26.5C36.747 26.5 41 22.247 41 17C41 11.753 36.747 7.5 31.5 7.5C25.5 7.5 20 17.5 12.5 17.5C7.253 17.5 3 13.247 3 8"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Shared SiteNav Component
───────────────────────────────────────────────────────────────────────────── */
export function SiteNav({
  variant = "bar",
  theme = "light",
  transparentOverHero = false,
}: {
  variant?: "bar" | "compact" | "marketplace";
  theme?: "light" | "dark";
  /** Homepage-only: starts transparent over the hero video, morphs to the standard opaque bar past it. */
  transparentOverHero?: boolean;
}) {
  const pathname = usePathname();
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const isAuthenticated = useAuthStore((s) => Boolean(s.accessToken));
  const user = useAuthStore((s) => s.user);
  const userLabel = useAuthStore((s) => s.user?.name ?? s.user?.email ?? null);
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();

  const [openDropdown, setOpenDropdown] = useState<DropdownId>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileAccordion, setMobileAccordion] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  /* ── hero scroll-morph (homepage only): transparent-over-video → opaque bar ── */
  const [isOverHero, setIsOverHero] = useState(transparentOverHero);
  useEffect(() => {
    if (!transparentOverHero) return;
    const heroHeight = 9600;
    let rafId: number | null = null;
    const update = () => {
      const vh = window.innerHeight;
      const morphThreshold = (heroHeight - vh) * 0.58;
      setIsOverHero(window.scrollY < morphThreshold);
      rafId = null;
    };
    const handleScroll = () => {
      if (rafId === null) rafId = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [transparentOverHero]);

  const onLogout = () => {
    setOpenDropdown(null);
    void logout();
  };

  /* ── Notifications state ── */
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

  const unreadCount = notifications.filter((n) => !n.read).length;
  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  /* ── close menus on route change ── */
  useEffect(() => {
    setOpenDropdown(null);
    setMobileOpen(false);
  }, [pathname]);

  /* ── outside click dismissal ── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ── lock body scroll on mobile open ── */
  useEffect(() => {
    const lenis = (window as unknown as { __lenis?: { stop: () => void; start: () => void } }).__lenis;
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      lenis?.stop();
    } else {
      document.body.style.overflow = "";
      lenis?.start();
    }
    return () => {
      document.body.style.overflow = "";
      lenis?.start();
    };
  }, [mobileOpen]);

  const toggle = useCallback((id: DropdownId) => {
    setOpenDropdown((prev) => (prev === id ? null : id));
  }, []);

  const handleAvaClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (pathname === "/chat") {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("flightone:new-chat"));
    }
  };

  const isDark = theme === "dark";
  const userInitials = (userLabel || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  /* ── Pill button for dropdown trigger ── */
  const PillBtn = ({
    label,
    id,
    isActive = false,
  }: {
    label: string;
    id: DropdownId;
    isActive?: boolean;
  }) => (
    <button
      type="button"
      id={`nav-btn-${id}`}
      aria-haspopup="true"
      aria-expanded={openDropdown === id}
      onClick={() => toggle(id)}
      className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-[13px] font-semibold tracking-[0.01em] whitespace-nowrap transition-all duration-150 cursor-pointer ${
        openDropdown === id || isActive
          ? "border border-black/10 bg-black/6 text-navy font-bold shadow-xs"
          : "border border-transparent text-ink-soft hover:bg-black/5 hover:text-navy"
      }`}
    >
      <span>{label}</span>
      <ChevronDown
        size={13}
        strokeWidth={2.2}
        className={`transition-transform duration-200 opacity-60 ${
          openDropdown === id ? "rotate-180" : ""
        }`}
        aria-hidden
      />
    </button>
  );

  /* ── Plain navigation link ── */
  const NavLink = ({
    href,
    label,
    highlight = false,
    onClick,
  }: {
    href: string;
    label: string;
    highlight?: boolean;
    onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  }) => {
    const isExact = pathname === href || (href.startsWith("/chat") && pathname === "/chat");
    const isNested = href !== "/" && !href.startsWith("/chat") && pathname.startsWith(href);
    const active = isExact || isNested;

    if (highlight) {
      return (
        <Link
          href={href}
          onClick={onClick}
          className="group inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-[#0e1620] px-4 text-[13px] font-bold text-white shadow-[0_2px_8px_rgba(14,22,32,0.18),inset_0_1px_0_rgba(255,255,255,0.2)] whitespace-nowrap transition-all duration-150 hover:bg-[#020615] hover:shadow-[0_4px_14px_rgba(14,22,32,0.28)] hover:translate-y-[-0.5px] active:translate-y-0 active:scale-98"
        >
          <Sparkles size={13} strokeWidth={2.5} className="text-cyan" aria-hidden />
          <span className="tracking-wide">Ava +</span>
        </Link>
      );
    }

    return (
      <Link
        href={href}
        onClick={onClick}
        className={`inline-flex h-9 shrink-0 items-center justify-center rounded-full px-4 text-[13px] font-semibold tracking-[0.01em] whitespace-nowrap transition-all duration-150 ${
          active
            ? "border border-black/10 bg-black/6 text-navy font-bold shadow-xs"
            : "border border-transparent text-ink-soft hover:bg-black/5 hover:text-navy"
        }`}
      >
        {label}
      </Link>
    );
  };

  /* ── Dropdown Item ── */
  const DropItem = ({
    href,
    icon: Icon,
    label,
    desc,
    badge,
    iconColor = "text-sky bg-sky/10",
  }: {
    href: string;
    icon: NavIcon;
    label: string;
    desc?: string;
    badge?: string;
    iconColor?: string;
  }) => (
    <Link
      href={href}
      onClick={() => {
        setTimeout(() => setOpenDropdown(null), 50);
      }}
      className="group flex items-start gap-3 rounded-2xl p-2.5 transition-all duration-150 hover:bg-black/4 active:scale-[0.99]"
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-150 group-hover:scale-105 ${iconColor}`}
      >
        <Icon size={16} strokeWidth={2.2} aria-hidden />
      </div>
      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[13.5px] font-bold text-navy group-hover:text-sky transition-colors">
            {label}
          </span>
          {badge ? (
            <span className="rounded-full bg-emerald/15 px-2 py-0.2 text-[10px] font-bold text-emerald uppercase tracking-wider">
              {badge}
            </span>
          ) : null}
        </div>
        {desc && (
          <span className="text-[11.5px] text-ink-faint leading-snug line-clamp-1">
            {desc}
          </span>
        )}
      </div>
    </Link>
  );

  /* ─────────────────────────────────────────────────────────────────────────────
     Compact Variant
  ───────────────────────────────────────────────────────────────────────────── */
  if (variant === "compact") {
    if (!hasHydrated || !isAuthenticated) return null;
    return (
      <nav
        aria-label="Account shortcuts"
        className="flex items-center gap-2 rounded-2xl border border-black/10 bg-white/90 px-3 py-1.5 shadow-sm backdrop-blur-xl"
      >
        <NavLink href="/" label="Home" />
        <NavLink href="/chat?new=true" label="Ava +" highlight onClick={handleAvaClick} />
        <NavLink href="/journey" label="My Journey" />
        <NavLink href="/vault" label="Vault" />
      </nav>
    );
  }

  /* ─────────────────────────────────────────────────────────────────────────────
     Main Navigation Bar
  ───────────────────────────────────────────────────────────────────────────── */
  return (
    <>
      <header
        ref={navRef}
        id="site-navigation"
        className={
          transparentOverHero
            ? `fixed top-0 right-0 left-0 z-50 flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-8 transition-all duration-300 ${
                isOverHero
                  ? "border-b border-transparent bg-transparent"
                  : "border-b border-black/6 bg-white/85 backdrop-blur-xl saturate-150 shadow-[0_2px_16px_rgba(14,22,32,0.02)]"
              }`
            : "sticky top-0 right-0 left-0 z-50 flex h-16 w-full items-center justify-between border-b border-black/6 bg-white/85 px-4 sm:px-6 lg:px-8 backdrop-blur-xl saturate-150 shadow-[0_2px_16px_rgba(14,22,32,0.02)] transition-all duration-200"
        }
        style={
          transparentOverHero && isOverHero
            ? ({
                "--navy": "#f5f4df",
                "--ink-soft": "rgba(245,244,223,0.75)",
                "--ink-faint": "rgba(245,244,223,0.55)",
              } as React.CSSProperties)
            : undefined
        }
      >
        {/* ── LEFT: Logo & Primary Exploration Links ── */}
        <div className="flex items-center gap-3 sm:gap-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-navy transition-transform duration-150 hover:scale-[1.02] active:scale-98"
          >
            <span className="text-navy flex items-center">
              <InfinityMark />
            </span>
            <span className="font-hero text-[1.125rem] font-extrabold tracking-tight text-navy">
              Flight<span className="text-sky">One</span>
            </span>
            <span className="hidden sm:inline-block h-1.5 w-1.5 rounded-full bg-sky animate-pulse" />
          </Link>

          {/* Desktop Left Nav Links */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-1 pl-2 border-l border-black/6"
          >
            <NavLink href="/" label="Home" />

            {/* Explore Dropdown */}
            <div className="relative">
              <PillBtn label="Explore" id="explore" />
              {openDropdown === "explore" && (
                <div
                  role="menu"
                  aria-label="Explore menu"
                  style={{
                    "--navy": "#0e1620",
                    "--ink-soft": "#55606e",
                    "--ink-faint": "#7a8494",
                  } as React.CSSProperties}
                  className="absolute top-[calc(100%+10px)] left-0 z-50 w-72 rounded-3xl border border-black/10 bg-white p-2 shadow-[0_24px_54px_-12px_rgba(14,22,32,0.22),0_4px_16px_rgba(14,22,32,0.06)] backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="px-3 py-1.5 mb-1 border-b border-black/4">
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">
                      Autonomous Travel Search
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    {EXPLORE_ITEMS.map((item) => (
                      <DropItem key={item.label} {...item} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Services Dropdown */}
            <div className="relative">
              <PillBtn
                label="Services"
                id="services"
                isActive={SERVICE_ITEMS.some((i) => pathname.startsWith(i.href))}
              />
              {openDropdown === "services" && (
                <div
                  role="menu"
                  aria-label="Services menu"
                  style={{
                    "--navy": "#0e1620",
                    "--ink-soft": "#55606e",
                    "--ink-faint": "#7a8494",
                  } as React.CSSProperties}
                  className="absolute top-[calc(100%+10px)] left-0 z-50 w-84 rounded-3xl border border-black/10 bg-white p-2 shadow-[0_24px_54px_-12px_rgba(14,22,32,0.22),0_4px_16px_rgba(14,22,32,0.06)] backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="px-3 py-1.5 mb-1 border-b border-black/4">
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">
                      Specialized Travel Operations
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-0.5 max-h-[70vh] overflow-y-auto">
                    {SERVICE_ITEMS.map((item) => (
                      <DropItem key={item.label} {...item} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </nav>
        </div>

        {/* ── RIGHT: Ava · Journey · Vault · Notifications · Account ── */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Desktop Right Links */}
          <div className="hidden md:flex items-center gap-1.5">
            <NavLink href="/chat?new=true" label="Ava +" highlight onClick={handleAvaClick} />
            <NavLink href="/journey" label="My Journey" />
            <NavLink href="/vault" label="Vault" />

            {/* Notifications Bell (Authenticated) */}
            {hasHydrated && isAuthenticated && (
              <div className="relative">
                <button
                  type="button"
                  aria-label="Notifications"
                  aria-expanded={openDropdown === "notifications"}
                  onClick={() => toggle("notifications")}
                  className={`relative flex h-9 w-9 items-center justify-center rounded-full transition-all duration-150 cursor-pointer ${
                    openDropdown === "notifications"
                      ? "bg-black/8 text-navy"
                      : "text-ink-soft hover:bg-black/5 hover:text-navy"
                  }`}
                >
                  <Bell size={17} strokeWidth={2} aria-hidden />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-sky" />
                    </span>
                  )}
                </button>

                {openDropdown === "notifications" && (
                  <div
                    role="menu"
                    aria-label="Notifications"
                    style={{
                      "--navy": "#0e1620",
                      "--ink-soft": "#55606e",
                      "--ink-faint": "#7a8494",
                    } as React.CSSProperties}
                    className="absolute top-[calc(100%+10px)] right-0 z-50 w-80 rounded-3xl border border-black/10 bg-white p-3 shadow-[0_24px_54px_-12px_rgba(14,22,32,0.22),0_4px_16px_rgba(14,22,32,0.06)] backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150"
                  >
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-black/6">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-navy">Notifications</span>
                        {unreadCount > 0 && (
                          <span className="rounded-full bg-sky/15 px-2 py-0.2 text-[10.5px] font-bold text-sky">
                            {unreadCount} new
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllRead}
                          className="text-[11.5px] font-semibold text-sky hover:underline cursor-pointer"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`rounded-2xl p-3 transition-colors ${
                            n.read ? "bg-transparent hover:bg-black/3" : "bg-sky/6 hover:bg-sky/9"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[12.5px] font-bold text-navy">{n.title}</p>
                            <span className="text-[10.5px] text-ink-faint shrink-0">{n.time}</span>
                          </div>
                          <p className="mt-0.5 text-[11.5px] text-ink-soft leading-relaxed">
                            {n.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Account dropdown / Profile Avatar Pill */}
            {hasHydrated && isAuthenticated ? (
              <div className="relative">
                <button
                  type="button"
                  aria-label="Account menu"
                  aria-expanded={openDropdown === "account"}
                  onClick={() => toggle("account")}
                  className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full p-1 pr-3.5 transition-all duration-150 cursor-pointer border whitespace-nowrap ${
                    openDropdown === "account"
                      ? "border-black/20 bg-black/6 shadow-xs"
                      : "border-black/10 bg-white/80 hover:border-black/20 hover:bg-white shadow-xs"
                  }`}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-[11.5px] font-bold text-white shadow-xs">
                    {userInitials}
                  </div>
                  <span className="text-[13px] font-bold text-navy truncate max-w-28">
                    {user?.name || userLabel?.split("@")[0] || "Traveler"}
                  </span>
                  <ChevronDown
                    size={12}
                    strokeWidth={2.2}
                    className={`text-ink-soft transition-transform duration-200 ${
                      openDropdown === "account" ? "rotate-180" : ""
                    }`}
                    aria-hidden
                  />
                </button>

                {openDropdown === "account" && (
                  <div
                    role="menu"
                    aria-label="Account menu"
                    style={{
                      "--navy": "#0e1620",
                      "--ink-soft": "#55606e",
                      "--ink-faint": "#7a8494",
                    } as React.CSSProperties}
                    className="absolute top-[calc(100%+10px)] right-0 z-50 w-72 rounded-3xl border border-black/10 bg-white p-2.5 shadow-[0_24px_54px_-12px_rgba(14,22,32,0.22),0_4px_16px_rgba(14,22,32,0.06)] backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150"
                  >
                    {/* User Identity Card Header */}
                    <div className="flex items-center gap-3 p-3 mb-2 rounded-2xl bg-[#f8fafb] border border-black/6">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0e1620] text-[13px] font-bold text-white shadow-sm ring-2 ring-sky/30">
                        {userInitials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[13.5px] font-bold text-navy truncate">
                            {user?.name || "Verified Traveler"}
                          </p>
                          <span className="h-2 w-2 rounded-full bg-emerald shrink-0 ring-2 ring-emerald/20" />
                        </div>
                        <p className="text-[11.5px] text-ink-faint truncate">
                          {user?.email || "Account Holder"}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky/10 px-2 py-0.5 text-[9.5px] font-bold text-sky uppercase tracking-wider">
                            <ShieldCheck size={10} strokeWidth={2.5} />
                            <span>Dossier Active</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Menu links */}
                    <div className="space-y-0.5">
                      <DropItem
                        href="/profile"
                        icon={User}
                        label="Profile & Preferences"
                        desc="Autonomous booking dossiers & identity"
                        iconColor="text-sky bg-sky/10"
                      />
                      <DropItem
                        href="/vault"
                        icon={Lock}
                        label="Travel Vault"
                        desc="Zero-knowledge biometric documents"
                        badge="AES-256"
                        iconColor="text-emerald bg-emerald/10"
                      />
                      <DropItem
                        href="/journey"
                        icon={Map}
                        label="My Journey"
                        desc="Active flight routes & timeline watches"
                        iconColor="text-sky bg-sky/10"
                      />
                      <DropItem
                        href="/dashboard"
                        icon={LayoutDashboard}
                        label="Operations Console"
                        desc="Agent controls & management overview"
                        iconColor="text-amber-600 bg-amber-500/10"
                      />
                    </div>

                    {/* Sign Out Footer */}
                    <div className="mt-1.5 pt-1.5 border-t border-black/6">
                      <button
                        type="button"
                        disabled={isLoggingOut}
                        onClick={onLogout}
                        className="flex w-full items-center gap-2.5 rounded-2xl p-2.5 text-[13px] font-bold text-danger transition-colors hover:bg-danger/10 cursor-pointer"
                      >
                        <LogOut size={15} strokeWidth={2.2} aria-hidden />
                        <span>{isLoggingOut ? "Signing out…" : "Sign Out"}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Unauthenticated Auth Buttons */
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="inline-flex h-9 shrink-0 items-center justify-center rounded-full border px-4 text-[13px] font-bold whitespace-nowrap transition-all hover:bg-black/5 active:scale-95"
                  style={{
                    borderColor: transparentOverHero && isOverHero ? "rgba(245,244,223,0.3)" : "rgba(14,22,32,0.14)",
                    color: "var(--navy)",
                  }}
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-[#0e1620] px-4.5 text-[13px] font-bold text-white shadow-[0_2px_10px_rgba(14,22,32,0.18)] whitespace-nowrap transition-all hover:bg-[#020615] active:scale-95"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            id="nav-mobile-toggle"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((prev) => !prev)}
            className="flex md:hidden h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/80 text-navy transition-all hover:bg-white active:scale-95"
          >
            {mobileOpen ? (
              <X size={18} strokeWidth={2.2} aria-hidden />
            ) : (
              <Menu size={18} strokeWidth={2.2} aria-hidden />
            )}
          </button>
        </div>
      </header>

      {/* ── MOBILE FULL-SCREEN MENU DRAWER ── */}
      {mobileOpen && (
        <div
          id="nav-mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
          className="fixed inset-0 z-40 flex flex-col bg-white/95 pt-20 pb-8 px-6 backdrop-blur-2xl overflow-y-auto animate-in fade-in duration-200"
        >
          <nav className="flex-1 flex flex-col gap-2">
            <Link
              href="/"
              onClick={() => setTimeout(() => setMobileOpen(false), 50)}
              className="flex items-center px-4 py-3 rounded-2xl text-[15px] font-bold text-navy hover:bg-black/5"
            >
              Home
            </Link>

            <Link
              href="/chat?new=true"
              onClick={(e) => {
                if (pathname === "/chat") {
                  e.preventDefault();
                  window.dispatchEvent(new CustomEvent("flightone:new-chat"));
                }
                setTimeout(() => setMobileOpen(false), 50);
              }}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-[#0e1620] text-white font-bold text-[15px] shadow-sm"
            >
              <Sparkles size={16} strokeWidth={2.5} className="text-cyan" aria-hidden />
              <span>Chat with Ava</span>
            </Link>

            {/* Mobile Explore Section */}
            <div className="pt-2">
              <p className="px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                Explore
              </p>
              <div className="space-y-1">
                {EXPLORE_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-[14px] font-semibold text-navy hover:bg-black/5"
                    >
                      <Icon size={16} strokeWidth={2} className="text-sky" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Mobile Services Section */}
            <div className="pt-2">
              <p className="px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                Services
              </p>
              <div className="space-y-1">
                {SERVICE_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-[14px] font-semibold text-navy hover:bg-black/5"
                    >
                      <Icon size={16} strokeWidth={2} className="text-sky" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Mobile Account Section */}
            <div className="mt-4 pt-4 border-t border-black/10">
              {isAuthenticated ? (
                <div className="space-y-1">
                  <div className="px-4 py-2 mb-2 rounded-2xl bg-black/5">
                    <p className="text-[13px] font-bold text-navy">{user?.name || "Traveler"}</p>
                    <p className="text-[11.5px] text-ink-faint">{user?.email}</p>
                  </div>
                  <Link
                    href="/profile"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-[14px] font-semibold text-navy hover:bg-black/5"
                  >
                    <User size={16} strokeWidth={2} className="text-sky" />
                    <span>Profile & Preferences</span>
                  </Link>
                  <Link
                    href="/vault"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-[14px] font-semibold text-navy hover:bg-black/5"
                  >
                    <Lock size={16} strokeWidth={2} className="text-emerald" />
                    <span>Travel Vault</span>
                  </Link>
                  <Link
                    href="/journey"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-[14px] font-semibold text-navy hover:bg-black/5"
                  >
                    <Map size={16} strokeWidth={2} className="text-sky" />
                    <span>My Journey</span>
                  </Link>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="flex w-full items-center gap-3 px-4 py-2.5 rounded-2xl text-[14px] font-bold text-danger hover:bg-danger/10"
                  >
                    <LogOut size={16} strokeWidth={2} />
                    <span>Log Out</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 px-2">
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex justify-center items-center rounded-2xl border border-black/10 py-3 text-[14px] font-bold text-navy"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setMobileOpen(false)}
                    className="flex justify-center items-center rounded-2xl bg-[#0e1620] py-3 text-[14px] font-bold text-white shadow-sm"
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
