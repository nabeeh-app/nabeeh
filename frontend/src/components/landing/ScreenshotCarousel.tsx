'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
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
  const locale = useLocale();
  const isRTL = locale === 'ar';
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollButtons, { passive: true });
    updateScrollButtons();
    const observer = new ResizeObserver(updateScrollButtons);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollButtons);
      observer.disconnect();
    };
  }, [updateScrollButtons]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.7;
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);

  const navigateLightbox = (direction: 'left' | 'right') => {
    if (lightboxIndex === null) return;
    if (direction === 'right') {
      setLightboxIndex((lightboxIndex + 1) % screenshots.length);
    } else {
      setLightboxIndex((lightboxIndex - 1 + screenshots.length) % screenshots.length);
    }
  };

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') navigateLightbox('right');
      if (e.key === 'ArrowLeft') navigateLightbox('left');
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [lightboxIndex]);

  return (
    <>
      <section id="screenshots" className="py-20 bg-surface-sage/50 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-ink font-display mb-4">
              {t('title')}
            </h2>
            <p className="text-lg text-ink/70 font-body">{t('subtitle')}</p>
          </div>

          <div className="relative">
            {canScrollLeft && (
              <button
                onClick={() => scroll('left')}
                aria-label="Scroll left"
                className={cn(
                  'absolute top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-canvas border border-ink/10 shadow-md flex items-center justify-center hover:bg-surface-cool transition-colors cursor-pointer',
                  isRTL ? 'right-0 -mr-2' : 'left-0 -ml-2'
                )}
              >
                <ChevronLeft className="w-5 h-5 text-ink" />
              </button>
            )}
            {canScrollRight && (
              <button
                onClick={() => scroll('right')}
                aria-label="Scroll right"
                className={cn(
                  'absolute top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-canvas border border-ink/10 shadow-md flex items-center justify-center hover:bg-surface-cool transition-colors cursor-pointer',
                  isRTL ? 'left-0 -ml-2' : 'right-0 -mr-2'
                )}
              >
                <ChevronRight className="w-5 h-5 text-ink" />
              </button>
            )}

            <div
              ref={scrollRef}
              dir="ltr"
              className="flex gap-6 overflow-x-auto snap-x snap-mandatory pb-4 scroll-smooth"
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <style>{`#screenshots [style*="scrollbarWidth"]::-webkit-scrollbar { display: none; }`}</style>
              {screenshots.map((shot, i) => (
                <button
                  key={i}
                  onClick={() => openLightbox(i)}
                  className="snap-center shrink-0 w-[280px] sm:w-[340px] lg:w-[400px] rounded-xl overflow-hidden border border-ink/10 bg-canvas shadow-md hover:shadow-lg transition-shadow cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <div className="aspect-video bg-surface-cool flex items-center justify-center overflow-hidden">
                    <img
                      src={shot.src}
                      alt={shot.alt}
                      className="w-full h-full object-cover pointer-events-none"
                      loading="lazy"
                      onLoad={updateScrollButtons}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-deep/90 backdrop-blur-sm"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-canvas/20 flex items-center justify-center hover:bg-canvas/40 transition-colors cursor-pointer"
          >
            <X className="w-6 h-6 text-canvas" />
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); navigateLightbox('left'); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-canvas/20 flex items-center justify-center hover:bg-canvas/40 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-7 h-7 text-canvas" />
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); navigateLightbox('right'); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-canvas/20 flex items-center justify-center hover:bg-canvas/40 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-7 h-7 text-canvas" />
          </button>

          <img
            src={screenshots[lightboxIndex].src}
            alt={screenshots[lightboxIndex].alt}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
            {screenshots.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(i); }}
                className={cn(
                  'w-2 h-2 rounded-full transition-colors cursor-pointer',
                  i === lightboxIndex ? 'bg-canvas' : 'bg-canvas/40'
                )}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
