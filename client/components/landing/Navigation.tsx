'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useLogoutMutation } from '@/lib/api/auth.api';

/* ─────────────────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────────────────── */
type DropdownId = 'explore' | 'services' | 'account' | null;

/* ─────────────────────────────────────────────────────────────────────────────
   Static nav data
───────────────────────────────────────────────────────────────────────────── */
const EXPLORE_ITEMS = [
  { label: 'Flights',  href: '/#search', icon: '✈', desc: 'Search & compare live fares' },
  { label: 'Stays',   href: '/#search', icon: '🏨', desc: 'Hotels, villas & resorts' },
  { label: 'Cars',    href: '/#search', icon: '🚗', desc: 'Hire at 1 000+ destinations' },
];

const SERVICE_ITEMS = [
  { label: 'Visa Assistance',  href: '/visa',        icon: '🛂', desc: 'End-to-end visa processing' },
  { label: 'Corporate Travel', href: '/corporate',   icon: '💼', desc: 'Managed business trips' },
  { label: 'Group Bookings',   href: '/groups',      icon: '👥', desc: 'Parties of 10 or more' },
  { label: 'MICE & Events',    href: '/mice',        icon: '🎤', desc: 'Conferences & incentives' },
  { label: 'Rewards',          href: '/rewards',     icon: '⭐', desc: 'Earn miles on every trip' },
  { label: 'Support',          href: '/escalations', icon: '💬', desc: 'Live agent assistance' },
  { label: 'Refunds',          href: '/refunds',     icon: '↩',  desc: 'Manage cancellations' },
];

const ACCOUNT_ITEMS = [
  { label: 'Profile',      href: '/profile', icon: '👤' },
  { label: 'My Journey',   href: '/journey', icon: '🗺' },
  { label: 'Travel Vault', href: '/vault',   icon: '🔒' },
];

