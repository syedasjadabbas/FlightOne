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
  ChevronDown,
  Hotel,
  LayoutDashboard,
  Lock,
  LogOut,
  Map,
  Menu,
  MessageCircle,
  Mic,
  Plane,
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
   Types & Static Data (Harmonized with Landing Page)
───────────────────────────────────────────────────────────────────────────── */
type DropdownId = "explore" | "services" | "account" | "notifications" | null;
type NavIcon = LucideIcon;

const EXPLORE_ITEMS: { label: string; href: string; icon: NavIcon; desc: string }[] = [
  { label: "Flights", href: "/#search", icon: Plane, desc: "Search & compare live fares" },
  { label: "Stays",   href: "/#search", icon: Hotel, desc: "Hotels, villas & resorts" },
  { label: "Cars",    href: "/#search", icon: Car, desc: "Hire at 1 000+ destinations" },
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
   Infinity Ribbon SVG Mark (Exact Homepage Mark)
───────────────────────────────────────────────────────────────────────────── */
function InfinityMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="34"
      height="24"
      viewBox="0 0 44 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
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

/* ─────────────────────────────────────────────────────────────────────────────
   Shared SiteNav Component
───────────────────────────────────────────────────────────────────────────── */
export function SiteNav({
  variant = "bar",
  theme = "dark",
}: {
  variant?: "bar" | "compact" | "marketplace";
  theme?: "light" | "dark";
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

  /* ── design tokens matching homepage navbar ── */
  const isDark = theme !== "light";
  const textColor = isDark ? "#F5F4DF" : "#0E1620";
  const subTextColor = isDark ? "rgba(245, 244, 223, 0.65)" : "#55606E";
  const faintTextColor = isDark ? "rgba(245, 244, 223, 0.4)" : "#8A96A6";
  const hoverBg = isDark ? "rgba(245, 244, 223, 0.08)" : "rgba(14, 22, 32, 0.06)";
  const activeBg = isDark ? "rgba(245, 244, 223, 0.12)" : "rgba(14, 22, 32, 0.08)";
  const headerBg = isDark ? "rgba(10, 18, 30, 0.92)" : "rgba(252, 251, 245, 0.88)";
  const borderBottom = isDark ? "1px solid rgba(245, 244, 223, 0.08)" : "1px solid rgba(14, 22, 32, 0.08)";
  const dropdownBg = isDark ? "rgba(10, 18, 30, 0.97)" : "rgba(252, 251, 245, 0.97)";
  const dropdownBorder = isDark ? "1px solid rgba(245, 244, 223, 0.1)" : "1px solid rgba(14, 22, 32, 0.1)";
  const dropdownShadow = isDark
    ? "0 24px 60px rgba(0,0,0,0.35), 0 4px 12px rgba(0,0,0,0.2)"
    : "0 24px 60px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.06)";
  const dropdownDivider = isDark ? "1px solid rgba(245, 244, 223, 0.08)" : "1px solid rgba(14, 22, 32, 0.08)";
  const dropdownItemHover = isDark ? "rgba(245, 244, 223, 0.07)" : "rgba(14, 22, 32, 0.05)";
  const mobileBg = isDark ? "rgba(10, 18, 30, 0.98)" : "rgba(252, 251, 245, 0.98)";
  const unreadItemBg = isDark ? "rgba(245, 244, 223, 0.04)" : "rgba(0, 122, 229, 0.05)";

  const toggle = useCallback((id: DropdownId) => {
    setOpenDropdown((prev) => (prev === id ? null : id));
  }, []);

  const handleAvaClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (pathname === "/chat") {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("flightone:new-chat"));
    }
  };

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
      id={`nav-btn-${id}`}
      aria-haspopup="true"
      aria-expanded={openDropdown === id}
      onClick={() => toggle(id)}
      style={{
        background: openDropdown === id || isActive ? hoverBg : "transparent",
        border: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "5px",
        padding: "6px 13px",
        borderRadius: "20px",
        color: textColor,
        fontSize: "13px",
        fontFamily: "var(--font-display), var(--font-sans), sans-serif",
        fontWeight: isActive ? 600 : 500,
        letterSpacing: "0.02em",
        transition: "background 0.2s, color 0.2s",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hoverBg)}
      onMouseLeave={(e) =>
        (e.currentTarget.style.backgroundColor =
          openDropdown === id || isActive ? hoverBg : "transparent")
      }
    >
      {label}
      <ChevronDown
        size={12}
        strokeWidth={2}
        aria-hidden
        style={{
          transform: openDropdown === id ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.2s",
          opacity: 0.7,
        }}
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

    return (
      <Link
        href={href}
        onClick={onClick}
        style={{
          padding: "6px 14px",
          borderRadius: "20px",
          color: highlight ? "#007AE5" : textColor,
          fontSize: "13px",
          fontFamily: "var(--font-display), var(--font-sans), sans-serif",
          fontWeight: highlight || active ? 600 : 500,
          letterSpacing: "0.02em",
          textDecoration: "none",
          whiteSpace: "nowrap",
          transition: "background 0.2s, color 0.2s, border-color 0.2s, box-shadow 0.2s",
          backgroundColor:
            highlight && active
              ? "rgba(0, 122, 229, 0.16)"
              : highlight
              ? isDark
                ? "rgba(0, 122, 229, 0.08)"
                : "rgba(0, 122, 229, 0.06)"
              : active
              ? activeBg
              : "transparent",
          border: highlight
            ? active
              ? "1px solid #007AE5"
              : isDark
              ? "1px solid rgba(0, 122, 229, 0.5)"
              : "1px solid rgba(0, 122, 229, 0.3)"
            : "1px solid transparent",
          boxShadow: highlight && active ? (isDark ? "0 0 14px rgba(0, 122, 229, 0.28)" : "0 0 12px rgba(0, 122, 229, 0.16)") : "none",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = highlight
            ? isDark
              ? "rgba(0, 122, 229, 0.18)"
              : "rgba(0, 122, 229, 0.14)"
            : hoverBg;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor =
            highlight && active
              ? "rgba(0, 122, 229, 0.16)"
              : highlight
              ? isDark
                ? "rgba(0, 122, 229, 0.08)"
                : "rgba(0, 122, 229, 0.06)"
              : active
              ? activeBg
              : "transparent";
        }}
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
  }: {
    href: string;
    icon: NavIcon;
    label: string;
    desc?: string;
  }) => (
    <Link
      href={href}
      onClick={() => {
        setTimeout(() => setOpenDropdown(null), 50);
      }}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        padding: "10px 14px",
        borderRadius: "10px",
        textDecoration: "none",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLElement).style.backgroundColor = dropdownItemHover)
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")
      }
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: "1px",
          flexShrink: 0,
          color: textColor,
          opacity: 0.85,
        }}
      >
        <Icon size={16} strokeWidth={1.75} aria-hidden />
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <span style={{ color: textColor, fontSize: "13px", fontWeight: 500 }}>{label}</span>
        {desc && (
          <span style={{ color: subTextColor, fontSize: "11px", lineHeight: 1.3 }}>
            {desc}
          </span>
        )}
      </span>
    </Link>
  );

  /* ─────────────────────────────────────────────────────────────────────────────
     Compact Variant (Preserved for small account strip if requested)
  ───────────────────────────────────────────────────────────────────────────── */
  if (variant === "compact") {
    if (!hasHydrated || !isAuthenticated) return null;
    return (
      <nav
        aria-label="Account shortcuts"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "4px 12px",
          background: headerBg,
          borderRadius: "12px",
          border: borderBottom,
          boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
        }}
      >
        <NavLink href="/" label="Home" />
        <NavLink href="/chat?new=true" label="Ava +" highlight onClick={handleAvaClick} />
        <NavLink href="/journey" label="My Journey" />
        <NavLink href="/vault" label="Vault" />
      </nav>
    );
  }

  /* ─────────────────────────────────────────────────────────────────────────────
     Main Navigation (Matches Homepage 100%)
  ───────────────────────────────────────────────────────────────────────────── */
  return (
    <>
      <header
        ref={navRef}
        id="site-navigation"
        className="fo-site-nav"
        style={{
          position: "sticky",
          top: 0,
          left: 0,
          right: 0,
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          height: "64px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingLeft: "clamp(16px, 3vw, 40px)",
          paddingRight: "clamp(16px, 3vw, 40px)",
          backgroundColor: headerBg,
          backdropFilter: "blur(20px) saturate(1.4)",
          WebkitBackdropFilter: "blur(20px) saturate(1.4)",
          borderBottom: borderBottom,
          zIndex: 100,
        }}
      >
        {/* ── LEFT: Logo + Home + Explore + Services ── */}
        <div style={{ display: "flex", alignItems: "center", gap: "clamp(8px, 1.5vw, 16px)" }}>
          {/* Infinity Mark & FlightOne Brand */}
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "9px",
              textDecoration: "none",
              color: textColor,
              opacity: 0.95,
              transition: "opacity 0.2s, transform 0.2s",
              marginRight: "4px",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = "1";
              (e.currentTarget as HTMLElement).style.transform = "scale(1.02)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = "0.95";
              (e.currentTarget as HTMLElement).style.transform = "scale(1)";
            }}
          >
            <span style={{ color: textColor, display: "flex", alignItems: "center" }}>
              <InfinityMark />
            </span>
            <span
              style={{
                fontFamily: "var(--font-display), sans-serif",
                fontSize: "1.125rem",
                fontWeight: 700,
                color: textColor,
                letterSpacing: "-0.03em",
                lineHeight: 1,
              }}
            >
              Flight<span style={{ color: "#007AE5" }}>One</span>
            </span>
          </Link>

          {/* Desktop Left Nav Links */}
          <nav
            aria-label="Primary navigation"
            className="nav-desktop-left"
            style={{ display: "flex", alignItems: "center", gap: "2px" }}
          >
            {/* 1. HOME: Redirects to / (replaces Search) */}
            <NavLink href="/" label="Home" />

            {/* 2. Explore dropdown */}
            <div style={{ position: "relative" }}>
              <PillBtn label="Explore" id="explore" />
              {openDropdown === "explore" && (
                <div
                  role="menu"
                  aria-label="Explore menu"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 12px)",
                    left: 0,
                    width: "260px",
                    background: dropdownBg,
                    border: dropdownBorder,
                    borderRadius: "16px",
                    boxShadow: dropdownShadow,
                    padding: "8px",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    animation: "navDropIn 0.18s ease",
                    zIndex: 200,
                  }}
                >
                  {EXPLORE_ITEMS.map((item) => (
                    <DropItem key={item.label} {...item} />
                  ))}
                </div>
              )}
            </div>

            {/* 3. Services dropdown */}
            <div style={{ position: "relative" }}>
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
                    position: "absolute",
                    top: "calc(100% + 12px)",
                    left: 0,
                    width: "280px",
                    background: dropdownBg,
                    border: dropdownBorder,
                    borderRadius: "16px",
                    boxShadow: dropdownShadow,
                    padding: "8px",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    animation: "navDropIn 0.18s ease",
                    zIndex: 200,
                  }}
                >
                  {SERVICE_ITEMS.map((item) => (
                    <DropItem key={item.label} {...item} />
                  ))}
                </div>
              )}
            </div>
          </nav>
        </div>

        {/* ── RIGHT: Ava · Journey · Vault · Notifications · Account · Mobile Toggle ── */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {/* Desktop Right Links */}
          <div
            className="nav-desktop-right"
            style={{ display: "flex", alignItems: "center", gap: "4px" }}
          >
            <NavLink href="/chat?new=true" label="Ava +" highlight onClick={handleAvaClick} />
            <NavLink href="/journey" label="My Journey" />
            <NavLink href="/vault" label="Vault" />

            {/* Notifications Bell (Authenticated) */}
            {hasHydrated && isAuthenticated && (
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  aria-label="Notifications"
                  aria-expanded={openDropdown === "notifications"}
                  onClick={() => toggle("notifications")}
                  style={{
                    background: openDropdown === "notifications" ? hoverBg : "transparent",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "34px",
                    height: "34px",
                    borderRadius: "50%",
                    color: textColor,
                    transition: "background 0.2s",
                    position: "relative",
                  }}
                >
                  <Bell size={17} strokeWidth={1.8} aria-hidden />
                  {unreadCount > 0 && (
                    <span
                      style={{
                        position: "absolute",
                        top: "4px",
                        right: "4px",
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: "#007AE5",
                        boxShadow: "0 0 6px #007AE5",
                      }}
                    />
                  )}
                </button>

                {openDropdown === "notifications" && (
                  <div
                    role="menu"
                    aria-label="Notifications"
                    style={{
                      position: "absolute",
                      top: "calc(100% + 12px)",
                      right: 0,
                      width: "300px",
                      background: dropdownBg,
                      border: dropdownBorder,
                      borderRadius: "16px",
                      boxShadow: dropdownShadow,
                      padding: "12px",
                      backdropFilter: "blur(20px)",
                      WebkitBackdropFilter: "blur(20px)",
                      animation: "navDropIn 0.18s ease",
                      zIndex: 200,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingBottom: "8px",
                        marginBottom: "6px",
                        borderBottom: dropdownDivider,
                      }}
                    >
                      <span style={{ fontSize: "12px", fontWeight: 600, color: textColor }}>
                        Notifications
                      </span>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllRead}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "11px",
                            fontWeight: 500,
                            color: "#007AE5",
                          }}
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          style={{
                            padding: "8px 10px",
                            borderRadius: "10px",
                            backgroundColor: n.read ? "transparent" : unreadItemBg,
                          }}
                        >
                          <p style={{ fontSize: "12px", fontWeight: 600, color: textColor, margin: 0 }}>
                            {n.title}
                          </p>
                          <p
                            style={{
                              fontSize: "11px",
                              color: subTextColor,
                              margin: "2px 0 0",
                              lineHeight: 1.35,
                            }}
                          >
                            {n.message}
                          </p>
                          <span
                            style={{
                              fontSize: "10px",
                              color: faintTextColor,
                              marginTop: "4px",
                              display: "block",
                            }}
                          >
                            {n.time}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Account dropdown / Profile Avatar */}
            {hasHydrated && isAuthenticated ? (
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  aria-label="Account menu"
                  aria-expanded={openDropdown === "account"}
                  onClick={() => toggle("account")}
                  style={{
                    background: openDropdown === "account" ? hoverBg : "transparent",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "4px 8px 4px 4px",
                    borderRadius: "20px",
                    color: textColor,
                    transition: "background 0.2s",
                  }}
                >
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      backgroundColor: "#007AE5",
                      color: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    {(userLabel || "T").charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontSize: "13px", fontWeight: 500 }}>
                    {userLabel?.split("@")[0] || "Account"}
                  </span>
                  <ChevronDown size={12} strokeWidth={2} aria-hidden style={{ opacity: 0.7 }} />
                </button>

                {openDropdown === "account" && (
                  <div
                    role="menu"
                    aria-label="Account menu"
                    style={{
                      position: "absolute",
                      top: "calc(100% + 12px)",
                      right: 0,
                      width: "230px",
                      background: dropdownBg,
                      border: dropdownBorder,
                      borderRadius: "16px",
                      boxShadow: dropdownShadow,
                      padding: "8px",
                      backdropFilter: "blur(20px)",
                      WebkitBackdropFilter: "blur(20px)",
                      animation: "navDropIn 0.18s ease",
                      zIndex: 200,
                    }}
                  >
                    <div style={{ padding: "8px 12px", borderBottom: dropdownDivider }}>
                      <p style={{ fontSize: "13px", fontWeight: 600, color: textColor, margin: 0 }}>
                        {user?.name || "Traveler"}
                      </p>
                      {user?.email && (
                        <p style={{ fontSize: "11px", color: subTextColor, margin: "2px 0 0" }}>
                          {user.email}
                        </p>
                      )}
                    </div>
                    <div style={{ padding: "4px 0" }}>
                      <DropItem href="/profile" icon={User} label="Profile & Preferences" />
                      <DropItem href="/vault" icon={Lock} label="Travel Vault" />
                      <DropItem href="/dashboard" icon={LayoutDashboard} label="Management Dashboard" />
                    </div>
                    <div style={{ borderTop: dropdownDivider, paddingTop: "4px" }}>
                      <button
                        type="button"
                        disabled={isLoggingOut}
                        onClick={onLogout}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "9px 14px",
                          borderRadius: "10px",
                          border: "none",
                          background: "transparent",
                          color: "#ef4444",
                          fontSize: "13px",
                          fontWeight: 500,
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.08)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor = "transparent")
                        }
                      >
                        <LogOut size={15} strokeWidth={1.75} aria-hidden />
                        {isLoggingOut ? "Signing out…" : "Log Out"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Unauthenticated Auth Buttons */
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Link
                  href="/login"
                  style={{
                    padding: "6px 14px",
                    borderRadius: "20px",
                    color: textColor,
                    fontSize: "13px",
                    fontWeight: 500,
                    textDecoration: "none",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hoverBg)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  style={{
                    padding: "6px 16px",
                    borderRadius: "20px",
                    backgroundColor: "#007AE5",
                    color: "#FFFFFF",
                    fontSize: "13px",
                    fontWeight: 600,
                    textDecoration: "none",
                    boxShadow: "0 2px 10px rgba(0, 122, 229, 0.25)",
                    transition: "opacity 0.2s, transform 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <button
            id="nav-mobile-toggle"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="nav-mobile-hamburger"
            onClick={() => setMobileOpen((prev) => !prev)}
            style={{
              display: "none",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "8px",
              alignItems: "center",
              justifyContent: "center",
              width: "36px",
              height: "36px",
              color: textColor,
            }}
          >
            {mobileOpen ? (
              <X size={20} strokeWidth={1.75} color={textColor} aria-hidden />
            ) : (
              <Menu size={20} strokeWidth={1.75} color={textColor} aria-hidden />
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
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 199,
            backgroundColor: mobileBg,
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            display: "flex",
            flexDirection: "column",
            paddingTop: "76px",
            paddingBottom: "32px",
            overflowY: "auto",
            animation: "mobileMenuIn 0.25s ease",
          }}
        >
          <nav
            style={{
              flex: 1,
              padding: "0 24px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            {/* Primary Direct Links */}
            <Link
              href="/"
              onClick={() => {
                setTimeout(() => setMobileOpen(false), 50);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "13px 16px",
                borderRadius: "12px",
                color: textColor,
                textDecoration: "none",
                fontSize: "15px",
                fontWeight: 500,
              }}
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
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "13px 16px",
                borderRadius: "12px",
                backgroundColor: "rgba(0, 122, 229, 0.08)",
                border: "1px solid rgba(0, 122, 229, 0.3)",
                color: "#007AE5",
                textDecoration: "none",
                fontSize: "15px",
                fontWeight: 600,
                marginBottom: "4px",
              }}
            >
              <Sparkles size={16} strokeWidth={1.75} aria-hidden /> Chat with Ava
            </Link>

            {/* Explore accordion */}
            <MobileAccordion
              id="explore"
              label="Explore"
              open={mobileAccordion === "explore"}
              onToggle={() =>
                setMobileAccordion((p) => (p === "explore" ? null : "explore"))
              }
              textColor={textColor}
              hoverBg={hoverBg}
            >
              {EXPLORE_ITEMS.map((item) => (
                <MobileLink
                  key={item.label}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  textColor={textColor}
                  hoverBg={dropdownItemHover}
                  onClose={() => setMobileOpen(false)}
                />
              ))}
            </MobileAccordion>

            {/* Services accordion */}
            <MobileAccordion
              id="services"
              label="Services"
              open={mobileAccordion === "services"}
              onToggle={() =>
                setMobileAccordion((p) => (p === "services" ? null : "services"))
              }
              textColor={textColor}
              hoverBg={hoverBg}
            >
              {SERVICE_ITEMS.map((item) => (
                <MobileLink
                  key={item.label}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  textColor={textColor}
                  hoverBg={dropdownItemHover}
                  onClose={() => setMobileOpen(false)}
                />
              ))}
            </MobileAccordion>

            {/* Direct links */}
            {[
              { label: "My Journey", href: "/journey", icon: Map },
              { label: "Travel Vault", href: "/vault", icon: Lock },
            ].map((item) => (
              <MobileLink
                key={item.label}
                href={item.href}
                label={item.label}
                icon={item.icon}
                textColor={textColor}
                hoverBg={dropdownItemHover}
                onClose={() => setMobileOpen(false)}
              />
            ))}

            {/* Account / Auth */}
            <div
              style={{
                marginTop: "12px",
                paddingTop: "12px",
                borderTop: dropdownDivider,
              }}
            >
              {isAuthenticated ? (
                <>
                  <p style={{ padding: "4px 16px", fontSize: "12px", color: subTextColor, margin: 0 }}>
                    Signed in as {userLabel}
                  </p>
                  <MobileLink
                    href="/profile"
                    label="Profile & Preferences"
                    icon={User}
                    textColor={textColor}
                    hoverBg={dropdownItemHover}
                    onClose={() => setMobileOpen(false)}
                  />
                  <MobileLink
                    href="/dashboard"
                    label="Management Dashboard"
                    icon={LayoutDashboard}
                    textColor={textColor}
                    hoverBg={dropdownItemHover}
                    onClose={() => setMobileOpen(false)}
                  />
                  <button
                    type="button"
                    onClick={onLogout}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "11px 16px",
                      background: "none",
                      border: "none",
                      color: "#f87171",
                      fontSize: "14px",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ width: "20px", display: "flex", justifyContent: "center" }}>
                      <LogOut size={15} strokeWidth={1.75} aria-hidden />
                    </span>
                    Log Out
                  </button>
                </>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "8px 16px" }}>
                  <Link
                    href="/login"
                    onClick={() => {
                      setTimeout(() => setMobileOpen(false), 50);
                    }}
                    style={{
                      textAlign: "center",
                      padding: "10px",
                      borderRadius: "10px",
                      border: isDark ? "1px solid rgba(245, 244, 223, 0.2)" : "1px solid rgba(14, 22, 32, 0.15)",
                      color: textColor,
                      textDecoration: "none",
                      fontSize: "14px",
                      fontWeight: 500,
                    }}
                  >
                    Log in
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => {
                      setTimeout(() => setMobileOpen(false), 50);
                    }}
                    style={{
                      textAlign: "center",
                      padding: "10px",
                      borderRadius: "10px",
                      backgroundColor: "#007AE5",
                      color: "#FFFFFF",
                      textDecoration: "none",
                      fontSize: "14px",
                      fontWeight: 600,
                    }}
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}

      {/* ── Keyframe styles ── */}
      <style>{`
        @keyframes navDropIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        @keyframes mobileMenuIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @media (max-width: 860px) {
          .nav-desktop-left    { display: none !important; }
          .nav-desktop-right   { display: none !important; }
          .nav-mobile-hamburger { display: flex !important; }
        }
      `}</style>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Mobile sub-components
───────────────────────────────────────────────────────────────────────────── */
function MobileAccordion({
  id,
  label,
  open,
  onToggle,
  children,
  textColor,
  hoverBg = "rgba(14, 22, 32, 0.05)",
}: {
  id: string;
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  textColor: string;
  hoverBg?: string;
}) {
  return (
    <div>
      <button
        id={`mobile-accordion-${id}`}
        aria-expanded={open}
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "13px 16px",
          background: "none",
          border: "none",
          borderRadius: "12px",
          cursor: "pointer",
          color: textColor,
          fontSize: "15px",
          fontWeight: 500,
          fontFamily: "inherit",
          backgroundColor: open ? hoverBg : "transparent",
        }}
      >
        {label}
        <ChevronDown
          size={14}
          strokeWidth={2}
          aria-hidden
          style={{
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
            opacity: 0.6,
          }}
        />
      </button>
      {open && (
        <div
          style={{
            paddingLeft: "12px",
            paddingBottom: "4px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function MobileLink({
  href,
  label,
  icon: Icon,
  textColor,
  hoverBg = "rgba(14, 22, 32, 0.05)",
  onClose,
}: {
  href: string;
  label: string;
  icon: NavIcon;
  textColor: string;
  hoverBg?: string;
  onClose: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={() => {
        setTimeout(onClose, 50);
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "11px 16px",
        borderRadius: "10px",
        color: textColor,
        textDecoration: "none",
        fontSize: "14px",
        fontWeight: 400,
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = hoverBg)}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}
    >
      <span
        style={{
          width: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.85,
        }}
      >
        <Icon size={15} strokeWidth={1.75} aria-hidden />
      </span>
      {label}
    </Link>
  );
}
