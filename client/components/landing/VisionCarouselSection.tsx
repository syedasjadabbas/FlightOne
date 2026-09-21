'use client';

import React, { useEffect, useRef, useState } from 'react';

/*
 * ── Dream of Flight / Our Future Vision ──────────────────────────────────
 * Reconstructed from Joby Aviation's live "illustration" section
 * (https://www.jobyaviation.com/ — id="illustration").
 *
 * Joby composites this scene from 11 stacked WebP illustration layers
 * (1 tall master sky/ground background + 10 transparent overlay layers:
 * clouds, aircraft, horizon haze, city skyline, skyport terrace, foreground
 * trees), each with an independently-authored desktop and mobile asset —
 * NOT a single flattened image.
 *
 * Assets: public/images/vision/joby/layer-XX-*.webp (original Joby files,
 * extracted from cdn.sanity.io — unmodified, unmerged, uncropped).
 */

type OverlayLayer = {
  id: string;
  desktop: string;
  mobile: string;
  /** top offset, as % of the tall stack's total height (same for both breakpoints) */
  top: number;
  z: number;
  /** relative parallax speed vs. the base scroll travel — 1 = locked to background */
  speed: number;
  alt: string;
};

const BASE_PATH = '/images/vision/joby';

const BACKGROUND_LAYER = {
  desktop: `${BASE_PATH}/layer-01-sky-desktop.webp`,
  mobile: `${BASE_PATH}/layer-01-sky-mobile.webp`,
};

/** Desktop/mobile bg intrinsic size — holds stack height before assets mount. */
const BG_ASPECT = { desktop: '2400 / 6045', mobile: '563 / 3527' } as const;

const OVERLAY_LAYERS: OverlayLayer[] = [
  { id: 'clouds-a', desktop: `${BASE_PATH}/layer-02-clouds-a-desktop.webp`, mobile: `${BASE_PATH}/layer-02-clouds-a-mobile.webp`, top: 3, z: 2, speed: 0.85, alt: '' },
  { id: 'clouds-b', desktop: `${BASE_PATH}/layer-03-clouds-b-desktop.webp`, mobile: `${BASE_PATH}/layer-03-clouds-b-mobile.webp`, top: 9, z: 2, speed: 0.85, alt: '' },
  { id: 'clouds-c', desktop: `${BASE_PATH}/layer-04-clouds-c-desktop.webp`, mobile: `${BASE_PATH}/layer-04-clouds-c-mobile.webp`, top: 16, z: 2, speed: 0.85, alt: '' },
  { id: 'aircraft-far', desktop: `${BASE_PATH}/layer-05-aircraft-far-desktop.webp`, mobile: `${BASE_PATH}/layer-05-aircraft-far-mobile.webp`, top: 21, z: 5, speed: 0.7, alt: '' },
  { id: 'aircraft-near', desktop: `${BASE_PATH}/layer-06-aircraft-near-desktop.webp`, mobile: `${BASE_PATH}/layer-06-aircraft-near-mobile.webp`, top: 38, z: 5, speed: 1.15, alt: '' },
  { id: 'horizon-haze', desktop: `${BASE_PATH}/layer-08-horizon-haze-desktop.webp`, mobile: `${BASE_PATH}/layer-08-horizon-haze-mobile.webp`, top: 56, z: 3, speed: 0.9, alt: '' },
  { id: 'dusk-clouds', desktop: `${BASE_PATH}/layer-09-dusk-clouds-desktop.webp`, mobile: `${BASE_PATH}/layer-09-dusk-clouds-mobile.webp`, top: 58, z: 3, speed: 0.95, alt: '' },
  { id: 'city-skyline', desktop: `${BASE_PATH}/layer-07-city-skyline-desktop.webp`, mobile: `${BASE_PATH}/layer-07-city-skyline-mobile.webp`, top: 70, z: 4, speed: 1.0, alt: '' },
  { id: 'skyport', desktop: `${BASE_PATH}/layer-10-skyport-desktop.webp`, mobile: `${BASE_PATH}/layer-10-skyport-mobile.webp`, top: 80, z: 6, speed: 1.1, alt: '' },
  { id: 'foreground-trees', desktop: `${BASE_PATH}/layer-11-foreground-trees-desktop.webp`, mobile: `${BASE_PATH}/layer-11-foreground-trees-mobile.webp`, top: 85, z: 7, speed: 1.2, alt: '' },
];

