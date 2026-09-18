'use client';

import React, { useEffect, useRef, useState } from 'react';

interface PartnerCategory {
  id: string;
  label: string;
  image: string;
  description: string;
  logos: {
    name: string;
    label?: string;
  }[];
}

const PARTNER_CATEGORIES: PartnerCategory[] = [
  {
    id: 'honeymoon',
    label: 'Honeymoon',
    image: '/images/destinations/maldives.jpg',
    description:
      'Overwater villas in the Maldives, cave suites in Cappadocia, and private dinners arranged around your dates, not a group schedule.',
    logos: [{ name: 'Maldives' }, { name: 'Turkey' }],
  },
  {
    id: 'family',
    label: 'Family',
    image: '/images/destinations/singapore.jpg',
    description:
      'Connecting rooms, kid-friendly resorts, and flight times that actually work for children.',
    logos: [{ name: 'Dubai' }, { name: 'Malaysia' }, { name: 'Singapore' }],
  },
  {
    id: 'groups',
    label: 'Groups',
    image: '/images/destinations/thailand.jpg',
    description:
      'Retreats, incentive travel, and friend-group getaways with group airfare and one consolidated invoice (10+ travellers).',
    logos: [{ name: 'Thailand' }, { name: 'Sri Lanka' }],
  },
  {
    id: 'e-sim',
    label: 'E-SIM',
    image: '/images/destinations/malaysia.jpg',
    description:
      'Every trip can include a ready-to-activate e-SIM, so you land connected instead of queuing at the airport counter.',
    logos: [],
  },
  {
    id: 'visa',
    label: 'Visa',
    image: '/images/destinations/sri-lanka.jpg',
    description:
      'Complete visa file preparation, embassy appointment scheduling, and transparent profile evaluation for guaranteed peace of mind.',
    logos: [{ name: '9 Destinations' }],
  },
];

