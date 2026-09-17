'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { COMPANY_INFO } from '@/data/company';

/* ── Travel Styles Highlights Slides (verified FlightOne trip types) ── */
const EXP_SLIDES = [
  {
    id: 0,
    n: '01 / 04',
    copy: 'Overwater villas in the Maldives, cave suites in Cappadocia, and private dinners arranged around your dates, not a group schedule.',
    image: '/images/destinations/maldives.jpg',
    nextLabel: 'Honeymoon Packages',
  },
  {
    id: 1,
    n: '02 / 04',
    copy: 'Connecting rooms, kid-friendly resorts, and flight times that actually work for children.',
    image: '/images/destinations/singapore.jpg',
    nextLabel: 'Family Holidays',
  },
  {
    id: 2,
    n: '03 / 04',
    copy: 'Retreats, incentive travel, and friend-group getaways with group airfare and one consolidated invoice (10+ travellers).',
    image: '/images/destinations/thailand.jpg',
    nextLabel: 'Group & Corporate Trips',
  },
  {
    id: 3,
    n: '04 / 04',
    copy: 'Every trip can include a ready-to-activate e-SIM, so you land connected instead of queuing at the airport counter.',
    image: '/images/destinations/malaysia.jpg',
    nextLabel: 'E-SIM Add-Ons',
  },
];

/* ── Section 2 Finale Editorial Statement ── */
const EDITORIAL_STATEMENT =
  'Every itinerary is built from scratch, so nothing is templated and nothing is priced to cover unsold inventory. Your itinerary, designed around you.';

let runningFlatIdx = 0;
const EDITORIAL_WORDS_ARRAY = EDITORIAL_STATEMENT.split(' ').map((word) => {
  const chars = word.split('').map((char) => {
    const idx = runningFlatIdx++;
    return { char, flatIdx: idx };
  });
  return { word, chars };
});
const TOTAL_EDITORIAL_CHARS = runningFlatIdx;

function smoothstep(min: number, max: number, value: number) {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
}

function calcOpacity(progress: number, fi: number, fv: number, fo: number, fe: number) {
  if (progress <= fi) return fi === 0 ? 1 : 0;
  if (progress < fv) return (progress - fi) / (fv - fi);
  if (progress <= fo) return 1;
  if (progress < fe) return 1 - (progress - fo) / (fe - fo);
  return 0;
}

function calcY(progress: number, fi: number, fv: number, fo: number, fe: number, range = 20) {
  if (progress <= fi) return 0;
  if (progress < fv) return range * (1 - (progress - fi) / (fv - fi));
  if (progress <= fo) return 0;
  if (progress < fe) return -range * ((progress - fo) / (fe - fo));
  return -range;
}