/** how far a layer may drift from the base scroll travel, in px, at full progress */
const PARALLAX_RANGE = 220;

type NarrativeBlock = {
  id: string;
  step: string;
  body: string;
  side: 'left' | 'right';
  topDesktop: number;
  topMobile: number;
};

type SkyCallout = {
  id: string;
  label: string;
  detail: string;
  topDesktop: number;
  topMobile: number;
  side: 'left' | 'right';
};

type DestChip = {
  id: string;
  name: string;
  meta: string;
  topDesktop: number;
  topMobile: number;
  side: 'left' | 'right';
};

/** Story beats — placed clear of aircraft layers (~21% / ~38%) where possible. */
const NARRATIVE_BLOCKS: NarrativeBlock[] = [
  {
    id: 'na-1',
    step: '01',
    body: 'Tell us where you want to go. We build the rest around your dates.',
    side: 'left',
    topDesktop: 15,
    topMobile: 16,
  },
  {
    id: 'na-2',
    step: '02',
    body: 'Flights, hotels, and daily plans in one clear itinerary — within 24 hours.',
    side: 'right',
    topDesktop: 26,
    topMobile: 28,
  },
  {
    id: 'na-3',
    step: '03',
    body: 'Visa files prepared honestly — including when a profile needs work first.',
    side: 'left',
    topDesktop: 42,
    topMobile: 44,
  },
  {
    id: 'na-4',
    step: '04',
    body: 'Imagine a journey designed entirely around you.',
    side: 'right',
    topDesktop: 54,
    topMobile: 56,
  },
  {
    id: 'na-5',
    step: '05',
    body: 'Where every destination feels closer, simpler, and more memorable.',
    side: 'left',
    topDesktop: 66,
    topMobile: 68,
  },
  {
    id: 'na-6',
    step: '06',
    body: 'Where every trip becomes a story worth bringing home.',
    side: 'right',
    topDesktop: 78,
    topMobile: 80,
  },
];

const SKY_CALLOUTS: SkyCallout[] = [
  {
    id: 'sc-1',
    label: '24-hour turnaround',
    detail: 'Full itinerary with hotel names and final pricing',
    topDesktop: 18,
    topMobile: 20,
    side: 'right',
  },
  {
    id: 'sc-2',
    label: 'Transparent quotes',
    detail: "What's included — and what isn't — always in writing",
    topDesktop: 36,
    topMobile: 38,
    side: 'right',
  },
  {
    id: 'sc-3',
    label: 'One WhatsApp contact',
    detail: 'From first message to your flight home',
    topDesktop: 60,
    topMobile: 62,
    side: 'left',
  },
];

const DEST_CHIPS: DestChip[] = [
  { id: 'dc-maldives', name: 'Maldives', meta: 'Honeymoon & beach', topDesktop: 21, topMobile: 22, side: 'left' },
  { id: 'dc-dubai', name: 'Dubai', meta: 'First international', topDesktop: 33, topMobile: 34, side: 'left' },
  { id: 'dc-turkey', name: 'Turkey', meta: 'Cappadocia & beyond', topDesktop: 48, topMobile: 50, side: 'right' },
  { id: 'dc-thailand', name: 'Thailand', meta: 'e-Visa handled', topDesktop: 70, topMobile: 72, side: 'right' },
];

const ADVENTURE_STATS = [
  { value: '9', label: 'Destinations' },
  { value: '24h', label: 'Itinerary' },
  { value: '3', label: 'Hotel tiers' },
] as const;

