'use client';

import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function CTASection() {
  const t = useTranslations('landing.cta');
  const locale = useLocale();
  const isRTL = locale === 'ar';

  return (
    <section className="py-20">
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <div className={cn('relative bg-ink rounded-3xl p-10 pt-16 text-center overflow-visible', isRTL && 'font-arabic')}>
          <h2
            className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-accent font-extrabold font-display"
            style={{ fontSize: 'clamp(1.25rem, 4vw, 2.5rem)' }}
          >
            {t('title')}
          </h2>

          <div className="relative">
            <Button
              size="lg"
              className="bg-accent text-ink hover:bg-accent/90 font-body font-semibold text-base px-10 py-6 h-auto rounded-xl"
              asChild
            >
              <Link href={`/${locale}/register`}>{t('button')}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
