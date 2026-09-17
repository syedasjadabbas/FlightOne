import type { Metadata } from 'next';
import SmoothScroll from '@/components/landing/SmoothScroll';
import Navigation from '@/components/landing/Navigation';
import HeroExperienceSequence from '@/components/landing/HeroExperienceSequence';
import AppPreviewSection from '@/components/landing/AppPreviewSection';
import TechPreviewSection from '@/components/landing/TechPreviewSection';
import NewsPreviewSection from '@/components/landing/NewsPreviewSection';
import PartnersSection from '@/components/landing/PartnersSection';
import CompanyPreviewSection from '@/components/landing/CompanyPreviewSection';
import VisionCarouselSection from '@/components/landing/VisionCarouselSection';
import Footer from '@/components/landing/Footer';

export const metadata: Metadata = {
  title: 'FlightOne – Custom Tour Packages from Pakistan, Designed Around You',
  description:
    'FlightOne designs custom international tour packages from Pakistan with transparent pricing, visa support and a complete itinerary within 24 hours.',
  keywords: [
    'FlightOne',
    'tour packages from Pakistan',
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
 * 7. VisionCarouselSection (Future vision narrative stack & curtain-lift reveal)
 */
export default function Home() {
  return (
    <SmoothScroll>
      <Navigation />
      <main style={{ background: '#FFFFFF', width: '100%', maxWidth: '100%', overflowX: 'clip' }}>
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

        {/* 7. Future vision */}
        <VisionCarouselSection />
      </main>
      <Footer />
    </SmoothScroll>
  );
}



