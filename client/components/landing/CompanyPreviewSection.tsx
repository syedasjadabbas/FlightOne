'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { COMPANY_INFO } from '@/data/company';

export default function CompanyPreviewSection() {
  const trackRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const bgImgRef = useRef<HTMLImageElement>(null);
  const overlayContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animId: number;

    const handleScroll = () => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const scrollableDist = trackRef.current.offsetHeight - vh;

      if (scrollableDist <= 0) return;

      const rawProgress = -rect.top / scrollableDist;
      const progress = Math.max(0, Math.min(0.999, rawProgress));

      // ── Growth phase: 0.0 → 0.35 ──
      const growthRange = 0.35;
      const growthP = Math.max(0, Math.min(1, progress / growthRange));
      const easedGrowth = growthP * growthP * (3 - 2 * growthP); // smooth cubic easeInOut

      if (cardRef.current) {
        // Card starts small & centered, grows to 100vw x 100vh edge-to-edge
        const startW = Math.min(560, vw * 0.56); // px
        const targetW = vw;
        const startH = startW * (9 / 16);
        const targetH = vh;

        const currentW = startW + (targetW - startW) * easedGrowth;
        const currentH = startH + (targetH - startH) * easedGrowth;

        // Border-radius collapses from 28px → 0px
        const currentRadius = (1 - easedGrowth) * 28;

        // Vertical position: starts slightly below centre, rises to top:0
        const cardY = (1 - easedGrowth) * 60;

        cardRef.current.style.width = `${currentW}px`;
        cardRef.current.style.height = `${currentH}px`;
        cardRef.current.style.borderRadius = `${currentRadius}px`;
        cardRef.current.style.transform = `translate3d(0, ${cardY}px, 0)`;
      }

      // ── Continuous Scroll-Driven Cinematic Zoom & Parallax on Image ──
      if (bgImgRef.current) {
        const imgScale = 1.0 + progress * 0.12; // slow cinematic zoom from 1.0x to 1.12x
        const imgY = (progress - 0.5) * 50; // subtle -25px to +25px parallax translation
        bgImgRef.current.style.transform = `translate3d(0, ${imgY}px, 0) scale(${imgScale})`;
      }

      // ── Overlay content (headline + buttons + copy) fades in once card is ≥70% grown ──
      if (overlayContentRef.current) {
        const contentOp = Math.max(0, Math.min(1, (growthP - 0.6) / 0.4));
        overlayContentRef.current.style.opacity = `${contentOp}`;
      }
    };

    const loop = () => {
      handleScroll();
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <section
      ref={trackRef}
      id="company"
      style={{
        position: 'relative',
        width: '100%',
        height: '280vh',
        backgroundColor: '#0E1620',
        color: '#F5F4DF',
        zIndex: 16,
      }}
    >
      {/* ── Sticky Viewport Stage ── */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          left: 0,
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
          backgroundColor: '#0E1620',
        }}
      >
        {/* ── Growing Card: small → full-bleed edge-to-edge ── */}
        <div
          ref={cardRef}
          style={{
            position: 'relative',
            width: '560px',
            height: '315px',
            borderRadius: '28px',
            overflow: 'hidden',
            flexShrink: 0,
            transformOrigin: 'center center',
            willChange: 'width, height, border-radius, transform',
            boxShadow: '0 32px 80px rgba(0, 0, 0, 0.6)',
          }}
        >
          {/* Dubai Skyline Image with Continuous Scroll Zoom (HD source — about-1.jpg was only 288x203) */}
          <img
            ref={bgImgRef}
            src="/images/destinations/dubai.jpg"
            alt="Dubai skyline and beach"
            loading="lazy"
            decoding="async"
            style={{
              position: 'absolute',
              inset: '-5% -5%',
              width: '110%',
              height: '110%',
              objectFit: 'cover',
              objectPosition: 'center 38%',
              display: 'block',
              willChange: 'transform',
              transformOrigin: 'center 40%',
            }}
          />

          {/* Gradient: darkens bottom for text legibility */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(180deg, rgba(14,22,32,0.0) 0%, rgba(14,22,32,0.1) 45%, rgba(14,22,32,0.72) 100%)',
              zIndex: 2,
            }}
          />

          {/* ── Overlaid Content Row (fades in once fully grown) ── */}
          <div
            ref={overlayContentRef}
            style={{
              position: 'absolute',
              bottom: 'clamp(2.5rem, 5vh, 4rem)',
              left: 0,
              right: 0,
              padding: '0 clamp(2rem, 4.5vw, 4.5rem)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              gap: '3.5rem',
              flexWrap: 'wrap',
              zIndex: 10,
              opacity: 0,
              willChange: 'opacity',
            }}
          >
            {/* Left: Headline + Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '520px' }}>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(2.4rem, 4.5vw, 5rem)',
                  fontWeight: 600,
                  lineHeight: 1.05,
                  letterSpacing: '-0.035em',
                  color: '#F5F4DF',
                  margin: 0,
                }}
              >
                Designed around you.
              </h2>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap' }}>
                <Link
                  href={COMPANY_INFO.contact.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#F5F4DF',
                    color: '#0E1620',
                    borderRadius: '9999px',
                    padding: '11px 26px',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    fontFamily: 'var(--font-sans)',
                    textDecoration: 'none',
                    letterSpacing: '-0.01em',
                    transition: 'transform 0.25s ease, background-color 0.25s ease',
                  }}
                  className="hover:scale-[1.03] hover:bg-white"
                >
                  Get My Free Itinerary
                </Link>

                <Link
                  href={COMPANY_INFO.contact.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(255, 255, 255, 0.14)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.42)',
                    color: '#FFFFFF',
                    borderRadius: '9999px',
                    padding: '11px 26px',
                    fontSize: '0.9rem',
                    fontWeight: 500,
                    fontFamily: 'var(--font-sans)',
                    textDecoration: 'none',
                    letterSpacing: '-0.01em',
                    transition: 'background-color 0.25s ease',
                  }}
                  className="hover:bg-white hover:text-[#0E1620]"
                >
                  Chat on WhatsApp
                </Link>
              </div>
            </div>

            {/* Right: Narrative Copy */}
            <div style={{ maxWidth: '340px', paddingBottom: '0.35rem' }}>
              <p
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'clamp(0.875rem, 1vw, 1rem)',
                  lineHeight: 1.6,
                  color: 'rgba(245, 244, 223, 0.88)',
                  margin: 0,
                }}
              >
                FlightOne builds custom tour packages from Pakistan for travellers tired of pre-made options that never fit. Tell us your destination, group size and comfort level, and we design a complete trip around it.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
