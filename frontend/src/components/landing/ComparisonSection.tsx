'use client';

import { useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';

const features = [
  { key: 'attendance', nabeeh: true, spreadsheets: false },
  { key: 'grades', nabeeh: true, spreadsheets: false },
  { key: 'whatsapp', nabeeh: true, spreadsheets: false },
  { key: 'reports', nabeeh: true, spreadsheets: false },
  { key: 'multiGroup', nabeeh: true, spreadsheets: false },
  { key: 'arabic', nabeeh: true, spreadsheets: false },
] as const;

export function ComparisonSection() {
  const t = useTranslations('landing.comparison');

  return (
    <section id="comparison" className="py-20 bg-surface-sage/50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-ink font-display mb-4">
            {t('title')}
          </h2>
          <p className="text-lg text-ink/60 font-body max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        <div className="bg-canvas rounded-xl border border-ink/10 overflow-hidden">
          <div className="grid grid-cols-3 bg-surface-sage/30 border-b border-ink/10">
            <div className="p-4 font-display font-semibold text-ink">
              {t('feature')}
            </div>
            <div className="p-4 font-display font-semibold text-ink text-center">
              {t('spreadsheets')}
            </div>
            <div className="p-4 font-display font-semibold text-primary text-center">
              {t('nabeeh')}
            </div>
          </div>

          {features.map(({ key, nabeeh, spreadsheets }) => (
            <div key={key} className="grid grid-cols-3 border-b border-ink/5 last:border-0">
              <div className="p-4 font-body text-ink">
                {t(`features.${key}`)}
              </div>
              <div className="p-4 flex justify-center items-center">
                {spreadsheets ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : (
                  <X className="w-5 h-5 text-destructive" />
                )}
              </div>
              <div className="p-4 flex justify-center items-center">
                <Check className="w-5 h-5 text-primary" />
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <p className="text-sm text-ink/60 font-body">
            {t('note')}
          </p>
        </div>
      </div>
    </section>
  );
}
