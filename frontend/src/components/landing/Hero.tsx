'use client';

import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { WhatsAppDemo } from './WhatsAppDemo';
import { cn } from '@/lib/utils';

export function Hero() {
  const t = useTranslations('landing.hero');
  const locale = useLocale();
  const isRTL = locale === 'ar';

  return (
    <section className={cn('relative pt-24 pb-16 lg:pt-32 lg:pb-24 overflow-hidden')}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={cn('grid lg:grid-cols-2 gap-12 lg:gap-16 items-center')}>
          {/* Left — Headline + CTAs */}
          <div className={cn('space-y-8', isRTL ? 'lg:text-right' : 'lg:text-left')}>
            <h1 className="hero-title text-4xl sm:text-5xl lg:text-6xl font-bold text-ink font-display leading-tight tracking-tight">
              {t('title')}
            </h1>
            <p className="hero-subtitle text-lg text-ink/70 font-body max-w-lg leading-relaxed">
              {t('subtitle')}
            </p>
            <div className={cn('flex flex-wrap gap-4', isRTL ? 'flex-row-reverse justify-end' : 'justify-start')}>
              <Button size="lg" asChild>
                <Link href={`/${locale}/register`}>{t('cta.start')}</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href={`/${locale}/login`}>{t('cta.login')}</Link>
              </Button>
            </div>
          </div>

          {/* Right — WhatsApp Demo */}
          <div className="flex justify-center lg:justify-end">
            <WhatsAppDemo />
          </div>
        </div>
      </div>
    </section>
  );
}
