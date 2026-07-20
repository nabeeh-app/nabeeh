'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { setConsent } from '@/lib/consent';

export function CookieNotice() {
  const [isVisible, setIsVisible] = useState(false);
  const t = useTranslations('cookie');

  useEffect(() => {
    const consent = localStorage.getItem('nabeeh-cookie-consent');
    if (!consent) {
      requestAnimationFrame(() => setIsVisible(true));
    }
  }, []);

  const accept = () => {
    setConsent('accepted');
    setIsVisible(false);
  };

  const reject = () => {
    setConsent('rejected');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 sm:p-6 pointer-events-none">
      <div
        className="max-w-2xl mx-auto bg-ink text-canvas rounded-xl shadow-2xl p-6 border border-canvas/10 pointer-events-auto"
      >
        <p className="text-sm font-body text-canvas/80 mb-4">
          {t('message')}
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={reject}>{t('reject')}</Button>
          <Button onClick={accept}>{t('accept')}</Button>
        </div>
      </div>
    </div>
  );
}
