'use client';

import React from 'react';
import Link from 'next/link';

const NEWS_ARTICLES = [
  {
    id: 'maldives',
    date: 'From PKR 385,000',
    title: 'Maldives — Honeymoons, overwater villas, beach rest',
    image: '/images/destinations/maldives.jpg',
    query: 'Tell me about honeymoon packages to the Maldives',
    aspectRatio: '16 / 10.5',
  },
  {
    id: 'turkey',
    date: 'From PKR 450,000',
    title: 'Turkey — Culture, history, Cappadocia hot air balloons',
    image: '/images/destinations/turkey.jpg',
    query: 'Tell me about tour packages to Turkey, including Cappadocia',
    aspectRatio: '4 / 4.8',
  },
  {
    id: 'dubai',
    date: 'From PKR 245,000',
    title: 'Dubai — First international trip, city luxury, desert safari',
    image: '/images/destinations/dubai.jpg',
    query: 'Tell me about tour packages to Dubai',
    aspectRatio: '16 / 9.8',
  },
];

export default function NewsPreviewSection() {
  return (
    <section
      id="destinations"
      style={{
        backgroundColor: '#F4F3DC',
        color: '#0E1620',
        padding: 'clamp(5.5rem, 9vh, 8.5rem) 0 clamp(6rem, 10vh, 9.5rem)',
        position: 'relative',
        zIndex: 15,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        borderTopLeftRadius: 'clamp(36px, 4.5vw, 60px)',
        borderTopRightRadius: 'clamp(36px, 4.5vw, 60px)',
        boxShadow: '0 -20px 50px rgba(14,22,32,0.15)',
        marginTop: '-2.5rem',
      }}
    >
      <div id="search" aria-hidden="true" style={{ position: 'absolute', top: 0, height: 0, width: 0 }} />
      <div
        style={{
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          padding: '0 clamp(2rem, 4.5vw, 4.5rem)',
          margin: '0 auto',
        }}
      >
        {/* Header Row: Title on Left + "View all News" button on Right */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'clamp(3.5rem, 6vh, 5.5rem)',
            flexWrap: 'wrap',
            gap: '1.5rem',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2.75rem, 4.5vw, 5.25rem)',
              fontWeight: 600,
              lineHeight: 1.06,
              letterSpacing: '-0.035em',
              color: '#0E1620',
              margin: 0,
            }}
          >
            Where will you go next?
          </h2>

          <Link
            href="/flights"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#0E1620',
              color: '#FFFFFF',
              borderRadius: '9999px',
              padding: '11px 26px',
              fontSize: '0.875rem',
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              textDecoration: 'none',
              letterSpacing: '-0.01em',
              boxShadow: '0 4px 14px rgba(14,22,32,0.15)',
              transition: 'background-color 0.25s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            className="hover:bg-[#007AE5] hover:scale-[1.03]"
          >
            View all Destinations
          </Link>
        </div>

        {/* 3-Column News Grid with Divider Lines and Hover Zoom */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '0',
            alignItems: 'start',
          }}
          className="news-grid-responsive"
        >
          {NEWS_ARTICLES.map((article) => (
            <Link
              key={article.id}
              href={`/chat?q=${encodeURIComponent(article.query)}`}
              className="group"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                textDecoration: 'none',
                color: 'inherit',
                borderLeft: '1px solid rgba(14, 22, 32, 0.22)',
                padding: '0 clamp(1.25rem, 2.2vw, 2.75rem)',
                transition: 'opacity 0.25s ease',
              }}
            >
              {/* Card Meta & Headline */}
              <div>
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: 'rgba(14, 22, 32, 0.6)',
                    letterSpacing: '0.01em',
                    display: 'block',
                    marginBottom: '0.5rem',
                  }}
                >
                  {article.date}
                </span>

                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(1rem, 1.15vw, 1.25rem)',
                    fontWeight: 600,
                    lineHeight: 1.25,
                    letterSpacing: '-0.015em',
                    color: '#0E1620',
                    margin: 0,
                    minHeight: '62px',
                    transition: 'color 0.25s ease',
                  }}
                  className="group-hover:text-[#007AE5]"
                >
                  {article.title}
                </h3>
              </div>

              {/* Image Container with Buttery Smooth Hover Zoom Effect */}
              <div
                className="news-image-frame"
                style={{
                  width: '100%',
                  aspectRatio: article.aspectRatio,
                  borderRadius: 'clamp(16px, 1.8vw, 24px)',
                  overflow: 'hidden',
                  backgroundColor: '#EBE9CD',
                  marginTop: 'clamp(2rem, 4vh, 3.5rem)',
                  boxShadow: '0 16px 40px rgba(14,22,32,0.06)',
                  WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                  transform: 'translateZ(0)',
                }}
              >
                <img
                  src={article.image}
                  alt={article.title}
                  loading="lazy"
                  decoding="async"
                  className="news-card-img"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center',
                    display: 'block',
                    transformOrigin: 'center center',
                    willChange: 'transform',
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'translate3d(0, 0, 0) scale(1)',
                    transition: 'transform 0.85s cubic-bezier(0.25, 1, 0.5, 1)',
                  }}
                />
              </div>
            </Link>
          ))}
        </div>
      </div>

      <style>{`
        .news-image-frame {
          position: relative;
          isolation: isolate;
        }
        .group:hover .news-card-img {
          transform: translate3d(0, 0, 0) scale(1.045) !important;
        }
        @media (max-width: 900px) {
          .news-grid-responsive {
            grid-template-columns: 1fr !important;
            gap: 3.5rem !important;
          }
          .news-grid-responsive > a {
            border-left: none !important;
            border-top: 1px solid rgba(14, 22, 32, 0.2) !important;
            padding: 1.75rem 0 0 0 !important;
          }
        }
      `}</style>
    </section>
  );
}
