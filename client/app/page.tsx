import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import HeroExperienceSequence from '@/components/landing/HeroExperienceSequence';

/* First-paint: hero stays eager. Nav + Lenis wrapper hydrate as separate
 * chunks so GSAP/Lenis and the lucide-heavy nav stay off the critical path. */
const SmoothScroll = dynamic(() => import('@/components/landing/SmoothScroll'));
const Navigation = dynamic(() => import('@/components/landing/Navigation'));

/* Below-fold sections: keep SSR for content/SEO, split JS out of the
 * first-paint client bundle so hero + nav hydrate without dragging in
 * App/Tech/News/Partners/Company/Vision/Footer code (and Vision's GSAP). */
const AppPreviewSection = dynamic(
  () => import('@/components/landing/AppPreviewSection'),
);
const TechPreviewSection = dynamic(
  () => import('@/components/landing/TechPreviewSection'),
);
const NewsPreviewSection = dynamic(
  () => import('@/components/landing/NewsPreviewSection'),
);
const PartnersSection = dynamic(
  () => import('@/components/landing/PartnersSection'),
);
const CompanyPreviewSection = dynamic(
  () => import('@/components/landing/CompanyPreviewSection'),
);
const VisionCarouselSection = dynamic(
  () => import('@/components/landing/VisionCarouselSection'),
);
const Footer = dynamic(() => import('@/components/landing/Footer'));

export const metadata: Metadata = {
  title: 'FlightOne – Custom Tour Packages Around the World, Designed Around You',
  description:
    'FlightOne designs custom international tour packages globally with transparent pricing, visa support and a complete itinerary within 24 hours.',
  keywords: [
    'FlightOne',
    'global tour packages',
    'visa assistance',
    'Maldives packages',
    'Dubai packages',
    'honeymoon packages',
  ],
};

/*
 * FlightOne Landing Page — authentic reconstruction of previous FlightOne experience:
 * 1. HeroExperienceSequence (120fps video playthrough, corner scoops, ivory stage morph, 4-slide showcase, editorial statement reveal)
 * 2. AppPreviewSection (Your Itinerary — 24-hour turnaround, Trajectory Arc, WhatsApp-first booking)
 * 3. TechPreviewSection (Full-width cinematic "FlightOne Difference" reveal with dynamic 160px morphing radius)
 * 4. NewsPreviewSection (3-column featured destinations)
 * 5. PartnersSection (Travel styles category cycler)
 * 6. CompanyPreviewSection (Expanding card: "Designed around you" / WhatsApp contact panels)
 * 7. VisionCarouselSection (Next Adventure scroll story)
 */
export default function Home() {
  return (
    <SmoothScroll>
      <Navigation />
      <main style={{ background: '#FFFFFF', width: '100%', maxWidth: '100%', overflowX: 'clip', boxSizing: 'border-box' }}>
        {/* 1. Unified Hero Video Playthrough -> Travel Styles showcase morph */}
        <HeroExperienceSequence />

        {/* 2. Itinerary Preview (24-hour turnaround) */}
        <AppPreviewSection />

        {/* 3. The FlightOne Difference */}
        <TechPreviewSection />

        {/* 4. Featured destinations */}
        <NewsPreviewSection />

        {/* 5. Travel styles */}
        <PartnersSection />

        {/* 6. Company story */}
        <CompanyPreviewSection />

        {/* 7. Next Adventure */}
        <VisionCarouselSection />
      </main>
      <Footer />
    </SmoothScroll>
  );
}
