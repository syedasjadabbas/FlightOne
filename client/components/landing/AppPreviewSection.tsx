'use client';

import React, { useEffect, useRef } from 'react';

const HEADLINE_WORDS = [
  'You',
  'receive',
  'the',
  'complete',
  'plan',
  'within',
  '24',
  'hours.',
];

// Precompute character mapping with flat index for smooth character-by-character scrub
let charCounter = 0;
const PARSED_HEADLINE = HEADLINE_WORDS.map((word, wordIdx) => {
  const isOurApp = wordIdx >= HEADLINE_WORDS.length - 2; // "24", "hours."
  const chars = word.split('').map((char) => ({
    char,
    flatIdx: charCounter++,
    isOurApp,
  }));
  return { word, chars, isOurApp };
});
const TOTAL_HEADLINE_CHARS = charCounter;

export default function AppPreviewSection() {
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const charRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    // rAF-throttled: native 'scroll' can fire more than once per animation
    // frame (fast trackpad input, high-refresh-rate displays), and each
    // firing previously re-ran a getBoundingClientRect() layout read plus up
    // to ~39 DOM style writes below. Coalescing to one execution per frame
    // removes the redundant reflows/writes without changing the update rate
    // (still recomputed every frame) or the resulting scrub value/timing.
    let rafId: number | null = null;

    const update = () => {
      rafId = null;
      if (!headlineRef.current) return;
      const rect = headlineRef.current.getBoundingClientRect();
      const vh = window.innerHeight;

      // Darken progressively as the headline scrolls through viewport (from 88% to 35% viewport height)
      const startY = vh * 0.88;
      const endY = vh * 0.35;
      const progress = Math.max(0, Math.min(1, (startY - rect.top) / (startY - endY)));

      const totalChars = TOTAL_HEADLINE_CHARS;
      const currentDarkCount = progress * totalChars;

      for (let k = 0; k < totalChars; k++) {
        const spanEl = charRefs.current[k];
        if (!spanEl) continue;

        const charDiff = currentDarkCount - k;
        const isOurApp = spanEl.getAttribute('data-app') === 'true';
        const activeColor = isOurApp ? '#4A6B52' : '#0E1620';
        const inactiveColor = '#c7c6b6';

        if (charDiff >= 1) {
          spanEl.style.color = activeColor;
        } else if (charDiff <= 0) {
          spanEl.style.color = inactiveColor;
        } else {
          spanEl.style.color = `color-mix(in srgb, ${activeColor} ${Math.round(charDiff * 100)}%, ${inactiveColor})`;
        }
      }
    };

    const handleScroll = () => {
      if (rafId === null) {
        rafId = requestAnimationFrame(update);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <section
      id="itinerary"
      style={{
        backgroundColor: '#F4F3DC',
        color: '#0E1620',
        padding: 'clamp(4rem, 8vh, 7rem) 0 clamp(6rem, 10vh, 9rem)',
        position: 'relative',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        zIndex: 10,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          padding: '0 clamp(1.75rem, 4vw, 4.5rem)',
          margin: '0 auto',
        }}
      >
        {/* Top Visual Row: Large Panoramic Skyline Card (Left) + Small Boarding Card (Right) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 2.75fr) minmax(0, 1fr)',
            gap: 'clamp(1.75rem, 3vw, 3.5rem)',
            alignItems: 'start',
          }}
          className="app-grid-responsive"
        >
          {/* ── Left Column: Large Prominent Panoramic Flight Route Card ── */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '16 / 9.8',
              minHeight: 'clamp(280px, 50vw, 440px)',
              borderRadius: 'clamp(24px, 2.8vw, 38px)',
              overflow: 'hidden',
              boxShadow: '0 24px 60px rgba(14,22,32,0.08)',
              backgroundColor: '#0E1620',
            }}
          >
            <img
              src="/images/app/panoramic-skyline.jpg"
              alt="City skyline at golden hour"
              loading="lazy"
              decoding="async"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center 40%',
                display: 'block',
              }}
            />

            {/* Dark gradient overlay for UI contrast */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(180deg, rgba(14,22,32,0.1) 0%, rgba(14,22,32,0.3) 50%, rgba(14,22,32,0.6) 100%)',
              }}
            />

            {/* Floating Glassmorphism Journey Overlay Card */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 'min(90%, 420px)',
                height: 'min(90%, 440px)',
                background: 'rgba(244, 243, 220, 0.12)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: '1.5px solid rgba(255, 255, 255, 0.55)',
                borderRadius: '34px',
                padding: 'clamp(1rem, 3.5vw, 1.75rem) clamp(1rem, 4vw, 2rem) clamp(0.9rem, 3vw, 1.5rem)',
                color: '#FFFFFF',
                boxShadow: '0 30px 60px rgba(0, 0, 0, 0.35)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              {/* Header */}
              <div>
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    letterSpacing: '0.02em',
                    color: 'rgba(255, 255, 255, 0.8)',
                    display: 'block',
                  }}
                >
                  Your Itinerary
                </span>
                <h4
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.35rem',
                    fontWeight: 600,
                    color: '#FFFFFF',
                    marginTop: '0.2rem',
                    letterSpacing: '-0.015em',
                  }}
                >
                  Requested today
                </h4>
              </div>

              {/* Timeline Arc Graphic */}
              <div style={{ position: 'relative', width: '100%', height: '140px', margin: '0.5rem 0' }}>
                <svg
                  viewBox="0 0 320 120"
                  fill="none"
                  style={{ width: '100%', height: '100%', overflow: 'visible' }}
                >
                  {/* Dotted Arching Trajectory */}
                  <path
                    d="M 25 100 Q 160 -10, 295 100"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    strokeDasharray="5 5"
                    fill="none"
                  />

                  {/* Left Start Dot */}
                  <circle cx="25" cy="100" r="4" fill="#FFFFFF" />

                  {/* Left Car Node Badge */}
                  <g transform="translate(45, 82)">
                    <circle cx="0" cy="0" r="14" fill="#FFFFFF" />
                    {/* Car Icon */}
                    <path
                      d="M -7 2 C -7 -1 -4 -4 0 -4 C 4 -4 7 -1 7 2 L 7 4 C 7 5 6 6 5 6 L 5 7 C 5 7.5 4.5 8 4 8 L 3 8 C 2.5 8 2 7.5 2 7 L 2 6 L -2 6 L -2 7 C -2 7.5 -2.5 8 -3 8 L -4 8 C -4.5 8 -5 7.5 -5 7 L -5 6 C -6 6 -7 5 -7 4 Z"
                      fill="#0E1620"
                    />
                    <circle cx="-3.5" cy="2" r="1.2" fill="#FFFFFF" />
                    <circle cx="3.5" cy="2" r="1.2" fill="#FFFFFF" />
                  </g>

                  {/* Center Flight Peak Node Badge (Aircraft Silhouette) */}
                  <g transform="translate(160, 20)">
                    <circle cx="0" cy="0" r="20" fill="#FFFFFF" />
                    {/* Airplane Icon */}
                    <path
                      d="M -10 2 L -2 0 L -6 -8 L -3 -8 L 3 0 L 9 -1 C 10.5 -1.3 11.5 0.6 10.2 1.6 L 3 6 L -1 6 L -5 9 L -3 9.3 L -6 10.5 L -8 8 L -8 6 L -10 5.5 Z"
                      fill="#0E1620"
                    />
                  </g>

                  {/* Right Car Node Badge */}
                  <g transform="translate(275, 82)">
                    <circle cx="0" cy="0" r="14" fill="#FFFFFF" />
                    {/* Car Icon */}
                    <path
                      d="M -7 2 C -7 -1 -4 -4 0 -4 C 4 -4 7 -1 7 2 L 7 4 C 7 5 6 6 5 6 L 5 7 C 5 7.5 4.5 8 4 8 L 3 8 C 2.5 8 2 7.5 2 7 L 2 6 L -2 6 L -2 7 C -2 7.5 -2.5 8 -3 8 L -4 8 C -4.5 8 -5 7.5 -5 7 L -5 6 C -6 6 -7 5 -7 4 Z"
                      fill="#0E1620"
                    />
                    <circle cx="-3.5" cy="2" r="1.2" fill="#FFFFFF" />
                    <circle cx="3.5" cy="2" r="1.2" fill="#FFFFFF" />
                  </g>

                  {/* Right End Dot */}
                  <circle cx="295" cy="100" r="4" fill="#FFFFFF" />
                </svg>
              </div>

              {/* Bottom Time / Progress Track */}
              <div>
                {/* Horizontal Progress Bar */}
                <div
                  style={{
                    width: '100%',
                    height: '5px',
                    backgroundColor: 'rgba(255, 255, 255, 0.3)',
                    borderRadius: '9999px',
                    position: 'relative',
                    marginBottom: '0.75rem',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: '68%',
                      backgroundColor: '#FFFFFF',
                      borderRadius: '9999px',
                    }}
                  />
                </div>

                {/* Step Labels */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#FFFFFF' }}>12:45 pm</span>
                    <p style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.75)', marginTop: '2px', lineHeight: 1.2 }}>
                      Airport<br />Pickup
                    </p>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#FFFFFF' }}>Direct Flight</span>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#FFFFFF' }}>1:15pm</span>
                    <p style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.75)', marginTop: '2px', lineHeight: 1.2 }}>
                      Hotel<br />Transfer
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right Column: Smaller Boarding Photo Card + Caption ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
            <div
              style={{
                width: '100%',
                aspectRatio: '3 / 3.6',
                borderRadius: 'clamp(20px, 2.2vw, 30px)',
                overflow: 'hidden',
                boxShadow: '0 20px 50px rgba(14,22,32,0.08)',
                backgroundColor: '#0E1620',
              }}
            >
              <img
                src="/images/app/passenger-boarding.jpg"
                alt="Traveller boarding an international flight"
                loading="lazy"
                decoding="async"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center top',
                  display: 'block',
                }}
              />
            </div>

            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'clamp(0.9375rem, 1.1vw, 1.0625rem)',
                lineHeight: 1.5,
                color: 'rgba(14, 22, 32, 0.85)',
                maxWidth: '320px',
              }}
            >
              One dedicated travel designer coordinates your flights, hotels, transfers and visa, all through a single WhatsApp conversation.
            </p>
          </div>
        </div>

        {/* ── Big Editorial Headline with Scroll-Driven Letter Darkening Animation ── */}
        <div style={{ marginTop: 'clamp(4rem, 7vh, 6.5rem)', maxWidth: '1360px' }}>
          <h2
            ref={headlineRef}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2.4rem, 4.4vw, 4.75rem)',
              fontWeight: 600,
              lineHeight: 1.1,
              letterSpacing: '-0.035em',
              color: '#c7c6b6',
              textAlign: 'left',
              width: '100%',
            }}
          >
            {PARSED_HEADLINE.map((wordObj, wIdx) => (
              <span
                key={wIdx}
                style={{
                  display: 'inline-block',
                  whiteSpace: 'nowrap',
                  marginRight: '0.28em',
                }}
              >
                {wordObj.chars.map((item) => (
                  <span
                    key={item.flatIdx}
                    ref={(el) => {
                      charRefs.current[item.flatIdx] = el;
                    }}
                    data-app={item.isOurApp ? 'true' : 'false'}
                    style={{
                      color: '#c7c6b6',
                      transition: 'color 0.05s linear',
                    }}
                  >
                    {item.char}
                  </span>
                ))}
              </span>
            ))}
          </h2>
        </div>

        {/* Bottom Left Fixed Label */}
        <div
          style={{
            marginTop: 'clamp(3rem, 5vh, 4.5rem)',
            fontFamily: 'var(--font-sans)',
            fontSize: '0.8125rem',
            fontWeight: 500,
            letterSpacing: '0.01em',
            color: 'rgba(14, 22, 32, 0.65)',
          }}
        >
          No app required — just WhatsApp
        </div>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .app-grid-responsive {
            grid-template-columns: 1fr !important;
            gap: 2.5rem !important;
          }
        }
      `}</style>
    </section>
  );
}
