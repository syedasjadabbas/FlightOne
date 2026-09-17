'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function Navigation() {
  const [isLightSection, setIsLightSection] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // rAF-throttled so a burst of native 'scroll' events within one frame
    // only runs this once; setScrolled/setIsLightSection already bail out
    // of re-rendering when the boolean doesn't change, so this only trims
    // the redundant window.scrollY/innerHeight reads in between.
    let rafId: number | null = null;

    const update = () => {
      rafId = null;
      const scrollY = window.scrollY;
      setScrolled(scrollY > 20);

      /* Check if scrolled into light ivory stage (where background morphs to #F4F3DC) */
      const heroHeight = 9600;
      const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
      const morphThreshold = (heroHeight - vh) * 0.58;
      const isPastHeroMorph = scrollY > morphThreshold;
      setIsLightSection(isPastHeroMorph);
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

  const textColor = isLightSection ? '#0E1620' : '#F5F4DF';

  const handleScrollToTop = (e: React.MouseEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      const lenis = (window as unknown as { __lenis?: { scrollTo: (target: number, opts?: { duration?: number }) => void } }).__lenis;
      if (lenis) {
        lenis.scrollTo(0, { duration: 1.2 });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  return (
    <header
      className={`joby-nav ${scrolled ? 'scrolled' : ''} ${isLightSection ? 'light-mode' : 'dark-mode'}`}
      style={{
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        paddingTop: '1.75rem',
        paddingBottom: '1.75rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        pointerEvents: 'none',
      }}
    >
      {/* Center: FlightOne Infinity Ribbon Logo */}
      <Link
        href="/"
        onClick={handleScrollToTop}
        className="flex items-center justify-center opacity-90 hover:opacity-100 transition-all duration-300 hover:scale-105"
        style={{ pointerEvents: 'auto', cursor: 'pointer' }}
        aria-label="Scroll to top"
      >
        <svg
          width="44"
          height="30"
          viewBox="0 0 44 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12.5 7.5C7.253 7.5 3 11.753 3 17C3 22.247 7.253 26.5 12.5 26.5C18.5 26.5 24 16.5 31.5 16.5C36.747 16.5 41 20.753 41 26"
            stroke={textColor}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M31.5 26.5C36.747 26.5 41 22.247 41 17C41 11.753 36.747 7.5 31.5 7.5C25.5 7.5 20 17.5 12.5 17.5C7.253 17.5 3 13.247 3 8"
            stroke={textColor}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      </Link>
    </header>
  );
}
