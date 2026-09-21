'use client';

import { useEffect, useRef } from 'react';
import type Lenis from 'lenis';

/**
 * Wraps the landing page in Lenis smooth scroll and syncs GSAP ScrollTrigger.
 * Lenis + GSAP are loaded asynchronously so they do not sit on the critical
 * first-paint path of the homepage (hero/nav can hydrate first).
 */
export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    let cancelled = false;
    let rafId = 0;
    let lenis: Lenis | null = null;

    // Disable automatic browser scroll restoration so refresh always starts at top
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);

    const handleReset = () => {
      window.scrollTo(0, 0);
      lenis?.scrollTo(0, { immediate: true });
    };

    window.addEventListener('beforeunload', handleReset);

    void (async () => {
      const [{ default: LenisCtor }, gsapMod, { ScrollTrigger }] = await Promise.all([
        import('lenis'),
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);

      if (cancelled) return;

      gsapMod.default.registerPlugin(ScrollTrigger);

      lenis = new LenisCtor({
        duration: 0.9,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        gestureOrientation: 'vertical',
        smoothWheel: true,
        wheelMultiplier: 1.15,
        touchMultiplier: 1.2,
      });

      lenisRef.current = lenis;
      (window as unknown as { __lenis?: Lenis }).__lenis = lenis;

      // Sync GSAP ScrollTrigger with Lenis scroll events
      lenis.on('scroll', ScrollTrigger.update);

      // Immediately jump to top on load
      lenis.scrollTo(0, { immediate: true });

      function raf(time: number) {
        lenis?.raf(time);
        rafId = requestAnimationFrame(raf);
      }

      rafId = requestAnimationFrame(raf);
    })();

    return () => {
      cancelled = true;
      window.removeEventListener('beforeunload', handleReset);
      cancelAnimationFrame(rafId);
      lenis?.destroy();
      lenisRef.current = null;
      const win = window as unknown as { __lenis?: Lenis };
      if (win.__lenis === lenis) delete win.__lenis;
    };
  }, []);

  return <>{children}</>;
}
