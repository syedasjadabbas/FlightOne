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
    let lenis: Lenis | null = null;
    let tick: ((time: number) => void) | null = null;
    let gsapInstance: typeof import('gsap').default | null = null;

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

      const gsap = gsapMod.default;
      gsapInstance = gsap;
      gsap.registerPlugin(ScrollTrigger);

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

      // Drive Lenis from GSAP's own ticker (not a separate rAF loop) so pinned/scrubbed
      // ScrollTrigger animations (e.g. VisionCarouselSection's curtain-lift) share one
      // frame authority with Lenis — two independent rAF loops can fall out of sync
      // and silently break `pin: true` mid-scroll.
      tick = (time: number) => lenis?.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
    })();

    return () => {
      cancelled = true;
      window.removeEventListener('beforeunload', handleReset);
      if (tick && gsapInstance) gsapInstance.ticker.remove(tick);
      lenis?.destroy();
      lenisRef.current = null;
      const win = window as unknown as { __lenis?: Lenis };
      if (win.__lenis === lenis) delete win.__lenis;
    };
  }, []);

  return <>{children}</>;
}
