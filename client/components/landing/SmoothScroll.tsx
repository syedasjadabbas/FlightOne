'use client';

import { useEffect, useRef } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    // Disable automatic browser scroll restoration so refresh always starts at top
    if (typeof window !== 'undefined') {
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'manual';
      }
      window.scrollTo(0, 0);
    }

    const lenis = new Lenis({
      duration: 0.9,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1.15,
      touchMultiplier: 1.2,
    });

    lenisRef.current = lenis;
    if (typeof window !== 'undefined') {
      (window as unknown as { __lenis?: Lenis }).__lenis = lenis;
    }

    // Sync GSAP ScrollTrigger with Lenis scroll events
    lenis.on('scroll', ScrollTrigger.update);

    // Immediately jump to top on load
    lenis.scrollTo(0, { immediate: true });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    const rafId = requestAnimationFrame(raf);

    // Also handle beforeunload/load reset
    const handleReset = () => {
      window.scrollTo(0, 0);
      lenis.scrollTo(0, { immediate: true });
    };

    window.addEventListener('beforeunload', handleReset);

    return () => {
      window.removeEventListener('beforeunload', handleReset);
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
