'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { COMPANY_INFO } from '@/data/company';

/**
 * The four wavy ribbon paths in the footer graphic, as a pure function of
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

  // The 5 ribbon <path> elements: driven straight from the RAF loop below via
  // setAttribute, not React state, since this scroll-linked value changes up
  // to 60x/sec for as long as the footer exists on the page — routing it
  // through useState previously forced a full component re-render every
  // single frame (newsletter form, links, everything) regardless of whether
  // the user was even scrolling. Same math, same visual output each frame;
  // only the update mechanism changed.
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
        backgroundColor: '#007AE5',
        color: '#FFFFFF',
        overflow: 'hidden',
        zIndex: 20,
        boxShadow: '0 -24px 60px rgba(14, 22, 32, 0.18)',
      }}
    >
      {/* ── 1. MAIN FULL-SCREEN FOOTER VIEWPORT CONTAINER (100vh / 100dvh) ── */}
      <div
        ref={mainPanelRef}
        style={{
          position: 'relative',
          width: '100%',
          minHeight: '100dvh',
          backgroundColor: '#007AE5',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 'clamp(3.5rem, 6vh, 5.5rem) clamp(2rem, 4.5vw, 4.5rem) clamp(3rem, 5vh, 4.5rem)',
          boxSizing: 'border-box',
          zIndex: 10,
        }}
      >
        {/* TOP ROW: LEGAL META / SUBLINKS (LEFT) & 3-COLUMN DIRECTORY (RIGHT) */}
        <div
          style={{
            width: '100%',
            maxWidth: '100%',
            display: 'grid',
            gridTemplateColumns: 'minmax(280px, 1.15fr) minmax(360px, 2fr)',
            gap: 'clamp(2.5rem, 5vw, 5rem)',
            alignItems: 'start',
          }}
          className="footer-top-grid"
        >
          {/* Left Column: Legal, Copyright & Policy Sub-links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'rgba(255, 255, 255, 0.95)',
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                © 2026 FlightOne. All rights reserved.
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.8125rem',
                  color: 'rgba(255, 255, 255, 0.75)',
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                {COMPANY_INFO.mission}
              </p>
            </div>

            {/* Sub-links */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.625rem',
              }}
            >
              {[
                { label: 'FAQ', href: '/faq' },
                { label: 'Honeymoon Packages', href: '/honeymoon-packages' },
                { label: 'Family Holidays', href: '/family-holidays' },
                { label: 'Group Tours', href: '/group-tours' },
                { label: 'Travel E-SIMs', href: '/e-sim' },
              ].map((subLink) => (
                <Link
                  key={subLink.label}
                  href={subLink.href}
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '0.8125rem',
                    color: 'rgba(255, 255, 255, 0.78)',
                    textDecoration: 'none',
                    transition: 'color 0.2s ease, transform 0.2s ease',
                    width: 'fit-content',
                  }}
                  className="hover:text-white hover:underline"
                >
                  {subLink.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Right Column: 3 Directory Columns (Explore, Company, Connect) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 'clamp(1.5rem, 3.5vw, 3.5rem)',
            }}
            className="footer-nav-columns"
          >
            {/* Column 1: Explore */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h4
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.9375rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#FFFFFF',
                  margin: 0,
                }}
              >
                Destinations
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {[
                  { label: 'Maldives', href: '/destinations/maldives' },
                  { label: 'Sri Lanka', href: '/destinations/sri-lanka' },
                  { label: 'Dubai', href: '/destinations/dubai' },
                  { label: 'Thailand', href: '/destinations/thailand' },
                  { label: 'Turkey', href: '/destinations/turkey' },
                ].map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: '1rem',
                        fontWeight: 450,
                        color: 'rgba(255, 255, 255, 0.88)',
                        textDecoration: 'none',
                        transition: 'color 0.2s ease',
                      }}
                      className="hover:text-white hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 2: Company */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h4
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.9375rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#FFFFFF',
                  margin: 0,
                }}
              >
                Company
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {[
                  { label: 'Home', href: '/' },
                  { label: 'About', href: '/about' },
                  { label: 'FAQ', href: '/faq' },
                  { label: 'Visa Assistance', href: '/visa-assistance' },
                  { label: 'Contact Us', href: '/contact-us' },
                ].map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: '1rem',
                        fontWeight: 450,
                        color: 'rgba(255, 255, 255, 0.88)',
                        textDecoration: 'none',
                        transition: 'color 0.2s ease',
                      }}
                      className="hover:text-white hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3: Connect */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h4
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.9375rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#FFFFFF',
                  margin: 0,
                }}
              >
                Connect
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {[
                  { label: 'Instagram ↗', href: COMPANY_INFO.social.instagram },
                  { label: 'WhatsApp ↗', href: COMPANY_INFO.contact.whatsappUrl },
                  { label: 'Call Us', href: `tel:${COMPANY_INFO.contact.phone}` },
                  { label: 'Email Us', href: `mailto:${COMPANY_INFO.contact.email}` },
                  { label: 'Get Directions ↗', href: COMPANY_INFO.address.mapsUrl },
                ].map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: '1rem',
                        fontWeight: 450,
                        color: 'rgba(255, 255, 255, 0.88)',
                        textDecoration: 'none',
                        transition: 'color 0.2s ease',
                      }}
                      className="hover:text-white hover:underline"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* BOTTOM ROW: FULL-WIDTH LOGO (LEFT) & HIGH-CONTRAST NEWSLETTER (RIGHT) */}
        <div
          style={{
            width: '100%',
            maxWidth: '100%',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 'clamp(2rem, 4vw, 4rem)',
            flexWrap: 'wrap',
            paddingTop: 'clamp(2rem, 4vh, 3.5rem)',
          }}
        >
          {/* Left: FlightOne Loop Logo & Wordmark */}
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '1.25rem',
              textDecoration: 'none',
              color: '#F5F4DF',
            }}
          >
            <svg
              width="60"
              height="40"
              viewBox="0 0 54 36"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ flexShrink: 0 }}
            >
              <path
                d="M13.5 9C7.15 9 2 14.15 2 20.5C2 26.85 7.15 32 13.5 32C19.85 32 24.5 26.5 28.5 20.5C32.5 14.5 38.5 9 44.5 9C49.5 9 52 12.5 52 17C52 22.5 46.5 27 40.5 27C34.5 27 29 21.5 25 15.5C21 9.5 17 4 11 4C5 4 2 8 2 13"
                stroke="#F5F4DF"
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(2.5rem, 4vw, 3.75rem)',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                color: '#F5F4DF',
                lineHeight: 1,
              }}
            >
              FlightOne
            </span>
          </Link>

          {/* Right: Sign Up for Updates Form */}
          <div style={{ maxWidth: '500px', width: '100%' }}>
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.4rem, 2vw, 2rem)',
                fontWeight: 600,
                color: '#F5F4DF',
                marginBottom: '0.875rem',
                letterSpacing: '-0.02em',
              }}
            >
              Sign up for updates
            </h3>

            <form
              onSubmit={handleSubmit}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                borderBottom: isFocused
                  ? '2px solid #F5F4DF'
                  : '1px solid rgba(245, 244, 223, 0.65)',
                paddingBottom: '0.75rem',
                transition: 'border-color 0.3s ease',
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
                  fontSize: 'clamp(1rem, 1.2vw, 1.2rem)',
                  color: '#F5F4DF',
                  paddingRight: '3rem',
                }}
              />
              <button
                type="submit"
                aria-label="Submit email"
                style={{
                  position: 'absolute',
                  right: 0,
                  background: 'transparent',
                  border: 'none',
                  color: '#F5F4DF',
                  fontSize: '1.75rem',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'transform 0.2s ease',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.transform = 'translateX(6px)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.transform = 'translateX(0)')
                }
              >
                →
              </button>
            </form>
            {submitted ? (
              <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#F5F4DF' }}>
                Thank you for subscribing!
              </p>
            ) : (
              <p style={{ marginTop: '0.625rem', fontSize: '0.75rem', color: 'rgba(245, 244, 223, 0.65)', margin: '0.625rem 0 0 0' }}>
                By signing up, you agree to receive communications from FlightOne.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. BOTTOM SECTION: FULL-WIDTH MULTI-LAYER COLOR RIBBONS & GIANT WORDMARK ── */}
      <div
        ref={graphicRef}
        style={{
          position: 'relative',
          width: '100%',
          minHeight: '440px',
          height: 'clamp(440px, 48vh, 560px)',
          backgroundColor: '#1C3F99',
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
            maxWidth: '100%',
            padding: '0 clamp(2rem, 4.5vw, 4.5rem) clamp(2rem, 4vh, 3.5rem)',
            margin: '0 auto',
            transformOrigin: 'bottom left',
            willChange: 'transform',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(4.5rem, 14vw, 12rem)',
              fontWeight: 700,
              letterSpacing: '-0.04em',
              color: '#F5F4DF',
              lineHeight: 0.85,
              textShadow: '0 8px 32px rgba(14, 22, 32, 0.4)',
              userSelect: 'none',
            }}
          >
            FlightOne
          </div>
        </div>
      </div>

      <style>{`
        footer ::placeholder {
          color: rgba(245, 244, 223, 0.7) !important;
        }
        @media (max-width: 900px) {
          .footer-top-grid {
            grid-template-columns: 1fr !important;
            gap: 3rem !important;
          }
          .footer-nav-columns {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 600px) {
          .footer-nav-columns {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </footer>
  );
}
