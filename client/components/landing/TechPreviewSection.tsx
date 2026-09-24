'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';

const TECH_SPECS = [
  { id: 'destinations', line1: '9 international', line2: 'destinations' },
  { id: 'turnaround', line1: '24-hour itinerary', line2: 'turnaround' },
  { id: 'tiers', line1: '3-star, 4-star and', line2: '5-star hotel tiers' },
];

export default function TechPreviewSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const bgImgRef = useRef<HTMLImageElement>(null);
  const textLeftRef = useRef<HTMLDivElement>(null);
  const specsRef = useRef<HTMLDivElement>(null);
  const vertLineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animId: number;

    const onScroll = () => {
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      const vh = window.innerHeight;

      // 1. Entrance progress (0.0 when top enters bottom of viewport, 1.0 when top reaches top of viewport)
      const entryProgress = Math.max(0, Math.min(1, (vh - rect.top) / vh));
      // 2. Full scroll progress across the 160vh track (0.0 to 1.0)
      const scrollableDistance = rect.height - vh;
      const trackProgress = scrollableDistance > 0 ? Math.max(0, Math.min(1, -rect.top / scrollableDistance)) : 0;

      // Dynamic 160px morphing border radius on card top corners
      if (cardRef.current) {
        // Starts at 160px curved and smoothly flattens to 0px as it fills the viewport
        const currentRadius = Math.max(0, (1 - entryProgress) * 160);
        cardRef.current.style.borderTopLeftRadius = `${currentRadius}px`;
        cardRef.current.style.borderTopRightRadius = `${currentRadius}px`;
      }

      // Parallax transformation on the high-res background image
      if (bgImgRef.current) {
        const imgY = (trackProgress - 0.5) * 120; // -60px to +60px smooth parallax
        const scale = 1.06 - entryProgress * 0.04;
        bgImgRef.current.style.transform = `translate3d(0, ${imgY}px, 0) scale(${scale})`;
      }

      // Staggered text entrance
      if (textLeftRef.current) {
        const textY = Math.max(0, (1 - entryProgress) * 45);
        const textOp = Math.max(0, Math.min(1, (entryProgress - 0.2) / 0.6));
        textLeftRef.current.style.transform = `translate3d(0, ${textY}px, 0)`;
        textLeftRef.current.style.opacity = `${textOp}`;
      }

      // Staggered specs and vertical line
      if (vertLineRef.current) {
        const lineScale = Math.max(0, Math.min(1, (entryProgress - 0.35) / 0.55));
        vertLineRef.current.style.transform = `scaleY(${lineScale})`;
      }

      if (specsRef.current) {
        const specsOp = Math.max(0, Math.min(1, (entryProgress - 0.3) / 0.6));
        const specsY = Math.max(0, (1 - entryProgress) * 30);
        specsRef.current.style.opacity = `${specsOp}`;
        specsRef.current.style.transform = `translate3d(0, ${specsY}px, 0)`;
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

  return (
    <section
      ref={sectionRef}
      id="why-choose-us"
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        height: '170vh',
        backgroundColor: '#F4F3DC',
        zIndex: 12,
      }}
    >
      {/* ── Sticky Full-Screen Viewport Container ── */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          left: 0,
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          height: '100dvh',
          minHeight: '100vh',
          overflow: 'hidden',
          backgroundColor: '#F4F3DC',
        }}
      >
        {/* ── Morphing Card Container (160px -> 0px) ── */}
        <div
          ref={cardRef}
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            backgroundColor: '#0E1620',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            willChange: 'border-radius',
            boxShadow: '0 -24px 60px rgba(14, 22, 32, 0.25)',
          }}
        >
          {/* ── Full-Bleed Parallax Aerodynamic Aircraft Background ── */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 1,
              overflow: 'hidden',
            }}
          >
            <img
              ref={bgImgRef}
              src="/images/technology/aircraft.jpg"
              alt="Aircraft wing at golden hour"
              loading="lazy"
              decoding="async"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center 45%',
                display: 'block',
                willChange: 'transform',
              }}
            />

            {/* Gradient Overlays for High-End Cinematic Contrast */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(90deg, rgba(14,22,32,0.65) 0%, rgba(14,22,32,0.15) 45%, rgba(14,22,32,0.55) 100%)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(180deg, rgba(14,22,32,0.35) 0%, rgba(14,22,32,0) 30%, rgba(14,22,32,0.45) 100%)',
              }}
            />
          </div>

          {/* ── Full-Width Edge-to-Edge Foreground Layout ── */}
          <div
            style={{
              position: 'relative',
              zIndex: 10,
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              padding: '0 clamp(1.5rem, 4.5vw, 4.5rem)',
              margin: '0 auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 'clamp(1.5rem, 3vh, 3rem)',
                flexWrap: 'wrap',
                width: '100%',
              }}
            >
              {/* Left Column: Headline & Explore Pill */}
              <div
                ref={textLeftRef}
                style={{
                  maxWidth: '720px',
                  willChange: 'transform, opacity',
                }}
              >
                <h2
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(2.5rem, 4.8vw, 5.25rem)',
                    fontWeight: 600,
                    lineHeight: 1.06,
                    letterSpacing: '-0.035em',
                    color: '#FFFFFF',
                    margin: 0,
                  }}
                >
                  Transparent pricing,<br />visa support built in
                </h2>

                <div style={{ marginTop: 'clamp(1.25rem, 3vh, 2.5rem)' }}>
                  <Link
                    href="/flights"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#F5F4DF',
                      color: '#0E1620',
                      borderRadius: '9999px',
                      padding: '12px 30px',
                      fontSize: '0.9375rem',
                      fontWeight: 600,
                      fontFamily: 'var(--font-sans)',
                      textDecoration: 'none',
                      letterSpacing: '-0.01em',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                      transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.25s ease',
                    }}
                    className="hover:scale-[1.03] hover:bg-[#FFFFFF]"
                  >
                    Explore
                  </Link>
                </div>
              </div>

              {/* Right Column: Technical Specs with Vertical Alignment Line */}
              <div
                ref={specsRef}
                style={{
                  display: 'flex',
                  alignItems: 'stretch',
                  gap: '1.25rem',
                  minWidth: '260px',
                  textAlign: 'left',
                  willChange: 'transform, opacity',
                }}
              >
                {/* Vertical Accent Guide Line */}
                <div
                  ref={vertLineRef}
                  style={{
                    width: '1px',
                    backgroundColor: 'rgba(255, 255, 255, 0.4)',
                    transformOrigin: 'top center',
                    transform: 'scaleY(1)',
                    transition: 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />

                {/* Stacked Bullet Copy */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  {TECH_SPECS.map((spec) => (
                    <div key={spec.id}>
                      <p
                        style={{
                          fontFamily: 'var(--font-sans)',
                          fontSize: 'clamp(0.875rem, 1.05vw, 1rem)',
                          fontWeight: 400,
                          color: 'rgba(255, 255, 255, 0.95)',
                          letterSpacing: '0.01em',
                          lineHeight: 1.35,
                          margin: 0,
                        }}
                      >
                        {spec.line1}
                      </p>
                      {spec.line2 && (
                        <p
                          style={{
                            fontFamily: 'var(--font-sans)',
                            fontSize: 'clamp(0.875rem, 1.05vw, 1rem)',
                            fontWeight: 400,
                            color: 'rgba(255, 255, 255, 0.95)',
                            letterSpacing: '0.01em',
                            lineHeight: 1.35,
                            margin: 0,
                          }}
                        >
                          {spec.line2}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
