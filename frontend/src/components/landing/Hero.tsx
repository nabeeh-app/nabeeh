'use client';

import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { WhatsAppDemo } from './WhatsAppDemo';
import { cn } from '@/lib/utils';

export function Hero() {
  const t = useTranslations('landing.hero');
  const locale = useLocale();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <section dir={dir} className={cn('relative pt-24 pb-16 lg:pt-32 lg:pb-24 overflow-hidden max-w-7xl mx-auto px-4 sm:px-6 lg:px-8')}>
      <div dir={dir} className={cn('grid lg:grid-cols-2 gap-12 lg:gap-16 items-center')}>
        {/* Left — Headline + CTAs */}
        <div className={cn('space-y-8', 'lg:text-end')} dir={dir}>
          <h1 dir={dir} className="hero-title text-4xl sm:text-5xl lg:text-6xl font-bold text-ink font-display leading-tight tracking-tight">
            {t('title')}
          </h1>
          <p dir={dir} className="hero-subtitle text-lg text-ink/70 font-body max-w-lg leading-relaxed">
            {t('subtitle')}
          </p>
          <div className={cn('flex flex-wrap gap-4', 'justify-start lg:justify-end')}>
            <Button size="lg" asChild>
              <Link href={`/${locale}/register`}>{t('cta.start')}</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href={`/${locale}/login`}>{t('cta.login')}</Link>
            </Button>
          </div>
        </div>

        {/* Right — WhatsApp Demo */}
        <div dir={dir} className="flex justify-center lg:justify-end">
          <WhatsAppDemo />
        </div>
      </div>
    </section>
  );
}
