'use client';

import { useEffect } from 'react';
import { useLocale } from 'next-intl';

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useLocale();

  // Initial dir/lang is set by inline script in root layout.tsx <head>
  // This effect handles client-side locale switches (SPA navigations)
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.body.classList.toggle('font-arabic', locale === 'ar');
  }, [locale]);

  return <>{children}</>;
}
