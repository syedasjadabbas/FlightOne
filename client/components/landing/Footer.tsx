'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { COMPANY_INFO } from '@/data/company';

/**
 * The five wavy ribbon paths in the footer graphic, as a pure function of
 * scroll progress (0..1) through the footer. Used both for the static
 * initial-paint JSX (progress 0) and for the live per-frame update, so the
 * two can never drift apart.
 */
function computeRibbonPaths(scrollProg: number) {
  const navyHeight = 320 + scrollProg * 240;
  const orangeHeight = 90 + scrollProg * 160;
  const creamHeight = 110 + scrollProg * 180;
  const rightCurveX = 720 + scrollProg * 320;

  return {
    navy: `M 0 0 H 1440 V ${navyHeight * 0.75} C ${rightCurveX} ${navyHeight * 0.8}, ${rightCurveX - 220} 440, 0 400 Z`,
    orange: `M 0 140 H 1440 V ${140 + orangeHeight} C ${rightCurveX + 80} ${180 + orangeHeight}, ${rightCurveX - 180} 460, 0 ${240 + orangeHeight} Z`,
    cream: `M 0 ${220 + orangeHeight * 0.5} H 1440 V ${300 + creamHeight * 0.5} C ${rightCurveX} 480, ${rightCurveX - 260} 520, 0 520 Z`,
    skyBlue: `M ${rightCurveX} 0 C ${rightCurveX - 120} 180, ${rightCurveX - 300} 380, 1440 520 V 0 Z`,
    accent: `M 0 0 H 1440 V 60 C ${rightCurveX} 80, ${rightCurveX - 200} 140, 0 100 Z`,
  };
}

const INITIAL_RIBBON_PATHS = computeRibbonPaths(0);

