'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { cn } from '@/lib/utils';

export function CookieNotice() {
  const [isVisible, setIsVisible] = useState(false);
  const locale = useLocale();
  const isAr = locale === 'ar';
  const t = useTranslations('cookie');
  const isRTL = isAr;

  useEffect(() => {
    const consent = localStorage.getItem('nabeeh-cookie-consent');
    if (!consent) {
      requestAnimationFrame(() => setIsVisible(true));
    }
  }, []);

  const accept = () => {
    localStorage.setItem('nabeeh-cookie-consent', 'accepted');
    setIsVisible(false);
  };

  const reject = () => {
    localStorage.setItem('nabeeh-cookie-consent', 'rejected');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 sm:p-6">
      <div
        className={cn(
          "max-w-2xl mx-auto bg-ink text-canvas rounded-xl shadow-2xl p-6 border border-canvas/10",
          isRTL && "font-arabic"
        )}
      >
        <p className="text-sm font-body text-canvas/80 mb-4">
          {t('message')}
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={reject}
            className="px-4 py-2 text-sm font-body text-canvas/60 hover:text-canvas transition-colors"
          >
            {t('reject')}
          </button>
          <button
            onClick={accept}
            className="px-4 py-2 text-sm font-body bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            {t('accept')}
          </button>
        </div>
      </div>
    </div>
  );
}