export default function VisionCarouselSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const textStackRef = useRef<HTMLDivElement>(null);
  const bgImgRef = useRef<HTMLImageElement>(null);
  const layerElRefs = useRef<Record<string, HTMLDivElement | null>>({});
  /* ~4.1MB Joby webps — mount src only when section is within ~800px. */
  const [assetsReady, setAssetsReady] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setAssetsReady(true);
        io.disconnect();
      },
      { rootMargin: '800px 0px' },
    );
    io.observe(section);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!assetsReady) return;
    if (!sectionRef.current || !stackRef.current || !sheetRef.current) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      const gsapMod = await import('gsap');
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      if (cancelled) return;

      const gsap = gsapMod.default;
      gsap.registerPlugin(ScrollTrigger);

      const ctx = gsap.context(() => {
        const section = sectionRef.current!;
        const sheet = sheetRef.current!;
        const stack = stackRef.current!;
        const textStack = textStackRef.current;
        const footerEl = document.querySelector('#footer') as HTMLElement | null;

        const calcTranslateY = () => {
          const stackHeight = stack.offsetHeight || stack.getBoundingClientRect().height;
          const vh = window.innerHeight;
          return -(Math.max(0, stackHeight - vh));
        };

        // Synchronize text coordinate space with tall artwork height
        const syncTextStackHeight = () => {
          if (textStack && stack) {
            textStack.style.height = `${stack.offsetHeight}px`;
          }
        };

        // ── Exit curtain ──────────────────────────────────────────────────
        // The pin's scroll range is split into two back-to-back phases:
        //   1) Storytelling (0..storytellingDistance) — the pin stays engaged
        //      while the artwork stack and text stack scroll through the scene.
        //   2) Curtain Lift (storytellingDistance..+exitDistance) — Section 8
        //      remains pinned at the end, and the entire Section 8 composition
        //      moves upward as ONE rigid sheet (y: 0 -> -exitDistance),
        //      progressively revealing the stationary next section underneath
        //      from the bottom until Section 8 completely clears the viewport.
        const exitDistance = () => window.innerHeight;

        const st = ScrollTrigger.create({
          trigger: section,
          start: 'top top',
          end: () => `+=${Math.abs(calcTranslateY()) + exitDistance()}`,
          pin: true,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onRefresh: () => {
            syncTextStackHeight();
            if (footerEl) gsap.set(footerEl, { y: 0 });
          },
          onLeave: () => {
            if (footerEl) gsap.set(footerEl, { y: 0 });
          },
          onLeaveBack: () => {
            if (footerEl) gsap.set(footerEl, { y: 0 });
          },
          onUpdate: (self) => {
            const storytellingDistance = Math.abs(calcTranslateY());
            const totalDistance = storytellingDistance + exitDistance();
            const scrolledPx = self.progress * totalDistance;

            // Phase 1: storytelling artwork and text scrub
            const p = storytellingDistance > 0 ? Math.min(1, scrolledPx / storytellingDistance) : 1;

            const baseY = p * calcTranslateY();
            gsap.set(stack, { y: baseY });
            if (textStack) gsap.set(textStack, { y: baseY });

            OVERLAY_LAYERS.forEach((layer) => {
              if (layer.speed === 1) return;
              const el = layerElRefs.current[layer.id];
              if (!el) return;
              const extra = (layer.speed - 1) * p * PARALLAX_RANGE;
              gsap.set(el, { y: extra });
            });

            // Phase 2: animated curtain lift — Section 8 moves upward as ONE rigid sheet
            // while holding the next section stationary underneath for a true curtain-lift reveal
            const exitP = Math.max(0, Math.min(1, (scrolledPx - storytellingDistance) / exitDistance()));
            gsap.set(sheet, { y: -exitP * exitDistance() });

            const footer = footerEl || (document.querySelector('#footer') as HTMLElement | null);
            if (footer) {
              if (exitP > 0 && exitP < 1) {
                gsap.set(footer, { y: -(1 - exitP) * exitDistance() });
              } else {
                gsap.set(footer, { y: 0 });
              }
            }
          },
        });

        // Refresh once the background artwork has finished loading
        const bgEl = bgImgRef.current;
        const handleImageLoad = () => ScrollTrigger.refresh();
        if (bgEl) {
          if (bgEl.complete) {
            ScrollTrigger.refresh();
          } else {
            bgEl.addEventListener('load', handleImageLoad);
          }
        }

        syncTextStackHeight();
        window.addEventListener('resize', syncTextStackHeight);

        return () => {
          if (bgEl) bgEl.removeEventListener('load', handleImageLoad);
          window.removeEventListener('resize', syncTextStackHeight);
          if (footerEl) gsap.set(footerEl, { y: 0 });
          st.kill();
        };
      }, sectionRef);

      cleanup = () => ctx.revert();
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [assetsReady]);

  return (
    <section
      id="vision"
      ref={sectionRef}
      style={{
        position: 'relative',
        zIndex: 30,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        height: '100dvh',
        marginTop: '-45vh',
        marginBottom: '-100vh',
        overflow: 'hidden',
        backgroundColor: 'transparent',
        color: '#FFFFFF',
      }}
    >
      {/* ── ENTIRE RIGID SHEET (translates upward as ONE unit during exit with rich underside shadow) ── */}
      <div
        ref={sheetRef}
        className="vision-sheet"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          backgroundColor: '#07162C',
          willChange: 'transform',
          boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.85), 0 12px 24px -6px rgba(0, 0, 0, 0.7)',
        }}
      >
        {/* ── 1. 11-LAYER COMPOSITED ILLUSTRATION (Joby "Dream of Flight" reconstruction) ── */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            pointerEvents: 'none',
          }}
        >
          <div ref={stackRef} className="vision-stack" style={{ position: 'relative', width: '100%', willChange: 'transform' }} aria-hidden="true">
            {/* Layer 1 — tall master sky/ground background.
                Assets mount only when the section nears the viewport
                (assetsReady). Until then an aspect-ratio shell holds height. */}
            <div style={{ position: 'relative', width: '100%', zIndex: 1 }}>
              {assetsReady ? (
                <picture>
                  <source media="(max-width: 768px)" srcSet={BACKGROUND_LAYER.mobile} />
                  <img
                    ref={bgImgRef}
                    src={BACKGROUND_LAYER.desktop}
                    alt="Aerial sky and skyline illustration"
                    className="vision-layer-img"
                    loading="lazy"
                    decoding="async"
                    fetchPriority="low"
                  />
                </picture>
              ) : (
                <>
                  <div
                    className="vision-bg-placeholder vision-bg-placeholder-desktop"
                    style={{ width: '100%', aspectRatio: BG_ASPECT.desktop, background: '#07162C' }}
                  />
                  <div
                    className="vision-bg-placeholder vision-bg-placeholder-mobile"
                    style={{ width: '100%', aspectRatio: BG_ASPECT.mobile, background: '#07162C' }}
                  />
                </>
              )}
            </div>

            {/* Layers 2–11 — transparent overlay illustrations */}
            {assetsReady &&
              OVERLAY_LAYERS.map((layer) => (
                <div
                  key={layer.id}
                  ref={(el) => {
                    layerElRefs.current[layer.id] = el;
                  }}
                  className="vision-overlay-layer"
                  style={{
                    position: 'absolute',
                    top: `${layer.top}%`,
                    left: 0,
                    width: '100%',
                    zIndex: layer.z,
                    willChange: layer.speed !== 1 ? 'transform' : undefined,
                  }}
                >
                  <picture>
                    <source media="(max-width: 768px)" srcSet={layer.mobile} />
                    <img
                      src={layer.desktop}
                      alt={layer.alt}
                      className="vision-layer-img"
                      loading="lazy"
                      decoding="async"
                      fetchPriority="low"
                    />
                  </picture>
                </div>
              ))}
          </div>
        </div>

        {/* ── 2. READABILITY SCRIM — lifts ivory type off bright clouds ── */}
        <div
          className="vision-scrim"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 8,
          }}
        />

        {/* ── 3. TEXT LAYER — branded panels over the illustration ── */}
        <div className="vision-text-layer">
          <div ref={textStackRef} className="vision-text-stack" style={{ willChange: 'transform' }}>
            <div className="vision-header-container">
              <div className="vision-header-plate">
                <div className="vision-headline-wrap">
                  <h2 className="vision-headline-desktop">Next Adventure</h2>
                  <h2 className="vision-headline-mobile">
                    Next
                    <br />
                    Adventure
                  </h2>
                </div>
                <p className="vision-subhead">
                  Custom routes across nine destinations — itinerary in 24 hours, visa support included.
                </p>
                <div className="vision-stats" role="list">
                  {ADVENTURE_STATS.map((stat) => (
                    <div key={stat.label} className="vision-stat" role="listitem">
                      <span className="vision-stat-value">{stat.value}</span>
                      <span className="vision-stat-label">{stat.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {SKY_CALLOUTS.map((callout) => (
              <div
                key={callout.id}
                className={`vision-text-block vision-plate vision-callout vision-side-${callout.side}`}
                style={
                  {
                    '--top-d': `${callout.topDesktop}%`,
                    '--top-m': `${callout.topMobile}%`,
                  } as React.CSSProperties
                }
              >
                <span className="vision-callout-label">{callout.label}</span>
                <p className="vision-callout-detail">{callout.detail}</p>
              </div>
            ))}

            {DEST_CHIPS.map((chip) => (
              <div
                key={chip.id}
                className={`vision-text-block vision-dest-chip vision-side-${chip.side}`}
                style={
                  {
                    '--top-d': `${chip.topDesktop}%`,
                    '--top-m': `${chip.topMobile}%`,
                  } as React.CSSProperties
                }
              >
                <span className="vision-dest-name">{chip.name}</span>
                <span className="vision-dest-meta">{chip.meta}</span>
              </div>
            ))}

            {NARRATIVE_BLOCKS.map((block) => (
              <article
                key={block.id}
                className={`vision-text-block vision-plate vision-narrative vision-side-${block.side}`}
                style={
                  {
                    '--top-d': `${block.topDesktop}%`,
                    '--top-m': `${block.topMobile}%`,
                  } as React.CSSProperties
                }
              >
                <span className="vision-caption">Next Adventure — {block.step}</span>
                <p className="vision-narrative-body">{block.body}</p>
              </article>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .vision-layer-img {
          display: block;
          width: 100%;
          height: auto;
        }

        .vision-bg-placeholder-desktop { display: block; }
        .vision-bg-placeholder-mobile { display: none; }
        @media (max-width: 768px) {
          .vision-bg-placeholder-desktop { display: none; }
          .vision-bg-placeholder-mobile { display: block; }
        }

        .vision-overlay-layer { pointer-events: none; }

        .vision-scrim {
          background:
            linear-gradient(
              180deg,
              rgba(7, 22, 44, 0.55) 0%,
              rgba(7, 22, 44, 0.18) 18%,
              rgba(7, 22, 44, 0.12) 42%,
              rgba(7, 22, 44, 0.28) 68%,
              rgba(7, 22, 44, 0.62) 100%
            ),
            radial-gradient(
              ellipse 90% 55% at 50% 8%,
              rgba(7, 22, 44, 0.45) 0%,
              transparent 70%
            );
        }

        .vision-text-layer {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: 10;
        }
        .vision-text-stack {
          position: relative;
          width: 100%;
        }
        .vision-header-container {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          padding: clamp(3.75rem, 7vh, 6rem) clamp(1.25rem, 3.5vw, 3rem) 0;
          box-sizing: border-box;
          display: flex;
          justify-content: center;
          z-index: 12;
        }
        .vision-header-plate {
          width: min(100%, 46rem);
          padding: clamp(1.1rem, 2.2vh, 1.65rem) clamp(1.15rem, 2.5vw, 1.85rem);
          border-radius: 0.65rem;
          background: color-mix(in oklab, #07162C 78%, transparent);
          border: 1px solid color-mix(in oklab, #F5F4DF 16%, transparent);
          box-shadow:
            0 18px 48px -16px rgba(2, 8, 20, 0.65),
            inset 0 1px 0 color-mix(in oklab, #F5F4DF 10%, transparent);
          backdrop-filter: blur(14px) saturate(1.15);
          -webkit-backdrop-filter: blur(14px) saturate(1.15);
          text-align: center;
        }
        .vision-headline-wrap {
          width: 100%;
        }
        .vision-headline-desktop {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(2.75rem, 6.5vw, 5.5rem);
          font-weight: 600;
          letter-spacing: -0.035em;
          line-height: 0.98;
          color: #F5F4DF;
          white-space: nowrap;
        }
        .vision-headline-mobile {
          display: none;
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(2.6rem, 12vw, 4rem);
          font-weight: 600;
          letter-spacing: -0.035em;
          line-height: 0.98;
          color: #F5F4DF;
        }
        .vision-subhead {
          margin: 0.75rem auto 0;
          max-width: 34ch;
          font-family: var(--font-sans);
          font-size: clamp(0.875rem, 1.2vw, 1.05rem);
          font-weight: 500;
          line-height: 1.4;
          letter-spacing: -0.01em;
          color: color-mix(in oklab, #F5F4DF 82%, #8FA0B2);
        }
        .vision-stats {
          display: flex;
          justify-content: center;
          gap: clamp(1.1rem, 3vw, 2.25rem);
          margin-top: 1.1rem;
          padding-top: 0.95rem;
          border-top: 1px solid color-mix(in oklab, #F5F4DF 12%, transparent);
        }
        .vision-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.2rem;
          min-width: 4.25rem;
        }
        .vision-stat-value {
          font-family: var(--font-display);
          font-size: clamp(1.35rem, 2.4vw, 1.85rem);
          font-weight: 600;
          letter-spacing: -0.03em;
          line-height: 1;
          color: #F5F4DF;
        }
        .vision-stat-label {
          font-family: var(--font-sans);
          font-size: 0.65rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: color-mix(in oklab, #F5F4DF 62%, transparent);
        }

        .vision-text-block {
          position: absolute;
          top: var(--top-d);
          z-index: 11;
        }
        .vision-side-left {
          left: clamp(1rem, 4vw, 3.25rem);
          right: auto;
        }
        .vision-side-right {
          right: clamp(1rem, 4vw, 3.25rem);
          left: auto;
        }

        .vision-plate {
          box-sizing: border-box;
          padding: 1rem 1.15rem 1.1rem;
          border-radius: 0.55rem;
          background: color-mix(in oklab, #0E1620 86%, transparent);
          border: 1px solid color-mix(in oklab, #F5F4DF 14%, transparent);
          box-shadow:
            0 16px 40px -14px rgba(2, 8, 20, 0.7),
            inset 0 1px 0 color-mix(in oklab, #F5F4DF 8%, transparent);
          backdrop-filter: blur(12px) saturate(1.1);
          -webkit-backdrop-filter: blur(12px) saturate(1.1);
        }

        .vision-callout {
          width: clamp(13.5rem, 22vw, 17.5rem);
          border-left: 3px solid var(--joby-blue, #007AE5);
        }
        .vision-callout-label {
          display: block;
          font-family: var(--font-sans);
          font-size: 0.6875rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: color-mix(in oklab, #F5F4DF 72%, var(--cyan, #2EC4B6));
          margin-bottom: 0.4rem;
        }
        .vision-callout-detail {
          margin: 0;
          font-family: var(--font-sans);
          font-size: clamp(0.9rem, 1.15vw, 1.05rem);
          font-weight: 500;
          letter-spacing: -0.015em;
          line-height: 1.35;
          color: #F5F4DF;
        }

        .vision-dest-chip {
          display: inline-flex;
          flex-direction: column;
          gap: 0.12rem;
          padding: 0.55rem 0.8rem 0.6rem;
          border-radius: 0.4rem;
          background: #F5F4DF;
          border: 1px solid color-mix(in oklab, #0E1620 10%, transparent);
          box-shadow: 0 10px 28px -10px rgba(2, 8, 20, 0.55);
          white-space: nowrap;
        }
        .vision-dest-name {
          font-family: var(--font-sans);
          font-size: 0.8125rem;
          font-weight: 700;
          letter-spacing: -0.015em;
          color: #0E1620;
        }
        .vision-dest-meta {
          font-family: var(--font-sans);
          font-size: 0.6875rem;
          font-weight: 500;
          letter-spacing: 0.01em;
          color: color-mix(in oklab, #0E1620 62%, #55606e);
        }

        .vision-narrative {
          width: clamp(15rem, 34vw, 28rem);
          max-width: min(28rem, calc(100vw - 2.5rem));
          border-left: 3px solid var(--cyan, #2EC4B6);
        }
        .vision-caption {
          display: block;
          font-family: var(--font-sans);
          font-size: 0.6875rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: color-mix(in oklab, #F5F4DF 68%, var(--cyan, #2EC4B6));
          margin-bottom: 0.55rem;
        }
        .vision-narrative-body {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(1.15rem, 2.4vw, 1.85rem);
          font-weight: 600;
          letter-spacing: -0.025em;
          line-height: 1.15;
          color: #F5F4DF;
        }

        @media (max-width: 768px) {
          .vision-header-container {
            padding: 4.5rem 1rem 0;
          }
          .vision-headline-desktop {
            display: none;
          }
          .vision-headline-mobile {
            display: block;
            white-space: normal;
          }
          .vision-stats {
            gap: 0.85rem;
          }
          .vision-text-block {
            top: var(--top-m) !important;
          }
          .vision-side-left,
          .vision-side-right {
            left: 1rem;
            right: 1rem;
            width: auto;
            max-width: none;
          }
          .vision-callout,
          .vision-narrative {
            width: auto;
            max-width: none;
          }
          .vision-dest-chip {
            left: 1rem !important;
            right: auto !important;
          }
        }
      `}</style>
    </section>
  );
}