/* ─────────────────────────────────────────────────────────────────────────────
   Component
───────────────────────────────────────────────────────────────────────────── */
export default function Navigation() {
  const [isLightSection, setIsLightSection] = useState(false);
  const [scrolled,       setScrolled]       = useState(false);
  const [openDropdown,   setOpenDropdown]   = useState<DropdownId>(null);
  const [mobileOpen,     setMobileOpen]     = useState(false);
  const [mobileAccordion, setMobileAccordion] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const isAuthenticated = useAuthStore((s) => Boolean(s.accessToken));
  const user = useAuthStore((s) => s.user);
  const userLabel = useAuthStore((s) => s.user?.name ?? s.user?.email ?? null);
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();

  const onLogout = () => {
    setOpenDropdown(null);
    void logout();
  };

  /* ── scroll position tracking ── */
  useEffect(() => {
    let rafId: number | null = null;
    const update = () => {
      rafId = null;
      const scrollY = window.scrollY;
      setScrolled(scrollY > 20);
      const heroHeight     = 9600;
      const vh             = window.innerHeight;
      const morphThreshold = (heroHeight - vh) * 0.58;
      setIsLightSection(scrollY > morphThreshold);
    };
    const handleScroll = () => {
      if (rafId === null) rafId = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  /* ── close dropdown on outside click ── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ── lock body scroll when mobile menu open ── */
  useEffect(() => {
    const lenis = (window as unknown as { __lenis?: { stop: () => void; start: () => void } }).__lenis;
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
      lenis?.stop();
    } else {
      document.body.style.overflow = '';
      lenis?.start();
    }
    return () => {
      document.body.style.overflow = '';
      lenis?.start();
    };
  }, [mobileOpen]);

  /* ── derived colours ── */
  const textColor    = isLightSection ? '#0E1620' : '#F5F4DF';
  const subTextColor = isLightSection ? '#4A5568' : 'rgba(245,244,223,0.6)';
  const hoverBg      = isLightSection ? 'rgba(14,22,32,0.06)' : 'rgba(245,244,223,0.08)';
  const dropdownBg   = isLightSection ? 'rgba(252,251,245,0.97)' : 'rgba(10,18,30,0.97)';
  const dropdownBorder = isLightSection
    ? '1px solid rgba(14,22,32,0.1)'
    : '1px solid rgba(245,244,223,0.1)';
  const dropdownShadow = '0 24px 60px rgba(0,0,0,0.22), 0 4px 12px rgba(0,0,0,0.12)';

  const toggle = useCallback((id: DropdownId) => {
    setOpenDropdown(prev => (prev === id ? null : id));
  }, []);

  const handleScrollToTop = (e: React.MouseEvent) => {
    setOpenDropdown(null);
    setMobileOpen(false);
    if (typeof window !== 'undefined' && window.location.pathname === '/') {
      e.preventDefault();
      const lenis = (window as unknown as {
        __lenis?: { scrollTo: (t: number, o?: { duration?: number }) => void };
      }).__lenis;
      if (lenis) lenis.scrollTo(0, { duration: 1.2 });
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  /* ── pill button (triggers a dropdown) ── */
  const PillBtn = ({
    label,
    id,
  }: {
    label: string;
    id: DropdownId;
  }) => (
    <button
      id={`nav-btn-${id}`}
      aria-haspopup="true"
      aria-expanded={openDropdown === id}
      onClick={() => toggle(id)}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '6px 12px',
        borderRadius: '20px',
        color: textColor,
        fontSize: '13px',
        fontFamily: 'inherit',
        fontWeight: 500,
        letterSpacing: '0.02em',
        transition: 'background 0.2s',
        backgroundColor: openDropdown === id ? hoverBg : 'transparent',
        pointerEvents: 'auto',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = hoverBg)}
      onMouseLeave={e =>
        (e.currentTarget.style.backgroundColor =
          openDropdown === id ? hoverBg : 'transparent')
      }
    >
      {label}
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        style={{
          transform: openDropdown === id ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
          opacity: 0.7,
        }}
      >
        <path
          d="M2 3.5L5 6.5L8 3.5"
          stroke={textColor}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );

  /* ── plain link button ── */
  const NavLink = ({
    href,
    label,
    highlight = false,
  }: {
    href: string;
    label: string;
    highlight?: boolean;
  }) => (
    <Link
      href={href}
      style={{
        padding: '6px 14px',
        borderRadius: '20px',
        color: highlight ? '#007AE5' : textColor,
        fontSize: '13px',
        fontWeight: highlight ? 600 : 500,
        letterSpacing: '0.02em',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        transition: 'background 0.2s, color 0.2s',
        backgroundColor: 'transparent',
        pointerEvents: 'auto',
        border: highlight
          ? `1px solid ${isLightSection ? 'rgba(0,122,229,0.3)' : 'rgba(0,122,229,0.5)'}`
          : 'none',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.backgroundColor = highlight
          ? 'rgba(0,122,229,0.1)'
          : hoverBg;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
      }}
    >
      {label}
    </Link>
  );

  /* ── single dropdown item ── */
  const DropItem = ({
    href,
    icon,
    label,
    desc,
  }: {
    href: string;
    icon: string;
    label: string;
    desc?: string;
  }) => (
    <Link
      href={href}
      onClick={() => {
        setTimeout(() => setOpenDropdown(null), 50);
      }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '10px 14px',
        borderRadius: '10px',
        textDecoration: 'none',
        pointerEvents: 'auto',
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e =>
        ((e.currentTarget as HTMLElement).style.backgroundColor = isLightSection
          ? 'rgba(14,22,32,0.05)'
          : 'rgba(245,244,223,0.07)')
      }
      onMouseLeave={e =>
        ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')
      }
    >
      <span style={{ fontSize: '16px', lineHeight: 1, marginTop: '1px', flexShrink: 0 }}>
        {icon}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span style={{ color: textColor, fontSize: '13px', fontWeight: 500 }}>{label}</span>
        {desc && (
          <span style={{ color: subTextColor, fontSize: '11.5px', lineHeight: 1.4 }}>{desc}</span>
        )}
      </span>
    </Link>
  );

  /* ─────────────────────────── render ── */
  return (
    <>
      <header
        ref={navRef}
        id="site-navigation"
        className={`joby-nav ${scrolled ? 'scrolled' : ''} ${isLightSection ? 'light-mode' : 'dark-mode'}`}
        style={{
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 200,
          pointerEvents: 'none',
          height: '64px',
          paddingLeft:  'clamp(16px, 3vw, 40px)',
          paddingRight: 'clamp(16px, 3vw, 40px)',
          backdropFilter:       scrolled ? 'blur(20px) saturate(1.4)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(20px) saturate(1.4)' : 'none',
          backgroundColor: scrolled
            ? isLightSection
              ? 'rgba(252,251,245,0.88)'
              : 'rgba(10,18,30,0.88)'
            : 'transparent',
          borderBottom: scrolled
            ? isLightSection
              ? '1px solid rgba(14,22,32,0.08)'
              : '1px solid rgba(245,244,223,0.06)'
            : 'none',
          transition:
            'background-color 0.35s ease, border-color 0.35s ease, backdrop-filter 0.35s ease',
        }}
      >
        {/* ── LEFT: Home + Explore + Services ── */}
        <nav
          aria-label="Primary navigation"
          className="nav-desktop-left"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            pointerEvents: 'auto',
            position: 'relative',
          }}
        >
          {/* Home */}
          <NavLink href="/" label="Home" />

          {/* Explore */}
          <div style={{ position: 'relative' }}>
            <PillBtn label="Explore" id="explore" />
            {openDropdown === 'explore' && (
              <div
                role="menu"
                aria-label="Explore menu"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 12px)',
                  left: 0,
                  width: '260px',
                  pointerEvents: 'auto',
                  zIndex: 210,
                  background: dropdownBg,
                  border: dropdownBorder,
                  borderRadius: '16px',
                  boxShadow: dropdownShadow,
                  padding: '8px',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  animation: 'navDropIn 0.18s ease',
                }}
              >
                {EXPLORE_ITEMS.map(item => (
                  <DropItem key={item.label} {...item} />
                ))}
              </div>
            )}
          </div>

          {/* Services */}
          <div style={{ position: 'relative' }}>
            <PillBtn label="Services" id="services" />
            {openDropdown === 'services' && (
              <div
                role="menu"
                aria-label="Services menu"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 12px)',
                  left: 0,
                  width: '280px',
                  pointerEvents: 'auto',
                  zIndex: 210,
                  background: dropdownBg,
                  border: dropdownBorder,
                  borderRadius: '16px',
                  boxShadow: dropdownShadow,
                  padding: '8px',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  animation: 'navDropIn 0.18s ease',
                }}
              >
                {SERVICE_ITEMS.map(item => (
                  <DropItem key={item.label} {...item} />
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* ── CENTER: Infinity Logo ── */}
        <Link
          href="/"
          onClick={handleScrollToTop}
          aria-label="FlightOne — scroll to top"
          style={{
            pointerEvents: 'auto',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.92,
            transition: 'opacity 0.2s, transform 0.2s',
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.opacity = '1';
            (e.currentTarget as HTMLElement).style.transform =
              'translateX(-50%) scale(1.08)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.opacity = '0.92';
            (e.currentTarget as HTMLElement).style.transform =
              'translateX(-50%) scale(1)';
          }}
        >
          <svg
            width="44"
            height="30"
            viewBox="0 0 44 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12.5 7.5C7.253 7.5 3 11.753 3 17C3 22.247 7.253 26.5 12.5 26.5C18.5 26.5 24 16.5 31.5 16.5C36.747 16.5 41 20.753 41 26"
              stroke={textColor}
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <path
              d="M31.5 26.5C36.747 26.5 41 22.247 41 17C41 11.753 36.747 7.5 31.5 7.5C25.5 7.5 20 17.5 12.5 17.5C7.253 17.5 3 13.247 3 8"
              stroke={textColor}
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
        </Link>

        {/* ── RIGHT: Ava · Journey · Vault · Account · Mobile toggle ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            pointerEvents: 'auto',
          }}
        >
          {/* Desktop links */}
          <div
            className="nav-desktop-right"
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <NavLink href="/chat"    label="Ava ✦" highlight />
            <NavLink href="/journey" label="My Journey" />
            <NavLink href="/vault"   label="Vault" />

            {/* Account dropdown */}
            <div style={{ position: 'relative' }}>
              <PillBtn
                label={hasHydrated && isAuthenticated ? (userLabel?.split('@')[0] || 'Account') : 'Account'}
                id="account"
              />
              {openDropdown === 'account' && (
                <div
                  role="menu"
                  aria-label="Account menu"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 12px)',
                    right: 0,
                    width: '230px',
                    pointerEvents: 'auto',
                    zIndex: 210,
                    background: dropdownBg,
                    border: dropdownBorder,
                    borderRadius: '16px',
                    boxShadow: dropdownShadow,
                    padding: '8px',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    animation: 'navDropIn 0.18s ease',
                  }}
                >
                  {hasHydrated && isAuthenticated ? (
                    <>
                      <div
                        style={{
                          padding: '8px 12px',
                          borderBottom: isLightSection
                            ? '1px solid rgba(14,22,32,0.08)'
                            : '1px solid rgba(245,244,223,0.08)',
                        }}
                      >
                        <p style={{ fontSize: '13px', fontWeight: 600, color: textColor, margin: 0 }}>
                          {user?.name || 'Traveler'}
                        </p>
                        {user?.email && (
                          <p style={{ fontSize: '11px', color: subTextColor, margin: '2px 0 0' }}>
                            {user.email}
                          </p>
                        )}
                      </div>
                      <DropItem href="/profile" icon="👤" label="Profile" desc="Personal details & 2FA" />
                      <DropItem href="/journey" icon="🗺" label="My Journey" desc="Active bookings & routes" />
                      <DropItem href="/vault"   icon="🔒" label="Travel Vault" desc="Passports & secure docs" />
                      <DropItem href="/dashboard" icon="⚡" label="Dashboard" desc="Operations & overview" />
                      <div
                        style={{
                          margin: '6px 8px',
                          height: '1px',
                          backgroundColor: isLightSection
                            ? 'rgba(14,22,32,0.08)'
                            : 'rgba(245,244,223,0.08)',
                        }}
                      />
                      <button
                        type="button"
                        disabled={isLoggingOut}
                        onClick={onLogout}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '9px 14px',
                          borderRadius: '10px',
                          border: 'none',
                          background: 'transparent',
                          color: '#ef4444',
                          fontSize: '13px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)')
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor = 'transparent')
                        }
                      >
                        <span style={{ fontSize: '15px' }}>🚪</span>
                        {isLoggingOut ? 'Signing out…' : 'Log Out'}
                      </button>
                    </>
                  ) : (
                    <>
                      {ACCOUNT_ITEMS.map(item => (
                        <DropItem key={item.label} href={item.href} icon={item.icon} label={item.label} />
                      ))}
                      <div
                        style={{
                          margin: '6px 8px',
                          height: '1px',
                          backgroundColor: isLightSection
                            ? 'rgba(14,22,32,0.08)'
                            : 'rgba(245,244,223,0.08)',
                        }}
                      />
                      <DropItem href="/login"  icon="🔑" label="Sign In"        desc="Access your account" />
                      <DropItem href="/signup" icon="✨" label="Create Account" desc="Join FlightOne free"  />
                    </>
                  )}
                </div>
              )}
            </div>

            {(!hasHydrated || !isAuthenticated) && (
              <NavLink href="/login" label="Sign In" />
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            id="nav-mobile-toggle"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            className="nav-mobile-hamburger"
            onClick={() => setMobileOpen(prev => !prev)}
            style={{
              display: 'none',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              pointerEvents: 'auto',
              flexDirection: 'column',
              gap: '5px',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
            }}
          >
            {[0, 1, 2].map(i => (
              <span
                key={i}
                style={{
                  display: 'block',
                  width: '20px',
                  height: '1.5px',
                  backgroundColor: textColor,
                  borderRadius: '2px',
                  transition: 'transform 0.25s, opacity 0.25s',
                  transform:
                    mobileOpen && i === 0
                      ? 'translateY(6.5px) rotate(45deg)'
                      : mobileOpen && i === 2
                      ? 'translateY(-6.5px) rotate(-45deg)'
                      : 'none',
                  opacity: mobileOpen && i === 1 ? 0 : 1,
                }}
              />
            ))}
          </button>
        </div>
      </header>

      {/* ── MOBILE FULL-SCREEN MENU ── */}
      {mobileOpen && (
        <div
          id="nav-mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
          style={{
            position: 'fixed',
            inset: 0,
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box',
            overflowX: 'hidden',
            zIndex: 199,
            backgroundColor: isLightSection
              ? 'rgba(252,251,245,0.98)'
              : 'rgba(10,18,30,0.98)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            display: 'flex',
            flexDirection: 'column',
            paddingTop: '80px',
            paddingBottom: '32px',
            overflowY: 'auto',
            animation: 'mobileMenuIn 0.25s ease',
          }}
        >
          <nav
            style={{
              flex: 1,
              padding: '0 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            {/* Ava CTA */}
            <Link
              href="/chat"
              onClick={() => setMobileOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 16px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #007AE5 0%, #0056b3 100%)',
                color: '#FFFFFF',
                textDecoration: 'none',
                fontSize: '15px',
                fontWeight: 600,
                marginBottom: '8px',
              }}
            >
              <span>✦</span> Chat with Ava
            </Link>

            {/* Explore accordion */}
            <MobileAccordion
              id="explore"
              label="Explore"
              open={mobileAccordion === 'explore'}
              onToggle={() =>
                setMobileAccordion(p => (p === 'explore' ? null : 'explore'))
              }
              textColor={textColor}
              isLight={isLightSection}
            >
              {EXPLORE_ITEMS.map(item => (
                <MobileLink
                  key={item.label}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  textColor={textColor}
                  onClose={() => setMobileOpen(false)}
                />
              ))}
            </MobileAccordion>

            {/* Services accordion */}
            <MobileAccordion
              id="services"
              label="Services"
              open={mobileAccordion === 'services'}
              onToggle={() =>
                setMobileAccordion(p => (p === 'services' ? null : 'services'))
              }
              textColor={textColor}
              isLight={isLightSection}
            >
              {SERVICE_ITEMS.map(item => (
                <MobileLink
                  key={item.label}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  textColor={textColor}
                  onClose={() => setMobileOpen(false)}
                />
              ))}
            </MobileAccordion>

            {/* Direct links */}
            {[
              { label: 'My Journey',   href: '/journey', icon: '🗺' },
              { label: 'Travel Vault', href: '/vault',   icon: '🔒' },
            ].map(item => (
              <MobileLink
                key={item.label}
                href={item.href}
                label={item.label}
                icon={item.icon}
                textColor={textColor}
                onClose={() => setMobileOpen(false)}
              />
            ))}

            {/* Account accordion */}
            <div
              style={{
                marginTop: '12px',
                paddingTop: '12px',
                borderTop: `1px solid ${
                  isLightSection
                    ? 'rgba(14,22,32,0.1)'
                    : 'rgba(245,244,223,0.1)'
                }`,
              }}
            >
              {hasHydrated && isAuthenticated ? (
                <>
                  <p style={{ padding: '4px 16px', fontSize: '12px', color: subTextColor, margin: 0 }}>
                    Signed in as {userLabel}
                  </p>
                  <MobileLink
                    href="/profile"
                    label="Profile & Preferences"
                    icon="👤"
                    textColor={textColor}
                    onClose={() => setMobileOpen(false)}
                  />
                  <MobileLink
                    href="/dashboard"
                    label="Management Dashboard"
                    icon="⚡"
                    textColor={textColor}
                    onClose={() => setMobileOpen(false)}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      void logout();
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '11px 16px',
                      background: 'none',
                      border: 'none',
                      color: '#f87171',
                      fontSize: '14px',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ width: '20px', textAlign: 'center' }}>🚪</span>
                    Log Out
                  </button>
                </>
              ) : (
                <MobileAccordion
                  id="account"
                  label="Account"
                  open={mobileAccordion === 'account'}
                  onToggle={() =>
                    setMobileAccordion(p => (p === 'account' ? null : 'account'))
                  }
                  textColor={textColor}
                  isLight={isLightSection}
                >
                  {ACCOUNT_ITEMS.map(item => (
                    <MobileLink
                      key={item.label}
                      href={item.href}
                      label={item.label}
                      icon={item.icon}
                      textColor={textColor}
                      onClose={() => setMobileOpen(false)}
                    />
                  ))}
                  <MobileLink
                    href="/login"
                    label="Sign In"
                    icon="🔑"
                    textColor={textColor}
                    onClose={() => setMobileOpen(false)}
                  />
                  <MobileLink
                    href="/signup"
                    label="Create Account"
                    icon="✨"
                    textColor={textColor}
                    onClose={() => setMobileOpen(false)}
                  />
                </MobileAccordion>
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
        @media (max-width: 768px) {
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
  isLight,
}: {
  id: string;
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  textColor: string;
  isLight: boolean;
}) {
  return (
    <div>
      <button
        id={`mobile-accordion-${id}`}
        aria-expanded={open}
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '13px 16px',
          background: 'none',
          border: 'none',
          borderRadius: '12px',
          cursor: 'pointer',
          color: textColor,
          fontSize: '15px',
          fontWeight: 500,
          fontFamily: 'inherit',
          backgroundColor: open
            ? isLight
              ? 'rgba(14,22,32,0.05)'
              : 'rgba(245,244,223,0.05)'
            : 'transparent',
        }}
      >
        {label}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s',
            opacity: 0.6,
          }}
        >
          <path
            d="M2 4.5L6 8L10 4.5"
            stroke={textColor}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {open && (
        <div
          style={{
            paddingLeft: '12px',
            paddingBottom: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
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
  icon,
  textColor,
  onClose,
}: {
  href: string;
  label: string;
  icon: string;
  textColor: string;
  onClose: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={() => {
        setTimeout(onClose, 50);
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '11px 16px',
        borderRadius: '10px',
        color: textColor,
        textDecoration: 'none',
        fontSize: '14px',
        fontWeight: 400,
        transition: 'background 0.15s',
      }}
    >
      <span style={{ width: '20px', textAlign: 'center', fontSize: '15px' }}>{icon}</span>
      {label}
    </Link>
  );
}

