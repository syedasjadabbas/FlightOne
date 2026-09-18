'use client';

import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

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
  caption: string;
  body: string;
  topDesktop: number;
  topMobile: number;
  leftDesktop: number;
  leftMobile: number;
};

const NARRATIVE_BLOCKS: NarrativeBlock[] = [
  {
    id: 'fv-1',
    caption: 'Future Vision — 1',
    body: 'Imagine a journey designed entirely around you.',
    topDesktop: 58,
    topMobile: 60,
    leftDesktop: 2.8,
    leftMobile: 4.3,
  },
  {
    id: 'fv-2',
    caption: 'Future Vision — 2',
    body: 'Where every destination feels closer, simpler, and more memorable.',
    topDesktop: 68.5,
    topMobile: 71,
    leftDesktop: 32.6,
    leftMobile: 19.9,
  },
  {
    id: 'fv-3',
    caption: 'Future Vision — 3',
    body: 'Where every trip becomes a story worth bringing home.',
    topDesktop: 79,
    topMobile: 82,
    leftDesktop: 56.5,
    leftMobile: 35.5,
  },
];

export default function VisionCarouselSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const textStackRef = useRef<HTMLDivElement>(null);
  const bgImgRef = useRef<HTMLImageElement>(null);
  const layerElRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!sectionRef.current || !stackRef.current || !sheetRef.current) return;

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

    return () => ctx.revert();
  }, []);

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
                <picture>/<source> lets the browser fetch ONLY the variant
                that matches the viewport (same 768px breakpoint the CSS
                used to gate with display:none/block) instead of always
                downloading both the desktop and mobile asset. Below-fold
                for every visitor, so it's lazy-loaded like every other
                layer here — Section 8's ~36MB of artwork no longer competes
                with the hero video/critical assets on initial load. */}
            <div style={{ position: 'relative', width: '100%', zIndex: 1 }}>
              <picture>
                <source media="(max-width: 768px)" srcSet={BACKGROUND_LAYER.mobile} />
                <img
                  ref={bgImgRef}
                  src={BACKGROUND_LAYER.desktop}
                  alt="Aerial sky and skyline illustration"
                  className="vision-layer-img"
                  loading="lazy"
                  decoding="async"
                />
              </picture>
            </div>

            {/* Layers 2–11 — transparent overlay illustrations */}
            {OVERLAY_LAYERS.map((layer) => (
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
                  <img src={layer.desktop} alt={layer.alt} className="vision-layer-img" loading="lazy" decoding="async" />
                </picture>
              </div>
            ))}
          </div>
        </div>

        {/* ── 2. SUBTLE DIRECTIONAL GRADIENT OVERLAY ── */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse at 50% 25%, rgba(7, 22, 44, 0.08) 0%, rgba(7, 22, 44, 0.3) 75%, rgba(7, 22, 44, 0.6) 100%)',
            pointerEvents: 'none',
            zIndex: 8,
          }}
        />

        {/* ── 3. TEXT LAYER — Header ("Dream of Flight") + 3 Cascading Narratives ── */}
        <div className="vision-text-layer" aria-hidden="true">
          <div ref={textStackRef} className="vision-text-stack" style={{ willChange: 'transform' }}>
            {/* Header: eyebrow labels + huge centered Dream of Flight headline */}
            <div className="vision-header-container">
              <div className="vision-topbar">
                <span className="vision-eyebrow">Our future vision</span>
                <span className="vision-eyebrow vision-topbar-right">Visa support included</span>
              </div>
              <div className="vision-headline-wrap">
                <h2 className="vision-headline-desktop">Next Adventure</h2>
                <h2 className="vision-headline-mobile">
                  Next
                  <br />
                  Adventure
                </h2>
              </div>
            </div>

            {/* Three narrative states — cascading diagonally */}
            {NARRATIVE_BLOCKS.map((block) => (
              <div
                key={block.id}
                className="vision-text-block vision-narrative"
                style={
                  {
                    '--top-d': `${block.topDesktop}%`,
                    '--top-m': `${block.topMobile}%`,
                    '--left-d': `${block.leftDesktop}%`,
                    '--left-m': `${block.leftMobile}%`,
                  } as React.CSSProperties
                }
              >
                <span className="vision-caption">{block.caption}</span>
                <p className="vision-narrative-body">{block.body}</p>
              </div>
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

        .vision-overlay-layer { pointer-events: none; }

        /* ── text layer ── */
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
          padding: clamp(4.5rem, 8.5vh, 7rem) clamp(1.5rem, 4vw, 3.5rem) 0;
          box-sizing: border-box;
          pointer-events: none;
          z-index: 10;
        }
        .vision-topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          margin-bottom: clamp(1rem, 2.5vh, 2.5rem);
        }
        .vision-eyebrow {
          font-family: var(--font-sans);
          font-size: clamp(0.75rem, 0.85vw, 0.875rem);
          font-weight: 500;
          letter-spacing: -0.01em;
          color: #F5F4DF;
          white-space: nowrap;
        }
        .vision-headline-wrap {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          text-align: center;
        }
        .vision-headline-desktop {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(4.5rem, 11vw, 11rem);
          font-weight: 500;
          letter-spacing: -0.03em;
          line-height: 0.95;
          color: #F5F4DF;
          text-shadow: 0 4px 36px rgba(7, 22, 44, 0.4);
          text-align: center;
          white-space: nowrap;
        }
        .vision-headline-mobile {
          display: none;
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(3.25rem, 14vw, 5.25rem);
          font-weight: 500;
          letter-spacing: -0.03em;
          line-height: 0.95;
          color: #F5F4DF;
          text-shadow: 0 4px 28px rgba(7, 22, 44, 0.4);
          text-align: center;
        }

        .vision-text-block {
          position: absolute;
          top: var(--top-d);
          left: var(--left-d, auto);
        }

        .vision-narrative {
          width: clamp(14rem, 34vw, 31.25rem);
          max-width: calc(100% - var(--left-d, 0%) - 1.5rem);
          box-sizing: border-box;
        }
        .vision-caption {
          display: block;
          font-family: var(--font-sans);
          font-size: clamp(0.7rem, 0.85vw, 0.8125rem);
          font-weight: 500;
          letter-spacing: -0.01em;
          color: #F5F4DF;
          margin-bottom: 0.85rem;
        }
        .vision-narrative-body {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(1.35rem, 5vw, 2.5rem);
          font-weight: 500;
          letter-spacing: -0.01em;
          line-height: 1.05;
          color: #F5F4DF;
          text-shadow: 0 2px 20px rgba(7, 22, 44, 0.3);
        }

        @media (max-width: 768px) {
          .vision-header-container {
            padding: 5rem 1.25rem 0;
          }
          .vision-headline-desktop {
            display: none;
          }
          .vision-headline-mobile {
            display: block;
          }
          .vision-topbar-right {
            display: none;
          }
          .vision-text-block {
            top: var(--top-m) !important;
          }
          .vision-narrative {
            left: var(--left-m) !important;
            max-width: calc(100% - var(--left-m, 0%) - 1.25rem) !important;
          }
        }
      `}</style>
    </section>
  );
}
