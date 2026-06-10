'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const screenshots = [
  { src: '/screenshots/01-dashboard.png', alt: 'Dashboard' },
  { src: '/screenshots/02-students.png', alt: 'Students' },
  { src: '/screenshots/03-attendance.png', alt: 'Attendance' },
  { src: '/screenshots/04-classes.png', alt: 'Classes' },
  { src: '/screenshots/05-schedule.png', alt: 'Schedule' },
  { src: '/screenshots/06-whatsapp.png', alt: 'WhatsApp' },
  { src: '/screenshots/dashboard.png', alt: 'Dashboard Overview' },
];

export function ScreenshotCarousel() {
  const t = useTranslations('landing.screenshots');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollButtons = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollButtons, { passive: true });
    updateScrollButtons();
    return () => el.removeEventListener('scroll', updateScrollButtons);
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.7;
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  return (
    <section id="screenshots" className="py-20 bg-surface-sage/50 scroll-mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-ink font-display mb-4">
            {t('title')}
          </h2>
          <p className="text-lg text-ink/60 font-body">{t('subtitle')}</p>
        </div>

        <div className="relative">
          {/* Scroll buttons */}
          {canScrollLeft && (
            <button
              onClick={() => scroll('left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-canvas border border-ink/10 shadow-md flex items-center justify-center hover:bg-surface-cool transition-colors -ml-2"
            >
              <ChevronLeft className="w-5 h-5 text-ink" />
            </button>
          )}
          {canScrollRight && (
            <button
              onClick={() => scroll('right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-canvas border border-ink/10 shadow-md flex items-center justify-center hover:bg-surface-cool transition-colors -mr-2"
            >
              <ChevronRight className="w-5 h-5 text-ink" />
            </button>
          )}

          {/* Carousel */}
          <div
            ref={scrollRef}
            className="flex gap-6 overflow-x-auto snap-x snap-mandatory pb-4"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {screenshots.map((shot, i) => (
              <div
                key={i}
                className="snap-center shrink-0 w-[280px] sm:w-[340px] lg:w-[400px] rounded-xl overflow-hidden border border-ink/10 bg-canvas shadow-md"
              >
                <div className="aspect-video bg-surface-cool flex items-center justify-center overflow-hidden">
                  <img
                    src={shot.src}
                    alt={shot.alt}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