export default function HeroExperienceSequence() {
  const trackRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Direct DOM Refs for 120fps hardware acceleration
  const videoFrameRef = useRef<HTMLDivElement>(null);
  const scoopsContainerRef = useRef<HTMLDivElement>(null);
  const heroSlide0Ref = useRef<HTMLDivElement>(null);
  const heroSlide1Ref = useRef<HTMLDivElement>(null);
  const heroSlide2Ref = useRef<HTMLDivElement>(null);
  const scrollHintRef = useRef<HTMLDivElement>(null);

  // Section 2 Elements
  const ivoryBgRef = useRef<HTMLDivElement>(null);
  const titleContainerRef = useRef<HTMLDivElement>(null);
  const titleWhiteRef = useRef<HTMLHeadingElement>(null);
  const titleDarkRef = useRef<HTMLHeadingElement>(null);

  const showcaseStageRef = useRef<HTMLDivElement>(null);
  const slideCardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const slideTextRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rightTextContainerRef = useRef<HTMLDivElement>(null);

  const cornerLabelLeftRef = useRef<HTMLDivElement>(null);
  const cornerLabelRightRef = useRef<HTMLDivElement>(null);
  const editorialStageRef = useRef<HTMLDivElement>(null);
  const editorialCharRefs = useRef<(HTMLSpanElement | null)[]>([]);

  // State for active slide index & images
  const [activeExpIdx, setActiveExpIdx] = useState(0);
  const activeExpIdxRef = useRef(0);

  const setVideoRef = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el) {
      el.muted = true;
      el.defaultMuted = true;
      el.playsInline = true;
      el.pause();
    }
  }, []);

  /* ── 120fps Inertial Scroll & Fluid Transformation Engine ── */
  useEffect(() => {
    let animationFrameId: number;
    let lerpedP = 0;
    let isInitialized = false;

    const updateLoop = () => {
      if (trackRef.current) {
        const { top, height } = trackRef.current.getBoundingClientRect();
        const scrollable = height - window.innerHeight;
        const scrolled = Math.max(0, Math.min(scrollable, -top));
        const rawP = scrollable > 0 ? scrolled / scrollable : 0;

        if (!isInitialized) {
          lerpedP = rawP;
          isInitialized = true;
        }

        // Inertial damping follow - velvety luxury feel
        const diffP = rawP - lerpedP;
        lerpedP += diffP * 0.12;
        const p = lerpedP;

        const w = window.innerWidth;
        const h = window.innerHeight;

        /* ────────────────────────────────────────────────
           PHASE 1: IMMERSIVE HERO VIDEO & SLIDES (p: 0.00 -> 0.38)
        ────────────────────────────────────────────────── */
        const maxEntranceRadius = Math.min(Math.max(w * 0.16, 120), 220);
        const maxEntranceMargin = Math.min(Math.max(h * 0.15, 110), 160);

        // Smooth Scroll-Driven Video Playback across full 20-second video
        const video = videoRef.current;
        if (video) {
          const duration = !isNaN(video.duration) && video.duration > 0 ? video.duration : 20.0;
          // Map scroll progress smoothly across the full 20-second video:
          // top of hero (p = 0.00) = 0s -> exit of hero (p = 0.35) = 20s
          const scrubProgress = Math.min(1, Math.max(0, p / 0.34));
          const targetTime = scrubProgress * (duration - 0.02);

          if (!video.seeking && Math.abs(targetTime - video.currentTime) > 0.015) {
            try {
              if ('fastSeek' in video && typeof (video as unknown as { fastSeek?: (t: number) => void }).fastSeek === 'function') {
                (video as unknown as { fastSeek: (t: number) => void }).fastSeek(targetTime);
              } else {
                video.currentTime = targetTime;
              }
            } catch {
              video.currentTime = targetTime;
            }
          }
        }

        // On first scroll (0.00 -> 0.035):
        const expandProgress = smoothstep(0.00, 0.035, p);

        // Video exit (0.30 -> 0.38)
        const exitCurveProgress = smoothstep(0.30, 0.35, p);
        const videoExitProgress = smoothstep(0.30, 0.38, p);
        const videoTy = -videoExitProgress * 110;
        const videoOp = 1 - smoothstep(0.34, 0.38, p);

        const currentMargin = (1 - expandProgress) * maxEntranceMargin;
        const currentRadius = (1 - expandProgress) * maxEntranceRadius + exitCurveProgress * maxEntranceRadius;

        if (videoFrameRef.current) {
          videoFrameRef.current.style.bottom = `${currentMargin}px`;
          videoFrameRef.current.style.borderBottomLeftRadius = `${currentRadius}px`;
          videoFrameRef.current.style.borderBottomRightRadius = `${currentRadius}px`;
          videoFrameRef.current.style.transform = `translate3d(0, ${videoTy}%, 0)`;
          videoFrameRef.current.style.opacity = `${videoOp}`;
          videoFrameRef.current.style.display = videoOp <= 0.001 ? 'none' : 'block';
        }

        // Corner scoops
        if (scoopsContainerRef.current) {
          const entranceScoopsOp = 1 - expandProgress;
          const exitScoopsOp = exitCurveProgress * (1 - smoothstep(0.34, 0.38, p));
          const scoopsOp = entranceScoopsOp + exitScoopsOp;

          scoopsContainerRef.current.style.bottom = `${currentMargin}px`;
          scoopsContainerRef.current.style.height = `${Math.max(currentRadius, 1)}px`;
          scoopsContainerRef.current.style.transform = `translate3d(0, ${videoTy}%, 0)`;
          scoopsContainerRef.current.style.opacity = `${scoopsOp}`;
          scoopsContainerRef.current.style.display = scoopsOp <= 0.001 ? 'none' : 'flex';
        }

        // Hero Slides:
        if (heroSlide0Ref.current) {
          const op0 = calcOpacity(p, 0.0, 0.0, 0.06, 0.10);
          const y0 = calcY(p, 0.0, 0.0, 0.06, 0.10, 25);
          heroSlide0Ref.current.style.opacity = `${op0}`;
          heroSlide0Ref.current.style.transform = `translate3d(-50%, calc(-50% + ${y0}px), 0)`;
          heroSlide0Ref.current.style.display = op0 <= 0.001 ? 'none' : 'block';
        }

        if (heroSlide1Ref.current) {
          const op1 = calcOpacity(p, 0.10, 0.14, 0.19, 0.23);
          const y1 = calcY(p, 0.10, 0.14, 0.19, 0.23, 25);
          heroSlide1Ref.current.style.opacity = `${op1}`;
          heroSlide1Ref.current.style.transform = `translate3d(0, ${y1}px, 0)`;
          heroSlide1Ref.current.style.display = op1 <= 0.001 ? 'none' : 'block';
        }

        if (heroSlide2Ref.current) {
          const op2 = calcOpacity(p, 0.23, 0.27, 0.31, 0.35);
          const y2 = calcY(p, 0.23, 0.27, 0.31, 0.35, 25);
          heroSlide2Ref.current.style.opacity = `${op2}`;
          heroSlide2Ref.current.style.transform = `translate3d(0, ${y2}px, 0)`;
          heroSlide2Ref.current.style.display = op2 <= 0.001 ? 'none' : 'block';
        }

        if (scrollHintRef.current) {
          const hintOp = 1 - smoothstep(0, 0.035, p);
          scrollHintRef.current.style.opacity = `${hintOp}`;
          scrollHintRef.current.style.display = hintOp <= 0.001 ? 'none' : 'flex';
        }

        /* ────────────────────────────────────────────────
           PHASE 2: BLUE BACKGROUND & "NOWHERE TO GO BUT UP" (p: 0.32 -> 0.46)
        ────────────────────────────────────────────────── */
        // Ivory Background Crossfade (0.32 -> 0.38)
        const ivoryOp = smoothstep(0.32, 0.38, p);
        if (ivoryBgRef.current) {
          ivoryBgRef.current.style.opacity = `${ivoryOp}`;
        }

        // Headline "Nowhere to go but Up"
        if (titleContainerRef.current) {
          const titleIn = smoothstep(0.30, 0.36, p);
          const slideUpProgress = smoothstep(0.38, 0.45, p);
          const titleOut = 1 - slideUpProgress;
          const titleOp = titleIn * titleOut;

          const titleEntranceY = (1 - titleIn) * 35;
          const titleSlideUpY = -slideUpProgress * 110;

          titleContainerRef.current.style.opacity = `${titleOp}`;
          titleContainerRef.current.style.transform = `translate3d(0, ${titleEntranceY + titleSlideUpY}px, 0)`;
          titleContainerRef.current.style.display = titleOp <= 0.001 ? 'none' : 'flex';

          if (titleWhiteRef.current) titleWhiteRef.current.style.opacity = `${1 - ivoryOp}`;
          if (titleDarkRef.current) titleDarkRef.current.style.opacity = `${ivoryOp}`;
        }

        /* ────────────────────────────────────────────────
           PHASE 3: EXPERIENCE SHOWCASE 4-SLIDE STAGE (p: 0.42 -> 0.86)
           Generous scroll runway, zoom-safe geometry, and millimeter alignment
        /* ────────────────────────────────────────────────
           PHASE 3: EXPERIENCE SHOWCASE & EDITORIAL FINALE (p: 0.42 -> 1.00)
           Seamless flow: Slides 0->3 morph smoothly, then Card 3 shifts up
           and the Editorial Statement reveals directly beneath it (same section!)
        ────────────────────────────────────────────────── */
        const showcaseIn = smoothstep(0.42, 0.46, p);
        const exitProgress = smoothstep(0.97, 1.00, p); // Whole section exit
        const showcaseOut = 1 - exitProgress;
        const showcaseOp = showcaseIn * showcaseOut;
        const showcaseSlideUpY = -exitProgress * 140;

        // Viewport safe bounds: 76px top navbar clearance, 64px bottom footer clearance
        const navSafeH = 76;
        const bottomSafeH = 64;
        const availableH = h - navSafeH - bottomSafeH;
        const stageOffsetY = (navSafeH - bottomSafeH) / 2; // Exact geometric center

        if (showcaseStageRef.current) {
          showcaseStageRef.current.style.opacity = `${showcaseOp}`;
          showcaseStageRef.current.style.transform = `translate3d(0, ${stageOffsetY + showcaseSlideUpY}px, 0)`;
          showcaseStageRef.current.style.display = showcaseOp <= 0.001 ? 'none' : 'flex';
          showcaseStageRef.current.style.pointerEvents = showcaseOp > 0.3 ? 'auto' : 'none';
        }

        // Card sizing: Larger, more prominent center image with comfortable viewport bounds
        const normalCardSize = Math.max(300, Math.min(availableH - 4, Math.min(w * 0.52, 780)));
        const finaleCardSize = Math.max(240, Math.min(availableH * 0.48, Math.min(w * 0.46, 560)));

        const thumbSize = Math.max(90, Math.min(normalCardSize * 0.22, 160));
        const thumbScale = thumbSize / normalCardSize;

        // Visual radius: 36px on main card, 22px on thumbnail (compensated for CSS scale transform)
        const mainRadius = Math.max(26, Math.min(normalCardSize * 0.052, 40));
        const thumbTargetVisualRadius = Math.max(18, Math.min(thumbSize * 0.18, 28));
        const thumbRadius = thumbTargetVisualRadius / thumbScale;

        const thumbGap = Math.max(18, Math.min(w * 0.024, 34));
        const leftX = -(normalCardSize / 2 + thumbGap + thumbSize / 2);
        const leftY = -(normalCardSize / 2 - thumbSize / 2); // Aligned to top edge of main card

        const rightX = (normalCardSize / 2 + thumbGap + thumbSize / 2);
        const rightY = (normalCardSize / 2 - thumbSize / 2); // Aligned to bottom edge of main card

        const rightTextLeft = normalCardSize / 2 + thumbGap;
        const rightTextTop = -Math.min(75, normalCardSize * 0.1); // Centered vertically in the center-right of the main card

        // Responsive floor/cap so the right-column copy always keeps a readable
        // width and never gets pushed past the right edge at narrow viewport
        // widths (or effective widths from browser zoom) — text-column layout
        // only, the card/thumbnail geometry above is untouched.
        const textBoxMinWidth = 170;
        const textBoxMargin = 20;
        const safeRightTextLeft = Math.min(rightTextLeft, Math.max(0, w / 2 - textBoxMargin - textBoxMinWidth));

        // Below ~900px there simply isn't enough horizontal room beside the
        // card for a readable column at this floor width: the longest copy
        // (Honeymoon) wraps into 7-8 lines and grows tall enough to push the
        // "Explore Travel Styles" link down into the thumbnail's fixed slot.
        // Rather than shrinking type or moving the thumbnail (both are
        // off-limits), stack the copy BELOW the card + thumbnail cluster at
        // these widths, where there's ample vertical room and the full
        // viewport width to wrap in instead of a ~170px sliver. 900px sits
        // comfortably above every "beside" case that stays clear (1024px+,
        // at any required zoom level) and above the narrowest verified-safe
        // case, so the 1440/1280/1024 desktop composition is untouched.
        const stackBelowCard = w < 900;
        const stackedGap = Math.max(28, normalCardSize * 0.07);
        const stackedTop = normalCardSize / 2 + stackedGap;
        const stackedSideMargin = Math.max(24, w * 0.06);
        const stackedWidth = Math.max(textBoxMinWidth, Math.min(560, w - stackedSideMargin * 2));

        // Entrance scale for initial card 0 (0.42 -> 0.46)
        const entranceGrow = smoothstep(0.42, 0.46, p);
        const initialScale = 0.35 + 0.65 * entranceGrow;
        const initialY = (1 - entranceGrow) * Math.max(h * 0.18, 80);

        // Slide progression across p: 0.46 -> 0.76 (slides 0, 1, 2, 3)
        const expP = Math.max(0, Math.min(1, (p - 0.46) / (0.76 - 0.46)));

        let continuousSlide = 0;
        if (expP <= 0) {
          continuousSlide = 0;
        } else if (expP >= 1) {
          continuousSlide = 3;
        } else {
          const scaledP = expP * 3; // 0.0 to 3.0
          const k = Math.min(2, Math.floor(scaledP)); // 0, 1, or 2
          const localT = scaledP - k; // 0.0 to 1.0 within slide pair
          
          // 32% hold resting state, 48% smooth ease transition, 20% settle
          let easedT = 0;
          if (localT < 0.32) {
            easedT = 0;
          } else if (localT > 0.80) {
            easedT = 1;
          } else {
            const ratio = (localT - 0.32) / 0.48;
            easedT = ratio * ratio * (3 - 2 * ratio);
          }
          continuousSlide = k + easedT;
        }

        const currentIdx = Math.min(3, Math.max(0, Math.round(continuousSlide)));
        if (currentIdx !== activeExpIdxRef.current) {
          activeExpIdxRef.current = currentIdx;
          setActiveExpIdx(currentIdx);
        }

        // Finale progression: when reaching slide 3 (p >= 0.78), card 3 shifts up and editorial statement reveals
        const finaleP = smoothstep(0.78, 0.85, p);
        const scrubP = Math.max(0, Math.min(1, (p - 0.84) / 0.10));

        // Animate each of the 4 slide cards with continuous fluid morphing
        EXP_SLIDES.forEach((_, i) => {
          const cardEl = slideCardsRef.current[i];
          if (!cardEl) return;

          if (p < 0.46) {
            cardEl.style.width = `${normalCardSize}px`;
            cardEl.style.height = `${normalCardSize}px`;

            if (i === 0) {
              cardEl.style.transform = `translate3d(0, ${initialY}px, 0) scale(${initialScale})`;
              cardEl.style.opacity = `${showcaseIn}`;
              cardEl.style.zIndex = '10';
              cardEl.style.borderRadius = `${mainRadius}px`;
              cardEl.style.display = showcaseIn <= 0.001 ? 'none' : 'block';
            } else if (i === 1) {
              const nextArrive = smoothstep(0.42, 0.46, p);
              const op = nextArrive * showcaseIn;
              cardEl.style.transform = `translate3d(${rightX}px, ${rightY + (1 - nextArrive) * 30}px, 0) scale(${thumbScale})`;
              cardEl.style.opacity = `${op}`;
              cardEl.style.zIndex = '12';
              cardEl.style.borderRadius = `${thumbRadius}px`;
              cardEl.style.display = op <= 0.001 ? 'none' : 'block';
            } else {
              cardEl.style.display = 'none';
              cardEl.style.opacity = '0';
            }
          } else {
            if (i === 3 && p >= 0.78) {
              // Card 3 in finale mode: stays visible, shifts to the 27vw content column, and glides upward
              const curCardSize = normalCardSize - (normalCardSize - finaleCardSize) * finaleP;
              const finaleShiftY = Math.min(availableH * 0.28, 190);
              const card3Y = -finaleP * finaleShiftY;

              const contentLeftPos = w >= 1024 ? Math.max(48, Math.min(w * 0.27, 480)) : Math.max(24, w * 0.05);
              const centerLeft = (w - curCardSize) / 2;
              const shiftX = (contentLeftPos - centerLeft) * finaleP;

              cardEl.style.width = `${curCardSize}px`;
              cardEl.style.height = `${curCardSize}px`;
              cardEl.style.transform = `translate3d(${shiftX}px, ${card3Y}px, 0) scale(1)`;
              cardEl.style.opacity = `${showcaseOut}`;
              cardEl.style.zIndex = '15';
              cardEl.style.borderRadius = `${mainRadius}px`;
              cardEl.style.display = 'block';
            } else {
              // Normal slide card morphing
              cardEl.style.width = `${normalCardSize}px`;
              cardEl.style.height = `${normalCardSize}px`;

              const rel = i - continuousSlide;
              let x = 0;
              let y = 0;
              let scale = 1.0;
              let op = 1.0;
              let z = 10;
              let radius = mainRadius;

              if (rel >= -1 && rel <= 0) {
                // Center -> Top-Left
                const t = -rel;
                const easedT = t * t * (3 - 2 * t);
                x = easedT * leftX;
                y = easedT * leftY;
                scale = 1.0 - (1.0 - thumbScale) * easedT;
                radius = mainRadius - (mainRadius - thumbRadius) * easedT;
                z = 8;
                op = 1.0;
              } else if (rel > 0 && rel <= 1) {
                // Bottom-Right -> Center
                const t = 1 - rel;
                const easedT = t * t * (3 - 2 * t);
                x = (1 - easedT) * rightX;
                y = (1 - easedT) * rightY;
                scale = thumbScale + (1.0 - thumbScale) * easedT;
                radius = thumbRadius + (mainRadius - thumbRadius) * easedT;
                z = 12;
                op = 1.0;
              } else if (rel < -1) {
                // Exiting off Top-Left
                const t = -rel - 1;
                x = leftX - t * 40;
                y = leftY - t * 40;
                scale = thumbScale;
                radius = thumbRadius;
                z = 4;
                op = Math.max(0, 1 - t * 2.0);
              } else if (rel > 1) {
                // Emerging into Bottom-Right
                const t = rel - 1;
                x = rightX;
                y = rightY + t * 30;
                scale = thumbScale;
                radius = thumbRadius;
                z = 4;
                op = Math.max(0, 1 - t * 2.0);
              }

              // In finale (p >= 0.78), fade out other cards smoothly
              const finaleCardFade = p >= 0.78 ? (1 - finaleP) : 1;
              const finalOp = op * showcaseOut * finaleCardFade;

              cardEl.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
              cardEl.style.opacity = `${finalOp}`;
              cardEl.style.zIndex = `${z}`;
              cardEl.style.borderRadius = `${radius}px`;
              cardEl.style.display = finalOp <= 0.001 ? 'none' : 'block';
            }
          }
        });

        // Right Text Container: Animate each slide text at 120fps with seamless crossfade
        if (rightTextContainerRef.current) {
          const textIn = smoothstep(0.43, 0.47, p);
          const finaleTextFade = p >= 0.78 ? (1 - finaleP) : 1;
          const textOp = textIn * showcaseOut * finaleTextFade;

          const textEntranceY = (1 - textIn) * 20;
          rightTextContainerRef.current.style.opacity = `${textOp}`;
          if (stackBelowCard) {
            // Reflowed: centered under the card + thumbnail, full-width column.
            rightTextContainerRef.current.style.left = '50%';
            rightTextContainerRef.current.style.top = `calc(50% + ${stackedTop}px)`;
            rightTextContainerRef.current.style.maxWidth = `${stackedWidth}px`;
            rightTextContainerRef.current.style.transform = `translate3d(-50%, ${textEntranceY}px, 0)`;
          } else {
            rightTextContainerRef.current.style.left = `calc(50% + ${safeRightTextLeft}px)`;
            rightTextContainerRef.current.style.top = `calc(50% + ${rightTextTop}px)`;
            rightTextContainerRef.current.style.maxWidth = `max(${textBoxMinWidth}px, calc(50vw - ${safeRightTextLeft}px - ${textBoxMargin}px))`;
            rightTextContainerRef.current.style.transform = `translate3d(0, ${textEntranceY}px, 0)`;
          }
          rightTextContainerRef.current.style.display = textOp <= 0.001 ? 'none' : 'flex';
        }

        // Animate individual slide text items
        EXP_SLIDES.forEach((_, i) => {
          const textEl = slideTextRefs.current[i];
          if (!textEl) return;
          const dist = continuousSlide - i;
          const absDist = Math.abs(dist);
          const itemOp = Math.max(0, 1 - absDist * 1.8);
          const itemY = -dist * 16;
          textEl.style.opacity = `${itemOp}`;
          textEl.style.transform = `translate3d(0, ${itemY}px, 0)`;
          textEl.style.display = itemOp <= 0.001 ? 'none' : 'block';
        });

        // Fixed Corner Labels:
        if (cornerLabelLeftRef.current) {
          const leftIn = smoothstep(0.32, 0.38, p);
          const leftOut = 1 - smoothstep(0.96, 0.99, p);
          const leftOp = leftIn * leftOut;
          cornerLabelLeftRef.current.style.opacity = `${leftOp}`;
          cornerLabelLeftRef.current.style.color = ivoryOp > 0.5 ? '#0E1620' : '#F5F4DF';
        }

        if (cornerLabelRightRef.current) {
          const rightIn = smoothstep(0.32, 0.38, p);
          const rightOut = 1 - smoothstep(0.80, 0.85, p);
          const rightOp = rightIn * rightOut;
          cornerLabelRightRef.current.style.opacity = `${rightOp}`;
          cornerLabelRightRef.current.style.color = ivoryOp > 0.5 ? '#0E1620' : '#F5F4DF';
        }

        /* ── Section 2 Finale: Editorial Statement directly beneath Card 3 ── */
        if (editorialStageRef.current) {
          const curCardSize = normalCardSize - (normalCardSize - finaleCardSize) * finaleP;
          const finaleShiftY = Math.min(availableH * 0.28, 190);
          const card3Y = -finaleP * finaleShiftY;
          const editOp = finaleP * showcaseOut;
          const editEntranceY = (1 - finaleP) * 20;

          const contentLeftPos = w >= 1024 ? Math.max(48, Math.min(w * 0.27, 480)) : Math.max(24, w * 0.05);
          const rightMargin = Math.max(32, w * 0.045);
          const maxAvailableW = w - contentLeftPos - rightMargin;

          editorialStageRef.current.style.opacity = `${editOp}`;
          editorialStageRef.current.style.left = `${contentLeftPos}px`;
          editorialStageRef.current.style.top = `calc(50% + ${card3Y + curCardSize / 2 + 28}px)`;
          editorialStageRef.current.style.maxWidth = `${maxAvailableW}px`;
          editorialStageRef.current.style.width = '100%';
          editorialStageRef.current.style.transform = `translate3d(0, ${editEntranceY}px, 0)`;
          editorialStageRef.current.style.display = editOp <= 0.001 ? 'none' : 'flex';
          editorialStageRef.current.style.pointerEvents = editOp > 0.4 ? 'auto' : 'none';

          // Progressive letter darkening scrub
          const totalChars = TOTAL_EDITORIAL_CHARS;
          const currentDarkCharCount = scrubP * totalChars;

          for (let k = 0; k < totalChars; k++) {
            const spanEl = editorialCharRefs.current[k];
            if (!spanEl) continue;

            const charDiff = currentDarkCharCount - k;
            if (charDiff >= 1) {
              spanEl.style.color = '#0E1620';
            } else if (charDiff <= 0) {
              spanEl.style.color = '#c7c6b6';
            } else {
              const alpha = charDiff;
              spanEl.style.color = `color-mix(in srgb, #0E1620 ${Math.round(alpha * 100)}%, #c7c6b6)`;
            }
          }
        }
      }
      animationFrameId = requestAnimationFrame(updateLoop);
    };

    // Run initial synchronous update to instantly calculate correct positions on mount
    updateLoop();
    animationFrameId = requestAnimationFrame(updateLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const handleThumbClick = (targetIdx: number) => {
    if (!trackRef.current) return;
    const { top, height } = trackRef.current.getBoundingClientRect();
    const scrollable = height - window.innerHeight;
    const currentScrolled = -top;
    const expPlateaus = [0.05, 0.38, 0.71, 0.95];
    const targetExpP = expPlateaus[targetIdx] ?? 0.05;
    const targetP = 0.46 + targetExpP * (0.84 - 0.46);
    const targetScrollY = window.scrollY + (targetP * scrollable - currentScrolled);
    window.scrollTo({
      top: targetScrollY,
      behavior: 'smooth',
    });
  };

  return (
    <section
      ref={trackRef}
      className="joby-hero-track"
      id="hero"
      style={{
        height: '16000px',
        position: 'relative',
        width: '100%',
        maxWidth: '100%',
        overflow: 'hidden',
        backgroundColor: '#007AE5',
      }}
    >
      <div
        className="joby-hero-sticky"
        style={{
          position: 'sticky',
          top: 0,
          left: 0,
          width: '100%',
          maxWidth: '100%',
          height: '100vh',
          overflow: 'hidden',
          backgroundColor: '#007AE5',
        }}
      >
        {/* ── Layer 1: Base FlightOne Blue Background (#007AE5) ── */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: '#007AE5',
            zIndex: 0,
          }}
        />

        {/* ── Layer 2: Cream Background (#F4F3DC) GPU Crossfade Layer ── */}
        <div
          ref={ivoryBgRef}
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: '#F4F3DC',
            zIndex: 1,
            opacity: 0,
            willChange: 'opacity',
          }}
        />

        {/* ═════════════════════════════════════════════════════════════════
            HERO VIDEO FRAME
        ══════════════════════════════════════════════════════════════════ */}
        <div
          ref={videoFrameRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 'clamp(110px, 15vh, 160px)',
            borderBottomLeftRadius: 'clamp(120px, 16vw, 220px)',
            borderBottomRightRadius: 'clamp(120px, 16vw, 220px)',
            overflow: 'hidden',
            backgroundColor: '#0E1620',
            zIndex: 10,
            isolation: 'isolate',
            WebkitMaskImage: '-webkit-radial-gradient(white, black)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
            willChange: 'transform, opacity, bottom, border-radius',
          }}
        >
          {/* HD Video */}
          <div className="absolute inset-0 bg-[#0E1620] overflow-hidden">
            <video
              ref={setVideoRef}
              src="/videos/flightone-hero.mp4"
              muted
              playsInline
              preload="auto"
              className="w-full h-full object-cover"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
                transform: 'translate3d(0, 0, 0)',
                willChange: 'transform',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
              }}
            />
          </div>

          {/* Dark Gradient Wash */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(to top, rgba(14,22,32,0.75) 0%, rgba(14,22,32,0.15) 45%, rgba(14,22,32,0.4) 100%)',
            }}
          />

          {/* Slide 0: Center Headline */}
          <div
            ref={heroSlide0Ref}
            style={{
              position: 'absolute',
              /* True vertical center of the video frame — no announcement
                 card to clear above it any more, so no extra offset needed. */
              top: '50%',
              left: '50%',
              transform: 'translate3d(-50%, -50%, 0)',
              textAlign: 'center',
              width: '100%',
              maxWidth: 'clamp(340px, 82vw, 1040px)',
              padding: '0 1.25rem',
              pointerEvents: 'none',
              zIndex: 20,
              willChange: 'transform, opacity',
            }}
          >
            <h1
              style={{
                /* Test face for this headline only — see --font-hero-heading
                   in globals.css (Sora Bold, falling back to the site's
                   global --font-display / Space Grotesk). Every other
                   heading and all body/UI text keeps Space Grotesk. */
                fontFamily: 'var(--font-hero-heading)',
                fontSize: 'clamp(2.6rem, 5.6vw, 5.75rem)',
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: '0.02em',
                color: '#F5F4DF',
                /* Tight near-shadow for crisp edge definition over bright
                   patches of the video, plus a larger soft shadow to lift
                   the whole headline off the footage regardless of what's
                   behind it — stronger than a single soft glow alone. */
                textShadow: '0 2px 6px rgba(0,0,0,0.55), 0 18px 48px rgba(0,0,0,0.5)',
                textWrap: 'balance',
              }}
            >
              Custom Tour Packages from Pakistan,<br />Designed Around You.
            </h1>
          </div>

          {/* Slide 1: Bottom-Left Overlay */}
          <div
            ref={heroSlide1Ref}
            style={{
              position: 'absolute',
              bottom: '4.5rem',
              left: '3.5rem',
              right: '3.5rem',
              maxWidth: '600px',
              zIndex: 25,
              pointerEvents: 'none',
              willChange: 'transform, opacity',
              display: 'none',
              opacity: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'stretch', gap: '1.25rem' }}>
              <div
                style={{
                  width: '3.5px',
                  backgroundColor: '#FFFFFF',
                  flexShrink: 0,
                  borderRadius: '2px',
                  boxShadow: '0 0 12px rgba(255,255,255,0.45)',
                }}
              />
              <p
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'clamp(1.25rem, 2.2vw, 1.875rem)',
                  fontWeight: 500,
                  lineHeight: 1.32,
                  color: '#FFFFFF',
                  letterSpacing: '-0.015em',
                  textShadow: '0 2px 14px rgba(0,0,0,0.6)',
                }}
              >
                FlightOne designs custom international tour packages from Pakistan with transparent pricing, visa support and a complete itinerary within 24 hours.
              </p>
            </div>
          </div>

          {/* Slide 2: Bottom-Left Overlay */}
          <div
            ref={heroSlide2Ref}
            style={{
              position: 'absolute',
              bottom: '4.5rem',
              left: '3.5rem',
              right: '3.5rem',
              maxWidth: '600px',
              zIndex: 25,
              pointerEvents: 'none',
              willChange: 'transform, opacity',
              display: 'none',
              opacity: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'stretch', gap: '1.25rem' }}>
              <div
                style={{
                  width: '3.5px',
                  backgroundColor: '#FFFFFF',
                  flexShrink: 0,
                  borderRadius: '2px',
                  boxShadow: '0 0 12px rgba(255,255,255,0.45)',
                }}
              />
              <p
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'clamp(1.25rem, 2.2vw, 1.875rem)',
                  fontWeight: 500,
                  lineHeight: 1.32,
                  color: '#FFFFFF',
                  letterSpacing: '-0.015em',
                  textShadow: '0 2px 14px rgba(0,0,0,0.6)',
                }}
              >
                Every quote lists exactly what is included and what is not. The number you approve is the number you pay, with no surprises at checkout.
              </p>
            </div>
          </div>

          {/* Scroll hint prompt */}
          <div
            ref={scrollHintRef}
            style={{
              position: 'absolute',
              bottom: '1.75rem',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
              pointerEvents: 'none',
              zIndex: 30,
            }}
          >
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(245,244,223,0.6)' }}>
              Scroll to explore
            </span>
            <div className="joby-scroll-hint" />
          </div>
        </div>

        {/* ── Vector SVG Corner Scoops ── */}
        <div
          ref={scoopsContainerRef}
          style={{
            position: 'absolute',
            bottom: 'clamp(110px, 15vh, 160px)',
            left: 0,
            right: 0,
            height: 'clamp(120px, 16vw, 220px)',
            pointerEvents: 'none',
            zIndex: 15,
            display: 'flex',
            justifyContent: 'space-between',
            willChange: 'transform, opacity, bottom, height',
          }}
        >
          <svg
            style={{ width: 'clamp(120px, 16vw, 220px)', height: '100%', display: 'block' }}
            viewBox="0 0 100 100"
            fill="none"
          >
            <path
              d="M 0 0 C 0 55.23 44.77 100 100 100 L 0 100 Z"
              fill="#007AE5"
            />
          </svg>

          <svg
            style={{ width: 'clamp(120px, 16vw, 220px)', height: '100%', display: 'block' }}
            viewBox="0 0 100 100"
            fill="none"
          >
            <path
              d="M 100 0 C 100 55.23 55.23 100 0 100 L 100 100 Z"
              fill="#007AE5"
            />
          </svg>
        </div>

        {/* ═════════════════════════════════════════════════════════════════
            "Popular Destinations, Available Worldwide" HEADLINE (Large Edge-to-Edge Typography)
        ══════════════════════════════════════════════════════════════════ */}
        <div
          ref={titleContainerRef}
          style={{
            position: 'absolute',
            top: 'clamp(3.25rem, 6vh, 4.75rem)',
            left: 0,
            right: 0,
            zIndex: 14,
            display: 'none',
            opacity: 0,
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            padding: '0 clamp(1rem, 2vw, 2.5rem)',
            willChange: 'transform, opacity',
            transform: 'translate3d(0, 35px, 0)',
          }}
        >
          <div className="w-full text-center relative mx-auto" style={{ paddingBottom: '0.75rem' }}>
            {/* White Title on Blue */}
            <h2
              ref={titleWhiteRef}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(2.5rem, 7.5vw, 9rem)',
                fontWeight: 700,
                letterSpacing: '-0.035em',
                color: '#FFFFFF',
                lineHeight: 1.12,
                whiteSpace: 'normal',
                overflowWrap: 'break-word',
                position: 'relative',
                opacity: 1,
              }}
            >
              Popular Destinations, Available Worldwide
            </h2>

            {/* Dark Title on Cream */}
            <h2
              ref={titleDarkRef}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(2.5rem, 7.5vw, 9rem)',
                fontWeight: 700,
                letterSpacing: '-0.035em',
                color: '#0E1620',
                lineHeight: 1.12,
                whiteSpace: 'normal',
                overflowWrap: 'break-word',
                position: 'absolute',
                inset: 0,
                opacity: 0,
              }}
            >
              Popular Destinations, Available Worldwide
            </h2>
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════════════
            SECTION 2: ROLLING EXPERIENCE SHOWCASE STAGE
            (Continuous Morphing Cards: Center -> Top-Left, Bottom-Right -> Center)
        ══════════════════════════════════════════════════════════════════ */}
        <div
          ref={showcaseStageRef}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 18,
            display: 'none',
            opacity: 0,
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            willChange: 'opacity',
          }}
        >
          {/* Centered Anchor Container */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'auto',
            }}
          >
            {/* Morphing Cards for all 4 Slides */}
            {EXP_SLIDES.map((slide, i) => (
              <div
                key={slide.id}
                ref={(el) => { slideCardsRef.current[i] = el; }}
                onClick={() => {
                  if (i !== activeExpIdxRef.current) {
                    handleThumbClick(i);
                  }
                }}
                style={{
                  position: 'absolute',
                  width: 'clamp(300px, min(52vw, calc(100vh - 140px)), 780px)',
                  aspectRatio: '1 / 1',
                  borderRadius: 'clamp(26px, 3vw, 40px)',
                  overflow: 'hidden',
                  boxShadow: '0 28px 75px rgba(14,22,32,0.16)',
                  border: '1px solid rgba(14,22,32,0.08)',
                  backgroundColor: '#EBE9CD',
                  transformOrigin: 'center center',
                  willChange: 'transform, opacity, border-radius',
                  cursor: i === activeExpIdx ? 'default' : 'pointer',
                  display: i === 0 ? 'block' : 'none',
                }}
              >
                <img
                  src={slide.image}
                  alt={slide.copy}
                  /* Cards 1-3 start display:none and are only flipped to
                     visible by the RAF loop as the user scrolls into the
                     showcase phase (~p=0.42+), so native loading="lazy"
                     (which needs a laid-out box to judge viewport distance)
                     can't safely prefetch them ahead of time without risking
                     a pop-in. fetchPriority="low" still deprioritizes them
                     behind the hero video/LCP content on the network without
                     changing *when* the fetch starts. */
                  fetchPriority={i === 0 ? undefined : 'low'}
                  decoding="async"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                    borderRadius: 'inherit',
                  }}
                />
              </div>
            ))}

            {/* Right Column: Slide Copy & Link */}
            <div
              ref={rightTextContainerRef}
              style={{
                position: 'absolute',
                left: 'calc(50% + clamp(160px, 22vw, 340px))',
                top: 'calc(50% - 60px)',
                width: 'clamp(240px, 20vw, 320px)',
                display: 'none',
                opacity: 0,
                flexDirection: 'column',
                gap: '1.25rem',
                willChange: 'transform, opacity',
                zIndex: 15,
                pointerEvents: 'auto',
              }}
            >
              {/* Grid-stacked crossfade: rows/columns auto-size to whichever slide's
                  text is currently visible, so this box always grows tall enough to
                  hold the copy at any viewport width/zoom — no fixed height to overflow. */}
              <div style={{ display: 'grid', gridTemplateColumns: '100%' }}>
                {EXP_SLIDES.map((slide, i) => (
                  <div
                    key={slide.id}
                    ref={(el) => { slideTextRefs.current[i] = el; }}
                    style={{
                      gridColumn: '1 / 1',
                      gridRow: '1 / 1',
                      width: '100%',
                      minWidth: 0,
                      opacity: i === 0 ? 1 : 0,
                      transform: 'translate3d(0, 0, 0)',
                      willChange: 'transform, opacity',
                      display: i === 0 ? 'block' : 'none',
                    }}
                  >
                    <p
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 'clamp(1rem, 1.45vw, 1.6rem)',
                        fontWeight: 500,
                        lineHeight: 1.25,
                        color: '#0E1620',
                        letterSpacing: '-0.02em',
                        maxWidth: '100%',
                        overflowWrap: 'break-word',
                        margin: 0,
                      }}
                    >
                      {slide.copy}
                    </p>
                  </div>
                ))}
              </div>

              <div>
                <Link
                  href="/travel-styles"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    color: '#0E1620',
                    textDecoration: 'underline',
                    textUnderlineOffset: '4px',
                    textDecorationThickness: '1.5px',
                    transition: 'color 0.2s ease',
                  }}
                  className="hover:text-[#007AE5]"
                >
                  Explore Travel Styles
                </Link>
              </div>
            </div>

            {/* Editorial Finale Statement: Full-width spanning from left to right */}
            <div
              ref={editorialStageRef}
              style={{
                position: 'absolute',
                display: 'none',
                opacity: 0,
                flexDirection: 'column',
                alignItems: 'flex-start',
                willChange: 'transform, opacity',
                zIndex: 25,
                pointerEvents: 'none',
                width: '100%',
              }}
            >
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(1.95rem, 3.1vw, 3.35rem)',
                  fontWeight: 550,
                  lineHeight: 1.12,
                  letterSpacing: '-0.035em',
                  color: '#c7c6b6',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                {EDITORIAL_WORDS_ARRAY.map((wordObj, wIdx) => (
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
                        ref={(el) => { editorialCharRefs.current[item.flatIdx] = el; }}
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
              </h3>

              <div style={{ marginTop: '1.75rem' }}>
                <Link
                  href={COMPANY_INFO.contact.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#0E1620',
                    color: '#FFFFFF',
                    borderRadius: '9999px',
                    padding: '11px 24px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    fontFamily: 'var(--font-sans)',
                    textDecoration: 'none',
                    letterSpacing: '-0.01em',
                    boxShadow: '0 4px 14px rgba(14,22,32,0.15)',
                    transition: 'background-color 0.25s ease, transform 0.25s ease',
                  }}
                  className="hover:bg-[#007AE5] hover:scale-[1.02]"
                >
                  Get My Free Itinerary
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════════════
            FIXED CORNER LABELS:
            - Bottom-Left: "Travel Styles"
            - Bottom-Right: current travel style name
        ══════════════════════════════════════════════════════════════════ */}
        <div
          ref={cornerLabelLeftRef}
          style={{
            position: 'absolute',
            bottom: '1.875rem',
            left: 'clamp(2rem, 4.5vw, 4rem)',
            zIndex: 20,
            fontFamily: 'var(--font-sans)',
            fontSize: '0.8125rem',
            fontWeight: 500,
            letterSpacing: '0.01em',
            color: '#F5F4DF',
            pointerEvents: 'none',
            opacity: 0,
            transition: 'color 0.4s ease',
            willChange: 'opacity',
          }}
        >
          Travel Styles
        </div>

        <div
          ref={cornerLabelRightRef}
          style={{
            position: 'absolute',
            bottom: '1.875rem',
            right: 'clamp(2rem, 4.5vw, 4rem)',
            zIndex: 20,
            fontFamily: 'var(--font-sans)',
            fontSize: '0.8125rem',
            fontWeight: 500,
            letterSpacing: '0.01em',
            color: '#F5F4DF',
            pointerEvents: 'none',
            opacity: 0,
            transition: 'color 0.4s ease',
            willChange: 'opacity',
          }}
        >
          {EXP_SLIDES[activeExpIdx]?.nextLabel || 'Honeymoon Packages'}
        </div>
      </div>
    </section>
  );
}
