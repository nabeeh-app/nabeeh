'use client';

import { useTranslations } from 'next-intl';
import { FeatureCard } from './FeatureCard';
import { CheckCircle, BarChart3, MessageCircle, Send, PieChart, Users } from 'lucide-react';

const featureKeys = [
  { key: 'attendance', icon: CheckCircle },
  { key: 'grades', icon: BarChart3 },
  { key: 'whatsapp', icon: MessageCircle },
  { key: 'communication', icon: Send },
  { key: 'reports', icon: PieChart },
  { key: 'groups', icon: Users },
] as const;

export function FeaturesSection() {
  const t = useTranslations('landing.features');

  return (
    <section id="features" className="py-20 scroll-mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-ink font-display mb-4">
            {t('title')}
          </h2>
          <p className="text-lg text-ink/70 font-body max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featureKeys.map(({ key, icon }) => (
            <FeatureCard
              key={key}
              icon={icon}
              title={t(`${key}.title`)}
              description={t(`${key}.description`)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
