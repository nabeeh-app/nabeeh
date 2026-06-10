'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle, MessageSquare, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

const painIcons = [AlertTriangle, MessageSquare, Eye];

export function ProblemSection() {
  const t = useTranslations('landing.problem');

  const points = [
    { key: 'spreadsheets', icon: painIcons[0] },
    { key: 'whatsapp', icon: painIcons[1] },
    { key: 'tracking', icon: painIcons[2] },
  ] as const;

  return (
    <section className="py-20 bg-surface-sage/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-ink font-display mb-4">
            {t('title')}
          </h2>
          <p className="text-lg text-ink/60 font-body max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {points.map(({ key, icon: Icon }) => (
            <div key={key} className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <Icon className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold text-ink font-display">
                {t(`points.${key}.title`)}
              </h3>
              <p className="text-sm text-ink/60 font-body">
                {t(`points.${key}.description`)}
              </p>
            </div>
          ))}
        </div>

        <div className="text-center bg-canvas rounded-xl border border-ink/10 p-8 max-w-2xl mx-auto">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 200 240" fill="none" className="w-8 h-10">
              <defs>
                <linearGradient id="solBodyGrad" x1="100" y1="40" x2="100" y2="200" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#05c4b8" />
                  <stop offset="1" stopColor="#026370" />
                </linearGradient>
              </defs>
              <ellipse cx="100" cy="112" rx="74" ry="82" fill="url(#solBodyGrad)" />
              <circle cx="70" cy="110" r="32" stroke="white" strokeWidth="6" fill="none" />
              <circle cx="130" cy="110" r="32" stroke="white" strokeWidth="6" fill="none" />
              <ellipse cx="70" cy="112" rx="11" ry="12" fill="#083d44" />
              <circle cx="66" cy="108" r="4" fill="white" />
              <ellipse cx="130" cy="112" rx="11" ry="12" fill="#083d44" />
              <circle cx="126" cy="108" r="4" fill="white" />
              <path d="M86 142Q100 154 114 142" stroke="#083d44" strokeWidth="3.5" strokeLinecap="round" fill="none" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-ink font-display mb-2">
            {t('solution.title')}
          </h3>
          <p className="text-ink/60 font-body">{t('solution.description')}</p>
        </div>
      </div>
    </section>
  );
}