export default function Footer() {
  const footerRef = useRef<HTMLElement>(null);
  const mainPanelRef = useRef<HTMLDivElement>(null);
  const graphicRef = useRef<HTMLDivElement>(null);
  const wordmarkRef = useRef<HTMLDivElement>(null);

  const [email, setEmail] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // The 5 ribbon <path> elements driven from RAF loop
  const navyPathRef = useRef<SVGPathElement>(null);
  const orangePathRef = useRef<SVGPathElement>(null);
  const creamPathRef = useRef<SVGPathElement>(null);
  const skyBluePathRef = useRef<SVGPathElement>(null);
  const accentPathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    let animId: number;

    const onScroll = () => {
      if (!footerRef.current) return;
      const rect = footerRef.current.getBoundingClientRect();
      const vh = window.innerHeight;

      // Scroll progress through footer
      const totalDist = vh + rect.height;
      const currentDist = vh - rect.top;
      const progress = Math.max(0, Math.min(1, currentDist / totalDist));

      const paths = computeRibbonPaths(progress);
      navyPathRef.current?.setAttribute('d', paths.navy);
      orangePathRef.current?.setAttribute('d', paths.orange);
      creamPathRef.current?.setAttribute('d', paths.cream);
      skyBluePathRef.current?.setAttribute('d', paths.skyBlue);
      accentPathRef.current?.setAttribute('d', paths.accent);

      // Parallax effect on giant bottom wordmark
      if (wordmarkRef.current) {
        const wmProgress = Math.max(0, Math.min(1, (vh - rect.bottom + 400) / 400));
        const wmY = Math.max(0, (1 - wmProgress) * 30);
        const wmScale = 0.97 + 0.03 * wmProgress;
        wordmarkRef.current.style.transform = `translate3d(0, ${wmY}px, 0) scale(${wmScale})`;
      }
    };

    const loop = () => {
      onScroll();
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubmitted(true);
      setEmail('');
      setTimeout(() => setSubmitted(false), 4000);
    }
  };

  return (
    <footer
      id="footer"
      ref={footerRef}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        backgroundColor: '#051122',
        backgroundImage:
          'radial-gradient(120% 90% at 50% 0%, #0A2244 0%, #06152B 45%, #020914 100%)',
        color: '#FFFFFF',
        overflow: 'hidden',
        zIndex: 20,
        boxShadow: '0 -24px 60px rgba(14, 22, 32, 0.25)',
        borderTop: '1px solid rgba(255, 255, 255, 0.12)',
      }}
    >
      {/* ── 1. MAIN FOOTER CONTENT CONTAINER (Generous navbar clearance + luxury editorial layout) ── */}
      <div
        ref={mainPanelRef}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '1380px',
          margin: '0 auto',
          padding:
            'clamp(6.5rem, 11vh, 8.5rem) clamp(1.75rem, 4.5vw, 4.5rem) clamp(3rem, 5vh, 4rem)',
          boxSizing: 'border-box',
          zIndex: 10,
        }}
      >
        {/* ── TOP SHOWCASE: Brand Anchor & Direct Concierge Card ── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 'clamp(2rem, 4vw, 4rem)',
            flexWrap: 'wrap',
          }}
          className="footer-hero-row"
        >
          {/* Left Column: Brand Headline & Vision */}
          <div style={{ maxWidth: '640px', flex: '1 1 380px' }}>
            {/* Trust badge with live pulse */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.625rem',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '9999px',
                padding: '6px 14px',
                marginBottom: '1.25rem',
              }}
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: '#25D366',
                  boxShadow: '0 0 10px #25D366',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: '#74C9DD',
                }}
              >
                Verified Travel Consultant · 24h Turnaround
              </span>
            </div>

            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(2.2rem, 3.8vw, 3.6rem)',
                fontWeight: 600,
                letterSpacing: '-0.035em',
                color: '#F5F4DF',
                lineHeight: 1.08,
                margin: '0 0 1.1rem 0',
              }}
            >
              Every journey, designed around you.
            </h2>

            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'clamp(0.95rem, 1.15vw, 1.0625rem)',
                lineHeight: 1.6,
                color: 'rgba(245, 244, 223, 0.78)',
                margin: 0,
                maxWidth: '560px',
              }}
            >
              {COMPANY_INFO.mission}
            </p>
          </div>

          {/* Right Column: Direct WhatsApp Concierge Card */}
          <div
            style={{
              flex: '1 1 340px',
              maxWidth: '440px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '22px',
              padding: 'clamp(1.5rem, 2.5vw, 2rem)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#74C9DD',
                }}
              >
                Direct Concierge
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.75rem',
                  color: 'rgba(245, 244, 223, 0.65)',
                }}
              >
                Avg. response ~15 mins
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.2rem',
                  fontWeight: 600,
                  color: '#FFFFFF',
                  letterSpacing: '-0.015em',
                }}
              >
                Plan with a Travel Designer
              </span>
              <p
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.84rem',
                  color: 'rgba(245, 244, 223, 0.72)',
                  lineHeight: 1.45,
                  margin: 0,
                }}
              >
                Tell us your destination, dates, and group size. We return flights, hotels, and visa advice in one chat.
              </p>
            </div>

            <Link
              href={COMPANY_INFO.contact.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.625rem',
                backgroundColor: '#007AE5',
                color: '#FFFFFF',
                borderRadius: '9999px',
                padding: '12px 22px',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.875rem',
                fontWeight: 600,
                textDecoration: 'none',
                letterSpacing: '-0.01em',
                boxShadow: '0 8px 24px rgba(0, 122, 229, 0.35)',
                transition: 'background-color 0.25s ease, transform 0.25s ease',
              }}
              className="hover:bg-[#0066cc] hover:scale-[1.02]"
            >
              <span>Chat on WhatsApp</span>
              <span style={{ fontSize: '1.1rem' }}>→</span>
            </Link>
          </div>
        </div>

        {/* ── DIVIDER LINE ── */}
        <div
          style={{
            height: '1px',
            width: '100%',
            background:
              'linear-gradient(90deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.06) 80%, transparent 100%)',
            margin: 'clamp(2.5rem, 5vh, 3.75rem) 0 clamp(2.5rem, 5vh, 3.5rem)',
          }}
        />

        {/* ── MAIN 4-COLUMN NAVIGATION DIRECTORY ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 'clamp(1.75rem, 3.5vw, 3.5rem)',
            alignItems: 'start',
          }}
          className="footer-nav-grid"
        >
          {/* Column 1: Destinations */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h4
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#74C9DD',
                margin: 0,
              }}
            >
              Destinations
            </h4>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              {[
                { label: 'Maldives', desc: 'Overwater villas', query: 'Tell me about honeymoon packages to the Maldives' },
                { label: 'Dubai', desc: 'Luxury city & desert', query: 'Tell me about tour packages to Dubai' },
                { label: 'Turkey', desc: 'Istanbul & Cappadocia', query: 'Tell me about tour packages to Turkey, including Cappadocia' },
                { label: 'Thailand', desc: 'Phuket & Krabi', query: 'Tell me about tour packages to Thailand, including Phuket and Krabi' },
                { label: 'Sri Lanka', desc: 'Nature & culture', query: 'Tell me about tour packages to Sri Lanka' },
              ].map((link) => (
                <li key={link.label}>
                  <Link
                    href={`/chat?q=${encodeURIComponent(link.query)}`}
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '0.9375rem',
                      color: 'rgba(245, 244, 223, 0.85)',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'baseline',
                      gap: '0.5rem',
                      transition: 'color 0.2s ease, transform 0.2s ease',
                    }}
                    className="hover:text-white hover:translate-x-1"
                  >
                    <span style={{ fontWeight: 500 }}>{link.label}</span>
                    <span style={{ fontSize: '0.75rem', color: 'rgba(245, 244, 223, 0.45)' }}>
                      · {link.desc}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 2: Experiences & Services */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h4
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#74C9DD',
                margin: 0,
              }}
            >
              Experiences
            </h4>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              {[
                { label: 'Honeymoon Packages', href: '/chat?q=' + encodeURIComponent('Tell me about honeymoon packages') },
                { label: 'Family Holidays', href: '/chat?q=' + encodeURIComponent('Tell me about family holiday packages') },
                { label: 'Group & MICE Tours', href: '/groups' },
                { label: 'Corporate Travel', href: '/corporate' },
                { label: 'Visa Assistance', href: '/visa' },
                { label: 'Travel E-SIMs', href: '/chat?q=' + encodeURIComponent('Tell me about travel e-SIM add-ons') },
              ].map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '0.9375rem',
                      fontWeight: 450,
                      color: 'rgba(245, 244, 223, 0.85)',
                      textDecoration: 'none',
                      transition: 'color 0.2s ease, transform 0.2s ease',
                    }}
                    className="hover:text-white hover:translate-x-1"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Company & Trust */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h4
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#74C9DD',
                margin: 0,
              }}
            >
              FlightOne
            </h4>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              {[
                { label: 'Why Choose Us', href: '/#why-choose-us' },
                { label: 'Transparent Pricing', href: '/#itinerary' },
                { label: 'Frequently Asked Questions', href: '/support' },
                { label: 'Customer Support', href: '/escalations' },
                { label: 'Refund Policies', href: '/refunds' },
              ].map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '0.9375rem',
                      fontWeight: 450,
                      color: 'rgba(245, 244, 223, 0.85)',
                      textDecoration: 'none',
                      transition: 'color 0.2s ease, transform 0.2s ease',
                    }}
                    className="hover:text-white hover:translate-x-1"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Newsletter & Direct Contact */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h4
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#74C9DD',
                margin: 0,
              }}
            >
              Stay in Touch
            </h4>

            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '0.84rem',
                lineHeight: 1.45,
                color: 'rgba(245, 244, 223, 0.72)',
                margin: 0,
              }}
            >
              Receive seasonal itinerary drops, private fare alerts, and visa updates from Pakistan.
            </p>

            {/* Newsletter Input Capsule */}
            <form
              onSubmit={handleSubmit}
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: isFocused
                  ? '1px solid #74C9DD'
                  : '1px solid rgba(255, 255, 255, 0.16)',
                borderRadius: '9999px',
                padding: '4px 6px 4px 16px',
                boxShadow: isFocused ? '0 0 16px rgba(116, 201, 221, 0.2)' : 'none',
                transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
              }}
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="Enter e-mail address"
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.875rem',
                  color: '#F5F4DF',
                }}
              />
              <button
                type="submit"
                aria-label="Submit email"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#007AE5',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'background-color 0.2s ease, transform 0.2s ease',
                }}
                className="hover:bg-[#0066cc] hover:scale-105"
              >
                →
              </button>
            </form>

            {submitted ? (
              <p style={{ margin: 0, fontSize: '0.8125rem', color: '#25D366' }}>
                Thank you for subscribing!
              </p>
            ) : (
              <span style={{ fontSize: '0.72rem', color: 'rgba(245, 244, 223, 0.5)' }}>
                No spam. Unsubscribe anytime.
              </span>
            )}

            {/* Direct Connect Quick Links */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.85rem',
                marginTop: '0.5rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <a
                href={COMPANY_INFO.contact.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.8125rem',
                  color: 'rgba(245, 244, 223, 0.85)',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                className="hover:text-[#25D366]"
              >
                WhatsApp ↗
              </a>
              <a
                href={COMPANY_INFO.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.8125rem',
                  color: 'rgba(245, 244, 223, 0.85)',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                className="hover:text-white"
              >
                Instagram ↗
              </a>
              <a
                href={`mailto:${COMPANY_INFO.contact.email}`}
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.8125rem',
                  color: 'rgba(245, 244, 223, 0.85)',
                  textDecoration: 'none',
                }}
                className="hover:text-white"
              >
                Email Support ↗
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. BOTTOM SECTION: INTEGRATED ANIMATED RIBBON HORIZON & ICONIC WORDMARK ── */}
      <div
        ref={graphicRef}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          minHeight: '380px',
          height: 'clamp(380px, 42vh, 500px)',
          backgroundColor: '#051122',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
        }}
      >
        {/* Dynamic Curved Multi-Layer SVG Color Ribbon Waves */}
        <svg
          viewBox="0 0 1440 520"
          fill="none"
          preserveAspectRatio="none"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            zIndex: 2,
          }}
        >
          {/* Base Dark Blue Ribbon (#1C3F99) */}
          <path ref={navyPathRef} d={INITIAL_RIBBON_PATHS.navy} fill="#1C3F99" />

          {/* Vibrant Orange Ribbon (#EB6110) */}
          <path ref={orangePathRef} d={INITIAL_RIBBON_PATHS.orange} fill="#EB6110" />

          {/* Soft Peach / Cream Ribbon (#FFD9C9) */}
          <path ref={creamPathRef} d={INITIAL_RIBBON_PATHS.cream} fill="#FFD9C9" />

          {/* Sweeping Sky Blue Ribbon on Right Side (#C1DFEF) */}
          <path ref={skyBluePathRef} d={INITIAL_RIBBON_PATHS.skyBlue} fill="#C1DFEF" />

          {/* Medium Blue Accent (#007AE5) */}
          <path ref={accentPathRef} d={INITIAL_RIBBON_PATHS.accent} fill="#007AE5" />
        </svg>

        {/* BOTTOM OF THE PAGE: Giant High-Contrast FlightOne Wordmark Full-Width Over Ribbons */}
        <div
          ref={wordmarkRef}
          style={{
            position: 'relative',
            zIndex: 10,
            width: '100%',
            maxWidth: '1380px',
            padding: '0 clamp(1.75rem, 4.5vw, 4.5rem) clamp(3.5rem, 6vh, 5rem)',
            margin: '0 auto',
            transformOrigin: 'bottom left',
            willChange: 'transform',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(4.2rem, 11vw, 8.5rem)',
              fontWeight: 700,
              letterSpacing: '-0.04em',
              color: '#F5F4DF',
              lineHeight: 0.85,
              textShadow: '0 8px 32px rgba(14, 22, 32, 0.45)',
              userSelect: 'none',
            }}
          >
            FlightOne
          </div>
        </div>

        {/* ── 3. LEGAL & REGULATORY STRIP ── */}
        <div
          style={{
            position: 'relative',
            zIndex: 12,
            width: '100%',
            maxWidth: '1380px',
            margin: '0 auto',
            padding: '0 clamp(1.75rem, 4.5vw, 4.5rem) clamp(1.5rem, 3vh, 2.25rem)',
            boxSizing: 'border-box',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1.5rem',
            flexWrap: 'wrap',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            paddingTop: '1.25rem',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '0.78rem',
              color: 'rgba(245, 244, 223, 0.72)',
              lineHeight: 1.5,
            }}
          >
            © {new Date().getFullYear()} {COMPANY_INFO.legalName}. All rights reserved. Department of Tourist Services License.
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem',
              flexWrap: 'wrap',
              fontFamily: 'var(--font-sans)',
              fontSize: '0.78rem',
            }}
          >
            <Link href="/support" style={{ color: 'rgba(245, 244, 223, 0.75)', textDecoration: 'none' }} className="hover:text-white">
              FAQ
            </Link>
            <Link href="/refunds" style={{ color: 'rgba(245, 244, 223, 0.75)', textDecoration: 'none' }} className="hover:text-white">
              Refunds
            </Link>
            <Link href="/escalations" style={{ color: 'rgba(245, 244, 223, 0.75)', textDecoration: 'none' }} className="hover:text-white">
              Contact
            </Link>
            <span style={{ color: 'rgba(245, 244, 223, 0.45)' }}>·</span>
            <span style={{ color: '#74C9DD', fontWeight: 500 }}>
              Pakistan (PKR)
            </span>
          </div>
        </div>
      </div>

      <style>{`
        footer ::placeholder {
          color: rgba(245, 244, 223, 0.55) !important;
        }
        @media (max-width: 1024px) {
          .footer-nav-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 2.5rem !important;
          }
          .footer-hero-row {
            flex-direction: column !important;
          }
          .footer-hero-row > div {
            max-width: 100% !important;
          }
        }
        @media (max-width: 640px) {
          .footer-nav-grid {
            grid-template-columns: 1fr !important;
            gap: 2.25rem !important;
          }
        }
      `}</style>
    </footer>
  );
}