export default function PartnersSection() {
  const trackRef = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const centerCardRef = useRef<HTMLDivElement>(null);
  const leftColRef = useRef<HTMLDivElement>(null);
  const rightColRef = useRef<HTMLDivElement>(null);

  const [activeCatIdx, setActiveCatIdx] = useState(0);

  useEffect(() => {
    let animId: number;

    const handleScroll = () => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const vh = window.innerHeight;
      const scrollableDist = trackRef.current.offsetHeight - vh;

      if (scrollableDist <= 0) return;

      // Track scroll progress across the pinned section (0.0 to 1.0)
      const rawProgress = -rect.top / scrollableDist;
      const progress = Math.max(0, Math.min(0.999, rawProgress));

      // ── Phase 1: Small-to-Big Growth & Headline Float (Progress 0.0 to 0.22) ──
      const growthRange = 0.22;
      const growthP = Math.max(0, Math.min(1, progress / growthRange));
      const easedGrowth = growthP * growthP * (3 - 2 * growthP); // smooth easeInOut

      // 1. Headline: starts centered above, translates upward and fades out
      if (headlineRef.current) {
        const headY = -easedGrowth * 140;
        const headOp = Math.max(0, 1 - growthP * 1.35);
        headlineRef.current.style.transform = `translate3d(0, ${headY}px, 0)`;
        headlineRef.current.style.opacity = `${headOp}`;
        headlineRef.current.style.display = headOp <= 0.001 ? 'none' : 'block';
      }

      // 2. Center Image: grows smoothly from small (scale 0.38) to full size (scale 1.0)
      if (centerCardRef.current) {
        const cardScale = 0.38 + 0.62 * easedGrowth;
        const cardY = (1 - easedGrowth) * 110;
        centerCardRef.current.style.transform = `translate3d(0, ${cardY}px, 0) scale(${cardScale})`;
      }

      // 3. Side columns: fade in and slide to their resting position
      if (leftColRef.current) {
        const sideOp = Math.max(0, Math.min(1, (growthP - 0.35) / 0.65));
        const sideY = (1 - easedGrowth) * 45;
        leftColRef.current.style.opacity = `${sideOp}`;
        leftColRef.current.style.transform = `translate3d(0, ${sideY}px, 0)`;
      }

      if (rightColRef.current) {
        const sideOp = Math.max(0, Math.min(1, (growthP - 0.35) / 0.65));
        const sideY = (1 - easedGrowth) * 45;
        rightColRef.current.style.opacity = `${sideOp}`;
        rightColRef.current.style.transform = `translate3d(0, ${sideY}px, 0)`;
      }

      // ── Phase 2: Category Cycling (Progress 0.22 to 1.0) ──
      const catCount = PARTNER_CATEGORIES.length;
      if (progress < growthRange) {
        setActiveCatIdx(0);
      } else {
        const categoryProgress = (progress - growthRange) / (1 - growthRange);
        const calculatedIdx = Math.min(catCount - 1, Math.floor(categoryProgress * catCount));
        setActiveCatIdx(calculatedIdx);
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

  const handleCategoryClick = (idx: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const vh = window.innerHeight;
    const scrollableDist = trackRef.current.offsetHeight - vh;
    const growthRange = 0.22;
    const catCount = PARTNER_CATEGORIES.length;

    // Calculate target scroll position for this specific category
    const catProgress = growthRange + (idx / catCount) * (1 - growthRange) + 0.02;
    const targetScrollY = window.scrollY + rect.top + catProgress * scrollableDist;

    window.scrollTo({
      top: targetScrollY,
      behavior: 'smooth',
    });
  };

  const activeCategory = PARTNER_CATEGORIES[activeCatIdx];

  return (
    <section
      ref={trackRef}
      id="travel-styles"
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        height: '420vh', // Extended pinned scroll track for small-to-big entrance and 6 categories
        backgroundColor: '#F4F3DC',
        color: '#0E1620',
        zIndex: 14,
      }}
    >
      {/* ── Sticky Viewport Stage ── */}
      <div
        className="partners-sticky-stage"
        style={{
          position: 'sticky',
          top: 0,
          left: 0,
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
          backgroundColor: '#F4F3DC',
          padding: '0 clamp(2rem, 4.5vw, 4.5rem)',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '1360px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Main Headline (Floating on entrance, lifting smoothly) */}
          <h2
            ref={headlineRef}
            style={{
              position: 'absolute',
              top: 'clamp(2rem, 6vh, 4.5rem)',
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2.4rem, 4.2vw, 4.75rem)',
              fontWeight: 600,
              lineHeight: 1.06,
              letterSpacing: '-0.035em',
              color: '#0E1620',
              textAlign: 'center',
              margin: '0 auto',
              zIndex: 5,
              willChange: 'transform, opacity',
            }}
          >
            The trips we plan<br />most often.
          </h2>

          {/* 3-Column Interactive Layout */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(180px, 1fr) minmax(320px, 1.4fr) minmax(240px, 1.2fr)',
              gap: 'clamp(2rem, 4vw, 4.5rem)',
              alignItems: 'center',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              marginTop: 'clamp(1rem, 2vh, 2.5rem)',
            }}
            className="partners-grid-responsive"
          >
            {/* ── Left Column: Category Vertical Navigation ── */}
            <div
              ref={leftColRef}
              className="partners-nav-list"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1.75rem',
                willChange: 'transform, opacity',
              }}
            >
              {PARTNER_CATEGORIES.map((cat, idx) => {
                const isActive = idx === activeCatIdx;
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryClick(idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.85rem',
                      background: 'none',
                      border: 'none',
                      padding: '0.2rem 0',
                      cursor: 'pointer',
                      textAlign: 'left',
                      color: isActive ? '#0E1620' : 'rgba(14, 22, 32, 0.35)',
                      transition: 'color 0.25s ease',
                    }}
                    className="hover:text-[#0E1620]"
                  >
                    {/* Active Bullet Indicator — sized to match the active label's scale */}
                    <span
                      style={{
                        width: '9px',
                        height: '9px',
                        borderRadius: '50%',
                        backgroundColor: '#0E1620',
                        flexShrink: 0,
                        opacity: isActive ? 1 : 0,
                        transform: isActive ? 'scale(1)' : 'scale(0.4)',
                        transition: 'opacity 0.25s ease, transform 0.25s ease',
                      }}
                    />
                    <span
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: isActive
                          ? 'clamp(1.85rem, 3.4vw, 2.75rem)'
                          : 'clamp(0.9rem, 1vw, 1.05rem)',
                        fontWeight: isActive ? 700 : 400,
                        letterSpacing: isActive ? '-0.025em' : '-0.005em',
                        lineHeight: isActive ? 1.08 : 1.3,
                        transition: 'font-size 0.25s ease, font-weight 0.25s ease, color 0.25s ease',
                      }}
                    >
                      {cat.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* ── Center Column: Smoothly Scaling & Crossfading Photo Card ── */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div
                ref={centerCardRef}
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: '520px',
                  aspectRatio: '1 / 1',
                  borderRadius: 'clamp(20px, 2.4vw, 32px)',
                  overflow: 'hidden',
                  boxShadow: '0 24px 60px rgba(14, 22, 32, 0.08)',
                  backgroundColor: '#0E1620',
                  transformOrigin: 'center center',
                  willChange: 'transform',
                }}
              >
                {PARTNER_CATEGORIES.map((cat, idx) => {
                  const isCur = idx === activeCatIdx;
                  return (
                    <img
                      key={cat.id}
                      src={cat.image}
                      alt={cat.label}
                      loading="lazy"
                      decoding="async"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'center',
                        opacity: isCur ? 1 : 0,
                        transform: isCur ? 'scale(1)' : 'scale(1.04)',
                        transition:
                          'opacity 0.55s cubic-bezier(0.16, 1, 0.3, 1), transform 0.65s cubic-bezier(0.16, 1, 0.3, 1)',
                        willChange: 'opacity, transform',
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* ── Right Column: Description & Bordered Partner Logos ── */}
            <div
              ref={rightColRef}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '2rem',
                willChange: 'transform, opacity',
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'clamp(1.05rem, 1.3vw, 1.375rem)',
                  lineHeight: 1.6,
                  color: 'rgba(14, 22, 32, 0.82)',
                  maxWidth: '340px',
                  minHeight: '4.5em',
                  margin: 0,
                  transition: 'opacity 0.35s ease',
                }}
              >
                {activeCategory.description}
              </p>

              {/* Destination Chip Boxes — compact, naturally sized */}
              {activeCategory.logos.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  {activeCategory.logos.map((logo) => (
                    <div
                      key={logo.name}
                      style={{
                        border: '1px solid rgba(14, 22, 32, 0.2)',
                        borderRadius: '5px',
                        backgroundColor: '#F4F3DC',
                        padding: '9px 18px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '42px',
                        fontFamily: 'var(--font-display)',
                        fontSize: '0.8125rem',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        color: '#0E1620',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        transition: 'border-color 0.2s ease',
                      }}
                    >
                      {logo.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 960px) {
          .partners-grid-responsive {
            grid-template-columns: 1fr !important;
            gap: 2rem !important;
          }
        }

        /* Mobile safe area: the stacked column (nav list + image + description)
           is tall enough at narrow widths that centering it in 100vh lets the
           top item graze the fixed header logo. Anchor to the top with just
           enough clearance to sit below it, instead of centering — typography,
           spacing and image sizing are untouched. */
        @media (max-width: 640px) {
          .partners-sticky-stage {
            justify-content: flex-start !important;
            padding-top: 2.5rem !important;
            padding-bottom: 1rem !important;
          }
        }

        /* Narrow phones (390px, 375px, and smaller): the stacked column still
           overflows the 100vh pinned stage by ~35-55px with the spacing above,
           clipping the description/logo-chip row at the bottom. Typography
           (font sizes, weights, line-heights) is untouched here — only the
           gaps and stage padding are tightened, which reclaims ~76px and
           brings every category (including the longest 3-line descriptions
           with logo chips) back within the viewport. */
        @media (max-width: 400px) {
          .partners-sticky-stage {
            padding-top: 1.5rem !important;
            padding-bottom: 0.75rem !important;
          }
          .partners-grid-responsive {
            gap: 1.25rem !important;
          }
          .partners-nav-list {
            gap: 1.25rem !important;
          }
        }
      `}</style>
    </section>
  );
}
