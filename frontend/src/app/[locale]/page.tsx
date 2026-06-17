'use client';

import { GridPattern } from '@/components/ui/grid-pattern';
import { LandingNav } from '@/components/landing/LandingNav';
import { Hero } from '@/components/landing/Hero';
import { ProblemSection } from '@/components/landing/ProblemSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { ScreenshotCarousel } from '@/components/landing/ScreenshotCarousel';
import { PricingSection } from '@/components/landing/PricingSection';
import { FAQSection } from '@/components/landing/FAQSection';
import { Footer } from '@/components/landing/Footer';
import { LandingJsonLd } from '@/components/landing/LandingJsonLd';

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-canvas">
      <LandingJsonLd />
      <GridPattern
        width={30}
        height={30}
        squares={[[1, 1], [4, 3], [7, 5], [10, 2], [13, 6]]}
        className="opacity-50"
      />
      <div className="relative z-10">
        <LandingNav />
        <main>
          <Hero />
          <ProblemSection />
          <FeaturesSection />
          <ScreenshotCarousel />
          <PricingSection />
          <FAQSection />
        </main>
        <Footer />
      </div>
    </div>
  );
}
