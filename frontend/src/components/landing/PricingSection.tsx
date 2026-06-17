'use client';

import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const tiers = ['free', 'pro', 'center'] as const;

export function PricingSection() {
  const t = useTranslations('landing.pricing');
  const tTiers = useTranslations('landing.pricing.tiers');
  const locale = useLocale();
  const isRTL = locale === 'ar';

  return (
    <section id="pricing" className="py-20 scroll-mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-ink font-display mb-4">
            {t('title')}
          </h2>
          <p className="text-lg text-ink/70 font-body max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {tiers.map((tier) => {
            const isAvailable = tier === 'free';
            return (
              <Card
                key={tier}
                className={cn(
                  'border-ink/10 bg-canvas relative overflow-hidden h-full',
                  tier === 'pro' && 'border-primary/30 shadow-md'
                )}
              >
                {tier === 'pro' && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
                )}
                <CardContent className="p-6 flex flex-col h-full">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-xl font-bold text-ink font-display">
                        {tTiers(`${tier}.name`)}
                      </h3>
                      {!isAvailable && (
                        <Badge variant="secondary" className="text-[10px]">
                          {t('comingSoon')}
                        </Badge>
                      )}
                    </div>
                    <p className={cn('text-sm text-ink/70 font-body', isRTL && 'text-right')}>
                      {tTiers(`${tier}.description`)}
                    </p>
                  </div>

                  <div className={cn('text-2xl font-bold text-ink font-display mt-4', isRTL && 'text-right')}>
                    {isAvailable ? (
                      <span className="text-primary">{tTiers(`${tier}.price`)}</span>
                    ) : (
                      tTiers(`${tier}.price`)
                    )}
                    {tTiers(`${tier}.period`) && (
                      <span className="text-sm font-normal text-ink/50 ml-1">
                        / {tTiers(`${tier}.period`)}
                      </span>
                    )}
                  </div>

                  <ul className="mt-4 space-y-3">
                    {['features.0', 'features.1', 'features.2', 'features.3', 'features.4'].map(
                      (fKey) => (
                        <li key={fKey} className="flex items-start gap-2 text-sm text-ink/70 font-body">
                          <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          <span>{tTiers(`${tier}.${fKey}`)}</span>
                        </li>
                      )
                    )}
                  </ul>

                  <div className="mt-auto pt-6">
                    {isAvailable ? (
                      <Button className="w-full" variant="outline" asChild>
                        <Link href={`/${locale}/register`}>{tTiers(`${tier}.cta`)}</Link>
                      </Button>
                    ) : (
                      <Button className="w-full" variant={tier === 'pro' ? 'default' : 'outline'} disabled>
                        {tTiers(`${tier}.cta`)}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
